import os
import sys
import re
import openpyxl
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base, get_mongo_db
import models

def format_hsn(raw):
    if not raw:
        return ""
    clean = re.sub(r'[^0-9]', '', str(raw).strip())
    if len(clean) == 8:
        return f"{clean[:4]}.{clean[4:6]}.{clean[6:]}"
    elif len(clean) == 6:
        return f"{clean[:4]}.{clean[4:6]}"
    elif len(clean) == 4:
        return clean
    return str(raw).strip()

def format_rate(val):
    if val is None or val == "":
        return None
    try:
        f = float(val)
        if f == 0:
            return "0%"
        elif f < 1:
            return f"{round(f * 100, 1)}%"
        else:
            return f"{int(f)}%" if f.is_integer() else f"{f}%"
    except Exception:
        return str(val).strip()

def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    excel_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'A3EXPRESS_10_26_27_DT_23_07_2026.xlsx')
    if not os.path.exists(excel_path):
        excel_path = os.path.join(os.getcwd(), 'A3EXPRESS_10_26_27_DT_23_07_2026.xlsx')
    
    print(f"Loading Excel workbook from: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, data_only=True)

    # 1. Parse DUTY_2025 to build rate map & base tariff categories
    duty_map = {}
    ws_duty = wb['DUTY_2025']
    duty_rows = list(ws_duty.iter_rows(values_only=True))
    for r in duty_rows[1:]:
        raw_hs = str(r[0]).strip() if r[0] is not None else ""
        desc = str(r[1]).strip() if len(r) > 1 and r[1] is not None else ""
        if not raw_hs or not re.sub(r'[^0-9]', '', raw_hs):
            continue
        
        hsn_formatted = format_hsn(raw_hs)
        raw_digits = re.sub(r'[^0-9]', '', raw_hs)
        
        # Column indexes from inspection:
        # Col 13: Unit
        unit = str(r[13]).strip() if len(r) > 13 and r[13] is not None else "KG"
        # Col 25: Gen Duty (0.2)
        gen_duty = format_rate(r[25]) if len(r) > 25 else None
        # Col 26: VAT (0.18)
        vat = format_rate(r[26]) if len(r) > 26 else None
        # Col 27: PAL_GEN (0.1)
        pal = format_rate(r[27]) if len(r) > 27 else None
        # Col 29: CESS_GEN (0.1)
        cess = format_rate(r[29]) if len(r) > 29 else None
        # Col 32: SSCL (0.025)
        sscl = format_rate(r[32]) if len(r) > 32 else None
        # Col 3: SCL
        scl = str(r[3]).strip() if len(r) > 3 and r[3] is not None else None
        
        info = {
            "raw_hs": raw_digits,
            "hs_code": hsn_formatted,
            "description": desc,
            "unit": unit,
            "gen_duty": gen_duty,
            "vat": vat,
            "pal": pal,
            "cess": cess,
            "sscl": sscl,
            "scl": scl
        }
        duty_map[raw_digits] = info
        duty_map[hsn_formatted] = info
        if len(raw_digits) >= 4:
            duty_map[raw_digits[:4]] = info

    print(f"Parsed {len(duty_rows)-1} rows from DUTY_2025.")

    # 2. Extract products from all sheets
    all_products = [] # list of dicts: {item_name, item_category, raw_hs, hs_code, unit, notes}

    # (A) DUTY_2025 commodities
    for r in duty_rows[1:]:
        raw_hs = str(r[0]).strip() if r[0] is not None else ""
        desc = str(r[1]).strip() if len(r) > 1 and r[1] is not None else ""
        if raw_hs and desc and re.sub(r'[^0-9]', '', raw_hs):
            digits = re.sub(r'[^0-9]', '', raw_hs)
            all_products.append({
                "item_name": desc,
                "item_category": desc,
                "raw_hs": digits,
                "hs_code": format_hsn(raw_hs),
                "unit": str(r[13]).strip() if len(r) > 13 and r[13] is not None else "KG",
                "source": "DUTY_2025"
            })

    # (B) ProductList (66 products)
    if 'ProductList' in wb.sheetnames:
        ws_prod = wb['ProductList']
        p_rows = list(ws_prod.iter_rows(values_only=True))[4:]
        for r in p_rows:
            raw_hs = str(r[5]).strip() if len(r) > 5 and r[5] is not None else ""
            cat = str(r[8]).strip() if len(r) > 8 and r[8] is not None else ""
            pname = str(r[9]).strip() if len(r) > 9 and r[9] is not None else ""
            if pname and pname not in ['0', 'None'] and raw_hs and re.sub(r'[^0-9]', '', raw_hs):
                digits = re.sub(r'[^0-9]', '', raw_hs)
                all_products.append({
                    "item_name": pname,
                    "item_category": cat or "General Food Products",
                    "raw_hs": digits,
                    "hs_code": format_hsn(raw_hs),
                    "unit": "PCS",
                    "source": "ProductList"
                })

    # (C) InvoiceGen (10 biscuit products)
    if 'InvoiceGen' in wb.sheetnames:
        ws_inv = wb['InvoiceGen']
        inv_rows = list(ws_inv.iter_rows(values_only=True))[2:]
        for r in inv_rows:
            pname = str(r[2]).strip() if len(r) > 2 and r[2] is not None else ""
            raw_hs = str(r[3]).strip() if len(r) > 3 and r[3] is not None else ""
            if pname and pname not in ['0', 'None'] and raw_hs and re.sub(r'[^0-9]', '', raw_hs):
                digits = re.sub(r'[^0-9]', '', raw_hs)
                all_products.append({
                    "item_name": pname,
                    "item_category": "Sweet Biscuits & Confectionery",
                    "raw_hs": digits,
                    "hs_code": format_hsn(raw_hs),
                    "unit": "PCS",
                    "source": "InvoiceGen"
                })

    # (D) Invoice_Colombo (132 products)
    if 'Invoice_Colombo' in wb.sheetnames:
        ws_col = wb['Invoice_Colombo']
        col_rows = list(ws_col.iter_rows(values_only=True))[3:]
        for r in col_rows:
            pname = str(r[3]).strip() if len(r) > 3 and r[3] is not None else ""
            raw_hs = str(r[4]).strip() if len(r) > 4 and r[4] is not None else ""
            if pname and pname not in ['0', 'None'] and raw_hs and re.sub(r'[^0-9]', '', raw_hs):
                digits = re.sub(r'[^0-9]', '', raw_hs)
                
                # Derive category from HSN or product name
                category = "General Cargo"
                if digits.startswith("1301"): category = "Gum Arabic / Asafoetida"
                elif digits.startswith("1905"): category = "Bakery & Biscuits"
                elif digits.startswith("2106"): category = "Food Preparations & Health Mixes"
                elif digits.startswith("0904"): category = "Chillies & Pepper"
                elif digits.startswith("2001"): category = "Pickles & Preserves"
                elif digits.startswith("2101"): category = "Coffee & Extracts"
                elif digits.startswith("1106"): category = "Gram & Pulse Flours"
                elif digits.startswith("1102"): category = "Cereal & Ragi Flours"
                elif digits.startswith("1904"): category = "Cornflakes & Cereals"
                elif digits.startswith("1902"): category = "Noodles & Pasta"
                elif digits.startswith("0405"): category = "Butter & Ghee"
                elif digits.startswith("0409"): category = "Honey"
                elif digits.startswith("2103"): category = "Sauces, Condiments & Masalas"
                elif digits.startswith("0909"): category = "Coriander & Seeds"
                elif digits.startswith("0910"): category = "Turmeric & Spices"
                elif digits.startswith("1901"): category = "Malt & Health Drinks"

                all_products.append({
                    "item_name": pname.replace('\n', ' ').strip(),
                    "item_category": category,
                    "raw_hs": digits,
                    "hs_code": format_hsn(raw_hs),
                    "unit": "PCS",
                    "source": "Invoice_Colombo"
                })

    print(f"Extracted {len(all_products)} product occurrences across workbook.")

    # 3. Deduplicate by clean item_name (keep most detailed record)
    unique_map = {}
    for p in all_products:
        clean_name = re.sub(r'\s+', ' ', p['item_name']).strip().lower()
        if not clean_name:
            continue
        if clean_name not in unique_map:
            unique_map[clean_name] = p
        else:
            # Upgrade if current record has category and previous didn't
            existing = unique_map[clean_name]
            if existing['item_category'] in ['General Cargo', ''] and p['item_category'] not in ['General Cargo', '']:
                unique_map[clean_name] = p

    print(f"Identified {len(unique_map)} distinct unique products to seed.")

    # 4. Ensure chapters and tariff lines exist
    chapter_cache = {c.chapter_number: c for c in db.query(models.Chapter).all()}
    def get_or_create_chapter(chap_num):
        if chap_num in chapter_cache:
            return chapter_cache[chap_num]
        sec_num = 1
        if 1 <= chap_num <= 5: sec_num = 1
        elif 6 <= chap_num <= 14: sec_num = 2
        elif chap_num == 15: sec_num = 3
        elif 16 <= chap_num <= 24: sec_num = 4
        elif 25 <= chap_num <= 27: sec_num = 5
        elif 28 <= chap_num <= 38: sec_num = 6
        elif 39 <= chap_num <= 40: sec_num = 7
        else: sec_num = 8
        c = models.Chapter(
            section_number=sec_num,
            section_title=f"SECTION {sec_num}",
            chapter_number=chap_num,
            chapter_title=f"Customs Tariff Chapter {chap_num:02d}",
            source_pdf_filename=f"Tariff_Chap_{chap_num:02d}.pdf"
        )
        db.add(c)
        db.commit()
        db.refresh(c)
        chapter_cache[chap_num] = c
        return c

    # Cache existing tariff lines by hs_code
    tl_cache = {tl.hs_code: tl for tl in db.query(models.TariffLine).filter(models.TariffLine.hs_code != None).all()}

    # 5. Clear or update ItemEntry table
    existing_items = {ie.item_name.strip().lower(): ie for ie in db.query(models.ItemEntry).all()}
    
    inserted_count = 0
    updated_count = 0
    
    for clean_name, p in unique_map.items():
        digits = p['raw_hs']
        rates = duty_map.get(digits) or duty_map.get(p['hs_code']) or duty_map.get(digits[:4]) or {}
        
        gen_duty = rates.get('gen_duty', '20%')
        vat = rates.get('vat', '18%')
        pal = rates.get('pal', 'Ex')
        cess = rates.get('cess', '10%')
        sscl = rates.get('sscl', '2.5%')

        # Find or create TariffLine
        hs_code = p['hs_code']
        chap_num = int(digits[:2]) if len(digits) >= 2 else 1
        chap = get_or_create_chapter(chap_num)
        
        if hs_code not in tl_cache:
            tl = models.TariffLine(
                chapter_id=chap.id,
                hs_code=hs_code,
                description=p['item_name'],
                unit=p['unit'] or "KG",
                general_duty_rate=gen_duty,
                vat_rate=vat,
                pal_rate=pal,
                cess_rate=cess,
                sscl_rate=sscl,
                is_verified=True
            )
            db.add(tl)
            db.commit()
            db.refresh(tl)
            tl_cache[hs_code] = tl
        else:
            tl = tl_cache[hs_code]
        
        if clean_name in existing_items:
            # Update existing
            ie = existing_items[clean_name]
            ie.hs_code = p['hs_code']
            ie.tariff_line_id = tl.id
            ie.item_category = p['item_category']
            ie.tariff_description = p['item_name']
            ie.general_duty_rate = gen_duty
            ie.vat_rate = vat
            ie.pal_rate = pal
            ie.cess_rate = cess
            ie.sscl_rate = sscl
            ie.is_favorite = True
            updated_count += 1
        else:
            # Create new
            ie = models.ItemEntry(
                item_name=p['item_name'],
                item_category=p['item_category'],
                item_classification="NORMAL",
                unit=p['unit'] or "KG",
                currency="LKR",
                tariff_line_id=tl.id,
                hs_code=p['hs_code'],
                tariff_description=p['item_name'],
                general_duty_rate=gen_duty,
                vat_rate=vat,
                pal_rate=pal,
                cess_rate=cess,
                sscl_rate=sscl,
                is_favorite=True
            )
            db.add(ie)
            inserted_count += 1

    db.commit()

    total_in_db = db.query(models.ItemEntry).count()
    print(f"\n==========================================")
    print(f"DATABASE SEEDING SUCCESSFUL!")
    print(f"Inserted: {inserted_count}")
    print(f"Updated: {updated_count}")
    print(f"Total Item Entries in Database: {total_in_db}")
    print(f"==========================================")

    # 6. Also sync to MongoDB if connected
    mongo_db = get_mongo_db()
    if mongo_db is not None:
        try:
            mongo_coll = mongo_db["item_entries"]
            print("Syncing products to MongoDB Atlas...")
            for clean_name, p in unique_map.items():
                digits = p['raw_hs']
                rates = duty_map.get(digits) or duty_map.get(p['hs_code']) or duty_map.get(digits[:4]) or {}
                mongo_coll.update_one(
                    {"item_name": p['item_name']},
                    {"$set": {
                        "item_name": p['item_name'],
                        "item_category": p['item_category'],
                        "hs_code": p['hs_code'],
                        "unit": p['unit'],
                        "general_duty_rate": rates.get('gen_duty', '20%'),
                        "vat_rate": rates.get('vat', '18%'),
                        "pal_rate": rates.get('pal', 'Ex'),
                        "cess_rate": rates.get('cess', '10%'),
                        "sscl_rate": rates.get('sscl', '2.5%'),
                        "is_favorite": True
                    }},
                    upsert=True
                )
            print("MongoDB Atlas sync complete!")
        except Exception as e:
            print(f"MongoDB sync notice: {e}")

    db.close()

if __name__ == '__main__':
    main()
