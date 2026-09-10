from asyncio import timeouts
from asyncio import exceptions
from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal
import io
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import func
import pandas as pd
# pyrefly: ignore [missing-import]
import pdfplumber

from database import get_db
import models
from models import (
    Shipment, ShipmentSequence, Customer, ShipmentCustomer,
    ShipmentProduct, ShipmentActual, TariffLine, ItemEntry,
    ShipmentProductRemovalHistory, ShipmentActivityLog
)
import schemas
from schemas import (
    ShipmentCreate, ShipmentConfigUpdate, ShipmentResponse,
    ShipmentProductCreate, ShipmentProductUpdate, ShipmentProductResponse,
    ShipmentActualUpdate, ShipmentActualResponse, DashboardSummaryResponse, CustomerProfitSummary,
    BulkSoftRemoveRequest, ShipmentProductRemovalHistoryResponse
)
from calculation_engine import recalculate_shipment

router = APIRouter(prefix="/api/v1/shipments", tags=["Shipments"])

def get_current_financial_year() -> str:
    """Generates financial year string like 2026-27."""
    now = datetime.now()
    year = now.year
    if now.month >= 4:
        return f"{year}-{str(year + 1)[-2:]}"
    else:
        return f"{year - 1}-{str(year)[-2:]}"


@router.get("/next-number")
def get_next_shipment_number(financial_year: Optional[str] = None, db: Session = Depends(get_db)):
    fy = financial_year or get_current_financial_year()
    seq_record = db.query(ShipmentSequence).filter(ShipmentSequence.financial_year == fy).first()
    next_seq = (seq_record.last_sequence + 1) if seq_record else 1
    return {
        "financial_year": fy,
        "next_sequence": next_seq,
        "shipment_no": f"AEC/{next_seq}/{fy}"
    }


@router.get("", response_model=List[ShipmentResponse])
def get_shipments(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).order_by(Shipment.id.desc()).all()
    if not shipments:
        try:
            from mongo_sync import restore_shipments_from_mongo
            restore_shipments_from_mongo(db)
            db.expire_all()
            shipments = db.query(Shipment).order_by(Shipment.id.desc()).all()
        except Exception as e:
            print(f"Auto-restore from Mongo error: {e}")

    res = []
    for s in shipments:
        try:
            custs = [sc.customer for sc in s.customers if sc.customer]
            products_resp = []
            for p in s.products:
                p_dict = ShipmentProductResponse.model_validate(p)
                cust_obj = next((c for c in custs if c.id == p.customer_id), None)
                p_dict.customer_name = cust_obj.name if cust_obj else "Unknown"
                products_resp.append(p_dict)

            po_resp = []
            for po in (s.purchase_orders or []):
                try:
                    po_resp.append(schemas.ShipmentPurchaseOrderResponse.model_validate(po, from_attributes=True))
                except Exception:
                    pass

            actual_resp = None
            if s.actuals:
                try:
                    actual_resp = schemas.ShipmentActualResponse.model_validate(s.actuals, from_attributes=True)
                except Exception:
                    pass

            s_resp = ShipmentResponse(
                id=s.id,
                shipment_no=s.shipment_no,
                sequence_number=s.sequence_number,
                financial_year=s.financial_year,
                shipment_date=s.shipment_date,
                status=s.status,
                destination=s.destination or "Colombo Port, Sri Lanka",
                currency=s.currency or "INR",
                current_stage=s.current_stage or "1_SHIPMENT_CREATION",
                usd_rate=s.usd_rate,
                lkr_inr_rate=s.lkr_inr_rate,
                profit_margin_pct=s.profit_margin_pct,
                indian_invoice_margin_pct=s.indian_invoice_margin_pct,
                colombo_invoice_margin_pct=s.colombo_invoice_margin_pct,
                common_expenses_inr=s.common_expenses_inr,
                common_expenses_lkr=s.common_expenses_lkr,
                notes=s.notes,
                created_at=s.created_at,
                updated_at=s.updated_at,
                customers=custs,
                products=products_resp,
                actuals=actual_resp,
                purchase_orders=po_resp
            )
            res.append(s_resp)
        except Exception as e:
            print(f"Error serializing shipment #{s.id}: {e}")

    return res


