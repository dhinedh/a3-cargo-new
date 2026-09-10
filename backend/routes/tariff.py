from fastapi import APIRouter, Depends, HTTPException, Query
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import or_, func
from typing import List, Optional
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/v1/tariff", tags=["Tariff"])

@router.get("/sections", response_model=List[schemas.ChapterResponse])
def get_sections_and_chapters(db: Session = Depends(get_db)):
    """Fetch chapters and sections with total tariff lines count."""
    chapters = db.query(models.Chapter).order_by(models.Chapter.chapter_number).all()
    results = []

    for chap in chapters:
        line_count = db.query(func.count(models.TariffLine.id)).filter(models.TariffLine.chapter_id == chap.id).scalar()
        results.append({
            "id": chap.id,
            "chapter_number": chap.chapter_number,
            "section_number": chap.section_number,
            "section_title": chap.section_title,
            "chapter_title": chap.chapter_title,
            "source_pdf_filename": chap.source_pdf_filename,
            "last_imported_at": chap.last_imported_at,
            "total_lines": line_count or 0
        })
    return results

@router.get("/lines")
def search_tariff_lines(
    query: Optional[str] = Query(None, description="HS code or description search string"),
    chapter_id: Optional[int] = Query(None, description="Filter by Chapter ID"),
    section_number: Optional[str] = Query(None, description="Filter by Section Number (e.g. I, XVI)"),
    is_verified: Optional[bool] = Query(None, description="Filter by verification status"),
    duty_type: Optional[str] = Query(None, description="Filter by duty presence e.g. 'gen', 'vat', 'cess'"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Search and filter tariff lines with pagination."""
    q = db.query(models.TariffLine).join(models.Chapter)

    if chapter_id:
        q = q.filter(models.TariffLine.chapter_id == chapter_id)

    if section_number:
        q = q.filter(models.Chapter.section_number == section_number)

    if is_verified is not None:
        q = q.filter(models.TariffLine.is_verified == is_verified)

    if query:
        clean_query = query.strip()
        q = q.filter(
            or_(
                models.TariffLine.hs_code.ilike(f"%{clean_query}%"),
                models.TariffLine.description.ilike(f"%{clean_query}%"),
                models.TariffLine.raw_row_text.ilike(f"%{clean_query}%")
            )
        )

    if duty_type:
        duty_clean = duty_type.lower()
        if duty_clean == 'gen':
            q = q.filter(models.TariffLine.general_duty_rate.isnot(None), models.TariffLine.general_duty_rate != "Free")
        elif duty_clean == 'vat':
            q = q.filter(models.TariffLine.vat_rate.isnot(None), models.TariffLine.vat_rate != "-")
        elif duty_clean == 'cess':
            q = q.filter(models.TariffLine.cess_rate.isnot(None), models.TariffLine.cess_rate != "-")

    total_count = q.count()
    offset = (page - 1) * page_size
    items = q.order_by(models.TariffLine.chapter_id, models.TariffLine.id).offset(offset).limit(page_size).all()

    formatted_items = []
    for item in items:
        formatted_items.append({
            "id": item.id,
            "chapter_id": item.chapter_id,
            "chapter_number": item.chapter.chapter_number,
            "section_number": item.chapter.section_number,
            "hs_code": item.hs_code,
            "description": item.description,
            "unit": item.unit,
            "icl_slsi": item.icl_slsi,
            "general_duty_rate": item.general_duty_rate,
            "preferential_rates": item.preferential_rates or {},
            "vat_rate": item.vat_rate,
            "pal_rate": item.pal_rate,
            "cess_rate": item.cess_rate,
            "sscl_rate": item.sscl_rate,
            "excise_rate": item.excise_rate,
            "scl_rate": item.scl_rate,
            "notes": item.notes,
            "indent_level": item.indent_level,
            "raw_row_text": item.raw_row_text,
            "page_number": item.page_number,
            "is_verified": item.is_verified
        })


    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size,
        "items": formatted_items
    }

@router.put("/lines/{line_id}", response_model=schemas.TariffLineResponse)
def update_tariff_line(line_id: int, payload: schemas.TariffLineUpdate, db: Session = Depends(get_db)):
    """Update a tariff line row (Human Review & Edit Step)."""
    tline = db.query(models.TariffLine).filter(models.TariffLine.id == line_id).first()
    if not tline:
        raise HTTPException(status_code=404, detail="Tariff line not found")

    update_data = payload.dict(exclude_unset=True)
    for field, val in update_data.items():
        setattr(tline, field, val)

    db.commit()
    db.refresh(tline)
    return tline

@router.post("/lines/{line_id}/verify", response_model=schemas.TariffLineResponse)
def verify_tariff_line(line_id: int, db: Session = Depends(get_db)):
    """Mark a tariff line as human-verified."""
    tline = db.query(models.TariffLine).filter(models.TariffLine.id == line_id).first()
    if not tline:
        raise HTTPException(status_code=404, detail="Tariff line not found")

    tline.is_verified = True
    db.commit()
    db.refresh(tline)
    return tline
