import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import type { Chapter, PaginatedTariffResponse } from '../types';
import { apiClient } from '../api/client';

interface SearchBrowsePageProps {
  chapters: Chapter[];
}

export const SearchBrowsePage: React.FC<SearchBrowsePageProps> = ({ chapters }) => {
  const [query, setQuery] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState<number | undefined>();
  const [selectedSectionNumber, setSelectedSectionNumber] = useState<string | undefined>();
  const [selectedDutyType] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PaginatedTariffResponse | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  const fetchTariffLines = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getTariffLines({
        query: query.trim() || undefined,
        chapter_id: selectedChapterId,
        section_number: selectedSectionNumber,
        duty_type: selectedDutyType,
        page,
        page_size: pageSize,
      });
      setData(res);
    } catch (err) {
      console.error('Error fetching tariff lines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTariffLines();
  }, [page, selectedChapterId, selectedSectionNumber, selectedDutyType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTariffLines();
  };

  const handleResetFilters = () => {
    setQuery('');
    setSelectedChapterId(undefined);
    setSelectedSectionNumber(undefined);
    setPage(1);
  };

  const sectionsList = Array.from(new Set(chapters.map((c) => c.section_number).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold text-white tracking-tight">Search & Browse Tariff Schedule</h1>
          <p className="text-sm text-slate-400 mt-1">
            Search across 97 HS chapters by 8-digit tariff code, product description keyword, or duty rate category.
          </p>
        </div>

        {/* Filter Bar */}
        <form onSubmit={handleSearchSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 0101.21.00, 'smartphone', or 'bovine'..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Section Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedSectionNumber || ''}
              onChange={(e) => {
                setSelectedSectionNumber(e.target.value || undefined);
                setSelectedChapterId(undefined);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Sections</option>
              {sectionsList.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedChapterId || ''}
              onChange={(e) => {
                setSelectedChapterId(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Chapters (1–97)</option>
              {chapters.map((chap) => (
                <option key={chap.id} value={chap.id}>
                  Ch {chap.chapter_number.toString().padStart(2, '0')} - {chap.chapter_title}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset Filters"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Results Header & Summary */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{data?.items.length || 0}</span> of{' '}
          <span className="font-semibold text-white">{data?.total || 0}</span> tariff lines
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-indigo-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Loading database records...</span>
          </div>
        )}
      </div>

      {/* Tariff Lines Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-32">HS Code</th>
                <th className="py-3.5 px-4">Description of Goods</th>
                <th className="py-3.5 px-3 text-center">Unit</th>
                <th className="py-3.5 px-3 text-right">Gen Duty</th>
                <th className="py-3.5 px-3 text-right">VAT</th>
                <th className="py-3.5 px-3 text-right">PAL</th>
                <th className="py-3.5 px-3 text-right">CESS</th>
                <th className="py-3.5 px-3 text-center">Preferential Rates</th>
                <th className="py-3.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {data?.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No tariff lines match your query. Try broadening your search or importing new PDFs.
                  </td>
                </tr>
              ) : (
                data?.items.map((line) => {
                  const isHeading = !line.hs_code || line.hs_code.length <= 5;
                  const indentPx = line.indent_level * 16;
                  const isExpanded = expandedRowId === line.id;

                  return (
                    <React.Fragment key={line.id}>
                      <tr
                        onClick={() => setExpandedRowId(isExpanded ? null : line.id)}
                        className={`cursor-pointer transition-colors ${
                          isHeading ? 'bg-slate-950/40 font-semibold text-slate-200' : 'hover:bg-slate-800/40 text-slate-300'
                        } ${isExpanded ? 'bg-indigo-950/20' : ''}`}
                      >
                        {/* HS Code */}
                        <td className="py-3 px-4 font-mono text-indigo-400 font-bold whitespace-nowrap">
                          {line.hs_code || <span className="text-slate-600 font-normal italic">Heading</span>}
                        </td>

                        {/* Description with Indent */}
                        <td className="py-3 px-4">
                          <div style={{ paddingLeft: `${indentPx}px` }} className="flex items-center gap-1.5">
                            {line.indent_level > 0 && (
                              <span className="text-slate-600 font-mono text-xs">
                                {'—'.repeat(line.indent_level)}
                              </span>
                            )}
                            <span className={line.hs_code ? 'text-slate-100' : 'text-slate-400'}>
                              {line.description}
                            </span>
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="py-3 px-3 text-center font-mono text-xs text-slate-400">
                          {line.unit || '-'}
                        </td>

                        {/* General Duty */}
                        <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-emerald-400 whitespace-nowrap">
                          {line.general_duty_rate || '-'}
                        </td>

                        {/* VAT */}
                        <td className="py-3 px-3 text-right font-mono text-xs text-slate-300 whitespace-nowrap">
                          {line.vat_rate || '-'}
                        </td>

                        {/* PAL */}
                        <td className="py-3 px-3 text-right font-mono text-xs text-slate-300 whitespace-nowrap">
                          {line.pal_rate || '-'}
                        </td>

                        {/* CESS */}
                        <td className="py-3 px-3 text-right font-mono text-xs text-amber-400 whitespace-nowrap">
                          {line.cess_rate || '-'}
                        </td>

                        {/* Preferential Rates */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {line.preferential_rates && Object.keys(line.preferential_rates).length > 0 ? (
                              Object.entries(line.preferential_rates).map(([scheme, rate]) => (
                                <span
                                  key={scheme}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono"
                                >
                                  {scheme}: {rate}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </div>
                        </td>

                        {/* Verification Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {line.is_verified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="w-3 h-3" />
                              <span>Parsed</span>
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-b border-indigo-900/30">
                          <td colSpan={9} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                              <div>
                                <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                  Tax & Levy Breakdown
                                </h4>
                                <ul className="space-y-1 text-slate-400 font-mono">
                                  <li>Excise Rate: <span className="text-slate-200">{line.excise_rate || 'None'}</span></li>
                                  <li>SCL Rate: <span className="text-slate-200">{line.scl_rate || 'None'}</span></li>
                                  <li>Notes: <span className="text-slate-200">{line.notes || 'None'}</span></li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-300 mb-2">Section & Chapter Reference</h4>
                                <ul className="space-y-1 text-slate-400">
                                  <li>Section: <span className="text-indigo-400 font-semibold">{line.section_number}</span></li>
                                  <li>Chapter: <span className="text-indigo-400 font-semibold">{line.chapter_number}</span></li>
                                  <li>PDF Page: <span className="text-slate-200 font-mono">{line.page_number}</span></li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-300 mb-2">Raw PDF Line Preview</h4>
                                <p className="text-slate-400 font-mono text-[11px] bg-slate-950 p-2 rounded border border-slate-800">
                                  {line.raw_row_text || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {data && data.total_pages > 1 && (
          <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Page {data.page} of {data.total_pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === data.total_pages}
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
