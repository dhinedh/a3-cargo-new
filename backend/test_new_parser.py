# pyrefly: ignore [missing-import]
import pdfplumber
import os
import re

pdf_path1 = r"d:\ZECH SOFT\projects\a3 express software\tariff_pdfs\Sample_Tariff_2026_Section_TEST_Chap_99 (1).pdf"
pdf_path2 = r"d:\ZECH SOFT\projects\a3 express software\Import Tariff Guide 16.05.2026\2.Tariff 2022 Section I Final Printable (Chapter 1-5)\Tariff 2022 Section I Final_Chap_01.pdf"

PREF_MAP = {
    "AP": "APTA",
    "AD": "AD",
    "BN": "BIMSTEC",
    "GT": "GSTP",
    "IN": "ISFTA",
    "PK": "PSFTA",
    "SA": "SAFTA",
    "SF": "SAFTA-SF",
    "SD": "SAFTA-LDC",
    "SG": "Singapore FTA"
}

def parse_pdf_accurate(pdf_path):
    print("=" * 80)
    print(f"PARSING: {os.path.basename(pdf_path)}")
    print("=" * 80)
    
    extracted_rows = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue

                # Find column mapping from header row
                col_map = {}
                header_found = False
                
                # Check for two-row header
                for idx in range(min(4, len(table))):
                    row = table[idx]
                    row_str = " ".join([str(c) for c in row if c])
                    if "HS Code" in row_str or "Description" in row_str or "Gen Duty" in row_str or "HS Hdg" in row_str:
                        header_found = True
                        for c_idx, cell in enumerate(row):
                            val = str(cell).replace("\n", " ").strip() if cell else ""
                            if "HS Hdg" in val or "HS Heading" in val:
                                col_map[c_idx] = "hs_hdg"
                            elif "HS Code" in val:
                                col_map[c_idx] = "hs_code"
                            elif "Description" in val:
                                col_map[c_idx] = "description"
                            elif "Unit" in val:
                                col_map[c_idx] = "unit"
                            elif "ICL" in val:
                                col_map[c_idx] = "icl_slsi"
                            elif "Gen Duty" in val:
                                col_map[c_idx] = "general_duty_rate"
                            elif "VAT" in val:
                                col_map[c_idx] = "vat_rate"
                            elif "PAL" in val:
                                col_map[c_idx] = "pal_rate"
                            elif "Cess" in val:
                                col_map[c_idx] = "cess_rate"
                            elif "Excise" in val:
                                col_map[c_idx] = "excise_rate"
                            elif "SSCL" in val:
                                col_map[c_idx] = "sscl_rate"
                            elif "SCL" in val and "SSCL" not in val:
                                col_map[c_idx] = "scl_rate"
                        
                        # Also check row+1 for subheaders (e.g., AP, AD, IN, PK, SA)
                        if idx + 1 < len(table):
                            sub_row = table[idx + 1]
                            for c_idx, cell in enumerate(sub_row):
                                sub_val = str(cell).strip() if cell else ""
                                if sub_val in PREF_MAP:
                                    col_map[c_idx] = f"pref_{sub_val}"

                # Default fallback map if standard Sri Lanka Customs table grid (24 columns)
                if not col_map and len(table[0]) >= 15:
                    col_map = {
                        0: "hs_hdg", 1: "hs_code", 2: "indent_dashes", 3: "description",
                        4: "unit", 5: "icl_slsi", 6: "pref_AP", 7: "pref_AD", 8: "pref_BN",
                        9: "pref_GT", 10: "pref_IN", 11: "pref_PK", 12: "pref_SA", 13: "pref_SF",
                        14: "pref_SD", 15: "pref_SG", 16: "general_duty_rate", 17: "vat_rate",
                        18: "pal_rate", 20: "cess_rate", 21: "excise_rate", 22: "sscl_rate", 23: "scl_rate"
                    }

                # Extract data rows
                for row_idx, row in enumerate(table):
                    row_str = " ".join([str(c) for c in row if c])
                    if "HS Code" in row_str or "Description" in row_str or "Preferential" in row_str:
                        continue
                    if not any(row):
                        continue

                    hs_hdg = ""
                    hs_code = ""
                    indent_dashes = ""
                    description = ""
                    unit = ""
                    icl_slsi = ""
                    gen_duty = ""
                    vat = ""
                    pal = ""
                    cess = ""
                    excise = ""
                    sscl = ""
                    scl = ""
                    pref_rates = {}

                    for c_idx, cell in enumerate(row):
                        val = str(cell).strip() if cell else ""
                        key = col_map.get(c_idx, f"col_{c_idx}")
                        
                        if key == "hs_hdg": hs_hdg = val
                        elif key == "hs_code": hs_code = val
                        elif key == "indent_dashes": indent_dashes = val
                        elif key == "description": description = val
                        elif key == "unit": unit = val
                        elif key == "icl_slsi": icl_slsi = val
                        elif key == "general_duty_rate": gen_duty = val
                        elif key == "vat_rate": vat = val
                        elif key == "pal_rate": pal = val
                        elif key == "cess_rate": cess = val
                        elif key == "excise_rate": excise = val
                        elif key == "sscl_rate": sscl = val
                        elif key == "scl_rate": scl = val
                        elif key.startswith("pref_"):
                            pref_code = key.replace("pref_", "")
                            scheme_name = PREF_MAP.get(pref_code, pref_code)
                            if val and val != "-":
                                pref_rates[scheme_name] = val

                    # Clean description
                    description = re.sub(r'\s+', ' ', description).strip()
                    
                    # If this is a Heading row (e.g. HS Hdg 01.01 or 99.01)
                    if hs_hdg and not hs_code:
                        extracted_rows.append({
                            "type": "heading",
                            "hs_code": hs_hdg,
                            "description": description,
                            "indent_level": 0,
                            "unit": None, "gen_duty": None, "vat": None, "pal": None, "cess": None, "sscl": None, "pref": {}
                        })
                        continue

                    # If this is a Subheading description row (e.g. "- Horses:")
                    if not hs_hdg and not hs_code and description and not gen_duty:
                        indent_level = len(indent_dashes) if indent_dashes else (1 if description.startswith("-") else 0)
                        extracted_rows.append({
                            "type": "subheading",
                            "hs_code": None,
                            "description": description,
                            "indent_level": indent_level,
                            "unit": None, "gen_duty": None, "vat": None, "pal": None, "cess": None, "sscl": None, "pref": {}
                        })
                        continue

                    # If this is a Tariff Line row (e.g. 0101.21 or 9901.10)
                    if hs_code:
                        indent_level = len(indent_dashes) if indent_dashes else (description.count("-") if description.startswith("-") else 2)
                        extracted_rows.append({
                            "type": "tariff_line",
                            "hs_code": hs_code,
                            "description": description,
                            "indent_level": indent_level,
                            "unit": unit or None,
                            "gen_duty": gen_duty or None,
                            "vat": vat or None,
                            "pal": pal or None,
                            "cess": cess or None,
                            "sscl": sscl or None,
                            "excise": excise or None,
                            "scl": scl or None,
                            "icl_slsi": icl_slsi or None,
                            "pref": pref_rates
                        })

    print(f"Extracted {len(extracted_rows)} structured items:")
    for idx, r in enumerate(extracted_rows[:10]):
        print(f"[{idx+1}] [{r['type'].upper()}] HS: {r['hs_code']} | Indent: {r['indent_level']} | Desc: {r['description']} | Unit: {r['unit']} | Gen: {r['gen_duty']} | VAT: {r['vat']} | SSCL: {r['sscl']} | Pref: {r['pref']}")

if __name__ == "__main__":
    parse_pdf_accurate(pdf_path1)
    parse_pdf_accurate(pdf_path2)
