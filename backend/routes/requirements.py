from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel
import io
import pandas as pd
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/v1/shipments", tags=["Customer Requirements"])

TRADE_NAME_HSN_MAP = {
    "ragi": "1008.29.00",
    "atta": "1101.00.10",
    "maida": "1101.00.90",
    "suji": "1103.11.00",
    "rava": "1103.11.00",
    "ghee": "0405.90.20",
    "masala": "0910.99.90",
    "turmeric": "0910.30.20",
    "chilli": "0904.22.10",
    "coriander": "0909.22.00",
    "cumin": "0909.32.00",
    "mustard": "1207.50.00",
    "pepper": "0904.11.00",
    "cardamom": "0908.31.00",
    "cinnamon": "0906.11.00",
    "clove": "0907.10.00",
    "rice": "1006.30.10",
    "dhal": "0713.40.00",
    "dal": "0713.40.00",
    "sugar": "1701.99.90",
    "salt": "2501.00.10",
    "oil": "1512.19.10",
    "jaggery": "1702.90.90"
}

def auto_map_hsn_code(product_name: str, db: Session) -> Optional[str]:
    if not product_name:
        return None
    clean_name = product_name.strip().lower()
    main_query = clean_name.split('(')[0].strip()

    # 1. Check Trade Name Dictionary
    for key, hsn in TRADE_NAME_HSN_MAP.items():
        if key in main_query or main_query in key:
            return hsn

    # 2. Search in ItemEntry master table
    item = db.query(models.ItemEntry).filter(
        models.ItemEntry.item_name.ilike(f"%{main_query}%"),
        models.ItemEntry.hs_code.isnot(None)
    ).first()
    if item and item.hs_code:
        return str(item.hs_code)

    # 3. Search in TariffLine master table
    t_line = db.query(models.TariffLine).filter(
        models.TariffLine.description.ilike(f"%{main_query}%"),
        models.TariffLine.hs_code.isnot(None)
    ).first()
    if t_line and t_line.hs_code:
        return str(t_line.hs_code)

    return None

def generate_sequential_sub_hsn(base_hsn: str, seq_number: int) -> str:
    if not base_hsn:
        return ""
    clean = base_hsn.strip()

    if "." in clean:
        parts = clean.split(".")
        p1 = parts[0]
        p2 = parts[1] if len(parts) > 1 else ""
        if len(p2) == 3 and p2.isdigit():
            p2 = p2[:2]
        base_prefix = f"{p1}.{p2[:2]}" if p2 else p1
    else:
        if len(clean) >= 6:
            base_prefix = f"{clean[:4]}.{clean[4:6]}"
        elif len(clean) >= 4:
            base_prefix = f"{clean[:4]}"
        else:
            base_prefix = clean

    return f"{base_prefix}{seq_number}"

def assign_sequential_hsn(shipment_id: int, product_name: str, raw_hsn: Optional[str], db: Session, cat_counts: dict) -> str:
    base = raw_hsn.strip() if raw_hsn and raw_hsn.lower() != "nan" else auto_map_hsn_code(product_name, db)
    if not base:
        base = "9999.00"

    if "." in base:
        parts = base.split(".")
        p1 = parts[0]
        p2 = parts[1] if len(parts) > 1 else ""
        if len(p2) == 3 and p2.isdigit():
            p2 = p2[:2]
        base_prefix = f"{p1}.{p2[:2]}" if p2 else p1
    else:
        base_prefix = base[:4]

    if base_prefix not in cat_counts:
        existing_count = db.query(models.ShipmentCustomerRequirement).filter(
            models.ShipmentCustomerRequirement.shipment_id == shipment_id,
            models.ShipmentCustomerRequirement.hsn_code.like(f"{base_prefix}%")
        ).count()
        cat_counts[base_prefix] = existing_count

    cat_counts[base_prefix] += 1
    seq = cat_counts[base_prefix]
    return generate_sequential_sub_hsn(base, seq)

