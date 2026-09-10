# Sri Lanka Customs Import Tariff Digitizer

A full-stack monorepo application to extract, digitize, review, search, and export the Sri Lanka Customs Import Tariff schedule (97 chapter PDFs covering Harmonized System Sections I–XXI).

## Project Structure

```
root/
├── frontend/                -> React 18 + TypeScript + Vite + Tailwind CSS UI
├── backend/                 -> Python FastAPI REST API + pdfplumber extraction service
│   ├── extraction/          -> PDF table extraction engine & sample inspector
│   ├── routes/              -> REST API endpoints (/api/v1/ingest, /tariff, /export)
│   ├── models.py            -> SQLAlchemy ORM models (Chapters, TariffLines, ImportLogs)
│   ├── database.py          -> SQLite / PostgreSQL database connection setup
│   ├── generate_sample_pdfs.py -> Generator script for test tariff PDFs
│   ├── requirements.txt     -> Python backend dependencies
│   └── test_batch_import.py -> Batch extraction CLI test script
├── tariff_pdfs/             -> Workspace folder for source chapter PDFs (Chapters 01 to 97 + Preamble)
└── README.md                -> Setup and run instructions
```

---

## Technical Stack & Architecture Rationale

### Backend (`/backend`)
- **Python FastAPI + `pdfplumber`**: Selected for superior PDF table structure extraction compared to Node.js `pdf-parse`. Customs tariff schedules contain varying column structures, multi-line row wrappings, and non-standard tax levy headers (VAT, PAL, CESS, Excise, SCL, ISFTA, SAFTA, APTA). `pdfplumber` provides line coordinate analysis and dynamic column header mapping.
- **SQLAlchemy + SQLite / PostgreSQL**: Provides structured storage for `chapters`, `tariff_lines`, and `import_logs`.
- **Pandas + OpenPyXL**: Generates structured CSV and Microsoft Excel (`.xlsx`) downloads.

### Frontend (`/frontend`)
- **React 18 + TypeScript + Vite + Tailwind CSS v4**: Decoupled single-page application connected strictly via REST API (`/api/v1/...`).
- **Lucide Icons & Tailwind CSS**: Glassmorphic, dark-mode design with split-screen human verification studio, real-time search, filter drawers, and upload dropzone.

---

## Quick Start & Setup Instructions

### 1. Backend Setup (`/backend`)

#### Environment Prerequisites
- Python 3.10+
- Port: `8000`

#### Steps
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Generate sample test tariff PDFs in /tariff_pdfs
python generate_sample_pdfs.py

# Run backend API dev server
uvicorn main:app --reload --port 8000
```
- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

---

### 2. Frontend Setup (`/frontend`)

#### Environment Prerequisites
- Node.js v18+ and npm
- Port: `5173`

#### Steps
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run Vite development server
npm run dev
```
- Web Application URL: `http://localhost:5173`

---

## Core Features & Workflow

1. **PDF Ingestion & Batch Pipeline**:
   - Place chapter PDFs (e.g. `Tariff 2022 Section I Final_Chap_01.pdf`, `..._Chap_02.pdf`, etc.) in `/tariff_pdfs/`.
   - Click **"Trigger Batch Import Now"** on the PDF Ingestion page or drag-and-drop individual PDFs.
2. **Sample Header Inspection**:
   - Run `python backend/extraction/sample_inspector.py` to preview raw extracted table structures and detected headers.
3. **Human Verification & Editing Studio**:
   - Open **Verification Studio** tab to inspect parsed rows side-by-side with original text references.
   - Edit any misparsed HS codes, descriptions, or rates inline and click **"Confirm & Mark Verified"**.
4. **Search & Browse**:
   - Search by 8-digit tariff line (e.g. `0101.21.00`), keyword, or filter by Section (I–XXI) and Chapter (1–97).
   - View expandable levy breakdowns (General Duty, VAT, PAL, CESS, Excise, SCL, ISFTA, SAFTA, APTA).
5. **CSV & Excel Export**:
   - Download the full digitized tariff schedule or filtered subset as `.csv` or `.xlsx` files.

---

## Environment Variables

### Backend (`/backend/.env`)
```env
DATABASE_URL=sqlite:///./tariff.db
PORT=8000
```

### Frontend (`/frontend/.env.local`)
```env
VITE_API_BASE_URL=http://localhost:8000
```
