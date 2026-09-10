# pyrefly: ignore [missing-import]
import pdfplumber
import re
import os
from typing import Dict, List, Any, Tuple

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

def extract_pdf_tariff_data(file_path: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[str]]:
    """Extract chapter metadata and structured tariff lines from Sri Lanka Customs PDF documents."""
    filename = os.path.basename(file_path)
    
    # Extract metadata from filename
    chap_match = re.search(r'Chap_(\d+)', filename, re.IGNORECASE)
    chapter_num = int(chap_match.group(1)) if chap_match else 0
    
    sec_match = re.search(r'Section\s+([IVXLCDM]+)', filename, re.IGNORECASE)
    section_num = sec_match.group(1) if sec_match else ""

    chapter_meta = {
        "chapter_number": chapter_num,
        "section_number": section_num,
        "section_title": f"Section {section_num}" if section_num else "",
        "chapter_title": f"Chapter {chapter_num:02d}",
        "source_pdf_filename": filename
    }

    tariff_rows: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                page_num = page_idx + 1
                text = page.extract_text() or ""
                
                # Check header metadata on page 1
                if page_idx == 0:
                    chap_title_match = re.search(r'Chapter\s+(\d+)\s*\n(.*)', text, re.IGNORECASE)
                    if chap_title_match:
                        if not chapter_meta["chapter_number"]:
                            chapter_meta["chapter_number"] = int(chap_title_match.group(1))
                        chapter_meta["chapter_title"] = chap_title_match.group(2).strip()

                tables = page.extract_tables()
                if not tables:
                    continue

                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    # Dynamic Column Header Detection
                    col_map = {}
                    for idx in range(min(4, len(table))):
                        row = table[idx]
                        row_str = " ".join([str(c) for c in row if c])
                        if any(kw in row_str for kw in ["HS Code", "Description", "Gen Duty", "HS Hdg"]):
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
                            
                            # Subheaders check for preferential trade columns
                            if idx + 1 < len(table):
                                sub_row = table[idx + 1]
                                for c_idx, cell in enumerate(sub_row):
                                    sub_val = str(cell).strip() if cell else ""
                                    if sub_val in PREF_MAP:
                                        col_map[c_idx] = f"pref_{sub_val}"

                    # Fallback map for standard 24-column Sri Lanka Customs table grid
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
                        if any(kw in row_str for kw in ["HS Code", "Description", "Preferential Duty"]):
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

                        description = re.sub(r'\s+', ' ', description).strip()
                        if not description and not hs_code and not hs_hdg:
                            continue

                        # Case 1: Heading Row (e.g. HS Hdg 01.01 or 99.01)
                        if hs_hdg and not hs_code:
                            tariff_rows.append({
                                "hs_code": hs_hdg,
                                "description": description,
                                "indent_level": 0,
                                "unit": None,
                                "icl_slsi": None,
                                "general_duty_rate": None,
                                "preferential_rates": {},
                                "vat_rate": None, "pal_rate": None, "cess_rate": None, "sscl_rate": None, "excise_rate": None, "scl_rate": None,
                                "raw_row_text": f"HEADING {hs_hdg}: {description}",
                                "page_number": page_num,
                                "is_verified": False
                            })
                            continue

                        # Case 2: Subheading Text Row (e.g. "- Horses:")
                        if not hs_hdg and not hs_code and description and not gen_duty:
                            indent_level = len(indent_dashes) if indent_dashes else (1 if description.startswith("-") else 0)
                            tariff_rows.append({
                                "hs_code": None,
                                "description": description,
                                "indent_level": indent_level,
                                "unit": None,
                                "icl_slsi": None,
                                "general_duty_rate": None,
                                "preferential_rates": {},
                                "vat_rate": None, "pal_rate": None, "cess_rate": None, "sscl_rate": None, "excise_rate": None, "scl_rate": None,
                                "raw_row_text": f"SUBHEADING: {description}",
                                "page_number": page_num,
                                "is_verified": False
                            })
                            continue

                        # Case 3: Tariff Line Row (e.g. 0101.21 or 9901.10)
                        if hs_code:
                            indent_level = len(indent_dashes) if indent_dashes else (description.count("-") if description.startswith("-") else 2)
                            tariff_rows.append({
                                "hs_code": hs_code,
                                "description": description,
                                "indent_level": indent_level,
                                "unit": unit or None,
                                "icl_slsi": icl_slsi or None,
                                "general_duty_rate": gen_duty or None,
                                "preferential_rates": pref_rates,
                                "vat_rate": vat or None,
                                "pal_rate": pal or None,
                                "cess_rate": cess or None,
                                "sscl_rate": sscl or None,
                                "excise_rate": excise or None,
                                "scl_rate": scl or None,
                                "raw_row_text": f"HS: {hs_code} | Desc: {description} | Unit: {unit} | Gen: {gen_duty} | VAT: {vat} | SSCL: {sscl}",
                                "page_number": page_num,
                                "is_verified": False
                            })

    except Exception as e:
        errors.append(f"PDF Extraction Error in {filename}: {str(e)}")

    return chapter_meta, tariff_rows, errors
