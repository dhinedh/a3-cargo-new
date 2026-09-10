import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  PackagePlus,
  Tag,
  Barcode,
  DollarSign,
  Weight,
  CalendarDays,
  Calculator,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Layers,
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  Star,
} from 'lucide-react';
import type { TariffSearchResult, ItemEntry, PaginatedItemEntryResponse } from '../types';
import { apiClient } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemFormState {
  item_name: string;
  item_category: string;
  unit: string;
  notes: string;
  tariff_line_id?: number;
  hs_code: string;
  tariff_description: string;
  general_duty_rate: string;
  vat_rate: string;
  pal_rate: string;
  cess_rate: string;
  sscl_rate: string;
  excise_rate: string;
  price_per_kg: string;
  total_quantity_kg: string;
  per_month_qty_kg: string;
}

const INITIAL_FORM: ItemFormState = {
  item_name: '',
  item_category: '',
  unit: 'KG',
  notes: '',
  tariff_line_id: undefined,
  hs_code: '',
  tariff_description: '',
  general_duty_rate: '',
  vat_rate: '',
  pal_rate: '',
  cess_rate: '',
  sscl_rate: '',
  excise_rate: '',
  price_per_kg: '',
  total_quantity_kg: '',
  per_month_qty_kg: '',
};

const PRESET_UNITS = ['KG', 'Units', 'Pcs', 'Liters', 'Meters', 'Boxes'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(val?: number | string | null): string {
  if (val === undefined || val === null || val === '') return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeTotal(price: string, qty: string): string {
  const p = parseFloat(price);
  const q = parseFloat(qty);
  if (isNaN(p) || isNaN(q)) return '';
  return (p * q).toFixed(2);
}

// ─── Duty Badge ───────────────────────────────────────────────────────────────

function DutyBadge({ label, value }: { label: string; value?: string }) {
  if (!value || value === '-') return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
      {label}: {value}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ItemEntryPage() {
  // Form state
  const [form, setForm] = useState<ItemFormState>({ ...INITIAL_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');

  // Typeahead
  const [suggestions, setSuggestions] = useState<TariffSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editing entry
  const [editingId, setEditingId] = useState<number | null>(null);

  // Entries table
  const [entries, setEntries] = useState<PaginatedItemEntryResponse | null>(null);
  const [tableQuery, setTableQuery] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);

  // ── Computed fields ──────────────────────────────────────────────────────────

  const totalValue = computeTotal(form.price_per_kg, form.total_quantity_kg);
  const perMonthValue = computeTotal(form.price_per_kg, form.per_month_qty_kg);

  // ── Fetch saved entries ──────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await apiClient.getItemEntries({ query: tableQuery || undefined, page: tablePage, page_size: 20 });
      setEntries(res);
    } catch {
      /* silently fail */
    } finally {
      setTableLoading(false);
    }
  }, [tableQuery, tablePage]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Typeahead search ─────────────────────────────────────────────────────────

  const handleNameChange = (value: string) => {
    setForm((f) => ({ ...f, item_name: value }));
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await apiClient.searchTariffByName(value.trim(), 12);
        setSuggestions(results);
        setDropdownOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const selectSuggestion = (s: TariffSearchResult) => {
    setForm((f) => ({
      ...f,
      tariff_line_id: s.tariff_line_id,
      hs_code: s.hs_code || '',
      tariff_description: s.description,
      item_category: s.chapter_title || f.item_category,
      unit: s.unit ? s.unit.toUpperCase() : (f.unit || 'KG'),
      general_duty_rate: s.general_duty_rate || '',
      vat_rate: s.vat_rate || '',
      pal_rate: s.pal_rate || '',
      cess_rate: s.cess_rate || '',
      sscl_rate: s.sscl_rate || '',
      excise_rate: s.excise_rate || '',
    }));
    setDropdownOpen(false);
    setSuggestions([]);
  };

  // ── Submit form ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item_name.trim()) return;

    setSubmitting(true);
    setSubmitStatus('idle');
    try {
      const payload = {
        ...form,
        currency: 'LKR',
        price_per_kg: form.price_per_kg ? parseFloat(form.price_per_kg) : undefined,
        total_quantity_kg: form.total_quantity_kg ? parseFloat(form.total_quantity_kg) : undefined,
        per_month_qty_kg: form.per_month_qty_kg ? parseFloat(form.per_month_qty_kg) : undefined,
        total_value: totalValue ? parseFloat(totalValue) : undefined,
        per_month_value: perMonthValue ? parseFloat(perMonthValue) : undefined,
      };

      if (editingId !== null) {
        await apiClient.updateItemEntry(editingId, payload);
        setSubmitMsg('Item entry updated successfully!');
      } else {
        await apiClient.createItemEntry(payload);
        setSubmitMsg('Item entry saved to database!');
      }

      setSubmitStatus('success');
      setForm({ ...INITIAL_FORM });
      setEditingId(null);
      await fetchEntries();
    } catch (err: any) {
      setSubmitStatus('error');
      setSubmitMsg(err?.response?.data?.detail || 'Failed to save entry. Please try again.');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitStatus('idle'), 4000);
    }
  };

  // ── Edit entry ───────────────────────────────────────────────────────────────

  const startEdit = (entry: ItemEntry) => {
    setEditingId(entry.id);
    setForm({
      item_name: entry.item_name || '',
      item_category: entry.item_category || '',
      unit: entry.unit || 'KG',
      notes: entry.notes || '',
      tariff_line_id: entry.tariff_line_id,
      hs_code: entry.hs_code || '',
      tariff_description: entry.tariff_description || '',
      general_duty_rate: entry.general_duty_rate || '',
      vat_rate: entry.vat_rate || '',
      pal_rate: entry.pal_rate || '',
      cess_rate: entry.cess_rate || '',
      sscl_rate: entry.sscl_rate || '',
      excise_rate: entry.excise_rate || '',
      price_per_kg: entry.price_per_kg !== undefined ? String(entry.price_per_kg) : '',
      total_quantity_kg: entry.total_quantity_kg !== undefined ? String(entry.total_quantity_kg) : '',
      per_month_qty_kg: entry.per_month_qty_kg !== undefined ? String(entry.per_month_qty_kg) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...INITIAL_FORM });
  };

  // ── Delete entry ─────────────────────────────────────────────────────────────

  const deleteEntry = async (id: number) => {
    if (!confirm('Delete this item entry?')) return;
    try {
      await apiClient.deleteItemEntry(id);
      await fetchEntries();
    } catch { /* silently fail */ }
  };

  // ── Excel Bulk Upload State ───────────────────────────────────────────────────
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelResult, setExcelResult] = useState<{ status: string; inserted: number; updated: number; total_processed: number; errors: string[] } | null>(null);

  const handleExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;
    setUploadingExcel(true);
    setExcelResult(null);
    try {
      const res = await apiClient.bulkUploadFavoriteProducts(excelFile);
      setExcelResult(res);
      fetchEntries();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload Excel file');
    } finally {
      setUploadingExcel(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <PackagePlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <span>Item Master & Favorites</span>
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </h2>
            <p className="text-xs text-slate-400">Manage saved product master catalog & auto-fill settings</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setExcelResult(null);
            setExcelFile(null);
            setShowExcelModal(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-900/20 flex items-center gap-2 transition-all cursor-pointer border border-emerald-500/30 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Bulk Upload Favorites (Excel)</span>
        </button>
      </div>

      {/* ── Bulk Upload Modal ── */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Bulk Upload Favorite Products</span>
              </div>
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Upload an Excel file (<code className="text-indigo-400">.xlsx</code> or <code className="text-indigo-400">.xls</code>) to create or update favorite products in your Item Master.
              Column headers supported: <b className="text-slate-300">Product Name, HSN Code, Category, Unit, Purchase Price, Currency, Unit Weight, Weight Unit, Duty, VAT, PAL, CESS</b>.
            </p>

            <form onSubmit={handleExcelUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 text-center transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => setExcelFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="favorite-excel-input"
                />
                <label htmlFor="favorite-excel-input" className="cursor-pointer flex flex-col items-center gap-2">
                  <UploadCloud className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-300">
                    {excelFile ? excelFile.name : 'Click to browse or drop your Excel file here'}
                  </span>
                  <span className="text-[10px] text-slate-500">Supports .xlsx and .xls</span>
                </label>
              </div>

              {excelResult && (
                <div className={`p-3.5 rounded-xl text-xs space-y-1 ${excelResult.status === 'success' ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border border-rose-800 text-rose-300'}`}>
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Upload Completed Successfully!</span>
                  </div>
                  <div>Processed: <b>{excelResult.total_processed} items</b> (Inserted: {excelResult.inserted}, Updated: {excelResult.updated})</div>
                  {excelResult.errors && excelResult.errors.length > 0 && (
                    <div className="text-[11px] text-rose-400 pt-1">
                      Warnings: {excelResult.errors.slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExcelModal(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={!excelFile || uploadingExcel}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  {uploadingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>{uploadingExcel ? 'Uploading...' : 'Import Products'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Form Card ── */}
      <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Form header */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            {editingId !== null ? `✏️ Editing Entry #${editingId}` : 'New Item Entry'}
          </span>
          {editingId !== null && (
            <button type="button" onClick={cancelEdit} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─ LEFT COLUMN ─ */}
          <div className="space-y-5">
            {/* Item Name with Typeahead */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-violet-400" /> Item Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchLoading && (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                <input
                  ref={nameInputRef}
                  type="text"
                  value={form.item_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === 'Tab') && dropdownOpen && suggestions.length > 0) {
                      if (!form.hs_code) {
                        selectSuggestion(suggestions[0]);
                      }
                    }
                  }}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                  onFocus={() => suggestions.length > 0 && setDropdownOpen(true)}
                  placeholder="e.g. Rice, Live Horses, Bulbs, Mobile Phones..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                  required
                />
              </div>

              {/* Typeahead Dropdown */}
              {dropdownOpen && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden max-h-72 overflow-y-auto">
                  {searchLoading ? (
                    <div className="px-4 py-3 text-xs text-indigo-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching tariff database...
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400">
                      No matching tariff line found for "{form.item_name}". Try another keyword or wait for PDF import to finish.
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex justify-between items-center">
                        <span>Matching Tariff Lines ({suggestions.length})</span>
                        <span className="text-indigo-400 font-normal">Click or press Enter to auto-fill</span>
                      </div>
                      {suggestions.map((s) => (
                        <button
                          key={s.tariff_line_id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(s);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-600/20 border-b border-slate-800/60 last:border-0 transition-colors group cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-200">{s.description}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{s.chapter_title || 'Unknown Chapter'}</p>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-indigo-400 whitespace-nowrap shrink-0 mt-0.5">
                              {s.hs_code || 'No Code'}
                            </span>
                          </div>
                          {s.general_duty_rate && (
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              <DutyBadge label="Gen" value={s.general_duty_rate} />
                              <DutyBadge label="VAT" value={s.vat_rate} />
                              <DutyBadge label="CESS" value={s.cess_rate} />
                            </div>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* HS Code — read-only, auto-assigned from DB */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-indigo-400" /> HS Code
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">
                  Auto-assigned from database
                </span>
              </label>
              <div className={`w-full rounded-xl px-3 py-2.5 text-sm font-mono border flex items-center gap-2 ${
                form.hs_code
                  ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-600 italic'
              }`}>
                {form.hs_code ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />{form.hs_code}</>
                ) : (
                  'Will be auto-filled when you select an item above'
                )}
              </div>
            </div>

            {/* Item Category — read-only, auto-assigned from DB chapter */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Item Category
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                  Auto-assigned from database
                </span>
              </label>
              <div className={`w-full rounded-xl px-3 py-2.5 text-sm border flex items-center gap-2 ${
                form.item_category
                  ? 'bg-amber-950/20 border-amber-500/25 text-amber-200'
                  : 'bg-slate-950/40 border-slate-800 text-slate-600 italic'
              }`}>
                {form.item_category ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />{form.item_category}</>
                ) : (
                  'Will be auto-filled when you select an item above'
                )}
              </div>
            </div>

            {/* Tariff Description */}
            {form.tariff_description && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tariff Description</label>
                <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 leading-relaxed">
                  {form.tariff_description}
                </div>
              </div>
            )}

            {/* Duty Rates (auto-filled, read-only display) */}
            {(form.general_duty_rate || form.vat_rate || form.cess_rate || form.sscl_rate || form.pal_rate || form.excise_rate) && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-orange-400" /> Applicable Duty Rates
                </label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-wrap gap-1.5">
                  <DutyBadge label="General Duty" value={form.general_duty_rate} />
                  <DutyBadge label="VAT" value={form.vat_rate} />
                  <DutyBadge label="PAL" value={form.pal_rate} />
                  <DutyBadge label="CESS" value={form.cess_rate} />
                  <DutyBadge label="SSCL" value={form.sscl_rate} />
                  <DutyBadge label="Excise" value={form.excise_rate} />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notes (Optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes about this item…"
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none transition-colors"
              />
            </div>
          </div>

          {/* ─ RIGHT COLUMN (Pricing & Quantities) ─ */}
          <div className="space-y-5">
            {/* Unit of Measurement Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Weight className="w-3.5 h-3.5 text-sky-400" /> Unit of Measurement
                <span className="ml-auto text-[10px] text-slate-400">Select or type custom unit</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, unit: u }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      form.unit.toUpperCase() === u.toUpperCase()
                        ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-600/30'
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="Or type custom unit (e.g. KG, Pcs, Liters, Bags)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-sky-300 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Price per Unit */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Price per {form.unit || 'Unit'} (LKR)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.price_per_kg}
                onChange={(e) => setForm((f) => ({ ...f, price_per_kg: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-emerald-300 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Total Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Weight className="w-3.5 h-3.5 text-sky-400" /> Total Quantity ({form.unit || 'Units'})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.total_quantity_kg}
                onChange={(e) => setForm((f) => ({ ...f, total_quantity_kg: e.target.value }))}
                placeholder="0.000"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-sky-300 font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Per Month Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-violet-400" /> Quantity per Month ({form.unit || 'Units'})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.per_month_qty_kg}
                onChange={(e) => setForm((f) => ({ ...f, per_month_qty_kg: e.target.value }))}
                placeholder="0.000"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-violet-300 font-mono placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            {/* Auto-computed summary */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 border-b border-slate-800 pb-2 mb-1">
                <Calculator className="w-3.5 h-3.5 text-amber-400" /> Auto-Computed Values
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Total Value</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {totalValue ? `LKR ${parseFloat(totalValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Per Month Value</span>
                <span className="text-sm font-bold font-mono text-violet-400">
                  {perMonthValue ? `LKR ${parseFloat(perMonthValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                </span>
              </div>

              {form.price_per_kg && form.per_month_qty_kg && totalValue && (
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                  LKR {parseFloat(form.price_per_kg).toFixed(2)} × {parseFloat(form.total_quantity_kg || '0').toFixed(3)} {form.unit || 'Units'} = LKR {parseFloat(totalValue).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-4">
          {/* Status message */}
          <div className="flex-1">
            {submitStatus === 'success' && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {submitMsg}
              </div>
            )}
            {submitStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" /> {submitMsg}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editingId !== null && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-all"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || !form.item_name.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/30 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              ) : editingId !== null ? (
                <><Check className="w-3.5 h-3.5" /> Update Entry</>
              ) : (
                <><PackagePlus className="w-3.5 h-3.5" /> Save to Database</>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Saved Entries Table ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Table header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-sm font-semibold text-white">Saved Item Entries</span>
            <span className="ml-2 text-xs text-slate-500">{entries?.total ?? 0} total records</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableQuery}
                onChange={(e) => { setTableQuery(e.target.value); setTablePage(1); }}
                placeholder="Search entries…"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={fetchEntries}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tableLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-3">HS Code</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Price / Unit</th>
                <th className="py-3 px-3 text-right">Total Qty</th>
                <th className="py-3 px-3 text-right">Per Month</th>
                <th className="py-3 px-3 text-right">Total Value</th>
                <th className="py-3 px-3 text-right">Monthly Value</th>
                <th className="py-3 px-3 text-center">Duty Rates</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {tableLoading && !entries?.items.length ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading entries…
                  </td>
                </tr>
              ) : entries?.items.length === 0 || !entries ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <PackagePlus className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500">No item entries yet. Fill the form above to add your first entry.</p>
                  </td>
                </tr>
              ) : (
                entries.items.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-2.5 px-4 font-medium text-white max-w-[180px]">
                      <p className="truncate">{entry.item_name}</p>
                      {entry.tariff_description && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{entry.tariff_description}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-400 whitespace-nowrap">
                      {entry.hs_code || <span className="text-slate-600 italic">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-[140px]">
                      <p className="truncate">{entry.item_category || '—'}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 whitespace-nowrap">
                      {entry.price_per_kg ? `LKR ${fmtNum(entry.price_per_kg)} / ${entry.unit || 'KG'}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-sky-300 whitespace-nowrap">
                      {entry.total_quantity_kg !== undefined ? `${fmtNum(entry.total_quantity_kg)} ${entry.unit || 'KG'}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-violet-300 whitespace-nowrap">
                      {entry.per_month_qty_kg !== undefined ? `${fmtNum(entry.per_month_qty_kg)} ${entry.unit || 'KG'}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-300 whitespace-nowrap">
                      {entry.total_value ? `${entry.currency} ${fmtNum(entry.total_value)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-violet-300 whitespace-nowrap">
                      {entry.per_month_value ? `${entry.currency} ${fmtNum(entry.per_month_value)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <DutyBadge label="Gen" value={entry.general_duty_rate} />
                        <DutyBadge label="VAT" value={entry.vat_rate} />
                        <DutyBadge label="CESS" value={entry.cess_rate} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {entries && entries.total_pages > 1 && (
          <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Page {entries.page} of {entries.total_pages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={tablePage === 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={tablePage === entries.total_pages}
                onClick={() => setTablePage((p) => Math.min(entries.total_pages, p + 1))}
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
}

export default ItemEntryPage;
