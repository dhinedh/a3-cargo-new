import json
import logging
from typing import Dict, Any, List, Optional
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from database import get_mongo_db, SessionLocal
import models


logger = logging.getLogger("mongo_sync")


def sync_item_to_mongo(item: models.ItemEntry):
    """Save/update an item entry into MongoDB Atlas item_entries collection."""
    db = get_mongo_db()
    if db is None:
        return
    try:
        doc = {
            "_id": item.id,
            "id": item.id,
            "item_name": item.item_name,
            "item_category": item.item_category,
            "item_classification": item.item_classification,
            "unit": item.unit,
            "notes": item.notes,
            "currency": item.currency,
            "tariff_line_id": item.tariff_line_id,
            "hs_code": item.hs_code,
            "tariff_description": item.tariff_description,
            "general_duty_rate": item.general_duty_rate,
            "vat_rate": item.vat_rate,
            "pal_rate": item.pal_rate,
            "cess_rate": item.cess_rate,
            "sscl_rate": item.sscl_rate,
            "excise_rate": item.excise_rate,
            "scl_rate": item.scl_rate,
            "weight_val": float(item.weight_val) if item.weight_val is not None else 0.0,
            "weight_unit": item.weight_unit,
            "is_favorite": item.is_favorite,
            "purchase_price": float(item.purchase_price) if item.purchase_price is not None else None,
            "price_per_kg": float(item.price_per_kg) if item.price_per_kg is not None else None,
            "total_quantity_kg": float(item.total_quantity_kg) if item.total_quantity_kg is not None else None,
            "per_month_qty_kg": float(item.per_month_qty_kg) if item.per_month_qty_kg is not None else None,
            "total_value": float(item.total_value) if item.total_value is not None else None,
            "per_month_value": float(item.per_month_value) if item.per_month_value is not None else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
        db.item_entries.replace_one({"_id": item.id}, doc, upsert=True)
    except Exception as e:
        logger.error(f"Error syncing item #{item.id} to Mongo Atlas: {e}")


def sync_shipment_to_mongo(shipment_id: int):
    """Save/update a full JSON snapshot of a shipment into MongoDB Atlas."""
    db = get_mongo_db()
    if db is None:
        return

    sql_db = SessionLocal()
    try:
        sh = sql_db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
        if not sh:
            return

        # Build full JSON document representation
        cust_list = [
            {
                "id": sc.customer.id,
                "name": sc.customer.name,
                "code": sc.customer.code,
                "country": sc.customer.country,
                "allocation_pct": float(sc.allocation_pct) if sc.allocation_pct is not None else 0.0,
            }
            for sc in sh.customers
            if sc.customer
        ]

        prod_list = []
        for p in sh.products:
            prod_list.append({
                "id": p.id,
                "customer_id": p.customer_id,
                "product_name": p.product_name,
                "product_category": p.product_category,
                "hsn_code": p.hsn_code,
                "item_classification": p.item_classification,
                "is_active": p.is_active,
                "stage_status": p.stage_status,
                "quantity": float(p.quantity or 0.0),
                "weight_val": float(p.weight_val or 0.0),
                "weight_unit": p.weight_unit,
                "unit": p.unit,
                "purchase_price": float(p.purchase_price or 0.0),
                "currency": p.currency,
                "freight_allocation_lkr": float(p.freight_allocation_lkr or 0.0),
                "calculated_duty_lkr": float(p.calculated_duty_lkr or 0.0),
                "total_cost_lkr": float(p.total_cost_lkr or 0.0),
                "final_quotation_price": float(p.final_quotation_price or 0.0),
            })

        req_list = []
        reqs = sql_db.query(models.ShipmentCustomerRequirement).filter(
            models.ShipmentCustomerRequirement.shipment_id == shipment_id
        ).all()
        for r in reqs:
            req_list.append({
                "id": r.id,
                "customer_id": r.customer_id,
                "customer_name": r.customer.name if r.customer else None,
                "product_name": r.product_name,
                "hsn_code": r.hsn_code,
                "required_quantity": float(r.required_quantity or 0.0),
                "unit": r.unit,
                "notes": r.notes
            })

        alloc_list = []
        allocs = sql_db.query(models.ShipmentVendorAllocation).filter(
            models.ShipmentVendorAllocation.shipment_id == shipment_id
        ).all()
        for a in allocs:
            alloc_list.append({
                "id": a.id,
                "requirement_id": a.requirement_id,
                "vendor_id": a.vendor_id,
                "allocated_quantity": float(a.allocated_quantity or 0.0),
                "allocated_unit": a.allocated_unit,
                "vendor_quote_price": float(a.vendor_quote_price or 0.0),
                "vendor_quote_currency": a.vendor_quote_currency,
                "rfq_sent": a.rfq_sent,
                "status": a.status,
                "notes": a.notes
            })

        pi_list = []
        pis = sql_db.query(models.ShipmentVendorProformaItem).filter(
            models.ShipmentVendorProformaItem.shipment_id == shipment_id
        ).all()
        for pi in pis:
            pi_list.append({
                "id": pi.id,
                "vendor_id": pi.vendor_id,
                "product_name": pi.product_name,
                "sku": pi.sku,
                "hsn_code": pi.hsn_code,
                "proforma_qty": float(pi.proforma_qty or 0.0),
                "cartons_count": float(pi.cartons_count or 0.0),
                "units_per_carton": float(pi.units_per_carton or 12.0),
                "unit_weight_val": float(pi.unit_weight_val or 0.0),
                "unit_weight_unit": pi.unit_weight_unit or 'KG',
                "net_weight_kg": float(pi.net_weight_kg or 0.0),
                "gross_weight_kg": float(pi.gross_weight_kg or 0.0),
                "proforma_price": float(pi.proforma_price or 0.0),
                "price_basis": pi.price_basis or 'PER_UNIT',
                "price_per_carton": float(pi.price_per_carton or 0.0),
                "price_per_kg": float(pi.price_per_kg or 0.0),
                "mrp": float(pi.mrp or 0.0),
                "discount_pct": float(pi.discount_pct or 0.0),
                "gst_pct": float(pi.gst_pct or 0.0),
                "total_payable": float(pi.total_payable or 0.0),
                "currency": pi.currency or 'INR',
                "notes": pi.notes
            })

        act_doc = None
        act = sql_db.query(models.ShipmentActual).filter(models.ShipmentActual.shipment_id == shipment_id).first()
        if act:
            act_doc = {
                "actual_duty_inr": float(act.actual_duty_inr or 0.0),
                "actual_duty_lkr": float(act.actual_duty_lkr or 0.0),
                "actual_cost_inr": float(act.actual_cost_inr or 0.0),
                "actual_cost_lkr": float(act.actual_cost_lkr or 0.0),
                "actual_revenue_inr": float(act.actual_revenue_inr or 0.0),
                "actual_revenue_lkr": float(act.actual_revenue_lkr or 0.0),
                "actual_profit_lkr": float(act.actual_profit_lkr or 0.0),
                "ocr_source_file": act.ocr_source_file,
                "notes": act.notes
            }

        doc = {
            "_id": sh.id,
            "id": sh.id,
            "financial_year": sh.financial_year,
            "sequence_number": sh.sequence_number,
            "shipment_no": sh.shipment_no,
            "shipment_date": sh.shipment_date,
            "status": sh.status,
            "destination": sh.destination,
            "currency": sh.currency,
            "current_stage": sh.current_stage,
            "usd_rate": float(sh.usd_rate or 305.0),
            "lkr_inr_rate": float(sh.lkr_inr_rate or 3.65),
            "profit_margin_pct": float(sh.profit_margin_pct or 15.0),
            "indian_invoice_margin_pct": float(sh.indian_invoice_margin_pct if sh.indian_invoice_margin_pct is not None else 15.0),
            "colombo_invoice_margin_pct": float(sh.colombo_invoice_margin_pct if sh.colombo_invoice_margin_pct is not None else 15.0),
            "common_expenses_inr": float(sh.common_expenses_inr or 0.0),
            "common_expenses_lkr": float(sh.common_expenses_lkr or 0.0),
            "notes": sh.notes,
            "customers": cust_list,
            "products": prod_list,
            "requirements": req_list,
            "allocations": alloc_list,
            "proforma_items": pi_list,
            "actuals": act_doc,
            "updated_at": sh.updated_at.isoformat() if sh.updated_at else None
        }

        db.shipments.replace_one({"_id": sh.id}, doc, upsert=True)
        db.shipments_cloud.replace_one({"_id": sh.id}, doc, upsert=True)
        logger.info(f"Synced Shipment #{sh.shipment_no} to MongoDB Atlas.")

    except Exception as e:
        logger.error(f"Error syncing shipment to Mongo Atlas: {e}")
    finally:
        sql_db.close()


def restore_shipments_from_mongo(db_session=None):
    """Auto-restore shipments from MongoDB Atlas if local database restarted or empty."""
    db = get_mongo_db()
    if db is None:
        return

    sql_db = db_session if db_session is not None else SessionLocal()
    should_close = db_session is None
    try:
        cloud_shipments = list(db.shipments_cloud.find())
        if not cloud_shipments:
            cloud_shipments = list(db.shipments.find())
        if not cloud_shipments:
            return

        max_seq = 0
        for doc in cloud_shipments:
            s_id = doc.get("id")
            if not s_id:
                continue
            
            seq_num = doc.get("sequence_number", 1)
            if seq_num > max_seq:
                max_seq = seq_num

            sh = sql_db.query(models.Shipment).filter(models.Shipment.id == s_id).first()
            if not sh:
                sh = models.Shipment(
                    id=s_id,
                    financial_year=doc.get("financial_year", "2026-27"),
                    sequence_number=seq_num,
                    shipment_no=doc.get("shipment_no", f"AEC/{s_id}/2026-27"),
                    shipment_date=doc.get("shipment_date"),
                    status=doc.get("status", "DRAFT"),
                    destination=doc.get("destination", "Colombo Port, Sri Lanka"),
                    currency=doc.get("currency", "INR"),
                    current_stage=doc.get("current_stage", "1_SHIPMENT_CREATION"),
                    usd_rate=doc.get("usd_rate", 305.0),
                    lkr_inr_rate=doc.get("lkr_inr_rate", 3.65),
                    profit_margin_pct=doc.get("profit_margin_pct", 15.0),
                    indian_invoice_margin_pct=doc.get("indian_invoice_margin_pct", 15.0),
                    colombo_invoice_margin_pct=doc.get("colombo_invoice_margin_pct", 15.0),
                    common_expenses_inr=doc.get("common_expenses_inr", 0.0),
                    common_expenses_lkr=doc.get("common_expenses_lkr", 0.0),
                    notes=doc.get("notes")
                )
                sql_db.add(sh)
                sql_db.flush()
            else:
                # Update header metadata
                sh.status = doc.get("status", sh.status)
                sh.destination = doc.get("destination", sh.destination)
                sh.currency = doc.get("currency", sh.currency)
                sh.current_stage = doc.get("current_stage", sh.current_stage)
                sh.usd_rate = doc.get("usd_rate", sh.usd_rate)
                sh.lkr_inr_rate = doc.get("lkr_inr_rate", sh.lkr_inr_rate)
                sh.profit_margin_pct = doc.get("profit_margin_pct", sh.profit_margin_pct)
                sh.indian_invoice_margin_pct = doc.get("indian_invoice_margin_pct", sh.indian_invoice_margin_pct)
                sh.colombo_invoice_margin_pct = doc.get("colombo_invoice_margin_pct", sh.colombo_invoice_margin_pct)
                sh.notes = doc.get("notes", sh.notes)

            # Restore Customers
            for c in doc.get("customers", []):
                c_obj = sql_db.query(models.Customer).filter(models.Customer.name == c["name"]).first()
                if not c_obj:
                    c_obj = models.Customer(
                        name=c["name"],
                        code=c.get("code", c["name"][:4].upper()),
                        country=c.get("country", "Sri Lanka")
                    )
                    sql_db.add(c_obj)
                    sql_db.flush()
                sc = sql_db.query(models.ShipmentCustomer).filter(
                    models.ShipmentCustomer.shipment_id == sh.id,
                    models.ShipmentCustomer.customer_id == c_obj.id
                ).first()
                if not sc:
                    sc = models.ShipmentCustomer(
                        shipment_id=sh.id,
                        customer_id=c_obj.id,
                        allocation_pct=c.get("allocation_pct", 0.0)
                    )
                    sql_db.add(sc)

            # Restore Requirements
            for r in doc.get("requirements", []):
                r_id = r.get("id")
                req = sql_db.query(models.ShipmentCustomerRequirement).filter(
                    models.ShipmentCustomerRequirement.id == r_id
                ).first() if r_id else None
                if not req:
                    req = models.ShipmentCustomerRequirement(
                        id=r_id,
                        shipment_id=sh.id,
                        customer_id=r.get("customer_id", 1),
                        product_name=r.get("product_name"),
                        hsn_code=r.get("hsn_code") or r.get("hs_code"),
                        required_quantity=r.get("required_quantity", 1.0),
                        unit=r.get("unit", "CARTON"),
                        notes=r.get("notes")
                    )
                    sql_db.add(req)

            # Restore Products
            for p in doc.get("products", []):
                p_id = p.get("id")
                sp = sql_db.query(models.ShipmentProduct).filter(
                    models.ShipmentProduct.id == p_id
                ).first() if p_id else None
                if not sp:
                    sp = models.ShipmentProduct(
                        id=p_id,
                        shipment_id=sh.id,
                        customer_id=p.get("customer_id", 1),
                        product_name=p.get("product_name"),
                        product_category=p.get("product_category"),
                        hsn_code=p.get("hsn_code") or p.get("hs_code"),
                        item_classification=p.get("item_classification", "NORMAL"),
                        is_active=p.get("is_active", True),
                        stage_status=p.get("stage_status", "REQUESTED"),
                        quantity=p.get("quantity", 1.0),
                        weight_val=p.get("weight_val", 0.0),
                        weight_unit=p.get("weight_unit", "KG"),
                        unit=p.get("unit", "CARTON"),
                        purchase_price=p.get("purchase_price", 0.0),
                        currency=p.get("currency") or p.get("purchase_currency", "INR"),
                        freight_allocation_lkr=p.get("freight_allocation_lkr", 0.0),
                        calculated_duty_lkr=p.get("calculated_duty_lkr", 0.0),
                        total_cost_lkr=p.get("total_cost_lkr", 0.0),
                        final_quotation_price=p.get("final_quotation_price", 0.0)
                    )
                    sql_db.add(sp)

            # Restore Allocations
            for a in doc.get("allocations", []):
                a_id = a.get("id")
                alloc = sql_db.query(models.ShipmentVendorAllocation).filter(
                    models.ShipmentVendorAllocation.id == a_id
                ).first() if a_id else None
                if not alloc:
                    alloc = models.ShipmentVendorAllocation(
                        id=a_id,
                        shipment_id=sh.id,
                        requirement_id=a.get("requirement_id"),
                        vendor_id=a.get("vendor_id"),
                        allocated_quantity=a.get("allocated_quantity", 1.0),
                        allocated_unit=a.get("allocated_unit", "CARTON"),
                        vendor_quote_price=a.get("vendor_quote_price", 0.0),
                        vendor_quote_currency=a.get("vendor_quote_currency", "INR"),
                        rfq_sent=a.get("rfq_sent", False),
                        status=a.get("status", "ALLOCATED"),
                        notes=a.get("notes")
                    )
                    sql_db.add(alloc)

            # Restore Proforma Items
            for pi in doc.get("proforma_items", []):
                pi_id = pi.get("id")
                pi_obj = sql_db.query(models.ShipmentVendorProformaItem).filter(
                    models.ShipmentVendorProformaItem.id == pi_id
                ).first() if pi_id else None
                if not pi_obj:
                    pi_obj = models.ShipmentVendorProformaItem(
                        id=pi_id,
                        shipment_id=sh.id,
                        vendor_id=pi.get("vendor_id"),
                        product_name=pi.get("product_name"),
                        sku=pi.get("sku"),
                        hsn_code=pi.get("hsn_code"),
                        proforma_qty=pi.get("proforma_qty", 1.0),
                        cartons_count=pi.get("cartons_count", 1.0),
                        units_per_carton=pi.get("units_per_carton", 12.0),
                        unit_weight_val=pi.get("unit_weight_val", 0.0),
                        unit_weight_unit=pi.get("unit_weight_unit", "KG"),
                        net_weight_kg=pi.get("net_weight_kg", 0.0),
                        gross_weight_kg=pi.get("gross_weight_kg", 0.0),
                        proforma_price=pi.get("proforma_price", 0.0),
                        price_basis=pi.get("price_basis", "PER_CARTON"),
                        price_per_carton=pi.get("price_per_carton", 0.0),
                        price_per_kg=pi.get("price_per_kg", 0.0),
                        mrp=pi.get("mrp", 0.0),
                        discount_pct=pi.get("discount_pct", 0.0),
                        gst_pct=pi.get("gst_pct", 0.0),
                        total_payable=pi.get("total_payable", 0.0),
                        currency=pi.get("currency", "INR"),
                        notes=pi.get("notes")
                    )
                    sql_db.add(pi_obj)

            # Restore Actuals
            act = sql_db.query(models.ShipmentActual).filter(models.ShipmentActual.shipment_id == sh.id).first()
            act_doc = doc.get("actuals")
            if not act:
                act = models.ShipmentActual(
                    shipment_id=sh.id,
                    actual_duty_inr=act_doc.get("actual_duty_inr", 0.0) if act_doc else 0.0,
                    actual_duty_lkr=act_doc.get("actual_duty_lkr", 0.0) if act_doc else 0.0,
                    actual_cost_inr=act_doc.get("actual_cost_inr", 0.0) if act_doc else 0.0,
                    actual_cost_lkr=act_doc.get("actual_cost_lkr", 0.0) if act_doc else 0.0,
                    actual_revenue_inr=act_doc.get("actual_revenue_inr", 0.0) if act_doc else 0.0,
                    actual_revenue_lkr=act_doc.get("actual_revenue_lkr", 0.0) if act_doc else 0.0,
                    actual_profit_lkr=act_doc.get("actual_profit_lkr", 0.0) if act_doc else 0.0,
                    ocr_source_file=act_doc.get("ocr_source_file") if act_doc else None,
                    notes=act_doc.get("notes") if act_doc else None
                )
                sql_db.add(act)

            sql_db.commit()
            logger.info(f"Restored Shipment #{sh.shipment_no} from MongoDB Atlas.")

        # Update sequence counter
        if max_seq > 0:
            for fy in ["2026-27", "2025-26"]:
                seq_rec = sql_db.query(models.ShipmentSequence).filter(models.ShipmentSequence.financial_year == fy).first()
                if seq_rec:
                    if seq_rec.last_sequence < max_seq:
                        seq_rec.last_sequence = max_seq
                else:
                    seq_rec = models.ShipmentSequence(financial_year=fy, last_sequence=max_seq)
                    sql_db.add(seq_rec)
            sql_db.commit()

    except Exception as e:
        sql_db.rollback()
        logger.error(f"Error restoring shipments from Mongo: {e}")
    finally:
        if should_close:
            sql_db.close()


def restore_catalog_from_mongo(db_session=None):
    """Auto-restore item_entries, tariff_lines, chapters, vendors, and customers from MongoDB if local SQLite is empty."""
    db = get_mongo_db()
    if db is None:
        return

    sql_db = db_session if db_session is not None else SessionLocal()
    should_close = db_session is None
    try:
        # 1. Check Chapters
        if sql_db.query(models.Chapter).count() == 0:
            chapters = list(db.chapters.find())
            for ch_doc in chapters:
                ch = models.Chapter(
                    id=ch_doc["id"],
                    chapter_number=ch_doc["chapter_number"],
                    section_number=ch_doc.get("section_number"),
                    section_title=ch_doc.get("section_title"),
                    chapter_title=ch_doc.get("chapter_title"),
                    source_pdf_filename=ch_doc.get("source_pdf_filename"),
                )
                sql_db.add(ch)
            sql_db.commit()
            logger.info(f"Restored {len(chapters)} chapters from MongoDB Atlas.")

        # 2. Check Tariff Lines
        if sql_db.query(models.TariffLine).count() == 0:
            lines = list(db.tariff_lines.find())
            for tl_doc in lines:
                tl = models.TariffLine(
                    id=tl_doc["id"],
                    chapter_id=tl_doc["chapter_id"],
                    hs_code=tl_doc.get("hs_code"),
                    description=tl_doc.get("description", ""),
                    unit=tl_doc.get("unit"),
                    general_duty_rate=tl_doc.get("general_duty_rate"),
                    preferential_rates=tl_doc.get("preferential_rates", {}),
                    vat_rate=tl_doc.get("vat_rate"),
                    pal_rate=tl_doc.get("pal_rate"),
                    cess_rate=tl_doc.get("cess_rate"),
                    sscl_rate=tl_doc.get("sscl_rate"),
                    excise_rate=tl_doc.get("excise_rate"),
                    scl_rate=tl_doc.get("scl_rate"),
                )
                sql_db.add(tl)
            sql_db.commit()
            logger.info(f"Restored {len(lines)} tariff lines from MongoDB Atlas.")

        # 3. Check Customers
        if sql_db.query(models.Customer).count() == 0:
            customers = list(db.customers.find())
            for c_doc in customers:
                c = models.Customer(
                    id=c_doc["id"],
                    name=c_doc["name"],
                    code=c_doc["code"],
                    company_name=c_doc.get("company_name"),
                    contact_person=c_doc.get("contact_person"),
                    email=c_doc.get("email"),
                    phone=c_doc.get("phone"),
                    address=c_doc.get("address"),
                    country=c_doc.get("country", "Sri Lanka"),
                    tax_id=c_doc.get("tax_id"),
                )
                sql_db.add(c)
            sql_db.commit()
            logger.info(f"Restored {len(customers)} customers from MongoDB Atlas.")

        # 4. Check Vendors
        if sql_db.query(models.Vendor).count() == 0:
            vendors = list(db.vendors.find())
            for v_doc in vendors:
                v = models.Vendor(
                    id=v_doc["id"],
                    name=v_doc["name"],
                    code=v_doc["code"],
                    legal_name=v_doc.get("legal_name"),
                    trade_name=v_doc.get("trade_name"),
                    company_type=v_doc.get("company_type"),
                    contact_person=v_doc.get("contact_person"),
                    email=v_doc.get("email"),
                    phone=v_doc.get("phone"),
                    address=v_doc.get("address"),
                    country=v_doc.get("country", "India"),
                    gstin=v_doc.get("gstin"),
                    pan_number=v_doc.get("pan_number"),
                    main_category=v_doc.get("main_category"),
                    sub_categories=v_doc.get("sub_categories", []),
                    products_supplied=v_doc.get("products_supplied", []),
                    status=v_doc.get("status", "Active Supplier"),
                )
                sql_db.add(v)
            sql_db.commit()
            logger.info(f"Restored {len(vendors)} vendors from MongoDB Atlas.")

        # 5. Check Item Entries (Product Catalog)
        if sql_db.query(models.ItemEntry).count() == 0:
            items = list(db.item_entries.find())
            for doc in items:
                it = models.ItemEntry(
                    id=doc.get("id"),
                    item_name=doc.get("item_name"),
                    item_category=doc.get("item_category"),
                    item_classification=doc.get("item_classification", "NORMAL"),
                    unit=doc.get("unit", "KG"),
                    notes=doc.get("notes"),
                    currency=doc.get("currency", "LKR"),
                    tariff_line_id=doc.get("tariff_line_id"),
                    hs_code=doc.get("hs_code"),
                    tariff_description=doc.get("tariff_description"),
                    general_duty_rate=doc.get("general_duty_rate"),
                    vat_rate=doc.get("vat_rate"),
                    pal_rate=doc.get("pal_rate"),
                    cess_rate=doc.get("cess_rate"),
                    sscl_rate=doc.get("sscl_rate"),
                    excise_rate=doc.get("excise_rate"),
                    scl_rate=doc.get("scl_rate"),
                    weight_val=doc.get("weight_val", 0.0),
                    weight_unit=doc.get("weight_unit", "KG"),
                    is_favorite=doc.get("is_favorite", True),
                    purchase_price=doc.get("purchase_price"),
                    price_per_kg=doc.get("price_per_kg"),
                    total_quantity_kg=doc.get("total_quantity_kg"),
                    per_month_qty_kg=doc.get("per_month_qty_kg"),
                    total_value=doc.get("total_value"),
                    per_month_value=doc.get("per_month_value"),
                )
                sql_db.add(it)
            sql_db.commit()
            logger.info(f"Restored {len(items)} catalog items from MongoDB Atlas.")

    except Exception as e:
        sql_db.rollback()
        logger.error(f"Error restoring catalog from Mongo: {e}")
    finally:
        if should_close:
            sql_db.close()


def delete_shipment_from_mongo(shipment_id: int):
    """Deletes a shipment and its snapshot from MongoDB Atlas collections."""
    db = get_mongo_db()
    if db is None:
        return
    try:
        db.shipments.delete_one({"_id": shipment_id})
        db.shipments_cloud.delete_one({"_id": shipment_id})
        logger.info(f"Deleted shipment #{shipment_id} from Mongo Atlas.")
    except Exception as e:
        logger.error(f"Error deleting shipment #{shipment_id} from Mongo: {e}")


def sync_customer_to_mongo(customer_id: int):
    """Save/update a customer into MongoDB Atlas customers collection."""
    db = get_mongo_db()
    if db is None:
        return
    sql_db = SessionLocal()
    try:
        cust = sql_db.query(models.Customer).filter(models.Customer.id == customer_id).first()
        if not cust:
            return
        doc = {
            "_id": cust.id,
            "id": cust.id,
            "name": cust.name,
            "code": cust.code,
            "email": cust.email,
            "phone": cust.phone,
            "address": cust.address,
            "country": cust.country,
            "tax_id": cust.tax_id,
            "created_at": cust.created_at.isoformat() if cust.created_at else None,
            "updated_at": cust.updated_at.isoformat() if cust.updated_at else None,
        }
        db.customers.replace_one({"_id": cust.id}, doc, upsert=True)
        logger.info(f"Synced customer #{cust.id} ({cust.name}) to Mongo Atlas.")
    except Exception as e:
        logger.error(f"Error syncing customer #{customer_id} to Mongo: {e}")
    finally:
        sql_db.close()


def delete_customer_from_mongo(customer_id: int):
    """Deletes a customer from MongoDB Atlas customers collection."""
    db = get_mongo_db()
    if db is None:
        return
    try:
        db.customers.delete_one({"_id": customer_id})
        logger.info(f"Deleted customer #{customer_id} from Mongo Atlas.")
    except Exception as e:
        logger.error(f"Error deleting customer #{customer_id} from Mongo: {e}")


def restore_customers_from_mongo(sql_db: Optional[Session] = None):
    """Restores all customers from MongoDB Atlas into SQLite if local db missing or out of sync."""
    db = get_mongo_db()
    if db is None:
        return
    should_close = False
    if sql_db is None:
        sql_db = SessionLocal()
        should_close = True
    try:
        docs = list(db.customers.find())
        if not docs:
            return
        for c_doc in docs:
            c_id = c_doc.get("id") or c_doc.get("_id")
            existing = sql_db.query(models.Customer).filter(models.Customer.id == c_id).first()
            if not existing and c_doc.get("code"):
                existing = sql_db.query(models.Customer).filter(models.Customer.code == c_doc.get("code")).first()
            if not existing:
                cust = models.Customer(
                    id=c_id,
                    name=c_doc.get("name"),
                    code=c_doc.get("code"),
                    email=c_doc.get("email"),
                    phone=c_doc.get("phone"),
                    address=c_doc.get("address"),
                    country=c_doc.get("country", "Sri Lanka"),
                    tax_id=c_doc.get("tax_id")
                )
                sql_db.add(cust)
            else:
                if c_doc.get("name"): existing.name = c_doc.get("name")
                if c_doc.get("email"): existing.email = c_doc.get("email")
                if c_doc.get("phone"): existing.phone = c_doc.get("phone")
                if c_doc.get("address"): existing.address = c_doc.get("address")
                if c_doc.get("country"): existing.country = c_doc.get("country")
                if c_doc.get("tax_id"): existing.tax_id = c_doc.get("tax_id")
        sql_db.commit()
        logger.info(f"Restored {len(docs)} customers from MongoDB Atlas.")
    except Exception as e:
        sql_db.rollback()
        logger.error(f"Error restoring customers from Mongo: {e}")
    finally:
        if should_close:
            sql_db.close()


def sync_vendor_to_mongo(vendor_id: int):
    """Save/update a vendor into MongoDB Atlas vendors collection."""
    db = get_mongo_db()
    if db is None:
        return
    sql_db = SessionLocal()
    try:
        v = sql_db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
        if not v:
            return
        doc = {
            "_id": v.id,
            "id": v.id,
            "name": v.name,
            "code": v.code,
            "legal_name": v.legal_name,
            "trade_name": v.trade_name,
            "company_type": v.company_type,
            "contact_person": v.contact_person,
            "email": v.email,
            "phone": v.phone,
            "address": v.address,
            "country": v.country,
            "gstin": v.gstin,
            "pan_number": v.pan_number,
            "bank_account_number": v.bank_account_number,
            "bank_ifsc_code": v.bank_ifsc_code,
            "bank_name": v.bank_name,
            "bank_branch": v.bank_branch,
            "main_category": v.main_category,
            "sub_categories": v.sub_categories or [],
            "products_supplied": v.products_supplied or [],
            "status": v.status,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "updated_at": v.updated_at.isoformat() if v.updated_at else None,
        }
        db.vendors.replace_one({"_id": v.id}, doc, upsert=True)
        logger.info(f"Synced vendor #{v.id} ({v.name}) to Mongo Atlas.")
    except Exception as e:
        logger.error(f"Error syncing vendor #{vendor_id} to Mongo: {e}")
    finally:
        sql_db.close()


def delete_vendor_from_mongo(vendor_id: int):
    """Deletes a vendor from MongoDB Atlas vendors collection."""
    db = get_mongo_db()
    if db is None:
        return
    try:
        db.vendors.delete_one({"_id": vendor_id})
        logger.info(f"Deleted vendor #{vendor_id} from Mongo Atlas.")
    except Exception as e:
        logger.error(f"Error deleting vendor #{vendor_id} from Mongo: {e}")


def restore_vendors_from_mongo(sql_db: Optional[Session] = None):
    """Restores all vendors from MongoDB Atlas into SQLite if local db missing or out of sync."""
    db = get_mongo_db()
    if db is None:
        return
    should_close = False
    if sql_db is None:
        sql_db = SessionLocal()
        should_close = True
    try:
        docs = list(db.vendors.find())
        if not docs:
            return
        for v_doc in docs:
            v_id = v_doc.get("id") or v_doc.get("_id")
            existing = sql_db.query(models.Vendor).filter(models.Vendor.id == v_id).first()
            if not existing and v_doc.get("code"):
                existing = sql_db.query(models.Vendor).filter(models.Vendor.code == v_doc.get("code")).first()
            if not existing:
                vend = models.Vendor(
                    id=v_id,
                    name=v_doc.get("name"),
                    code=v_doc.get("code"),
                    legal_name=v_doc.get("legal_name"),
                    trade_name=v_doc.get("trade_name"),
                    company_type=v_doc.get("company_type"),
                    contact_person=v_doc.get("contact_person"),
                    email=v_doc.get("email"),
                    phone=v_doc.get("phone"),
                    address=v_doc.get("address"),
                    country=v_doc.get("country", "India"),
                    gstin=v_doc.get("gstin"),
                    pan_number=v_doc.get("pan_number"),
                    bank_account_number=v_doc.get("bank_account_number"),
                    bank_ifsc_code=v_doc.get("bank_ifsc_code"),
                    bank_name=v_doc.get("bank_name"),
                    bank_branch=v_doc.get("bank_branch"),
                    main_category=v_doc.get("main_category"),
                    sub_categories=v_doc.get("sub_categories", []),
                    products_supplied=v_doc.get("products_supplied", []),
                    status=v_doc.get("status", "Active Supplier")
                )
                sql_db.add(vend)
            else:
                if v_doc.get("name"): existing.name = v_doc.get("name")
                if v_doc.get("legal_name"): existing.legal_name = v_doc.get("legal_name")
                if v_doc.get("trade_name"): existing.trade_name = v_doc.get("trade_name")
                if v_doc.get("contact_person"): existing.contact_person = v_doc.get("contact_person")
                if v_doc.get("email"): existing.email = v_doc.get("email")
                if v_doc.get("phone"): existing.phone = v_doc.get("phone")
                if v_doc.get("address"): existing.address = v_doc.get("address")
                if v_doc.get("gstin"): existing.gstin = v_doc.get("gstin")
                if v_doc.get("pan_number"): existing.pan_number = v_doc.get("pan_number")
                if v_doc.get("main_category"): existing.main_category = v_doc.get("main_category")
                if v_doc.get("sub_categories"): existing.sub_categories = v_doc.get("sub_categories")
                if v_doc.get("products_supplied"): existing.products_supplied = v_doc.get("products_supplied")
                if v_doc.get("status"): existing.status = v_doc.get("status")
        sql_db.commit()
        logger.info(f"Restored {len(docs)} vendors from MongoDB Atlas.")
    except Exception as e:
        sql_db.rollback()
        logger.error(f"Error restoring vendors from Mongo: {e}")
    finally:
        if should_close:
            sql_db.close()


