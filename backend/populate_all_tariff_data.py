import os
import sys

# Ensure backend folder is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
import models
from routes.ingest import run_batch_import

def main():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Starting batch ingestion of all 121 Tariff PDF files from /tariff_pdfs...")
        result = run_batch_import(db)
        print("\n--- BATCH IMPORT COMPLETE ---")
        print(f"Total PDF Files Processed: {result['total_files_processed']}")
        print(f"Successful Files: {result['successful_files']}")
        print(f"Failed Files: {result['failed_files']}")
        print(f"Total Tariff Line Items Extracted: {result['total_rows_extracted']}")
    except Exception as e:
        print(f"Error during batch ingestion: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
