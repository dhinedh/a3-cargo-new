import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from extraction.parser import extract_pdf_tariff_data

def inspect_sample_pdfs():
    pdf_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tariff_pdfs")
    
    if not os.path.exists(pdf_dir):
        print(f"Error: {pdf_dir} directory not found.")
        return

    pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith(".pdf")]
    
    if not pdf_files:
        print("No PDF files found in /tariff_pdfs directory.")
        return

    print("=" * 80)
    print(f"INSPECTING {len(pdf_files)} SAMPLE PDF TARIFF SCHEDULES IN {pdf_dir}")
    print("=" * 80)

    for pdf_file in pdf_files:
        file_path = os.path.join(pdf_dir, pdf_file)
        print(f"\nFILE: {pdf_file}")
        print("-" * 80)
        
        meta, rows, errors = extract_pdf_tariff_data(file_path)
        
        print(f"CHAPTER METADATA: {meta}")
        print(f"EXTRACTED ROWS COUNT: {len(rows)}")
        if errors:
            print(f"ERRORS: {errors}")
        
        print("\nSAMPLE EXTRACTED TARIFF ROWS:")
        for idx, r in enumerate(rows[:5]):  # Print top 5 rows
            print(f"  Row [{idx+1}]:")
            print(f"    - HS Code       : {r['hs_code']}")
            print(f"    - Description   : {r['description']}")
            print(f"    - Indent Level  : {r['indent_level']}")
            print(f"    - Unit          : {r['unit']}")
            print(f"    - Gen Duty      : {r['general_duty_rate']}")
            print(f"    - VAT / PAL     : VAT: {r['vat_rate']}, PAL: {r['pal_rate']}")
            print(f"    - Preferential  : {r['preferential_rates']}")
            print(f"    - CESS / SCL    : CESS: {r['cess_rate']}, SCL: {r['scl_rate']}")
        print("-" * 80)

if __name__ == "__main__":
    inspect_sample_pdfs()