def resolve_customer_ids(
    db: Session,
    customer_ids: Optional[List[int]],
    customer_names: Optional[List[str]],
    customer_addresses: Optional[List[str]] = None,
    customer_details: Optional[List[Dict[str, Any]]] = None
) -> List[int]:
    final_ids = set(customer_ids or [])
    
    if customer_details:
        for c_dict in customer_details:
            if not isinstance(c_dict, dict):
                continue
            c_name = (c_dict.get("name") or "").strip()
            if not c_name:
                continue
            
            c_code = c_dict.get("code") or f"CUST-{(db.query(Customer).count() + 1):03d}"
            c_phone = c_dict.get("phone")
            c_email = c_dict.get("email")
            c_addr = c_dict.get("address")
            c_country = c_dict.get("country") or "Sri Lanka"
            c_tax = c_dict.get("tax_id")

            cust = db.query(Customer).filter(Customer.name.ilike(c_name)).first()
            if not cust:
                cust = Customer(
                    name=c_name,
                    code=c_code,
                    phone=c_phone,
                    email=c_email,
                    address=c_addr,
                    country=c_country,
                    tax_id=c_tax
                )
                db.add(cust)
                db.flush()
            else:
                if c_phone: cust.phone = c_phone
                if c_email: cust.email = c_email
                if c_addr: cust.address = c_addr
                if c_country: cust.country = c_country
                if c_tax: cust.tax_id = c_tax
            final_ids.add(cust.id)

    elif customer_names:
        for idx, name in enumerate(customer_names):
            c_name = (name or "").strip()
            if not c_name:
                continue
            addr = customer_addresses[idx] if (customer_addresses and idx < len(customer_addresses)) else None
            cust = db.query(Customer).filter(Customer.name.ilike(c_name)).first()
            if not cust:
                code = f"CUST-{(db.query(Customer).count() + 1):03d}"
                cust = Customer(name=c_name, code=code, address=addr, country="Sri Lanka")
                db.add(cust)
                db.flush()
            else:
                if addr:
                    cust.address = addr
            final_ids.add(cust.id)
            
    return list(final_ids)


@router.post("", response_model=ShipmentResponse)
def create_shipment(payload: ShipmentCreate, db: Session = Depends(get_db)):
    fy = payload.financial_year or get_current_financial_year()
    
    # Atomic sequence counter logic
    seq_record = db.query(ShipmentSequence).filter(ShipmentSequence.financial_year == fy).first()
    if not seq_record:
        seq_record = ShipmentSequence(financial_year=fy, last_sequence=1)
        db.add(seq_record)
        seq_num = 1
    else:
        seq_record.last_sequence += 1
        seq_num = seq_record.last_sequence
        
    shipment_no = f"AEC/{seq_num}/{fy}"
    
    shipment = Shipment(
        shipment_no=shipment_no,
        sequence_number=seq_num,
        financial_year=fy,
        shipment_date=payload.shipment_date or datetime.now().strftime("%Y-%m-%d"),
        status="DRAFT",
        destination=payload.destination or "Colombo Port, Sri Lanka",
        currency=payload.currency or "INR",
        current_stage="1_SHIPMENT_CREATION",
        usd_rate=payload.usd_rate or Decimal("1.0"),
        lkr_inr_rate=payload.lkr_inr_rate or Decimal("1.0"),
        profit_margin_pct=payload.profit_margin_pct or Decimal("15.0"),
        indian_invoice_margin_pct=payload.indian_invoice_margin_pct if payload.indian_invoice_margin_pct is not None else (payload.profit_margin_pct or Decimal("15.0")),
        colombo_invoice_margin_pct=payload.colombo_invoice_margin_pct if payload.colombo_invoice_margin_pct is not None else (payload.profit_margin_pct or Decimal("15.0")),
        common_expenses_inr=payload.common_expenses_inr or Decimal("0.0"),
        common_expenses_lkr=payload.common_expenses_lkr or Decimal("0.0"),
        notes=payload.notes
    )
    db.add(shipment)
    db.flush()

    c_ids = resolve_customer_ids(db, payload.customer_ids, payload.customer_names, payload.customer_addresses, payload.customer_details)
    for c_id in c_ids:
        sc = ShipmentCustomer(shipment_id=shipment.id, customer_id=c_id)
        db.add(sc)

    # Initialize actuals record
    actual = ShipmentActual(shipment_id=shipment.id)
    db.add(actual)

    db.commit()
    db.refresh(shipment)
    try:
        from mongo_sync import sync_shipment_to_mongo
        sync_shipment_to_mongo(shipment.id)
    except Exception as e:
        print(f"Mongo sync notice: {e}")
    return get_shipment_details(shipment.id, db)


