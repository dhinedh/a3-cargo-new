import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Filter } from 'lucide-react';
import type { Chapter } from '../types';
import { apiClient } from '../api/client';

interface ExportPageProps {
  chapters: Chapter[];
}

export const ExportPage: React.FC<ExportPageProps> = ({ chapters }) => {
  const [selectedChapterId, setSelectedChapterId] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const handleDownloadCsv = () => {
    const url = apiClient.getExportCsvUrl(selectedChapterId, searchQuery.trim() || undefined);
    window.open(url, '_blank');
  };

  const handleDownloadExcel = () => {
    const url = apiClient.getExportExcelUrl(selectedChapterId, searchQuery.trim() || undefined);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Export Tariff Database</h1>
        <p className="text-sm text-slate-400 mt-1">
          Export full or filtered customs tariff datasets into CSV or Microsoft Excel (.xlsx) formats.
        </p>
      </div>

      {/* Filter Scope Controls Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" />
          Export Scope & Filters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chapter Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Filter by Chapter</label>
            <select
              value={selectedChapterId || ''}
              onChange={(e) => setSelectedChapterId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Export All Chapters (Full Schedule)</option>
              {chapters.map((chap) => (
                <option key={chap.id} value={chap.id}>
                  Chapter {chap.chapter_number.toString().padStart(2, '0')}: {chap.chapter_title}
                </option>
              ))}
            </select>
          </div>

          {/* Keyword Search Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Filter by Keyword / HS Code</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. 0101 or smartphone (Leave blank for all)"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Download Format Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full 11-Sheet Workbook Export Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-indigo-500/50 transition-all md:col-span-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Full 11-Sheet Master Excel Workbook</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Complete Automation
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Generates the exact multi-sheet workbook (<code className="text-indigo-300">A3EXPRESS_10_26_27_DT_23_07_2026.xlsx</code> format) containing all 11 linked sheets: <strong className="text-slate-200">DUTY_2025, SI, InvoiceGen, ProductList, P_1, P_2, Invoice_India, Sheet2, Sheet1, Invoice_Colombo, and COOTemplate</strong>.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const url = apiClient.getFullWorkbookExcelUrl(1);
                window.open(url, '_blank');
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Download className="w-4 h-4" />
              <span>Download Master Workbook (.xlsx)</span>
            </button>
            <button
              onClick={() => {
                const url = apiClient.getCooExcelUrl(1);
                window.open(url, '_blank');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all flex items-center gap-2 border border-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>COO Template (.xlsx)</span>
            </button>
            <button
              onClick={() => {
                const url = apiClient.getCooPdfUrl(1);
                window.open(url, '_blank');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all flex items-center gap-2 border border-slate-700"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              <span>COO Certificate (.pdf)</span>
            </button>
          </div>
        </div>

        {/* CSV Download Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Tariff CSV Schedule (.csv)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standard Comma Separated Value document containing HS codes, product descriptions, duty rates, preferential schemes, and levy breakdowns.
            </p>
          </div>

          <button
            onClick={handleDownloadCsv}
            className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV Schedule</span>
          </button>
        </div>

        {/* Excel Tariff Schedule Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Tariff Excel Schedule (.xlsx)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Formatted Excel spreadsheet with styled header columns, worksheet auto-formatting, and structured duty columns suitable for reporting and offline analysis.
            </p>
          </div>

          <button
            onClick={handleDownloadExcel}
            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Download Tariff Schedule (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