def fix_corrupted_hsn(req: models.ShipmentCustomerRequirement, db: Session):
    if not req.hsn_code or "." not in req.hsn_code:
        correct_hsn = auto_map_hsn_code(req.product_name, db)
        if correct_hsn:
            req.hsn_code = generate_sequential_sub_hsn(correct_hsn, 1)

@router.get("/{shipment_id}/requirements", response_model=List[schemas.ShipmentCustomerRequirementResponse])
def get_customer_requirements(shipment_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    reqs = db.query(models.ShipmentCustomerRequirement).filter(
        models.ShipmentCustomerRequirement.shipment_id == shipment_id
    ).all()

    # Auto-fix corrupted HSN codes in database
    modified = False
    for req in reqs:
        if req.hsn_code and "." not in req.hsn_code:
            correct_base = auto_map_hsn_code(req.product_name, db)
            if correct_base:
                req.hsn_code = generate_sequential_sub_hsn(correct_base, 1)
                modified = True
    if modified:
        db.commit()

    return reqs

@router.post("/{shipment_id}/requirements", response_model=schemas.ShipmentCustomerRequirementResponse)
def add_customer_requirement(shipment_id: int, payload: schemas.ShipmentCustomerRequirementCreate, db: Session = Depends(get_db)):
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    cust = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    p_name = payload.product_name.strip()
    cat_counts = {}
    hsn = assign_sequential_hsn(shipment_id, p_name, payload.hsn_code, db, cat_counts)

    req = models.ShipmentCustomerRequirement(
        shipment_id=shipment_id,
        customer_id=payload.customer_id,
        product_name=p_name,
        hsn_code=hsn,
        required_quantity=payload.required_quantity,
        unit=payload.unit.strip().upper(),
        notes=payload.notes
    )
    db.add(req)
    db.flush()

    # Log audit history
    hist = models.CustomerRequirementHistory(
        requirement_id=req.id,
        shipment_id=shipment_id,
        customer_id=payload.customer_id,
        product_name=req.product_name,
        old_quantity=None,
        new_quantity=req.required_quantity,
        unit=req.unit,
        action_type="CREATED"
    )
    db.add(hist)

    db.commit()
    db.refresh(req)
    try:
        from mongo_sync import sync_shipment_to_mongo
        sync_shipment_to_mongo(shipment_id)
    except Exception as e:
        print(f"Mongo sync notice: {e}")
    return req

@router.put("/{shipment_id}/requirements/{req_id}", response_model=schemas.ShipmentCustomerRequirementResponse)
def update_customer_requirement(shipment_id: int, req_id: int, payload: schemas.ShipmentCustomerRequirementUpdate, db: Session = Depends(get_db)):
    req = db.query(models.ShipmentCustomerRequirement).filter(
        models.ShipmentCustomerRequirement.id == req_id,
        models.ShipmentCustomerRequirement.shipment_id == shipment_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Customer Requirement not found")

    old_qty = req.required_quantity

    if payload.product_name is not None:
        req.product_name = payload.product_name.strip()
    if payload.hsn_code is not None:
        req.hsn_code = payload.hsn_code.strip()
    elif payload.product_name is not None and not req.hsn_code:
        cat_counts = {}
        req.hsn_code = assign_sequential_hsn(shipment_id, req.product_name, None, db, cat_counts)
    if payload.required_quantity is not None:
        req.required_quantity = payload.required_quantity
    if payload.unit is not None:
        req.unit = payload.unit.strip().upper()
    if payload.notes is not None:
        req.notes = payload.notes

    # Log audit history
    hist = models.CustomerRequirementHistory(
        requirement_id=req.id,
        shipment_id=shipment_id,
        customer_id=req.customer_id,
        product_name=req.product_name,
        old_quantity=old_qty,
        new_quantity=req.required_quantity,
        unit=req.unit,
        action_type="UPDATED"
    )
    db.add(hist)

    db.commit()
    db.refresh(req)
    return req

@router.delete("/{shipment_id}/requirements/{req_id}")
def delete_customer_requirement(shipment_id: int, req_id: int, db: Session = Depends(get_db)):
    req = db.query(models.ShipmentCustomerRequirement).filter(
        models.ShipmentCustomerRequirement.id == req_id,
        models.ShipmentCustomerRequirement.shipment_id == shipment_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Customer Requirement not found")

    db.delete(req)
    db.commit()
    return {"message": "Requirement deleted successfully"}

class BulkDeleteRequirementsPayload(BaseModel):
    requirement_ids: List[int]

@router.post("/{shipment_id}/requirements/bulk-delete")
def bulk_delete_customer_requirements(
    shipment_id: int, 
    payload: BulkDeleteRequirementsPayload, 
    db: Session = Depends(get_db)
):
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if not payload.requirement_ids:
        return {"message": "No requirement IDs provided", "deleted_count": 0}

    deleted_count = db.query(models.ShipmentCustomerRequirement).filter(
        models.ShipmentCustomerRequirement.shipment_id == shipment_id,
        models.ShipmentCustomerRequirement.id.in_(payload.requirement_ids)
    ).delete(synchronize_session=False)

    db.commit()
    return {"message": f"Successfully deleted {deleted_count} requirement(s)", "deleted_count": deleted_count}

@router.delete("/{shipment_id}/requirements/clear-all")
def clear_all_customer_requirements(shipment_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    deleted_count = db.query(models.ShipmentCustomerRequirement).filter(
        models.ShipmentCustomerRequirement.shipment_id == shipment_id
    ).delete(synchronize_session=False)

    db.commit()
    return {"message": f"Successfully cleared all {deleted_count} customer requirements", "deleted_count": deleted_count}

@router.post("/{shipment_id}/requirements/upload-excel", response_model=List[schemas.ShipmentCustomerRequirementResponse])
async def upload_excel_requirements(shipment_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    contents = await file.read()
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            try:
                df = pd.read_excel(io.BytesIO(contents))
            except Exception:
                df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file format (.xlsx, .xls, .csv): {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Clean column headers
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_") for c in df.columns]

    customers_map = {c.name.strip().lower(): c.id for c in db.query(models.Customer).all()}
    for c in db.query(models.Customer).all():
        if c.code:
            customers_map[c.code.strip().lower()] = c.id

    shipment_customers = [sc.customer_id for sc in s.customers]
    default_cust_id = shipment_customers[0] if shipment_customers else None

    if not default_cust_id:
        def_c = db.query(models.Customer).first()
        if not def_c:
            def_c = models.Customer(name="Default Customer", code="CUST-001", country="Sri Lanka")
            db.add(def_c)
            db.flush()
        default_cust_id = def_c.id

    created_requirements = []
    cat_counts = {}

    PROD_COLS = ["product_name", "product", "sku", "item_name", "item", "description", "particulars", "name", "product_description", "items", "details"]
    QTY_COLS = ["quantity", "required_quantity", "qty", "req_qty", "count", "cartons", "no_of_cartons", "pcs", "nos", "amount", "total_qty"]
    HSN_COLS = ["hsn_code", "hsn", "hs_code", "hsn_sac", "tariff", "hs_number", "tariff_code"]
    CUST_COLS = ["customer", "customer_name", "consignee", "buyer", "client", "party", "party_name"]
    UNIT_COLS = ["unit", "uom", "type", "packing_unit", "pkg"]
    NOTES_COLS = ["notes", "remarks", "comments", "specification", "specifications"]

    def find_val(row, cols, default=""):
        for col in cols:
            if col in row and pd.notna(row[col]):
                val = str(row[col]).strip()
                if val and val.lower() != "nan":
                    return val
        return default

    for idx, row in df.iterrows():
        p_name = find_val(row, PROD_COLS, "")
        if not p_name:
            continue

        if p_name.lower().startswith(("total", "subtotal", "grand total", "summary", "sl.no", "s.no", "s.no.")):
            continue

        c_name = find_val(row, CUST_COLS, "").lower()
        cust_id = customers_map.get(c_name, default_cust_id)

        raw_hsn = find_val(row, HSN_COLS, "")
        hsn_code = assign_sequential_hsn(shipment_id, p_name, raw_hsn, db, cat_counts)

        raw_qty = find_val(row, QTY_COLS, "1")
        try:
            qty = Decimal(str(raw_qty).replace(",", ""))
            if qty <= 0: qty = Decimal("1.0")
        except Exception:
            qty = Decimal("1.0")

        unit = find_val(row, UNIT_COLS, "PCS").upper()
        if unit == "NAN": unit = "PCS"

        notes_val = find_val(row, NOTES_COLS, "Uploaded via Excel")

        req = models.ShipmentCustomerRequirement(
            shipment_id=shipment_id,
            customer_id=cust_id,
            product_name=p_name,
            hsn_code=hsn_code,
            required_quantity=qty,
            unit=unit,
            notes=notes_val
        )
        db.add(req)
        db.flush()

        hist = models.CustomerRequirementHistory(
            requirement_id=req.id,
            shipment_id=shipment_id,
            customer_id=cust_id,
            product_name=p_name,
            old_quantity=None,
            new_quantity=qty,
            unit=unit,
            action_type="BULK_UPLOAD"
        )
        db.add(hist)
        created_requirements.append(req)

    db.commit()
    for r in created_requirements:
        db.refresh(r)
    return created_requirements

@router.get("/{shipment_id}/requirements/export/excel")
def export_customer_requirements_excel(shipment_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    reqs = db.query(models.ShipmentCustomerRequirement).filter(
        models.ShipmentCustomerRequirement.shipment_id == shipment_id
    ).all()

    data = []
    for idx, r in enumerate(reqs, 1):
        cust_name = r.customer.name if r.customer else f"Customer #{r.customer_id}"
        data.append({
            "S.No": idx,
            "Customer": cust_name,
            "Product Name": r.product_name,
            "HSN Code": r.hsn_code or "Auto-mapped",
            "Quantity": float(r.required_quantity),
            "Unit": r.unit,
            "Notes": r.notes or ""
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Customer Requirements')

    output.seek(0)
    filename = f"Customer_Requirements_{s.shipment_no}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{shipment_id}/requirements/export/pdf")
def export_customer_requirements_pdf(shipment_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    reqs = db.query(models.ShipmentCustomerRequirement).filter(
        models.ShipmentCustomerRequirement.shipment_id == shipment_id
    ).all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=16, leading=20, textColor=colors.HexColor("#1e293b"))
    story.append(Paragraph(f"Stage 1: Customer Requirements Report", title_style))
    story.append(Paragraph(f"Shipment #: {s.shipment_no} | Date: {s.shipment_date or 'N/A'}", styles['Normal']))
    story.append(Spacer(1, 14))

    table_data = [["S.No", "Customer", "Product Name", "HSN Code", "Quantity", "Unit", "Notes"]]
    for idx, r in enumerate(reqs, 1):
        cust_name = r.customer.name if r.customer else f"Customer #{r.customer_id}"
        table_data.append([
            str(idx),
            cust_name,
            r.product_name,
            r.hsn_code or "Auto-mapped",
            f"{float(r.required_quantity):,}",
            r.unit,
            r.notes or "-"
        ])

    t = Table(table_data, colWidths=[30, 100, 140, 70, 60, 50, 80])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2563eb")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)

    doc.build(story)
    buffer.seek(0)
    filename = f"Customer_Requirements_{s.shipment_no}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

@router.get("/{shipment_id}/requirements/history", response_model=List[schemas.CustomerRequirementHistoryResponse])
def get_customer_requirement_history(shipment_id: int, db: Session = Depends(get_db)):
    return db.query(models.CustomerRequirementHistory).filter(
        models.CustomerRequirementHistory.shipment_id == shipment_id
    ).order_by(models.CustomerRequirementHistory.modified_at.desc()).all()
