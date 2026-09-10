# pyrefly: ignore [missing-import]
import pdfplumber
import os

pdf_path1 = r"d:\ZECH SOFT\projects\a3 express software\tariff_pdfs\Sample_Tariff_2026_Section_TEST_Chap_99 (1).pdf"
pdf_path2 = r"d:\ZECH SOFT\projects\a3 express software\Import Tariff Guide 16.05.2026\2.Tariff 2022 Section I Final Printable (Chapter 1-5)\Tariff 2022 Section I Final_Chap_01.pdf"

def inspect_pdf(path, name):
    print("=" * 80)
    print(f"INSPECTING {name}: {path}")
    print("=" * 80)
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return

    with pdfplumber.open(path) as pdf:
        for page_idx, page in enumerate(pdf.pages[:3]):
            print(f"\n--- PAGE {page_idx+1} ---")
            text = page.extract_text() or ""
            print("PAGE TEXT SNIPPET (First 300 chars):")
            print(text[:300])
            print("\nEXTRACTED TABLES:")
            tables = page.extract_tables()
            for t_idx, table in enumerate(tables):
                print(f"Table {t_idx+1} (rows: {len(table)}):")
                for row_idx, row in enumerate(table[:10]):
                    print(f"  Row [{row_idx}]: {row}")

if __name__ == "__main__":
    inspect_pdf(pdf_path1, "SAMPLE CHAP 99")
    inspect_pdf(pdf_path2, "OFFICIAL CHAP 01")
