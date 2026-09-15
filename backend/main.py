from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from migrate_db import run_migrations
from routes import ingest, tariff, export, items, customers, shipments, documents, excel_ingest, vendors, requirements, allocations

from mongo_sync import restore_shipments_from_mongo, restore_catalog_from_mongo

# Auto-migrate SQLite schema & create database tables if they do not exist
try:
    run_migrations()
except Exception as e:
    print(f"Migration notice: {e}")

Base.metadata.create_all(bind=engine)

# Auto-restore catalog & shipments from MongoDB Atlas cloud if container or DB restarted
try:
    restore_catalog_from_mongo()
    restore_shipments_from_mongo()
except Exception as e:
    print(f"Mongo restore notice: {e}")

app = FastAPI(
    title="A3 Express Software - Shipment & Tariff API",
    description="Digitized Harmonized System (HS) Import Tariff & Shipment Management System",
    version="2.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://a3-cargo-new.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global exception caught: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )

# Include API routers
app.include_router(ingest.router)
app.include_router(tariff.router)
app.include_router(export.router)
app.include_router(items.router)
app.include_router(customers.router)
app.include_router(shipments.router)
app.include_router(documents.router)
app.include_router(excel_ingest.router)
app.include_router(vendors.router)
app.include_router(requirements.router)
app.include_router(allocations.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Sri Lanka Customs Import Tariff API",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
