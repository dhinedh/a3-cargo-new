from database import SessionLocal, get_mongo_db
import models

def clear_all_mock_data():
    """Clears pre-seeded demo/mock shipments from SQLite database and MongoDB Atlas Cloud."""
    db = SessionLocal()
    try:
        # Delete demo allocations, proformas, requirements, customer links, and shipments
        db.query(models.ShipmentVendorAllocation).delete()
        db.query(models.ShipmentVendorProformaItem).delete()
        db.query(models.ShipmentCustomerRequirement).delete()
        db.query(models.ShipmentCustomer).delete()
        db.query(models.ShipmentProduct).delete()
        db.query(models.ShipmentActual).delete()
        db.query(models.ShipmentPurchaseOrder).delete()
        db.query(models.PackingListSequence).delete()
        db.query(models.ShipmentPackingList).delete()
        db.query(models.ShipmentPackingListItem).delete()
        db.query(models.ShipmentActivityLog).delete()
        db.query(models.Shipment).delete()
        db.commit()
        print("Cleared all mock/demo shipments from local database successfully!")

        # Clear MongoDB Atlas Cloud shipments
        mongo_db = get_mongo_db()
        if mongo_db is not None:
            mongo_db.shipments_cloud.delete_many({})
            print("Cleared all mock/demo shipments from MongoDB Atlas cloud database!")

    except Exception as e:
        print(f"Error clearing mock data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_all_mock_data()
