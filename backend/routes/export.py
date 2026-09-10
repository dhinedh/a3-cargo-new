from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import Optional
import pandas as pd
import io
from database import get_db
import models

router = APIRouter(prefix="/api/v1/export", tags=["Export"])

def build_export_dataframe(db: Session, chapter_id: Optional[int], query: Optional[str]):
    q = db.query(models.TariffLine).join(models.Chapter)

    if chapter_id:
        q = q.filter(models.TariffLine.chapter_id == chapter_id)
    if query:
        clean_q = query.strip()
        q = q.filter(
            models.TariffLine.hs_code.ilike(f"%{clean_q}%") |
            models.TariffLine.description.ilike(f"%{clean_q}%")
        )

    lines = q.order_by(models.TariffLine.chapter_id, models.TariffLine.id).all()

    data = []
    for line in lines:
        row = {
            "Chapter": line.chapter.chapter_number,
            "Section": line.chapter.section_number,
            "HS Code": line.hs_code or "",
            "Description": line.description or "",
            "Indent Level": line.indent_level,
            "Unit": line.unit or "",
            "ICL/SLSI": line.icl_slsi or "",
            "General Duty Rate": line.general_duty_rate or "",
            "VAT Rate": line.vat_rate or "",
            "PAL Rate": line.pal_rate or "",
            "CESS Rate": line.cess_rate or "",
            "SSCL Rate": line.sscl_rate or "",
            "Excise Rate": line.excise_rate or "",
            "SCL Rate": line.scl_rate or "",
            "Preferential Rates": str(line.preferential_rates or {}),
            "Page Number": line.page_number or "",
            "Verified": "Yes" if line.is_verified else "No"
        }

        data.append(row)

    return pd.DataFrame(data)

@router.get("/csv")
def export_csv(
    chapter_id: Optional[int] = Query(None),
    query: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Export tariff lines as a CSV file download."""
    df = build_export_dataframe(db, chapter_id, query)
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    stream.seek(0)

    headers = {'Content-Disposition': 'attachment; filename="sri_lanka_customs_tariff.csv"'}
    return StreamingResponse(io.BytesIO(stream.getvalue().encode('utf-8')), media_type="text/csv", headers=headers)

@router.get("/excel")
def export_excel(
    chapter_id: Optional[int] = Query(None),
    query: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Export tariff lines as an Excel (.xlsx) file download."""
    df = build_export_dataframe(db, chapter_id, query)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Import Tariff')
    
    output.seek(0)
    headers = {'Content-Disposition': 'attachment; filename="sri_lanka_customs_tariff.xlsx"'}
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
