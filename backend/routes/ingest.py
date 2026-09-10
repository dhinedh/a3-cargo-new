from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
import os
import shutil
from typing import List
from database import get_db
import models
import schemas
from extraction.parser import extract_pdf_tariff_data

router = APIRouter(prefix="/api/v1/ingest", tags=["Ingest"])

TARIFF_PDFS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tariff_pdfs")

@router.post("/reset")
def reset_database(db: Session = Depends(get_db)):
    """Wipe all chapters, tariff lines, and import logs from database."""
    db.query(models.TariffLine).delete()
    db.query(models.Chapter).delete()
    db.query(models.ImportLog).delete()
    db.commit()
    return {"status": "SUCCESS", "message": "Database wiped successfully."}


@router.post("/batch", response_model=schemas.BatchImportSummary)
def run_batch_import(db: Session = Depends(get_db)):
    """Run batch import pipeline over all PDF files in the /tariff_pdfs folder."""
    if not os.path.exists(TARIFF_PDFS_DIR):
        os.makedirs(TARIFF_PDFS_DIR, exist_ok=True)

    pdf_files = [f for f in os.listdir(TARIFF_PDFS_DIR) if f.endswith(".pdf")]
    
    total_processed = 0
    successful = 0
    failed = 0
    total_rows = 0
    logs: List[models.ImportLog] = []

    for pdf_file in pdf_files:
        total_processed += 1
        file_path = os.path.join(TARIFF_PDFS_DIR, pdf_file)
        
        meta, rows, errors = extract_pdf_tariff_data(file_path)
        
        if errors and not rows:
            failed += 1
            status = "FAILED"
        elif errors:
            successful += 1
            status = "WARNING"
        else:
            successful += 1
            status = "SUCCESS"

        # Create or update Chapter
        chap_num = meta.get("chapter_number", 0)
        chapter = db.query(models.Chapter).filter(models.Chapter.chapter_number == chap_num).first()
        
        if not chapter:
            chapter = models.Chapter(
                chapter_number=chap_num,
                section_number=meta.get("section_number"),
                section_title=meta.get("section_title"),
                chapter_title=meta.get("chapter_title"),
                source_pdf_filename=pdf_file
            )
            db.add(chapter)
            db.flush()
        else:
            chapter.section_number = meta.get("section_number") or chapter.section_number
            chapter.section_title = meta.get("section_title") or chapter.section_title
            chapter.chapter_title = meta.get("chapter_title") or chapter.chapter_title
            chapter.source_pdf_filename = pdf_file

        # Delete old lines for re-import
        db.query(models.TariffLine).filter(models.TariffLine.chapter_id == chapter.id).delete()

        # Insert extracted lines
        for r in rows:
            tariff_line = models.TariffLine(
                chapter_id=chapter.id,
                hs_code=r.get("hs_code"),
                description=r.get("description"),
                unit=r.get("unit"),
                icl_slsi=r.get("icl_slsi"),
                general_duty_rate=r.get("general_duty_rate"),
                preferential_rates=r.get("preferential_rates", {}),
                vat_rate=r.get("vat_rate"),
                pal_rate=r.get("pal_rate"),
                cess_rate=r.get("cess_rate"),
                sscl_rate=r.get("sscl_rate"),
                excise_rate=r.get("excise_rate"),
                scl_rate=r.get("scl_rate"),
                notes=r.get("notes"),
                indent_level=r.get("indent_level", 0),
                raw_row_text=r.get("raw_row_text"),
                page_number=r.get("page_number"),
                is_verified=False
            )
            db.add(tariff_line)


        rows_extracted = len(rows)
        total_rows += rows_extracted

        log = models.ImportLog(
            filename=pdf_file,
            status=status,
            rows_extracted=rows_extracted,
            errors=errors
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        logs.append(log)

    return {
        "total_files_processed": total_processed,
        "successful_files": successful,
        "failed_files": failed,
        "total_rows_extracted": total_rows,
        "logs": logs
    }

@router.post("/upload", response_model=schemas.ImportLogResponse)
def upload_single_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a single tariff PDF file and execute parsing."""
    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    os.makedirs(TARIFF_PDFS_DIR, exist_ok=True)
    save_path = os.path.join(TARIFF_PDFS_DIR, file.filename)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    meta, rows, errors = extract_pdf_tariff_data(save_path)
    status = "SUCCESS" if not errors else ("WARNING" if rows else "FAILED")

    chap_num = meta.get("chapter_number", 0)
    chapter = db.query(models.Chapter).filter(models.Chapter.chapter_number == chap_num).first()
    
    if not chapter:
        chapter = models.Chapter(
            chapter_number=chap_num,
            section_number=meta.get("section_number"),
            section_title=meta.get("section_title"),
            chapter_title=meta.get("chapter_title"),
            source_pdf_filename=file.filename
        )
        db.add(chapter)
        db.flush()

    db.query(models.TariffLine).filter(models.TariffLine.chapter_id == chapter.id).delete()

    for r in rows:
        tline = models.TariffLine(
            chapter_id=chapter.id,
            hs_code=r.get("hs_code"),
            description=r.get("description"),
            unit=r.get("unit"),
            icl_slsi=r.get("icl_slsi"),
            general_duty_rate=r.get("general_duty_rate"),
            preferential_rates=r.get("preferential_rates", {}),
            vat_rate=r.get("vat_rate"),
            pal_rate=r.get("pal_rate"),
            cess_rate=r.get("cess_rate"),
            sscl_rate=r.get("sscl_rate"),
            excise_rate=r.get("excise_rate"),
            scl_rate=r.get("scl_rate"),
            notes=r.get("notes"),
            indent_level=r.get("indent_level", 0),
            raw_row_text=r.get("raw_row_text"),
            page_number=r.get("page_number"),
            is_verified=False
        )
        db.add(tline)


    log = models.ImportLog(
        filename=file.filename,
        status=status,
        rows_extracted=len(rows),
        errors=errors
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return log

@router.get("/logs", response_model=List[schemas.ImportLogResponse])
def get_import_logs(db: Session = Depends(get_db)):
    """Fetch history of import logs."""
    return db.query(models.ImportLog).order_by(models.ImportLog.imported_at.desc()).all()
