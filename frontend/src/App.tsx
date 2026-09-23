import { useState, useEffect } from 'react';
import {
  UploadCloud,
  FolderArchive,
  Search,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck
} from 'lucide-react';
import type { Chapter, TariffLine, PaginatedTariffResponse } from './types';
import { apiClient } from './api/client';
import './utils/toast';
import { ToastContainer } from './components/ToastContainer';
import { Navbar } from './components/Navbar';
import { ItemEntryPage } from './pages/ItemEntryPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';
import { CustomerMasterPage } from './pages/CustomerMasterPage';
import { DashboardPage } from './pages/DashboardPage';
import { VendorManagementPage } from './pages/VendorManagementPage';
import { TrackingDashboardPage } from './pages/TrackingDashboardPage';
import { TraceabilityPanel } from './components/TraceabilityPanel';

export function App() {
  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('shipments');
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);

  // Global Traceability Drawer state
  const [isTraceabilityOpen, setIsTraceabilityOpen] = useState<boolean>(false);
  const [traceRootType, setTraceRootType] = useState<string>('SHIPMENT');
  const [traceRootId, setTraceRootId] = useState<number | undefined>();

  const handleOpenTraceability = (type: string, id: number) => {
    setTraceRootType(type);
    setTraceRootId(id);
    setIsTraceabilityOpen(true);
  };

  const handleCreateNewShipment = async () => {
    try {
      const nextNo = await apiClient.getNextShipmentNumber();
      const newShipment = await apiClient.createShipment({
        shipment_no: nextNo.shipment_no,
        financial_year: nextNo.financial_year,
        status: 'DRAFT',
        destination: 'Colombo Port, Sri Lanka',
        currency: 'INR',
        usd_rate: 305.0,
        lkr_inr_rate: 3.65,
        profit_margin_pct: 15.0,
        indian_invoice_margin_pct: 15.0,
        colombo_invoice_margin_pct: 15.0,
        margin_mode: 'MARGIN_ON_REVENUE',
        customers: []
      });
      setSelectedShipmentId(newShipment.id);
      localStorage.setItem(`a3_shipment_${newShipment.id}_main_tab`, 'config');
      setActiveTab('shipment_detail');
    } catch (err: any) {
      alert('Failed to initialize new shipment: ' + (err.response?.data?.detail || err.message || 'Unknown error'));
    }
  };

  // Tariff State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [tariffData, setTariffData] = useState<PaginatedTariffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch sections/chapters metadata
  const fetchMetaData = async () => {
    try {
      const data = await apiClient.getSections();
      setChapters(data);
    } catch (err) {
      console.error('Failed to fetch chapters:', err);
    }
  };

  // Fetch tariff lines
  const fetchTariffLines = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getTariffLines({
        query: query.trim() || undefined,
        chapter_id: selectedChapterId,
        page,
        page_size: pageSize,
      });
      setTariffData(res);
    } catch (err) {
      console.error('Failed to fetch tariff lines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetaData();
  }, []);

  useEffect(() => {
    if (activeTab === 'tariff') {
      fetchTariffLines();
    }
  }, [query, selectedChapterId, page, activeTab]);

  // Upload Single PDF
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      alert('Please upload a valid PDF file.');
      return;
    }
    setUploading(true);
    try {
      await apiClient.uploadSinglePdf(file);
      await fetchMetaData();
      await fetchTariffLines();
      alert(`PDF '${file.name}' successfully extracted and saved to database!`);
    } catch (err: any) {
      alert(`Extraction failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Batch Import
  const handleBatchImport = async () => {
    if (!confirm('Run automated extraction on all PDFs in tariff_pdfs directory?')) return;
    setBatchRunning(true);
    try {
      const summary = await apiClient.triggerBatchImport();
      await fetchMetaData();
      await fetchTariffLines();
      alert(
        `Batch import completed!\nProcessed: ${summary.total_files_processed} files\nSuccess: ${summary.successful_files}\nExtracted Rows: ${summary.total_rows_extracted}`
      );
    } catch (err: any) {
      alert(`Batch processing failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBatchRunning(false);
    }
  };



  const toggleVerify = async (line: TariffLine) => {
    try {
      await apiClient.verifyTariffLine(line.id);
      fetchTariffLines();
    } catch (err: any) {
      alert(`Failed to change verification: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleSelectShipment = (sId: number) => {
    setSelectedShipmentId(sId);
    setActiveTab('shipment_detail');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Top Dropdown Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCreateShipment={handleCreateNewShipment}
        onOpenAddVendor={() => setActiveTab('vendors')}
        onOpenAddCustomer={() => setActiveTab('customers')}
      />

      {/* Global Toast Container */}
      <ToastContainer />

      {/* Main Content Area */}
      <main className={activeTab === 'shipment_detail' ? 'w-full flex-1 flex flex-col' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full'}>
        {activeTab === 'shipments' && (
          <ShipmentsPage onSelectShipment={handleSelectShipment} />
        )}

        {activeTab === 'shipment_detail' && selectedShipmentId && (
          <ShipmentDetailPage
            shipmentId={selectedShipmentId}
            onBack={() => setActiveTab('shipments')}
            onOpenTraceability={handleOpenTraceability}
          />
        )}

        {activeTab === 'tracking' && (
          <TrackingDashboardPage
            onSelectShipment={handleSelectShipment}
            onOpenTraceability={handleOpenTraceability}
          />
        )}

        {activeTab === 'customers' && (
          <CustomerMasterPage />
        )}

        {activeTab === 'vendors' && (
          <VendorManagementPage />
        )}

        {activeTab === 'dashboard' && (
          <DashboardPage />
        )}

        {activeTab === 'items' && (
          <ItemEntryPage />
        )}

        {activeTab === 'tariff' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                }}
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <h3 className="font-semibold text-xs text-slate-800">Upload Tariff PDF</h3>
                <label className="mt-2 inline-block bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs font-semibold cursor-pointer">
                  {uploading ? 'Processing...' : 'Browse PDF'}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                </label>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs mb-1">
                    <FolderArchive className="w-4 h-4 text-emerald-600" />
                    <span>Batch Directory Parser</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Scan official tariff PDFs in backend directory.</p>
                </div>
                <button
                  onClick={handleBatchImport}
                  disabled={batchRunning}
                  className="mt-2 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${batchRunning ? 'animate-spin' : ''}`} />
                  {batchRunning ? 'Extracting Directory...' : 'Run Batch Import'}
                </button>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs mb-1">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>Export Tariff Database</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Download formatted CSV or Excel dataset.</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <a
                    href={apiClient.getExportCsvUrl(selectedChapterId, query)}
                    className="flex-1 text-center bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 rounded-md text-xs font-semibold"
                  >
                    CSV Export
                  </a>
                  <a
                    href={apiClient.getExportExcelUrl(selectedChapterId, query)}
                    className="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-md text-xs font-semibold"
                  >
                    Excel Export
                  </a>
                </div>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search HS Code or Keyword..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={selectedChapterId || ''}
                onChange={(e) => { setSelectedChapterId(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium max-w-xs"
              >
                <option value="">All Chapters</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Ch {ch.chapter_number} - {ch.chapter_title || 'Untitled'}
                  </option>
                ))}
              </select>
            </div>

            {/* Tariff Lines Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white font-semibold">
                    <th className="p-3">HS Code</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-center">Gen Duty</th>
                    <th className="p-3 text-center">VAT</th>
                    <th className="p-3 text-center">PAL</th>
                    <th className="p-3 text-center">CESS</th>
                    <th className="p-3 text-center">SSCL</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">Loading tariff records...</td>
                    </tr>
                  ) : !tariffData?.items || tariffData.items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">No matching tariff lines found.</td>
                    </tr>
                  ) : (
                    tariffData.items.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-blue-700">{line.hs_code || '-'}</td>
                        <td className="p-3 max-w-xs truncate">{line.description}</td>
                        <td className="p-3 text-center font-mono">{line.general_duty_rate || '-'}</td>
                        <td className="p-3 text-center font-mono">{line.vat_rate || '-'}</td>
                        <td className="p-3 text-center font-mono">{line.pal_rate || '-'}</td>
                        <td className="p-3 text-center font-mono">{line.cess_rate || '-'}</td>
                        <td className="p-3 text-center font-mono">{line.sscl_rate || '-'}</td>
                        <td className="p-3 text-center">
                          {line.is_verified ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-semibold text-[10px]">Verified</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-semibold text-[10px]">Unverified</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleVerify(line)}
                            className="p-1 text-slate-400 hover:text-emerald-600 rounded-md"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {tariffData && tariffData.total_pages > 1 && (
                <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
                  <span className="text-xs text-slate-500">
                    Page {tariffData.page} of {tariffData.total_pages} ({tariffData.total} total rows)
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="px-3 py-1 border rounded-md text-xs font-semibold disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      disabled={page >= tariffData.total_pages}
                      onClick={() => setPage(page + 1)}
                      className="px-3 py-1 border rounded-md text-xs font-semibold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
      </main>

      {/* Global Traceability Drawer */}
      <TraceabilityPanel
        isOpen={isTraceabilityOpen}
        onClose={() => setIsTraceabilityOpen(false)}
        rootEntityType={traceRootType}
        rootEntityId={traceRootId}
      />
    </div>
  );
}

export default App;
