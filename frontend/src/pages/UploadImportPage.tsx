import React, { useState, useEffect } from 'react';
import { UploadCloud, FolderArchive, FileText, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import type { ImportLog, BatchImportSummary } from '../types';
import { apiClient } from '../api/client';

interface UploadImportPageProps {
  onImportComplete: () => void;
}

export const UploadImportPage: React.FC<UploadImportPageProps> = ({ onImportComplete }) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [lastSummary, setLastSummary] = useState<BatchImportSummary | null>(null);

  const fetchLogs = async () => {
    try {
      const data = await apiClient.getImportLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch import logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleResetDatabase = async () => {
    if (!confirm('Are you sure you want to clear all imported tariff lines and database records?')) return;
    try {
      await apiClient.resetDatabase();
      setLastSummary(null);
      await fetchLogs();
      onImportComplete();
      alert('Database cleared successfully.');
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };


  const handleFileUpload = async (file: File) => {
    const isPdf = file.name.endsWith('.pdf');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isPdf && !isExcel) {
      alert('Please select a valid PDF tariff document or Excel shipment workbook (.xlsx).');
      return;
    }

    setUploading(true);
    try {
      if (isPdf) {
        await apiClient.uploadSinglePdf(file);
        alert(`Successfully ingested PDF tariff document: ${file.name}`);
      } else {
        const res = await apiClient.ingestExcelWorkbook(file);
        alert(`Successfully ingested Excel shipment workbook!\nShipment No: ${res.shipment_no}\nProducts Imported: ${res.products_imported}`);
      }
      await fetchLogs();
      onImportComplete();
    } catch (err: any) {
      alert(`Upload failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleBatchImport = async () => {
    setBatchRunning(true);
    try {
      const summary = await apiClient.triggerBatchImport();
      setLastSummary(summary);
      await fetchLogs();
      onImportComplete();
    } catch (err: any) {
      alert(`Batch import failed: ${err.message}`);
    } finally {
      setBatchRunning(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">PDF Ingestion & Ingest Pipeline</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload single chapter PDFs or trigger an automated batch extraction of all 97 chapter PDFs placed in <code className="bg-slate-900 px-2 py-0.5 rounded text-indigo-400 font-mono">/tariff_pdfs</code>.
        </p>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Single Drag & Drop Upload Zone */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              Upload Chapter PDF
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Select or drop a specific chapter tariff PDF to parse and append/update tariff lines.
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-indigo-500 bg-indigo-950/20'
                  : 'border-slate-700/80 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950'
              }`}
            >
              <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">
                {uploading ? 'Processing PDF extraction...' : 'Drag and drop your chapter PDF here'}
              </p>
              <p className="text-xs text-slate-500 mt-1">or click to browse local files</p>
              <input
                type="file"
                accept=".pdf"
                disabled={uploading}
                onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                className="hidden"
                id="file-upload-input"
              />
              <label
                htmlFor="file-upload-input"
                className="mt-4 inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg cursor-pointer transition-all"
              >
                Choose File
              </label>
            </div>
          </div>
        </div>

        {/* Batch Import Trigger Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <FolderArchive className="w-5 h-5 text-indigo-400" />
              Batch Import /tariff_pdfs Folder
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Scans all PDF files in the local <code className="text-indigo-400 font-mono">/tariff_pdfs</code> workspace directory and runs high-precision extraction.
            </p>

            <div className="bg-slate-950/60 rounded-xl p-5 border border-slate-800/80 mb-6">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Pipeline Steps Executed:</h4>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Detect Chapter & Section metadata from text headers</li>
                <li>Dynamic header column normalization (Duty, VAT, PAL, CESS, SCL)</li>
                <li>Multi-line row grouping & indent level calculation</li>
                <li>Database upsert & error diagnostics logging</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleBatchImport}
            disabled={batchRunning}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {batchRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Running Batch Ingestion Pipeline...</span>
              </>
            ) : (
              <>
                <FolderArchive className="w-4 h-4" />
                <span>Trigger Batch Import Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Batch Import Summary Report Card */}
      {lastSummary && (
        <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-5 shadow-lg">
          <h3 className="font-semibold text-indigo-300 text-sm mb-3">Batch Import Execution Report</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="text-xl font-bold text-white font-mono">{lastSummary.total_files_processed}</div>
              <div className="text-xs text-slate-400">PDFs Processed</div>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="text-xl font-bold text-emerald-400 font-mono">{lastSummary.successful_files}</div>
              <div className="text-xs text-slate-400">Successful</div>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="text-xl font-bold text-rose-400 font-mono">{lastSummary.failed_files}</div>
              <div className="text-xs text-slate-400">Failed</div>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="text-xl font-bold text-indigo-400 font-mono">{lastSummary.total_rows_extracted}</div>
              <div className="text-xs text-slate-400">Rows Extracted</div>
            </div>
          </div>
        </div>
      )}

      {/* Ingestion Diagnostics Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-base">Ingestion History & Diagnostics Log</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDatabase}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs transition-colors font-medium"
              title="Clear Database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Database</span>
            </button>
            <button
              onClick={fetchLogs}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>


        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-6">Source PDF Filename</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Rows Extracted</th>
                <th className="py-3.5 px-6">Errors / Warnings</th>
                <th className="py-3.5 px-6 text-right">Imported At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No ingestion logs yet. Run a batch import above to populate data.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-6 font-mono text-slate-200 text-xs font-medium">{log.filename}</td>
                    <td className="py-3 px-4 text-center">
                      {log.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> SUCCESS
                        </span>
                      )}
                      {log.status === 'WARNING' && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                          <AlertTriangle className="w-3 h-3" /> WARNING
                        </span>
                      )}
                      {log.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                          <XCircle className="w-3 h-3" /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-400 font-bold">{log.rows_extracted}</td>
                    <td className="py-3 px-6 text-xs text-slate-400">
                      {log.errors && log.errors.length > 0 ? (
                        <span className="text-rose-400">{log.errors.join(', ')}</span>
                      ) : (
                        <span className="text-slate-600">Clean extraction</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-xs text-slate-500">
                      {new Date(log.imported_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
