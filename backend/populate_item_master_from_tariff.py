import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
import models

def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        print("Fetching all extracted tariff line items from database...")
        tlines = db.query(models.TariffLine).filter(models.TariffLine.hs_code != None).all()
        print(f"Found {len(tlines)} valid tariff lines with HS codes.")

        existing_hs = set(r[0] for r in db.query(models.ItemEntry.hs_code).all() if r[0])
        
        new_items = []
        for t in tlines:
            if not t.description or t.description.strip() == "":
                continue
                
            # Avoid duplicate seeding if HS code already exists in Item Master
            if t.hs_code in existing_hs:
                continue

            item = models.ItemEntry(
                item_name=t.description[:250],
                item_category=t.chapter.chapter_title if t.chapter else "General Tariff Product",
                item_classification="NORMAL",
                unit=t.unit or "KG",
                notes=t.notes,
                currency="LKR",
                tariff_line_id=t.id,
                hs_code=t.hs_code,
                tariff_description=t.description,
                general_duty_rate=t.general_duty_rate,
                vat_rate=t.vat_rate,
                pal_rate=t.pal_rate,
                cess_rate=t.cess_rate,
                sscl_rate=t.sscl_rate,
                excise_rate=t.excise_rate,
                scl_rate=t.scl_rate,
                is_favorite=True
            )
            new_items.append(item)
            existing_hs.add(t.hs_code)

        print(f"Bulk adding {len(new_items)} product items to Item Master (item_entries)...")
        db.bulk_save_objects(new_items)
        db.commit()

        total_items = db.query(models.ItemEntry).count()
        print(f"\n--- ITEM MASTER SEEDING COMPLETE ---")
        print(f"Total Products in Item Master: {total_items}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding item master: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
