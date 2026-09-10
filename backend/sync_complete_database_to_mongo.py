import os
import sys
import openpyxl
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, SessionLocal, get_mongo_db, MONGODB_URL
from migrate_db import run_migrations
import models

def sync_complete_database():
    print("=" * 60)
    print("A3 Express - Complete Database Synchronization to MongoDB Atlas")
    print("=" * 60)

    # Auto-migrate SQLite schema & create database tables if they do not exist
    try:
        run_migrations()
    except Exception as e:
        print(f"Migration notice: {e}")

    Base.metadata.create_all(bind=engine)
    
    # 1. Connect to MongoDB Atlas
    mongo_db = get_mongo_db()
    if mongo_db is None:
        print("[ERROR] Could not connect to MongoDB Atlas at:", MONGODB_URL[:35] + "...")
        return False

    print("[OK] Connected to MongoDB Atlas cluster 'a3_express' successfully!")

    sql_db = SessionLocal()
    try:
        # -------------------------------------------------------------
        # 2. Seed Customers if empty
        # -------------------------------------------------------------
        existing_customers = sql_db.query(models.Customer).all()
        if not existing_customers:
            print("[INFO] Seeding initial customers from Excel configuration...")
            default_customers = [
                models.Customer(name="NATRAJ EXPORTS & IMPORTS", code="CUST-001", email="orders@natrajexports.com", phone="+94 77 123 4567", address="145 Main Street, Pettah, Colombo 11", country="Sri Lanka", tax_id="TIN-98765432"),
                models.Customer(name="COLOMBO WHOLESALERS LTD", code="CUST-002", email="procurement@colombowholesale.lk", phone="+94 71 987 6543", address="88 Sea Street, Colombo 11", country="Sri Lanka", tax_id="TIN-87654321"),
                models.Customer(name="LANKA FOOD DISTRIBUTORS", code="CUST-003", email="contact@lankafoods.lk", phone="+94 11 234 5678", address="25 Galle Road, Colombo 03", country="Sri Lanka", tax_id="TIN-76543210"),
            ]
            sql_db.add_all(default_customers)
            sql_db.commit()
            for c in default_customers:
                sql_db.refresh(c)
            print(f"  -> Created {len(default_customers)} initial customer records in SQLite.")

        # -------------------------------------------------------------
        # 3. Seed Vendors if empty
        # -------------------------------------------------------------
        existing_vendors = sql_db.query(models.Vendor).all()
        if not existing_vendors:
            print("[INFO] Seeding initial vendor partners...")
            default_vendors = [
                models.Vendor(
                    name="Sakthi Masala Pvt Ltd",
                    code="VEND-SAKT-001",
                    legal_name="Sakthi Masala Private Limited",
                    trade_name="Sakthi Masala",
                    company_type="Private Limited",
                    contact_person="P. Duraisamy",
                    email="exports@sakthimasala.com",
                    phone="+91 424 253 3601",
                    address="Mamarathupalayam, Erode, Tamil Nadu 638004",
                    country="India",
                    gstin="33AAACS1234F1Z5",
                    pan_number="AAACS1234F",
                    bank_name="State Bank of India",
                    bank_account_number="30123456789",
                    bank_ifsc_code="SBIN0001234",
                    bank_branch="Erode Main",
                    main_category="Raw Materials",
                    sub_categories=["Spices & Masala"],
                    products_supplied=["Special Chilli Powder", "Daniya Powder", "Turmeric Powder", "Sakthi Chicken Masala", "Sakthi Rasam Powder"],
                    status="Active Supplier"
                ),
                models.Vendor(
                    name="Naga Limited - Foods Division",
                    code="VEND-NAGA-002",
                    legal_name="Naga Limited",
                    trade_name="Naga Foods",
                    company_type="Public Limited",
                    contact_person="K. Soundararajan",
                    email="sales@nagalimited.com",
                    phone="+91 451 241 0121",
                    address="No. 1, Anna Pillai Street, Dindigul, Tamil Nadu 624001",
                    country="India",
                    gstin="33AAACN5678G1Z2",
                    pan_number="AAACN5678G",
                    bank_name="HDFC Bank",
                    bank_account_number="50200012345678",
                    bank_ifsc_code="HDFC0000456",
                    bank_branch="Dindigul",
                    main_category="Raw Materials",
                    sub_categories=["Urad & Dal Flours", "Grains & Millets"],
                    products_supplied=["Ragi Flour", "Naga Gram Flour", "Maida", "Atta (Wheat Flour)", "Sooji / Rava"],
                    status="Active Supplier"
                ),
                models.Vendor(
                    name="Britannia Industries Limited",
                    code="VEND-BRIT-003",
                    legal_name="Britannia Industries Ltd",
                    trade_name="Britannia",
                    company_type="Public Limited",
                    contact_person="M. Varma",
                    email="exports@britannia.co.in",
                    phone="+91 80 3768 7100",
                    address="Britannia Gardens, Airport Road, Bangalore, Karnataka 560017",
                    country="India",
                    gstin="29AAACB1234H1Z3",
                    pan_number="AAACB1234H",
                    bank_name="ICICI Bank",
                    bank_account_number="000205012345",
                    bank_ifsc_code="ICIC0000002",
                    bank_branch="Bangalore Main",
                    main_category="General Import/Export Goods",
                    sub_categories=["Customs Tariff Goods"],
                    products_supplied=["50-50 Biscuit", "50-50 Cheese Dipper", "GoodDay Butter Biscuit", "GoodDay Cashew Biscuit", "Marie Gold"],
                    status="Active Supplier"
                )
            ]
            sql_db.add_all(default_vendors)
            sql_db.commit()
            for v in default_vendors:
                sql_db.refresh(v)
            print(f"  -> Created {len(default_vendors)} initial vendor records in SQLite.")

        # -------------------------------------------------------------
        # 4. Seed Initial Shipment if empty
        # -------------------------------------------------------------
        existing_shipments = sql_db.query(models.Shipment).all()
        if not existing_shipments:
            print("[INFO] Seeding initial baseline shipment 'A3-2026-001' (2026_6_2_NATRAJ)...")
            cust = sql_db.query(models.Customer).first()
            first_shipment = models.Shipment(
                shipment_no="A3-2026-001",
                sequence_number=1,
                financial_year="2026-2027",
                shipment_date="2026-07-23",
                status="CONFIGURED",
                destination="Colombo Port, Sri Lanka",
                currency="INR",
                current_stage="Stage 1: Customer Requirements",
                usd_rate=305.0,
                lkr_inr_rate=3.65,
                profit_margin_pct=15.0,
                margin_mode="MARGIN_ON_REVENUE",
                common_expenses_inr=25000.0,
                common_expenses_lkr=91250.0,
                notes="Initial baseline shipment extracted from Excel A3EXPRESS_10_26_27_DT_23_07_2026.xlsx"
            )
            sql_db.add(first_shipment)
            sql_db.commit()
            sql_db.refresh(first_shipment)

            if cust:
                sc = models.ShipmentCustomer(shipment_id=first_shipment.id, customer_id=cust.id, allocation_pct=100.0)
                sql_db.add(sc)
                sql_db.commit()

            # Add sample customer requirements
            sample_reqs = [
                models.ShipmentCustomerRequirement(shipment_id=first_shipment.id, customer_id=cust.id if cust else 1, product_name="SPECIAL CHILLI POWDER - 200 G", hs_code="0904.21.90", required_quantity=100, unit="Carton", notes="Standard Colombo export pack"),
                models.ShipmentCustomerRequirement(shipment_id=first_shipment.id, customer_id=cust.id if cust else 1, product_name="50-50 BISCUIT 140.6 G", hs_code="1905.31.00", required_quantity=400, unit="Carton", notes="Sweet biscuit export"),
                models.ShipmentCustomerRequirement(shipment_id=first_shipment.id, customer_id=cust.id if cust else 1, product_name="RAGI FLOUR 500 G", hs_code="1102.90.20", required_quantity=200, unit="Pack", notes="Kurakkan flour demand"),
                models.ShipmentCustomerRequirement(shipment_id=first_shipment.id, customer_id=cust.id if cust else 1, product_name="JUNIOR HORLICKS 500G", hs_code="1901.90.99", required_quantity=150, unit="Carton", notes="Malt drink requirement"),
            ]
            sql_db.add_all(sample_reqs)
            sql_db.commit()
            print("  -> Created baseline shipment A3-2026-001 with customer requirements.")

        # -------------------------------------------------------------
        # 5. SYNC TO MONGODB ATLAS
        # -------------------------------------------------------------
        print("\n[INFO] Starting full sync to MongoDB Atlas collections...")

        # A. Sync Chapters
        chapters = sql_db.query(models.Chapter).all()
        if chapters:
            mongo_db.chapters.delete_many({})
            ch_docs = []
            for ch in chapters:
                ch_docs.append({
                    "_id": ch.id,
                    "id": ch.id,
                    "chapter_number": ch.chapter_number,
                    "section_number": ch.section_number,
                    "section_title": ch.section_title,
                    "chapter_title": ch.chapter_title,
                    "total_lines": len(ch.tariff_lines) if ch.tariff_lines else 0,
                    "synced_at": datetime.utcnow().isoformat()
                })
            mongo_db.chapters.insert_many(ch_docs)
            print(f"  [MongoDB] Synced {len(ch_docs)} Chapters -> collection 'chapters'")

        # B. Sync Tariff Lines
        tariff_lines = sql_db.query(models.TariffLine).all()
        if tariff_lines:
            mongo_db.tariff_lines.delete_many({})
            tl_docs = []
            for tl in tariff_lines:
                tl_docs.append({
                    "_id": tl.id,
                    "id": tl.id,
                    "chapter_id": tl.chapter_id,
                    "hs_code": tl.hs_code,
                    "description": tl.description,
                    "unit": tl.unit,
                    "general_duty_rate": tl.general_duty_rate,
                    "vat_rate": tl.vat_rate,
                    "pal_rate": tl.pal_rate,
                    "cess_rate": tl.cess_rate,
                    "sscl_rate": tl.sscl_rate,
                    "excise_rate": tl.excise_rate,
                    "synced_at": datetime.utcnow().isoformat()
                })
            mongo_db.tariff_lines.insert_many(tl_docs)
            print(f"  [MongoDB] Synced {len(tl_docs)} Tariff Lines -> collection 'tariff_lines'")

        # C. Sync Item Entries (ALL 284 Excel Products with Categories and HSN Codes)
        items = sql_db.query(models.ItemEntry).all()
        if items:
            mongo_db.item_entries.delete_many({})
            it_docs = []
            for it in items:
                it_docs.append({
                    "_id": it.id,
                    "id": it.id,
                    "item_name": it.item_name,
                    "item_category": it.item_category,
                    "hs_code": it.hs_code,
                    "tariff_description": it.tariff_description,
                    "tariff_line_id": it.tariff_line_id,
                    "unit": it.unit,
                    "currency": it.currency,
                    "purchase_price": float(it.purchase_price) if it.purchase_price is not None else None,
                    "price_per_kg": float(it.price_per_kg) if it.price_per_kg is not None else None,
                    "weight_val": float(it.weight_val) if it.weight_val is not None else 1.0,
                    "weight_unit": it.weight_unit or "KG",
                    "general_duty_rate": it.general_duty_rate,
                    "vat_rate": it.vat_rate,
                    "pal_rate": it.pal_rate,
                    "cess_rate": it.cess_rate,
                    "sscl_rate": it.sscl_rate,
                    "is_favorite": it.is_favorite,
                    "synced_at": datetime.utcnow().isoformat()
                })
            mongo_db.item_entries.insert_many(it_docs)
            print(f"  [MongoDB] Synced {len(it_docs)} Products with HSN & Categories -> collection 'item_entries'")

        # D. Sync Customers
        customers = sql_db.query(models.Customer).all()
        if customers:
            mongo_db.customers.delete_many({})
            cust_docs = []
            for c in customers:
                cust_docs.append({
                    "_id": c.id,
                    "id": c.id,
                    "name": c.name,
                    "code": c.code,
                    "email": c.email,
                    "phone": c.phone,
                    "address": c.address,
                    "country": c.country,
                    "tax_id": c.tax_id,
                    "synced_at": datetime.utcnow().isoformat()
                })
            mongo_db.customers.insert_many(cust_docs)
            print(f"  [MongoDB] Synced {len(cust_docs)} Customers -> collection 'customers'")

        # E. Sync Vendors
        vendors = sql_db.query(models.Vendor).all()
        if vendors:
            mongo_db.vendors.delete_many({})
            vend_docs = []
            for v in vendors:
                vend_docs.append({
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
                    "bank_name": v.bank_name,
                    "bank_account_number": v.bank_account_number,
                    "bank_ifsc_code": v.bank_ifsc_code,
                    "bank_branch": v.bank_branch,
                    "main_category": v.main_category,
                    "sub_categories": v.sub_categories or [],
                    "products_supplied": v.products_supplied or [],
                    "status": v.status,
                    "synced_at": datetime.utcnow().isoformat()
                })
            mongo_db.vendors.insert_many(vend_docs)
            print(f"  [MongoDB] Synced {len(vend_docs)} Vendors -> collection 'vendors'")

        # F. Sync Shipments
        shipments = sql_db.query(models.Shipment).all()
        if shipments:
            mongo_db.shipments.delete_many({})
            mongo_db.shipments_cloud.delete_many({})
            sh_docs = []
            for sh in shipments:
                c_list = [
                    {"id": sc.customer.id, "name": sc.customer.name, "code": sc.customer.code, "country": sc.customer.country}
                    for sc in sh.customers if sc.customer
                ]
                p_list = []
                for p in sh.products:
                    p_list.append({
                        "id": p.id,
                        "customer_id": p.customer_id,
                        "product_name": p.product_name,
                        "product_category": p.product_category,
                        "hsn_code": p.hsn_code,
                        "quantity": float(p.quantity or 0.0),
                        "unit": p.unit
                    })
                r_list = []
                for r in sql_db.query(models.ShipmentCustomerRequirement).filter(models.ShipmentCustomerRequirement.shipment_id == sh.id).all():
                    r_list.append({
                        "id": r.id,
                        "customer_id": r.customer_id,
                        "product_name": r.product_name,
                        "hs_code": r.hs_code,
                        "required_quantity": float(r.required_quantity or 0.0),
                        "unit": r.unit,
                        "notes": r.notes
                    })
                sh_doc = {
                    "_id": sh.id,
                    "id": sh.id,
                    "financial_year": sh.financial_year,
                    "sequence_number": sh.sequence_number,
                    "shipment_no": sh.shipment_no,
                    "shipment_date": sh.shipment_date,
                    "status": sh.status,
                    "current_stage": sh.current_stage,
                    "destination": sh.destination,
                    "currency": sh.currency,
                    "usd_rate": float(sh.usd_rate or 305.0),
                    "lkr_inr_rate": float(sh.lkr_inr_rate or 3.65),
                    "profit_margin_pct": float(sh.profit_margin_pct or 15.0),
                    "customers": c_list,
                    "products": p_list,
                    "requirements": r_list,
                    "synced_at": datetime.utcnow().isoformat()
                }
                sh_docs.append(sh_doc)

            mongo_db.shipments.insert_many(sh_docs)
            mongo_db.shipments_cloud.insert_many(sh_docs)
            print(f"  [MongoDB] Synced {len(sh_docs)} Shipments -> collections 'shipments' & 'shipments_cloud'")

        print("\n" + "=" * 60)
        print("[SUCCESS] Complete database successfully synced to MongoDB Atlas!")
        print(f"MongoDB URI: {MONGODB_URL[:35]}...")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"[ERROR] Sync failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        sql_db.close()

if __name__ == "__main__":
    sync_complete_database()
