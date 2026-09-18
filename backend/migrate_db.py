import sqlite3

def run_migrations():
    conn = sqlite3.connect('tariff.db')
    cur = conn.cursor()

    columns_to_ensure = [
        ('item_entries', 'unit', 'VARCHAR DEFAULT "KG"'),
        ('item_entries', 'scl_rate', 'VARCHAR'),
        ('item_entries', 'weight_val', 'NUMERIC DEFAULT 0.0'),
        ('item_entries', 'weight_unit', 'VARCHAR DEFAULT "KG"'),
        ('item_entries', 'is_favorite', 'BOOLEAN DEFAULT 1'),
        ('item_entries', 'purchase_price', 'NUMERIC'),
        ('vendors', 'legal_name', 'VARCHAR'),
        ('vendors', 'trade_name', 'VARCHAR'),
        ('vendors', 'company_type', 'VARCHAR'),
        ('vendors', 'gstin', 'VARCHAR'),
        ('vendors', 'pan_number', 'VARCHAR'),
        ('vendors', 'bank_account_number', 'VARCHAR'),
        ('vendors', 'bank_ifsc_code', 'VARCHAR'),
        ('vendors', 'bank_name', 'VARCHAR'),
        ('vendors', 'bank_branch', 'VARCHAR'),
        ('vendors', 'main_category', 'VARCHAR'),
        ('vendors', 'sub_categories', 'TEXT'),
        ('vendors', 'products_supplied', 'TEXT'),
        ('vendors', 'status', 'VARCHAR DEFAULT "Active Supplier"'),
        ('shipments', 'destination', 'VARCHAR DEFAULT "Colombo Port, Sri Lanka"'),
        ('shipments', 'currency', 'VARCHAR DEFAULT "INR"'),
        ('shipments', 'current_stage', 'VARCHAR DEFAULT "1_SHIPMENT_CREATION"'),
        ('item_entries', 'item_classification', 'VARCHAR DEFAULT "NORMAL"'),
        ('shipment_products', 'item_classification', 'VARCHAR DEFAULT "NORMAL"'),
        ('shipment_products', 'is_active', 'BOOLEAN DEFAULT 1'),
        ('shipment_products', 'stage_status', 'VARCHAR DEFAULT "REQUESTED"'),
        ('shipment_receiving_verifications', 'received_pieces', 'NUMERIC DEFAULT 0.0'),
        ('shipment_receiving_verifications', 'damaged_qty', 'NUMERIC DEFAULT 0.0'),
        ('shipment_receiving_verifications', 'missing_qty', 'NUMERIC DEFAULT 0.0'),
        ('shipment_receiving_verifications', 'excess_qty', 'NUMERIC DEFAULT 0.0'),
        ('shipment_vendor_proforma_items', 'sku', 'VARCHAR'),
        ('shipment_vendor_proforma_items', 'hsn_code', 'VARCHAR'),
        ('shipments', 'margin_mode', 'VARCHAR DEFAULT "MARGIN_ON_REVENUE"'),
        ('shipments', 'indian_invoice_margin_pct', 'NUMERIC DEFAULT 15.0'),
        ('shipments', 'colombo_invoice_margin_pct', 'NUMERIC DEFAULT 15.0'),
        ('shipment_customer_requirements', 'hsn_code', 'VARCHAR'),
        ('shipment_vendor_proforma_items', 'mrp', 'NUMERIC DEFAULT 0.0'),
        ('shipment_vendor_proforma_items', 'discount_pct', 'NUMERIC DEFAULT 0.0'),
        ('shipment_vendor_proforma_items', 'gst_pct', 'NUMERIC DEFAULT 0.0'),
        ('shipment_vendor_proforma_items', 'total_payable', 'NUMERIC DEFAULT 0.0'),
        ('shipments', 'is_deleted', 'BOOLEAN DEFAULT 0'),
    ]

    for table, col, col_def in columns_to_ensure:
        cur.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in cur.fetchall()]
        if col not in cols:
            print(f"Adding {col} to {table}...")
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")

    conn.commit()
    conn.close()
    print("Database migration completed successfully!")

if __name__ == "__main__":
    run_migrations()
