import sqlite3

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
            # If base ends in .10, .20, .30, etc. (like 1905.31.10):
            # index 1 => .11, index 2 => .12
            # If base ends in .00 (like 2001.90.00):
            # index 1 => .01, index 2 => .02
            # If already a sub-code like .11 or .12, find base 10/00
            if base_val % 10 != 0 and base_val > 10:
                base_val = (base_val // 10) * 10
            elif base_val > 0 and base_val < 10:
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

def migrate_shipment_hsn_codes():
    conn = sqlite3.connect("tariff.db")
    cur = conn.cursor()

    cur.execute("SELECT DISTINCT shipment_id FROM shipment_products")
    shipment_ids = [r[0] for r in cur.fetchall()]

    total_updated = 0
    for sid in shipment_ids:
        cur.execute("SELECT id, product_category, hsn_code FROM shipment_products WHERE shipment_id = ? ORDER BY id", (sid,))
        products = cur.fetchall()
        
        cat_counts = {}
        for pid, cat, hsn in products:
            if not hsn:
                continue
            clean_hsn = hsn.strip()
            
            # Extract base HSN prefix
            base_hsn = clean_hsn
            if "." in clean_hsn:
                parts = clean_hsn.split(".")
                if len(parts) >= 3 and parts[-1].isdigit():
                    last_num = int(parts[-1])
                    if last_num % 10 != 0 and last_num > 10:
                        base_last = (last_num // 10) * 10
                    elif last_num < 10:
                        base_last = 0
                    else:
                        base_last = last_num
                    width = len(parts[-1])
                    prefix_str = ".".join(parts[:-1])
                    base_hsn = f"{prefix_str}.{base_last:0{width}d}"
            elif clean_hsn.isdigit() and len(clean_hsn) >= 6:
                val = int(clean_hsn)
                base_val = (val // 10) * 10
                base_hsn = f"{base_val:0{len(clean_hsn)}d}"

            cat_counts[base_hsn] = cat_counts.get(base_hsn, 0) + 1
            seq_idx = cat_counts[base_hsn]
            
            new_hsn = format_sub_hsn(base_hsn, seq_idx)
            if new_hsn != clean_hsn:
                cur.execute("UPDATE shipment_products SET hsn_code = ? WHERE id = ?", (new_hsn, pid))
                total_updated += 1

    conn.commit()
    conn.close()
    print(f"Migration finished: Updated {total_updated} shipment products with sequential sub-item HSN codes!")

if __name__ == "__main__":
    migrate_shipment_hsn_codes()
