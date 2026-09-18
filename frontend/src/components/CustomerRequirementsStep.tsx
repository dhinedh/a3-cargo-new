import React, { useState, useEffect } from 'react';
import { Plus, History, Edit3, Trash2, CheckCircle2, FileSpreadsheet, Package, AlertCircle, Clock, ArrowLeft, X, Download } from 'lucide-react';
import { apiClient } from '../api/client';
import type { ShipmentCustomerRequirement, CustomerRequirementHistory, Customer, UnifiedProductSearchResult } from '../types';
import { ProductSearchSelect } from './ProductSearchSelect';
import type { ProductOption } from './ProductSearchSelect';

interface CustomerRequirementsStepProps {
  shipmentId: number;
  customers: Customer[];
  onNext: () => void;
  onBack?: () => void;
}

export interface ProductRow {
  id: string;
  product_name: string;
  hsn_code: string;
  required_quantity: number;
  unit: string;
  notes: string;
}

const createEmptyRow = (): ProductRow => ({
  id: Math.random().toString(36).substring(2, 9),
  product_name: '',
  hsn_code: '',
  required_quantity: 1,
  unit: 'Carton',
  notes: ''
});

export const CustomerRequirementsStep: React.FC<CustomerRequirementsStepProps> = ({ shipmentId, customers, onNext, onBack }) => {
  const [requirements, setRequirements] = useState<ShipmentCustomerRequirement[]>([]);
  const [history, setHistory] = useState<CustomerRequirementHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedReqIds, setSelectedReqIds] = useState<number[]>([]);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(customers[0]?.id || 0);
  const [editingReqId, setEditingReqId] = useState<number | null>(null);

  // Multi-product rows state
  const [productRows, setProductRows] = useState<ProductRow[]>([createEmptyRow()]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // Database Autocomplete states with rich product + HSN suggestions
  const [productSuggestions, setProductSuggestions] = useState<UnifiedProductSearchResult[]>([]);

  const activeRow = productRows.find(r => r.id === activeRowId);
  const activeQuery = activeRow ? activeRow.product_name : '';

  useEffect(() => {
    if (!activeQuery || !activeQuery.trim()) {
      setProductSuggestions([]);
      return;
    }
    const searchCatalog = async () => {
      try {
        const results = await apiClient.searchAllProducts(activeQuery.trim(), 20);
        setProductSuggestions(results);
      } catch (err) {
        console.error('Failed to fetch product catalog suggestions:', err);
      }
    };
    searchCatalog();
  }, [activeQuery, activeRowId]);

  // Upload Excel state
  const [uploading, setUploading] = useState<boolean>(false);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const reqs = await apiClient.getCustomerRequirements(shipmentId);
      setRequirements(reqs);
      const hist = await apiClient.getRequirementHistory(shipmentId);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load customer requirements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shipmentId) {
      fetchRequirements();
    }
  }, [shipmentId]);

  const handleAddRow = () => {
    setProductRows(prev => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (id: string) => {
    if (productRows.length <= 1) return;
    setProductRows(prev => prev.filter(r => r.id !== id));
    if (activeRowId === id) setActiveRowId(null);
  };

  const handleRowChange = (id: string, field: keyof ProductRow, value: any) => {
    setProductRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const TRADE_NAME_HSN_MAP: Record<string, string> = {
    // Biscuits & Confectionery
    'biscuit': '1905.31.00',
    '50-50': '1905.31.00',
    'goodday': '1905.31.00',
    'malkist': '1905.31.00',
    'oreo': '1905.31.00',
    'dark fantasy': '1905.31.00',
    // Spices & Chillies
    'chilli': '0904.21.90',
    'chilly': '0904.21.90',
    'coriander': '0909.22.00',
    'dhaniya': '0909.22.00',
    'daniya': '0909.22.00',
    'turmeric': '0910.30.30',
    'cardamom': '0908.32.90',
    'cinnamon': '0906.11.00',
    'clove': '0907.10.00',
    'pepper': '0904.11.00',
    'cumin': '0909.31.90',
    'mustard': '1207.50.00',
    // Flours & Grains
    'ragi': '1008.29.00',
    'rag': '1008.29.00',
    'rag grain': '1008.29.00',
    'raggrain': '1008.29.00',
    'ragigrain': '1008.29.00',
    'kurakkan': '1102.90.20',
    'urad': '0713.31.00',
    'urad dal': '0713.31.00',
    'uraddal': '0713.31.00',
    'uraddhal': '0713.31.00',
    'dal': '0713.40.00',
    'dhal': '0713.40.00',
    'gram flour': '1106.10.10',
    'besan': '1106.10.10',
    'rice flour': '1102.90.10',
    'idiyappam': '1102.90.10',
    'puttu': '1102.90.10',
    'atta': '1101.00.10',
    'wheat flour': '1101.00.10',
    'maida': '1101.00.10',
    'suji': '1103.11.00',
    'rava': '1103.11.00',
    'rice': '1006.30.11',
    'basmati': '1006.30.11',
    // Ghee & Honey
    'ghee': '0405.90.00',
    'honey': '0409.00.00',
    // Asafoetida & Gum
    'asafoetida': '1301.20.00',
    'gum arabic': '1301.20.00',
    // Masalas & Mixes
    'sakthi': '2106.90.99',
    'masala': '2106.90.99',
    'rasam': '2106.90.99',
    'sambar': '2106.90.99',
    'health mix': '2106.90.99',
    'payasam': '2106.90.99',
    'badam': '2106.90.99',
    'gulab jamun': '2106.90.99',
    'halwa': '2106.90.99',
    'pani puri': '1905.90.90',
    // Pickles
    'pickle': '2001.90.00',
    'mango': '2001.90.00',
    'lemon': '2001.90.00',
    'garlic': '2001.90.00',
    'thokku': '2001.90.00',
    // Snacks & Confectionery
    'kadalai': '2106.90.99',
    'mittai': '2106.90.99',
    'bhujia': '2106.90.99',
    'boondi': '2106.90.99',
    'mixture': '2106.90.99',
    'sev': '2106.90.99',
    'soya': '2106.90.99',
    'papad': '2106.90.60',
    // Cereals & Noodles
    'corn flakes': '1904.10.90',
    'cornflakes': '1904.10.90',
    'chocos': '1904.10.90',
    'noodles': '1902.19.00',
    'chowmein': '1902.19.00',
    'pasta': '1902.19.00',
    // Beverages
    'coffee': '2101.12.00',
    'tea': '0902.30.21',
    'boost': '1901.90.99',
    'horlicks': '1901.90.99',
    // Commodities
    'sugar': '1701.99.90',
    'salt': '2501.00.10',
    'oil': '1514.99.90'
  };

  const autoDetectHsn = async (rowId: string, prodName: string) => {
    if (!prodName || !prodName.trim() || prodName.trim().length < 2) return;
    const clean = prodName.trim().toLowerCase().split('(')[0].trim();
    const compact = clean.replace(/[\s\-_]/g, '');

    let baseHsn = '';

    // 1. Instant check: Trade Name Commodity Dictionary
    for (const [k, hsn] of Object.entries(TRADE_NAME_HSN_MAP)) {
      const kCompact = k.replace(/[\s\-_]/g, '');
      if (clean === k || compact === kCompact || clean.includes(k) || (clean.length >= 3 && k.includes(clean))) {
        baseHsn = hsn;
        break;
      }
    }

    // 2. Search Database / Excel Seeded Catalog
    if (!baseHsn) {
      try {
        const items = await apiClient.searchAllProducts(prodName.trim(), 5);
        const withHsn = items.find(i => i.hs_code);
        if (withHsn && withHsn.hs_code) {
          baseHsn = withHsn.hs_code;
        }
      } catch (err) {
        console.error('Failed to auto-detect HSN from catalog:', err);
      }
    }

    // 3. Fallback: Customs Tariff Lines
    if (!baseHsn) {
      try {
        const tariffLines = await apiClient.searchTariffByName(prodName.trim(), 5);
        if (tariffLines.length > 0 && tariffLines[0].hs_code) {
          baseHsn = tariffLines[0].hs_code;
        }
      } catch (err) {
        console.error('Failed to auto-detect HSN from tariff:', err);
      }
    }

    if (baseHsn) {
      setProductRows(prev => prev.map(r => r.id === rowId ? { ...r, hsn_code: baseHsn } : r));
    }
  };

  // Auto-trigger HSN detection when product name exists but HSN is empty
  useEffect(() => {
    productRows.forEach(row => {
      if (row.product_name && row.product_name.trim().length >= 2 && !row.hsn_code) {
        autoDetectHsn(row.id, row.product_name);
      }
    });
  }, [productRows]);


  const resetForm = () => {
    setProductRows([createEmptyRow()]);
    setEditingReqId(null);
    setSelectedCustomerId(customers[0]?.id || 0);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleSaveRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }

    const validRows = productRows.filter(r => r.product_name.trim().length > 0);
    if (validRows.length === 0) {
      alert('Please enter at least one Product / SKU name.');
      return;
    }

    try {
      if (editingReqId) {
        const row = validRows[0];
        await apiClient.updateCustomerRequirement(shipmentId, editingReqId, {
          product_name: row.product_name.trim(),
          hsn_code: row.hsn_code.trim() || undefined,
          required_quantity: row.required_quantity,
          unit: row.unit,
          notes: row.notes
        });
      } else {
        await Promise.all(validRows.map(row => apiClient.addCustomerRequirement(shipmentId, {
          customer_id: selectedCustomerId,
          product_name: row.product_name.trim(),
          hsn_code: row.hsn_code.trim() || undefined,
          required_quantity: row.required_quantity,
          unit: row.unit,
          notes: row.notes
        })));
      }
      setShowAddModal(false);
      resetForm();
      fetchRequirements();
    } catch (err) {
      alert('Failed to save customer requirement(s)');
    }
  };

  const handleEditReq = (req: ShipmentCustomerRequirement) => {
    setEditingReqId(req.id);
    setSelectedCustomerId(req.customer_id);
    setProductRows([{
      id: 'edit-row',
      product_name: req.product_name,
      hsn_code: req.hsn_code || '',
      required_quantity: req.required_quantity,
      unit: req.unit,
      notes: req.notes || ''
    }]);
    setShowAddModal(true);
  };

  const handleDeleteReq = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this customer requirement?')) return;
    try {
      await apiClient.deleteCustomerRequirement(shipmentId, id);
      setSelectedReqIds(prev => prev.filter(i => i !== id));
      fetchRequirements();
    } catch (err) {
      alert('Failed to delete requirement');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedReqIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedReqIds.length} selected requirement(s)?`)) return;
    try {
      await apiClient.bulkDeleteRequirements(shipmentId, selectedReqIds);
      setSelectedReqIds([]);
      fetchRequirements();
    } catch (err) {
      alert('Failed to delete selected requirements');
    }
  };

  const handleClearAll = async () => {
    if (requirements.length === 0) return;
    if (!window.confirm(`Are you sure you want to clear ALL ${requirements.length} customer requirements? This action cannot be undone.`)) return;
    try {
      await apiClient.clearAllRequirements(shipmentId);
      setSelectedReqIds([]);
      fetchRequirements();
    } catch (err) {
      alert('Failed to clear requirements');
    }
  };

  const toggleSelectAll = () => {
    if (selectedReqIds.length === requirements.length) {
      setSelectedReqIds([]);
    } else {
      setSelectedReqIds(requirements.map(r => r.id));
    }
  };

  const toggleSelectRow = (id: number) => {
    if (selectedReqIds.includes(id)) {
      setSelectedReqIds(prev => prev.filter(i => i !== id));
    } else {
      setSelectedReqIds(prev => [...prev, id]);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const imported = await apiClient.uploadExcelRequirements(shipmentId, file);
      fetchRequirements();
      alert(`Successfully imported ${imported?.length || 0} requirement(s) & auto-enriched with HSN codes!`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to upload requirements file';
      alert(`Upload Error: ${msg}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const validRowsCount = productRows.filter(r => r.product_name.trim().length > 0).length;

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Stage 1: Customer Requirements
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Capture initial expected demands (SKU, Required Qty, Unit, HSN Code) before vendor packing details are known.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
          >
            <History className="w-4 h-4 text-slate-600" />
            Audit History ({history.length})
          </button>

          <a
            href={apiClient.getRequirementsExportExcelUrl(shipmentId)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export Stage 1 Customer Requirements as Excel with HSN Column"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </a>

          <a
            href={apiClient.getRequirementsExportPdfUrl(shipmentId)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export Stage 1 Customer Requirements as PDF"
          >
            <Download className="w-4 h-4 text-purple-600" />
            <span>Export PDF</span>
          </a>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <a
              href={apiClient.getRequirementsTemplateExcelUrl(shipmentId)}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs border border-slate-200 cursor-pointer"
              title="Download Excel Template for Customer Requirements Upload"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download Template</span>
            </a>

            <label className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs">
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>{uploading ? 'Uploading...' : 'Upload Excel'}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {requirements.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Delete all customer requirements for this shipment"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Clear All</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Requirement
          </button>
        </div>
      </div>

      {/* Bulk Selection Actions Bar */}
      {selectedReqIds.length > 0 && (
        <div className="bg-blue-900 text-white p-3 px-5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-blue-700 text-blue-100 rounded-lg text-xs font-extrabold font-mono">
              {selectedReqIds.length} of {requirements.length} Selected
            </span>
            <span className="text-xs text-blue-200 font-medium hidden sm:inline">
              Perform batch operations on selected customer requirement rows
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedReqIds.length})</span>
            </button>
            <button
              onClick={() => setSelectedReqIds([])}
              className="px-3 py-2 bg-blue-800 hover:bg-blue-700 text-blue-200 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading requirements...</div>
        ) : requirements.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">No Requirements Entered Yet</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add customer demand requirements manually or upload an Excel / CSV sheet to get started.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={apiClient.getRequirementsTemplateExcelUrl(shipmentId)}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Download Excel Template for Uploading Requirements"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Download Excel Template</span>
              </a>

              <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer border border-slate-200 shadow-xs">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{uploading ? 'Importing Excel...' : 'Upload Excel Sheet'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer Requirement</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedReqIds.length === requirements.length && requirements.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      title="Select / Deselect All Requirements"
                    />
                  </th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product / SKU Name</th>
                  <th className="py-3 px-4">HSN Code</th>
                  <th className="py-3 px-4">Required Qty</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {requirements.map((req) => {
                  const cust = customers.find(c => c.id === req.customer_id);
                  const isSelected = selectedReqIds.includes(req.id);
                  return (
                  <tr key={req.id} className={`transition-colors ${isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50/50'}`}>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(req.id)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{cust?.name || `Customer #${req.customer_id}`}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-blue-700">{req.product_name}</span>
                        {req.notes?.includes('Auto-corrected') && (
                          <span
                            className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-extrabold border border-amber-300"
                            title={req.notes}
                          >
                            ⚡ Auto-Corrected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {req.hsn_code || 'Auto-mapped'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {req.required_quantity}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                        {req.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={req.notes || ''}>
                      {req.notes?.includes('Auto-corrected') ? (
                        <span className="text-amber-700 font-semibold">{req.notes}</span>
                      ) : (
                        req.notes || '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditReq(req)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"
                          title="Edit Requirement"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteReq(req.id)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-500 hover:text-rose-600 transition-colors"
                          title="Delete Requirement"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Next Step Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Header</span>
          </button>
        ) : <div />}

        <button
          onClick={onNext}
          disabled={requirements.length === 0}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <span>Proceed to Vendor Process</span>
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>

      {/* Modal: Add/Edit Requirement */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingReqId ? 'Edit Customer Requirement' : 'Add Customer Requirement'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingReqId ? 'Update product details for this requirement.' : 'Select a customer and add one or multiple product requirements.'}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRequirement} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Customer *</label>
                <select
                  value={selectedCustomerId}
                  disabled={Boolean(editingReqId)}
                  onChange={e => setSelectedCustomerId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {/* Product Rows List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Product Requirements ({productRows.length})</span>
                </div>

                {productRows.map((row, idx) => (
                  <div key={row.id} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        Item #{idx + 1}
                      </span>
                      {productRows.length > 1 && !editingReqId && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 p-1 hover:bg-rose-50 rounded"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <ProductSearchSelect
                        label="Product / SKU Name"
                        value={row.product_name}
                        onChange={(val) => {
                          handleRowChange(row.id, 'product_name', val);
                          autoDetectHsn(row.id, val);
                        }}
                        onSelectProduct={(opt: ProductOption) => {
                          handleRowChange(row.id, 'product_name', opt.item_name);
                          if (opt.hs_code) {
                            handleRowChange(row.id, 'hsn_code', opt.hs_code);
                          } else {
                            autoDetectHsn(row.id, opt.item_name);
                          }
                          if (opt.unit) {
                            handleRowChange(row.id, 'unit', opt.unit);
                          }
                        }}
                        required
                        placeholder="Search product name, HSN code, or category..."
                      />
                    </div>


                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">HSN Code (Auto-mapped)</label>
                        <input
                          type="text"
                          value={row.hsn_code}
                          onChange={e => handleRowChange(row.id, 'hsn_code', e.target.value)}
                          placeholder="e.g. 0405.90.20 (Auto)"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-blue-700 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Required Quantity *</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={row.required_quantity}
                          onChange={e => handleRowChange(row.id, 'required_quantity', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Unit *</label>
                        <select
                          value={row.unit}
                          onChange={e => handleRowChange(row.id, 'unit', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                        >
                          <option value="Carton">Carton</option>
                          <option value="Pack">Pack</option>
                          <option value="Piece">Piece</option>
                          <option value="Box">Box</option>
                          <option value="KG">KG</option>
                          <option value="Bag">Bag</option>
                          <option value="MT">MT</option>
                          <option value="Bottle">Bottle</option>
                          <option value="Tin">Tin</option>
                          <option value="Drum">Drum</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Specifications</label>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={e => handleRowChange(row.id, 'notes', e.target.value)}
                        placeholder="Optional requirement notes"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-700 bg-white"
                      />
                    </div>
                  </div>
                ))}

                {/* Add Another Product Button */}
                {!editingReqId && (
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full py-2.5 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Another Product</span>
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  {editingReqId ? 'Save Requirement' : (validRowsCount > 1 ? `Save ${validRowsCount} Requirements` : 'Save Requirement')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Audit History */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Customer Requirement Audit History
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1">
              {history.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-4 text-center">No modification logs recorded yet.</div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{h.product_name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        {h.action_type}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      {h.old_quantity !== null && h.old_quantity !== undefined ? (
                        <span>Quantity changed from <strong className="font-mono text-amber-700">{h.old_quantity}</strong> to <strong className="font-mono text-emerald-700">{h.new_quantity} {h.unit}</strong></span>
                      ) : (
                        <span>Added initial requirement: <strong className="font-mono text-emerald-700">{h.new_quantity} {h.unit}</strong></span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(h.modified_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