@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment_details(shipment_id: int, db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
        
    custs = [sc.customer for sc in s.customers if sc.customer]
    products_resp = []
    for p in s.products:
        p_dict = ShipmentProductResponse.model_validate(p)
        cust_obj = next((c for c in custs if c.id == p.customer_id), None)
        p_dict.customer_name = cust_obj.name if cust_obj else "Unknown"
        products_resp.append(p_dict)

    return ShipmentResponse(
        id=s.id,
        shipment_no=s.shipment_no,
        sequence_number=s.sequence_number,
        financial_year=s.financial_year,
        shipment_date=s.shipment_date,
        status=s.status,
        destination=s.destination or "Colombo Port, Sri Lanka",
        currency=s.currency or "INR",
        current_stage=s.current_stage or "1_SHIPMENT_CREATION",
        usd_rate=s.usd_rate,
        lkr_inr_rate=s.lkr_inr_rate,
        profit_margin_pct=s.profit_margin_pct,
        indian_invoice_margin_pct=s.indian_invoice_margin_pct,
        colombo_invoice_margin_pct=s.colombo_invoice_margin_pct,
        common_expenses_inr=s.common_expenses_inr,
        common_expenses_lkr=s.common_expenses_lkr,
        notes=s.notes,
        created_at=s.created_at,
        updated_at=s.updated_at,
        customers=custs,
        products=products_resp,
        actuals=schemas.ShipmentActualResponse.model_validate(s.actuals, from_attributes=True) if s.actuals else None,
        purchase_orders=[schemas.ShipmentPurchaseOrderResponse.model_validate(po, from_attributes=True) for po in (s.purchase_orders or [])]
    )


@router.put("/{shipment_id}/config", response_model=ShipmentResponse)
def update_shipment_config(shipment_id: int, payload: ShipmentConfigUpdate, db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if payload.shipment_date is not None:
        s.shipment_date = payload.shipment_date
    if payload.status is not None:
        s.status = payload.status
    if payload.destination is not None:
        s.destination = payload.destination
    if payload.currency is not None:
        s.currency = payload.currency
    if payload.current_stage is not None:
        s.current_stage = payload.current_stage
    if payload.usd_rate is not None:
        s.usd_rate = payload.usd_rate
    if payload.lkr_inr_rate is not None:
        s.lkr_inr_rate = payload.lkr_inr_rate
    if payload.profit_margin_pct is not None:
        s.profit_margin_pct = payload.profit_margin_pct
    if payload.indian_invoice_margin_pct is not None:
        s.indian_invoice_margin_pct = payload.indian_invoice_margin_pct
    if payload.colombo_invoice_margin_pct is not None:
        s.colombo_invoice_margin_pct = payload.colombo_invoice_margin_pct
    if payload.margin_mode is not None:
        s.margin_mode = payload.margin_mode
    if payload.common_expenses_inr is not None:
        s.common_expenses_inr = payload.common_expenses_inr
    if payload.common_expenses_lkr is not None:
        s.common_expenses_lkr = payload.common_expenses_lkr
    if payload.notes is not None:
        s.notes = payload.notes

    if payload.customer_ids is not None or payload.customer_names is not None or payload.customer_addresses is not None or payload.customer_details is not None:
        db.query(ShipmentCustomer).filter(ShipmentCustomer.shipment_id == shipment_id).delete()
        c_ids = resolve_customer_ids(db, payload.customer_ids, payload.customer_names, payload.customer_addresses, payload.customer_details)
        for c_id in c_ids:
            sc = ShipmentCustomer(shipment_id=shipment_id, customer_id=c_id)
            db.add(sc)

    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


def format_sub_hsn(base_hsn: str, index: int) -> str:
    if not base_hsn:
        return ""
    clean = base_hsn.strip()
    if "." in clean:
        parts = clean.split(".")
        prefix = ".".join(parts[:-1])
        last_part = parts[-1]
        if last_part.isdigit():
            width = max(2, len(last_part))
            base_val = int(last_part)
            if base_val % 10 != 0 and base_val > 10:
                base_val = (base_val // 10) * 10
            elif base_val < 10 and base_val > 0:
                base_val = 0
            new_val = base_val + index
            return f"{prefix}.{new_val:0{width}d}"
        return f"{clean}.{index:02d}"
    else:
        if clean.isdigit() and len(clean) >= 6:
            base_val = int(clean)
            width = len(clean)
            if base_val % 10 != 0:
                base_val = (base_val // 10) * 10
            new_val = base_val + index
            return f"{new_val:0{width}d}"
        return f"{clean}.{index:02d}"


@router.post("/{shipment_id}/products", response_model=ShipmentResponse)
def add_product(shipment_id: int, payload: ShipmentProductCreate, db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    clean_name = payload.product_name.strip()
    raw_hsn = payload.hsn_code.strip() if payload.hsn_code else None
    assigned_hsn = raw_hsn

    if raw_hsn:
        if "." in raw_hsn and len(raw_hsn.split(".")) >= 3:
            parts = raw_hsn.split(".")
            base_prefix = ".".join(parts[:2])
        else:
            base_prefix = raw_hsn[:6]

        existing_count = db.query(func.count(ShipmentProduct.id)).filter(
            ShipmentProduct.shipment_id == shipment_id,
            ShipmentProduct.hsn_code.like(f"{base_prefix}%")
        ).scalar() or 0

        assigned_hsn = format_sub_hsn(raw_hsn, existing_count + 1)

    p = ShipmentProduct(
        shipment_id=shipment_id,
        customer_id=payload.customer_id,
        product_name=clean_name,
        product_category=payload.product_category,
        hsn_code=assigned_hsn,
        quantity=payload.quantity,
        weight_val=payload.weight_val or Decimal("0.0"),
        weight_unit=payload.weight_unit or "KG",
        unit=payload.unit or "PCS",
        purchase_price=payload.purchase_price,
        currency=payload.currency or "INR"
    )
    db.add(p)

    # Save to Favorites / Item Master if requested
    if payload.save_to_favorite:
        entry = db.query(ItemEntry).filter(func.lower(ItemEntry.item_name) == clean_name.lower()).first()
        if not entry:
            entry = ItemEntry(item_name=clean_name)
            db.add(entry)
        entry.item_category = payload.product_category
        entry.unit = payload.unit or "PCS"
        entry.currency = payload.currency or "INR"
        entry.hs_code = assigned_hsn
        entry.purchase_price = payload.purchase_price
        entry.weight_val = payload.weight_val or Decimal("0.0")
        entry.weight_unit = payload.weight_unit or "KG"
        entry.is_favorite = True

    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


@router.put("/{shipment_id}/products/{product_id}", response_model=ShipmentResponse)
def update_product(shipment_id: int, product_id: int, payload: ShipmentProductUpdate, db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    p = db.query(ShipmentProduct).filter(ShipmentProduct.id == product_id, ShipmentProduct.shipment_id == shipment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found in this shipment")

    if payload.customer_id is not None:
        p.customer_id = payload.customer_id
    if payload.product_name is not None:
        p.product_name = payload.product_name.strip()
    if payload.product_category is not None:
        p.product_category = payload.product_category
    if payload.hsn_code is not None:
        p.hsn_code = payload.hsn_code.strip()
    if payload.quantity is not None:
        p.quantity = payload.quantity
    if payload.weight_val is not None:
        p.weight_val = payload.weight_val
    if payload.weight_unit is not None:
        p.weight_unit = payload.weight_unit
    if payload.unit is not None:
        p.unit = payload.unit
    if payload.purchase_price is not None:
        p.purchase_price = payload.purchase_price
    if payload.currency is not None:
        p.currency = payload.currency
    if payload.final_quotation_price is not None:
        p.final_quotation_price = payload.final_quotation_price

    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


@router.delete("/{shipment_id}/products/{product_id}", response_model=ShipmentResponse)
def delete_product(shipment_id: int, product_id: int, db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    p = db.query(ShipmentProduct).filter(ShipmentProduct.id == product_id, ShipmentProduct.shipment_id == shipment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found in shipment")

    db.delete(p)
    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


@router.post("/{shipment_id}/products/{product_id}/remove", response_model=ShipmentResponse)
def soft_remove_product(
    shipment_id: int,
    product_id: int,
    reason: Optional[str] = "Customer requested removal from quotation",
    removed_by: Optional[str] = "System User",
    db: Session = Depends(get_db)
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    p = db.query(ShipmentProduct).filter(ShipmentProduct.id == product_id, ShipmentProduct.shipment_id == shipment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found in shipment")

    prev_state = {"product_name": p.product_name, "quantity": float(p.quantity), "price": float(p.final_quotation_price or 0.0), "is_active": p.is_active}
    
    p.is_active = False
    p.stage_status = "REMOVED"
    
    new_state = {"product_name": p.product_name, "quantity": 0.0, "is_active": False}

    # Store Removal Audit History
    removal_hist = models.ShipmentProductRemovalHistory(
        shipment_id=shipment_id,
        product_id=product_id,
        product_name=p.product_name,
        quantity=p.quantity,
        removed_by=removed_by,
        reason=reason,
        previous_state=prev_state,
        new_state=new_state
    )
    db.add(removal_hist)

    # Activity Log
    act_log = models.ShipmentActivityLog(
        shipment_id=shipment_id,
        stage_name="CUSTOMER_APPROVAL",
        action_type="REMOVE",
        action_title=f"Soft-Removed Product: {p.product_name}",
        details=f"Product removed by {removed_by}. Reason: {reason}"
    )
    db.add(act_log)

    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


@router.post("/{shipment_id}/products/bulk-soft-remove", response_model=ShipmentResponse)
def bulk_soft_remove_products(
    shipment_id: int,
    payload: schemas.BulkSoftRemoveRequest,
    db: Session = Depends(get_db)
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    removed_count = 0
    removed_names = []

    for pid in payload.product_ids:
        p = db.query(ShipmentProduct).filter(ShipmentProduct.id == pid, ShipmentProduct.shipment_id == shipment_id).first()
        if p and p.is_active:
            prev_state = {"product_name": p.product_name, "quantity": float(p.quantity), "price": float(p.final_quotation_price or 0.0), "is_active": p.is_active}
            p.is_active = False
            p.stage_status = "REMOVED"
            new_state = {"product_name": p.product_name, "quantity": 0.0, "is_active": False}

            hist = models.ShipmentProductRemovalHistory(
                shipment_id=shipment_id,
                product_id=p.id,
                product_name=p.product_name,
                quantity=p.quantity,
                removed_by=payload.removed_by or "Sales Agent",
                reason=payload.reason or "Customer requested removal from quotation",
                previous_state=prev_state,
                new_state=new_state
            )
            db.add(hist)
            removed_count += 1
            removed_names.append(p.product_name)

    if removed_count > 0:
        act_log = models.ShipmentActivityLog(
            shipment_id=shipment_id,
            stage_name="CUSTOMER_APPROVAL",
            action_type="REMOVE",
            action_title=f"Bulk Soft-Removed {removed_count} Products",
            details=f"Products removed: {', '.join(removed_names[:5])}{'...' if len(removed_names) > 5 else ''}. Reason: {payload.reason}"
        )
        db.add(act_log)

    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


@router.get("/{shipment_id}/removal-history", response_model=List[schemas.ShipmentProductRemovalHistoryResponse])
def get_shipment_removal_history(shipment_id: int, db: Session = Depends(get_db)):
    return db.query(models.ShipmentProductRemovalHistory).filter(
        models.ShipmentProductRemovalHistory.shipment_id == shipment_id
    ).order_by(models.ShipmentProductRemovalHistory.removed_at.desc()).all()


@router.post("/{shipment_id}/approve-quotation-and-create-po", response_model=ShipmentResponse)
def approve_quotation_and_create_po(
    shipment_id: int,
    payload: Optional[schemas.ApproveQuotationRequest] = None,
    db: Session = Depends(get_db)
):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Filter ONLY active approved products (Req 16: initial requirements not treated as confirmed purchases)
    active_products = db.query(ShipmentProduct).filter(
        ShipmentProduct.shipment_id == shipment_id,
        ShipmentProduct.is_active == True
    ).all()

    if not active_products:
        raise HTTPException(status_code=400, detail="No active approved products found to generate Purchase Orders")

    approved_by = payload.approved_by if payload else "Customer Representative"
    approval_notes = payload.approval_notes if payload else "Customer approved preliminary quotation after product adjustments"

    # Advance shipment stage to 9_PURCHASE
    s.current_stage = "9_PURCHASE"

    # Group approved active products by allocated vendor or assign default vendor
    allocs = db.query(models.ShipmentVendorAllocation).filter(
        models.ShipmentVendorAllocation.shipment_id == shipment_id
    ).all()

    vendor_ids = list({a.vendor_id for a in allocs})
    if not vendor_ids:
        v_def = db.query(models.Vendor).first()
        if v_def:
            vendor_ids = [v_def.id]

    pos_created = []
    today_str = datetime.now().strftime("%Y-%m-%d")

    for v_id in vendor_ids:
        po_total = Decimal("0.0")
        for p in active_products:
            po_total += (p.purchase_price or Decimal("0.0")) * (p.quantity or Decimal("1.0"))

        existing_po = db.query(models.ShipmentPurchaseOrder).filter(
            models.ShipmentPurchaseOrder.shipment_id == shipment_id,
            models.ShipmentPurchaseOrder.vendor_id == v_id
        ).first()

        po_no = f"PO-{s.shipment_no}-{v_id}"
        if existing_po:
            existing_po.total_amount = po_total
            existing_po.status = "CONFIRMED"
            existing_po.notes = approval_notes
            pos_created.append(existing_po)
        else:
            new_po = models.ShipmentPurchaseOrder(
                shipment_id=shipment_id,
                vendor_id=v_id,
                po_number=po_no,
                po_date=today_str,
                total_amount=po_total,
                currency=s.currency or "INR",
                status="CONFIRMED",
                notes=approval_notes
            )
            db.add(new_po)
            pos_created.append(new_po)

    for p in active_products:
        p.stage_status = "PURCHASED"

    act_log = models.ShipmentActivityLog(
        shipment_id=shipment_id,
        stage_name="PURCHASE",
        action_type="CONFIRM_PURCHASE",
        action_title="Customer Approved Quotation -> Purchase Orders Confirmed",
        details=f"Approved by {approved_by}. Generated {len(pos_created)} Purchase Orders for active items. Notes: {approval_notes}"
    )
    db.add(act_log)

    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


@router.post("/{shipment_id}/upload-excel", response_model=ShipmentResponse)
async def upload_excel_products(shipment_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if not file.filename or not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls Excel files allowed")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")

    # Clean column names
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("-", "_") for c in df.columns]

    customers_map = {c.name.strip().lower(): c.id for c in db.query(Customer).all()}
    shipment_customers = [sc.customer_id for sc in s.customers]
    default_cust_id = shipment_customers[0] if shipment_customers else None

    if not default_cust_id:
        def_c = db.query(Customer).first()
        if not def_c:
            def_c = Customer(name="Default Customer", code="CUST-001", country="Sri Lanka")
            db.add(def_c)
            db.flush()
        default_cust_id = def_c.id
        sc = ShipmentCustomer(shipment_id=s.id, customer_id=default_cust_id)
        db.add(sc)

    cat_counts = {}
    rows_added = 0

    for idx, row in df.iterrows():
        p_name = str(row.get("product_name") or row.get("product") or row.get("description") or f"Item {int(idx)+1}").strip()
        if not p_name or p_name == "nan":
            continue

        c_name = str(row.get("customer") or row.get("customer_name") or "").strip().lower()
        cust_id = customers_map.get(c_name, default_cust_id)

        hsn = str(row.get("hsn_code") or row.get("hsn") or row.get("hs_code") or "").strip()
        if hsn == "nan": hsn = ""

        if hsn:
            if "." in hsn and len(hsn.split(".")) >= 3:
                base_prefix = ".".join(hsn.split(".")[:2])
            else:
                base_prefix = hsn[:6]

            if base_prefix not in cat_counts:
                db_count = db.query(func.count(ShipmentProduct.id)).filter(
                    ShipmentProduct.shipment_id == shipment_id,
                    ShipmentProduct.hsn_code.like(f"{base_prefix}%")
                ).scalar() or 0
                cat_counts[base_prefix] = db_count

            cat_counts[base_prefix] += 1
            hsn = format_sub_hsn(hsn, cat_counts[base_prefix])
        
        category = str(row.get("category") or row.get("product_category") or "").strip()
        if category == "nan": category = None

        unit = str(row.get("unit") or "PCS").strip().upper()
        if unit == "NAN": unit = "PCS"

        try:
            qty = Decimal(str(row.get("quantity") or row.get("qty") or 1))
        except Exception:
            qty = Decimal("1.0")

        try:
            weight = Decimal(str(row.get("weight") or row.get("weight_val") or row.get("grams") or 0))
        except Exception:
            weight = Decimal("0.0")

        try:
            price = Decimal(str(row.get("price") or row.get("purchase_price") or row.get("price_per_unit") or 0))
        except Exception:
            price = Decimal("0.0")

        currency = str(row.get("currency") or "INR").strip().upper()
        if currency == "NAN": currency = "INR"

        sp = ShipmentProduct(
            shipment_id=shipment_id,
            customer_id=cust_id,
            product_name=p_name,
            product_category=category,
            hsn_code=hsn,
            quantity=qty,
            weight_val=weight,
            weight_unit="KG",
            unit=unit,
            purchase_price=price,
            currency=currency
        )
        db.add(sp)
        rows_added += 1

    db.commit()
    recalculate_shipment(db, s)
    return get_shipment_details(shipment_id, db)


@router.put("/{shipment_id}/actuals", response_model=ShipmentActualResponse)
def update_shipment_actuals(shipment_id: int, payload: ShipmentActualUpdate, db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    actual = s.actuals
    if not actual:
        actual = ShipmentActual(shipment_id=shipment_id)
        db.add(actual)

    actual.actual_duty_inr = payload.actual_duty_inr
    actual.actual_duty_lkr = payload.actual_duty_lkr
    actual.actual_cost_inr = payload.actual_cost_inr
    actual.actual_cost_lkr = payload.actual_cost_lkr
    actual.actual_revenue_inr = payload.actual_revenue_inr
    actual.actual_revenue_lkr = payload.actual_revenue_lkr
    actual.actual_profit_lkr = payload.actual_profit_lkr
    if payload.notes: actual.notes = payload.notes

    db.commit()
    db.refresh(actual)
    return actual


@router.post("/{shipment_id}/ocr-duty-invoice")
async def ocr_duty_invoice(shipment_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF invoice files are supported for OCR")

    contents = await file.read()
    extracted_text = ""
    try:
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF extraction error: {str(e)}")

    # Simple heuristic regex extraction for Duty / Amount paid in PDF text
    import re
    duty_match = re.search(r"(?:DUTY|CUSTOMS|TAX)\s*(?:AMOUNT|PAID|TOTAL)?\s*[:\-]?\s*(?:LKR|INR|RS\.?)?\s*([\d,]+(?:\.\d{2})?)", extracted_text, re.IGNORECASE)
    cost_match = re.search(r"(?:TOTAL|AMOUNT|SUBTOTAL)\s*(?:COST|PAID|DUE)?\s*[:\-]?\s*(?:LKR|INR|RS\.?)?\s*([\d,]+(?:\.\d{2})?)", extracted_text, re.IGNORECASE)

    extracted_duty = Decimal("0.0")
    extracted_cost = Decimal("0.0")

    if duty_match:
        try:
            extracted_duty = Decimal(duty_match.group(1).replace(",", ""))
        except Exception:
            pass

    if cost_match:
        try:
            extracted_cost = Decimal(cost_match.group(1).replace(",", ""))
        except Exception:
            pass

    actual = s.actuals
    if not actual:
        actual = ShipmentActual(shipment_id=shipment_id)
        db.add(actual)

    if extracted_duty > 0: actual.actual_duty_lkr = extracted_duty
    if extracted_cost > 0: actual.actual_cost_lkr = extracted_cost
    actual.ocr_source_file = file.filename

    db.commit()
    db.refresh(actual)
    return {
        "filename": file.filename,
        "extracted_duty_lkr": actual.actual_duty_lkr,
        "extracted_cost_lkr": actual.actual_cost_lkr,
        "raw_text_snippet": extracted_text[:500]
    }


@router.get("/reports/dashboard", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    total_shipments = len(shipments)

    total_sales_lkr = Decimal("0.0")
    total_duty_lkr = Decimal("0.0")
    total_cost_lkr = Decimal("0.0")
    total_profit_lkr = Decimal("0.0")
    total_loss_lkr = Decimal("0.0")

    customer_stats = {} # customer_id -> stats dict
    year_stats = {} # financial_year -> stats dict

    for s in shipments:
        fy = s.financial_year or "Unknown"
        if fy not in year_stats:
            year_stats[fy] = {"shipments_count": 0, "sales_lkr": 0.0, "cost_lkr": 0.0, "profit_lkr": 0.0}
        year_stats[fy]["shipments_count"] += 1

        for p in s.products:
            p_qty = float(p.quantity or 1.0)
            sales = float(p.final_quotation_price or 0.0) * p_qty
            cost = float(p.total_cost_lkr or 0.0) * p_qty
            duty = float(p.calculated_duty_lkr or 0.0) * p_qty
            profit = float(p.predicted_profit or 0.0) * p_qty

            total_sales_lkr += Decimal(str(sales))
            total_duty_lkr += Decimal(str(duty))
            total_cost_lkr += Decimal(str(cost))

            if profit >= 0:
                total_profit_lkr += Decimal(str(profit))
            else:
                total_loss_lkr += Decimal(str(abs(profit)))

            year_stats[fy]["sales_lkr"] += sales
            year_stats[fy]["cost_lkr"] += cost
            year_stats[fy]["profit_lkr"] += profit

            c_id = p.customer_id
            if c_id not in customer_stats:
                c_obj = db.query(Customer).filter(Customer.id == c_id).first()
                customer_stats[c_id] = {
                    "customer_id": c_id,
                    "customer_name": c_obj.name if c_obj else "Unknown",
                    "customer_code": c_obj.code if c_obj else "UNKNOWN",
                    "total_shipments": set(),
                    "total_sales_lkr": 0.0,
                    "total_cost_lkr": 0.0,
                    "total_profit_lkr": 0.0,
                    "pending_amount_lkr": 0.0
                }
            customer_stats[c_id]["total_shipments"].add(s.id)
            customer_stats[c_id]["total_sales_lkr"] += sales
            customer_stats[c_id]["total_cost_lkr"] += cost
            customer_stats[c_id]["total_profit_lkr"] += profit

    c_summaries = []
    for c_id, stats in customer_stats.items():
        c_summaries.append(CustomerProfitSummary(
            customer_id=stats["customer_id"],
            customer_name=stats["customer_name"],
            customer_code=stats["customer_code"],
            total_shipments=len(stats["total_shipments"]),
            total_sales_lkr=Decimal(str(round(stats["total_sales_lkr"], 2))),
            total_cost_lkr=Decimal(str(round(stats["total_cost_lkr"], 2))),
            total_profit_lkr=Decimal(str(round(stats["total_profit_lkr"], 2))),
            pending_amount_lkr=Decimal(str(round(stats["total_sales_lkr"] * 0.2, 2))) # Est. pending
        ))

    return DashboardSummaryResponse(
        total_shipments=total_shipments,
        total_sales_lkr=Decimal(str(round(total_sales_lkr, 2))),
        total_duty_lkr=Decimal(str(round(total_duty_lkr, 2))),
        total_cost_lkr=Decimal(str(round(total_cost_lkr, 2))),
        total_profit_lkr=Decimal(str(round(total_profit_lkr, 2))),
        total_loss_lkr=Decimal(str(round(total_loss_lkr, 2))),
        customer_summaries=c_summaries,
        year_wise_summary=year_stats
    )
