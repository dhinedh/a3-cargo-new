from database import SessionLocal
import models
from mongo_sync import sync_shipment_to_mongo

def seed_demo_shipment_if_empty():
    db = SessionLocal()
    try:
        count = db.query(models.Shipment).count()
        if count > 0:
            return

        print("Seeding initial demonstration shipment AEC/1001/2026-27...")
        
        # 1. Customers
        c1 = db.query(models.Customer).filter(models.Customer.name == "Lanka Retail Distributors").first()
        if not c1:
            c1 = models.Customer(name="Lanka Retail Distributors", code="LRD", country="Sri Lanka")
            db.add(c1)
        
        c2 = db.query(models.Customer).filter(models.Customer.name == "Ceylon Spices & Agri Ltd").first()
        if not c2:
            c2 = models.Customer(name="Ceylon Spices & Agri Ltd", code="CSA", country="Sri Lanka")
            db.add(c2)
        
        db.commit()

        # 2. Shipment Header
        sh = models.Shipment(
            financial_year="2026-27",
            sequence_number=1001,
            shipment_no="AEC/1001/2026-27",
            status="DRAFT",
            current_stage="2_VENDOR_ALLOCATION",
            usd_rate=305.0,
            lkr_inr_rate=3.65,
            profit_margin_pct=15.0
        )
        db.add(sh)
        db.commit()
        db.refresh(sh)

        # Link Customers
        sc1 = models.ShipmentCustomer(shipment_id=sh.id, customer_id=c1.id)
        sc2 = models.ShipmentCustomer(shipment_id=sh.id, customer_id=c2.id)
        db.add(sc1)
        db.add(sc2)
        db.commit()

        # 3. Vendors
        v1 = db.query(models.Vendor).filter(models.Vendor.name == "India Grain Exporters Pvt Ltd").first()
        if not v1:
            v1 = models.Vendor(name="India Grain Exporters Pvt Ltd", code="IGE", country="India")
            db.add(v1)
        
        v2 = db.query(models.Vendor).filter(models.Vendor.name == "Apex Mills India").first()
        if not v2:
            v2 = models.Vendor(name="Apex Mills India", code="AMI", country="India")
            db.add(v2)
        db.commit()

        # 4. Customer Requirements
        r1 = models.ShipmentCustomerRequirement(
            shipment_id=sh.id,
            customer_id=c1.id,
            product_name="Ragi (Finger Millet)",
            hsn_code="10082920",
            required_quantity=120,
            unit="CTNS",
            target_price=250.0,
            currency="INR"
        )
        r2 = models.ShipmentCustomerRequirement(
            shipment_id=sh.id,
            customer_id=c2.id,
            product_name="Basmati Rice",
            hsn_code="10063020",
            required_quantity=80,
            unit="BAGS",
            target_price=450.0,
            currency="INR"
        )
        db.add(r1)
        db.add(r2)
        db.commit()

        # Sync to MongoDB Atlas
        sync_shipment_to_mongo(sh.id)
        print(f"Successfully seeded Shipment #{sh.shipment_no} and synced to MongoDB Atlas!")

    except Exception as e:
        print(f"Error seeding demo shipment: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_shipment_if_empty()
