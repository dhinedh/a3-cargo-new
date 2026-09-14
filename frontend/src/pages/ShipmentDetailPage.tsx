import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft, Settings, Package, UploadCloud, Users, FileText, Download,
  TrendingUp, Plus, Trash2, FileSpreadsheet, FileSearch, Sparkles,
  Search, Tag, Loader2, BookOpen, Star, CheckCircle2, History, Calculator
} from 'lucide-react';
import type { Shipment, Customer, ShipmentProduct, TariffSearchResult, ItemEntry, UnifiedProductSearchResult } from '../types';
import { apiClient } from '../api/client';
import { parseProductName } from '../utils/productParser';
import { CustomerSearchInput } from '../components/CustomerSearchInput';
import { CustomerSelectionTable } from '../components/CustomerSelectionTable';
import type { CustomerFormData } from '../components/CustomerSearchInput';
import { VendorAllocationStep } from '../components/VendorAllocationStep';

interface ShipmentDetailPageProps {
  shipmentId: number;
  onBack: () => void;
}

export const ShipmentDetailPage: React.FC<ShipmentDetailPageProps> = ({ shipmentId, onBack }) => {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  type MainTabType = 'config' | 'customers' | 'products' | 'customer_alloc' | 'quotations' | 'documents' | 'actuals' | 'audit';
  const [activeTab, setActiveTabState] = useState<MainTabType>(() => {
    const saved = localStorage.getItem(`a3_shipment_${shipmentId}_main_tab`);
    return (saved as MainTabType) || 'config';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('a3_detail_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = (val: boolean) => {
    setIsSidebarCollapsed(val);
    localStorage.setItem('a3_detail_sidebar_collapsed', String(val));
  };


  const setActiveTab = (tab: MainTabType) => {
    localStorage.setItem(`a3_shipment_${shipmentId}_main_tab`, tab);
    setActiveTabState(tab);
  };

  const [vendorSubTab, setVendorSubTab] = useState<
    'allocation' | 'proforma' | 'quotation' | 'payments' | 'audit' | 'packing_lists'
  >(() => {
    const saved = localStorage.getItem(`a3_shipment_${shipmentId}_sub_tab`);
    return (saved as any) || 'allocation';
  });
  const [selectedQuotCustId, setSelectedQuotCustId] = useState<number | null>(null);

  // Excel Upload state
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Manual Product Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShipmentProduct | null>(null);
  const [productForm, setProductForm] = useState({
    customer_id: 0,
    product_name: '',
    product_category: '',
    hsn_code: '',
    quantity: 1,
    weight_val: 0,
    weight_unit: 'KG',
    unit: 'PCS',
    purchase_price: 0,
    currency: 'INR',
    save_to_favorite: false,
  });

  // Quotation Price Override editing state
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [overridePriceVal, setOverridePriceVal] = useState<number>(0);

  // Config Form State
  const [configData, setConfigData] = useState({
    shipment_date: '',
    status: 'DRAFT',
    destination: 'Colombo Port, Sri Lanka',
    currency: 'INR',
    usd_rate: 305.0,
    lkr_inr_rate: 3.65,
    profit_margin_pct: 15.0,
    indian_invoice_margin_pct: 15.0,
    colombo_invoice_margin_pct: 15.0,
    margin_mode: 'MARGIN_ON_REVENUE',
    common_expenses_inr: 0.0,
    common_expenses_lkr: 0.0,
    notes: '',
    customer_ids: [] as number[],
    customer_names: [] as string[],
    customer_addresses: [] as string[],
    customer_details: [] as CustomerFormData[]
  });

  // Actuals Form State
  const [actualsForm, setActualsForm] = useState({
    actual_duty_inr: 0,
    actual_duty_lkr: 0,
    actual_cost_inr: 0,
    actual_cost_lkr: 0,
    actual_revenue_inr: 0,
    actual_revenue_lkr: 0,
    actual_profit_lkr: 0,
    notes: ''
  });
  const [ocrUploading, setOcrUploading] = useState(false);

  // Requirement 14: Dynamic Selection & In-Line Edit States
  const [selectedProdIds, setSelectedProdIds] = useState<number[]>([]);

  // Requirement 15: Product Removal History & Bulk Soft Remove States
  const [showRemovalModal, setShowRemovalModal] = useState<boolean>(false);
  const [removalHistory, setRemovalHistory] = useState<any[]>([]);

  const handleBulkSoftRemove = async () => {
    if (selectedProdIds.length === 0) return;
    const r = window.prompt(
      `Remove ${selectedProdIds.length} selected products from active purchase requirement?\nReason:`,
      'Customer requested removal after reviewing preliminary quotation'
    );
    if (r !== null) {
      try {
        const updated = await apiClient.bulkSoftRemoveProducts(shipmentId, selectedProdIds, r);
        setShipment(updated);
        setSelectedProdIds([]);
        alert(`Successfully soft-removed ${selectedProdIds.length} products and recorded audit history.`);
      } catch (err) {
        console.error('Failed to bulk soft remove products:', err);
      }
    }
  };

  const openRemovalHistoryModal = async () => {
    try {
      const hist = await apiClient.getShipmentRemovalHistory(shipmentId);
      setRemovalHistory(hist);
      setShowRemovalModal(true);
    } catch (err) {
      console.error('Failed to load removal history:', err);
    }
  };

  const toggleSelectAllProducts = () => {
    const activeProds = shipment?.products.filter(p => p.is_active !== false) || [];
    if (selectedProdIds.length === activeProds.length) {
      setSelectedProdIds([]);
    } else {
      setSelectedProdIds(activeProds.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: number) => {
    if (selectedProdIds.includes(id)) {
      setSelectedProdIds(selectedProdIds.filter(i => i !== id));
    } else {
      setSelectedProdIds([...selectedProdIds, id]);
    }
  };

  // Item Master & Tariff DB Typeahead Search State
  const [savedItems, setSavedItems] = useState<ItemEntry[]>([]);
  const [unifiedSuggestions, setUnifiedSuggestions] = useState<UnifiedProductSearchResult[]>([]);
  const [parsedNotice, setParsedNotice] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [tariffDropdownOpen, setTariffDropdownOpen] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState<TariffSearchResult | null>(null);
  const typeaheadWrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadShipment = async () => {
    setLoading(true);
    try {
      const [sData, cData, itemsResp] = await Promise.all([
        apiClient.getShipmentDetails(shipmentId),
        apiClient.getCustomers(),
        apiClient.getItemEntries().catch(() => null)
      ]);
      setShipment(sData);
      setAllCustomers(cData);
      if (itemsResp && itemsResp.items) {
        setSavedItems(itemsResp.items);
      }

      setConfigData({
        shipment_date: sData.shipment_date || '',
        status: sData.status,
        destination: sData.destination || 'Colombo Port, Sri Lanka',
        currency: sData.currency || 'INR',
        usd_rate: sData.usd_rate,
        lkr_inr_rate: sData.lkr_inr_rate,
        profit_margin_pct: sData.profit_margin_pct,
        indian_invoice_margin_pct: sData.indian_invoice_margin_pct ?? 15.0,
        colombo_invoice_margin_pct: sData.colombo_invoice_margin_pct ?? 15.0,
        margin_mode: sData.margin_mode || 'MARGIN_ON_REVENUE',
        common_expenses_inr: sData.common_expenses_inr,
        common_expenses_lkr: sData.common_expenses_lkr,
        notes: sData.notes || '',
        customer_ids: sData.customers.map(c => c.id),
        customer_names: sData.customers.map(c => c.name),
        customer_addresses: sData.customers.map(c => c.address || ''),
        customer_details: sData.customers.map(c => ({
          name: c.name,
          code: c.code,
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          country: c.country || 'Sri Lanka',
          tax_id: c.tax_id || ''
        }))
      });

      if (sData.actuals) {
        setActualsForm({
          actual_duty_inr: sData.actuals.actual_duty_inr || 0,
          actual_duty_lkr: sData.actuals.actual_duty_lkr || 0,
          actual_cost_inr: sData.actuals.actual_cost_inr || 0,
          actual_cost_lkr: sData.actuals.actual_cost_lkr || 0,
          actual_revenue_inr: sData.actuals.actual_revenue_inr || 0,
          actual_revenue_lkr: sData.actuals.actual_revenue_lkr || 0,
          actual_profit_lkr: sData.actuals.actual_profit_lkr || 0,
          notes: sData.actuals.notes || ''
        });
      }
      if (sData.customers && sData.customers.length > 0) {
        setManageCustomerProfiles(sData.customers.map(c => ({
          name: c.name,
          code: c.code,
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          country: c.country || 'Sri Lanka',
          tax_id: c.tax_id || ''
        })));
      } else {
        setManageCustomerProfiles([{ name: '', country: 'Sri Lanka' }]);
      }

      apiClient.getShipmentRemovalHistory(shipmentId)
        .then(hist => setRemovalHistory(hist))
        .catch(() => {});
    } catch (err) {
      console.error('Failed to load shipment details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      apiClient.getShipmentRemovalHistory(shipmentId)
        .then(hist => setRemovalHistory(hist))
        .catch(() => {});
    }
  }, [activeTab, shipmentId]);

  // Close typeahead on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeaheadWrapperRef.current && !typeaheadWrapperRef.current.contains(e.target as Node)) {
        setTariffDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerTypeaheadSearch = (query: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (query.trim().length < 2) {
      setUnifiedSuggestions([]);
      setTariffDropdownOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await apiClient.searchAllProducts(query.trim(), 15);
        setUnifiedSuggestions(results);
        setTariffDropdownOpen(results.length > 0);
      } catch {
        setUnifiedSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleProductNameSearchChange = (value: string) => {
    // 1. Run real-time product parsing for weight, unit, quantity
    const parsed = parseProductName(value);
    let notice: string | null = null;
    let newWeightVal = productForm.weight_val;
    let newWeightUnit = productForm.weight_unit;
    let newQty = productForm.quantity;

    if (parsed.detectedWeightVal !== null) {
      if (parsed.detectedWeightUnit === 'G' || parsed.detectedWeightUnit === 'ML') {
        newWeightVal = parsed.convertedWeightKg || (parsed.detectedWeightVal / 1000);
        newWeightUnit = 'KG';
        notice = `Parsed weight: ${newWeightVal} KG (converted from ${parsed.detectedWeightVal} ${parsed.detectedWeightUnit})`;
      } else {
        newWeightVal = parsed.detectedWeightVal;
        newWeightUnit = parsed.detectedWeightUnit;
        notice = `Parsed weight: ${newWeightVal} ${newWeightUnit}`;
      }
    }

    if (parsed.detectedQuantity !== null) {
      newQty = parsed.detectedQuantity;
      notice = notice ? `${notice} | Pack Qty: ${newQty}` : `Parsed pack quantity: ${newQty}`;
    }

    setParsedNotice(notice);

    setProductForm(f => ({
      ...f,
      product_name: value,
      weight_val: parsed.detectedWeightVal !== null ? newWeightVal : f.weight_val,
      weight_unit: parsed.detectedWeightVal !== null ? newWeightUnit : f.weight_unit,
      quantity: parsed.detectedQuantity !== null ? newQty : f.quantity,
    }));

    setSelectedTariff(null);
    triggerTypeaheadSearch(value);
  };

  const handleCategorySearchChange = (value: string) => {
    setProductForm(f => ({
      ...f,
      product_category: value,
    }));
    triggerTypeaheadSearch(value);
  };

  const calculateSubHsnCode = (baseHsn: string, existingProducts: ShipmentProduct[]): string => {
    if (!baseHsn) return '';
    const clean = baseHsn.trim();

    let basePrefix = clean;
    if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts.length >= 3) {
        basePrefix = parts.slice(0, 2).join('.');
      }
    } else if (clean.length >= 6) {
      basePrefix = clean.substring(0, 6);
    }

    const matchingCount = existingProducts.filter(p => {
      if (!p.hsn_code) return false;
      const pHsn = p.hsn_code.trim();
      return pHsn.startsWith(basePrefix);
    }).length;

    const nextIndex = matchingCount + 1;

    if (clean.includes('.')) {
      const parts = clean.split('.');
      const prefix = parts.slice(0, -1).join('.');
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        const width = Math.max(2, lastPart.length);
        let baseVal = parseInt(lastPart, 10);
        if (baseVal % 10 !== 0 && baseVal > 10) {
          baseVal = Math.floor(baseVal / 10) * 10;
        } else if (baseVal < 10 && baseVal > 0) {
          baseVal = 0;
        }
        const newVal = baseVal + nextIndex;
        return `${prefix}.${String(newVal).padStart(width, '0')}`;
      }
      return `${clean}.${String(nextIndex).padStart(2, '0')}`;
    } else if (/^\d+$/.test(clean) && clean.length >= 6) {
      let baseVal = parseInt(clean, 10);
      if (baseVal % 10 !== 0) {
        baseVal = Math.floor(baseVal / 10) * 10;
      }
      const newVal = baseVal + nextIndex;
      return String(newVal).padStart(clean.length, '0');
    }

    return `${clean}.${String(nextIndex).padStart(2, '0')}`;
  };

  const selectProductSuggestion = (s: UnifiedProductSearchResult) => {
    setSelectedTariff({
      tariff_line_id: s.tariff_line_id || s.id,
      hs_code: s.hs_code || '',
      description: s.description || s.item_name || '',
      general_duty_rate: s.general_duty_rate,
      vat_rate: s.vat_rate,
      pal_rate: s.pal_rate,
      cess_rate: s.cess_rate,
    });

    const isFav = s.source === 'FAVORITE';
    const rawHsn = s.hs_code || productForm.hsn_code;
    const subHsn = calculateSubHsnCode(rawHsn, shipment?.products || []);

    setProductForm(f => ({
      ...f,
      // For Favorite items, populate product_name. For Tariff DB lines, keep user's typed product_name (e.g. 5050 biscuit) intact if present!
      product_name: isFav ? (s.item_name || f.product_name) : (f.product_name.trim() !== '' ? f.product_name : (s.item_name || s.description || f.product_name)),
      // Product category from database/catalog!
      product_category: s.product_category || s.description || s.item_name || f.product_category,
      hsn_code: rawHsn || subHsn || f.hsn_code,
      unit: s.unit ? s.unit.toUpperCase() : f.unit,
      currency: s.currency || f.currency,
      purchase_price: s.purchase_price ? Number(s.purchase_price) : f.purchase_price,
      weight_val: s.weight_val !== null && s.weight_val !== undefined && s.weight_val > 0 ? Number(s.weight_val) : f.weight_val,
      weight_unit: s.weight_unit || f.weight_unit,
    }));
    setTariffDropdownOpen(false);
    setUnifiedSuggestions([]);
  };

  const selectFromItemMaster = (itemId: number) => {
    const found = savedItems.find(i => i.id === itemId);
    if (!found) return;
    setProductForm(f => ({
      ...f,
      product_name: found.item_name,
      hsn_code: found.hs_code || f.hsn_code,
      product_category: found.item_category || f.product_category,
      purchase_price: found.purchase_price ? Number(found.purchase_price) : (found.price_per_kg ? Number(found.price_per_kg) : f.purchase_price),
      weight_val: found.weight_val ? Number(found.weight_val) : f.weight_val,
      weight_unit: found.weight_unit || f.weight_unit,
      unit: found.unit ? found.unit.toUpperCase() : f.unit
    }));
  };

  useEffect(() => {
    loadShipment();
  }, [shipmentId]);

  // Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await apiClient.updateShipmentConfig(shipmentId, configData);
      setShipment(updated);
      alert('Shipment configuration updated and formulas recalculated!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update configuration');
    }
  };

  // Customer Manage Modal State
  const [showCustomerManageModal, setShowCustomerManageModal] = useState(false);
  const [manageCustomerProfiles, setManageCustomerProfiles] = useState<CustomerFormData[]>([]);
  const [quickAddCustomer, setQuickAddCustomer] = useState<CustomerFormData>({ name: '', country: 'Sri Lanka' });

  const openCustomerManageModal = () => {
    const existing = shipment?.customers || [];
    if (existing.length > 0) {
      setManageCustomerProfiles(existing.map(c => ({
        name: c.name,
        code: c.code,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        country: c.country || 'Sri Lanka',
        tax_id: c.tax_id || ''
      })));
    } else {
      setManageCustomerProfiles([{ name: '', country: 'Sri Lanka' }]);
    }
    setShowCustomerManageModal(true);
  };

  const handleSaveManagedCustomers = async () => {
    try {
      const validProfiles = manageCustomerProfiles.filter(p => p.name.trim() !== '');
      if (validProfiles.length === 0) {
        alert('Please provide at least one customer name');
        return;
      }
      const updated = await apiClient.updateShipmentConfig(shipmentId, {
        customer_details: validProfiles
      });
      setShipment(updated);
      setShowCustomerManageModal(false);
      alert('Shipment customers updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update shipment customers');
    }
  };

  // Save Manual Product
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      customer_id: shipment?.customers[0]?.id || allCustomers[0]?.id || 1,
      product_name: '',
      product_category: '',
      hsn_code: '',
      quantity: 1,
      weight_val: 0,
      weight_unit: 'KG',
      unit: 'PCS',
      purchase_price: 0,
      currency: 'INR',
      save_to_favorite: false,
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let currentShipment = shipment;
      if (!currentShipment || currentShipment.customers.length === 0) {
        if (!quickAddCustomer.name.trim()) {
          alert('Please enter or assign a customer for this shipment');
          return;
        }
        currentShipment = await apiClient.updateShipmentConfig(shipmentId, {
          customer_details: [quickAddCustomer]
        });
        setShipment(currentShipment);
      }

      const activeCustId = productForm.customer_id || currentShipment.customers[0]?.id || 1;
      const payload = { ...productForm, customer_id: activeCustId };

      if (editingProduct) {
        const updated = await apiClient.updateProduct(shipmentId, editingProduct.id, payload);
        setShipment(updated);
      } else {
        const updated = await apiClient.addProduct(shipmentId, payload);
        setShipment(updated);
      }
      setShowProductModal(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save product');
    }
  };

  const handleDeleteProduct = async (pId: number) => {
    if (!confirm('Are you sure you want to remove this product?')) return;
    try {
      const updated = await apiClient.deleteProduct(shipmentId, pId);
      setShipment(updated);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete product');
    }
  };

  // Excel Upload
  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please upload a valid Excel file (.xlsx or .xls)');
      return;
    }
    setUploadingExcel(true);
    try {
      const updated = await apiClient.uploadExcelProducts(shipmentId, file);
      setShipment(updated);
      alert('Excel products imported & automatically calculated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Excel import failed');
    } finally {
      setUploadingExcel(false);
    }
  };

  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // Download Sample Excel/CSV Template
  const downloadSampleExcelTemplate = () => {
    const csvHeader = "Customer,Product Name,Category,HSN Code,Qty,Unit,Price,Currency,Weight\n";
    const sampleRows = [
      "Customer 1 Test,Cotton Woven Fabrics,Textiles,5208.11,100,KG,350.00,INR,100.0",
      "Customer 2 Test,Silk Ladies Dresses,Apparel,6204.12,50,PCS,1200.00,INR,25.0",
      "Customer 1 Test,Textile Polyester Yarns,Synthetics,5402.33,250,KG,180.00,INR,250.0"
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'A3_Express_Shipment_Products_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Final Quotation Price Override
  const savePriceOverride = async (pId: number) => {
    try {
      const updated = await apiClient.updateProduct(shipmentId, pId, {
        final_quotation_price: overridePriceVal
      });
      setShipment(updated);
      setEditingPriceId(null);
    } catch (err: any) {
      alert('Failed to save price override');
    }
  };

  // Save Actuals
  const handleSaveActuals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.updateActuals(shipmentId, actualsForm);
      loadShipment();
      alert('Actual duty, cost, and revenue figures saved!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save actual figures');
    }
  };

  // OCR Duty Invoice
  const handleOcrUpload = async (file: File) => {
    setOcrUploading(true);
    try {
      const res = await apiClient.ocrDutyInvoice(shipmentId, file);
      alert(`OCR Extraction Complete!\nDuty Extracted: LKR ${res.extracted_duty_lkr}\nCost Extracted: LKR ${res.extracted_cost_lkr}`);
      loadShipment();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'OCR extraction failed');
    } finally {
      setOcrUploading(false);
    }
  };

  if (loading || !shipment) {
    return <div className="text-center py-12 text-slate-500">Loading shipment studio...</div>;
  }

  // Group products by customer
  const customerProductsMap: Record<number, ShipmentProduct[]> = {};
  shipment.products.forEach(p => {
    if (!customerProductsMap[p.customer_id]) {
      customerProductsMap[p.customer_id] = [];
    }
    customerProductsMap[p.customer_id].push(p);
  });

  // Calculate totals
  const totalPredictedDuty = shipment.products.reduce((acc, p) => acc + ((p.calculated_duty_lkr || 0) * p.quantity), 0);
  const totalPredictedCost = shipment.products.reduce((acc, p) => acc + ((p.total_cost_lkr || 0) * p.quantity), 0);
  const totalPredictedRevenue = shipment.products.reduce((acc, p) => acc + ((p.final_quotation_price || 0) * p.quantity), 0);
  const totalPredictedProfit = totalPredictedRevenue - totalPredictedCost;

  const PIPELINE_STEPS = [
    { id: 'config' as const, stepNo: 1, title: '1. Overview & Rates', subtitle: 'Base assumptions & FX', icon: Settings },
    { id: 'customers' as const, stepNo: 2, title: '2. Customer Consignees', subtitle: 'Consignee directory', icon: Users, badge: shipment?.customers?.length || 0 },
    { id: 'customer_alloc' as const, stepNo: 4, title: '4. Vendor Process', subtitle: '6-step supplier workflow', icon: Users },
    { id: 'products' as const, stepNo: 5, title: '5. Products & Excel Bulk Upload', subtitle: 'Bulk sheets & catalog', icon: Package, badge: shipment?.products?.filter(p => p.is_active !== false).length || 0 },
    { id: 'quotations' as const, stepNo: 6, title: '6. Duty & Quotations', subtitle: 'Formulas & P_1, P_2 sheets', icon: Calculator },
    { id: 'documents' as const, stepNo: 7, title: '7. Invoices & Export Studio', subtitle: 'Colombo & Indian docs', icon: FileText },
    { id: 'actuals' as const, stepNo: 8, title: '8. Actuals & Settlement', subtitle: 'OCR & realized profit', icon: TrendingUp },
    { id: 'audit' as const, stepNo: 9, title: '9. Audit Trail (Req 15)', subtitle: 'Removal history trail', icon: History },
  ];

  const VENDOR_SUB_STEPS = [
    { id: 'allocation' as const, subNo: '4.1', label: '4.1 Requirement Allocation' },
    { id: 'proforma' as const, subNo: '4.2', label: '4.2 Vendor Proforma Invoice (PI)' },
    { id: 'quotation' as const, subNo: '4.3', label: '4.3 Preliminary Quotation' },
    { id: 'payments' as const, subNo: '4.4', label: '4.4 Advance & TT Payments' },
    { id: 'audit' as const, subNo: '4.5', label: '4.5 Actual Invoice Comparison' },
    { id: 'packing_lists' as const, subNo: '4.6', label: '4.6 Continuous Packing Lists' },
  ];

  const flatSteps = [
    { tab: 'config', subTab: null, label: '1. Overview & Rates' },
    { tab: 'customers', subTab: null, label: '2. Customer Consignees' },
    { tab: 'customer_alloc', subTab: 'allocation', label: '4.1 Requirement Allocation' },
    { tab: 'customer_alloc', subTab: 'proforma', label: '4.2 Vendor Proforma Invoice (PI)' },
    { tab: 'customer_alloc', subTab: 'quotation', label: '4.3 Preliminary Quotation' },
    { tab: 'customer_alloc', subTab: 'payments', label: '4.4 Advance & TT Payments' },
    { tab: 'customer_alloc', subTab: 'audit', label: '4.5 Actual Invoice Comparison' },
    { tab: 'customer_alloc', subTab: 'packing_lists', label: '4.6 Continuous Packing Lists' },
    { tab: 'products', subTab: null, label: '5. Products & Excel Bulk Upload' },
    { tab: 'quotations', subTab: null, label: '6. Duty & Quotations' },
    { tab: 'documents', subTab: null, label: '7. Invoices & Export Studio' },
    { tab: 'actuals', subTab: null, label: '8. Actuals & Settlement' },
    { tab: 'audit', subTab: null, label: '9. Audit Trail (Req 15)' },
  ];

  const currentFlatIndex = flatSteps.findIndex(s => {
    if (s.tab === 'customer_alloc' && activeTab === 'customer_alloc') {
      return s.subTab === vendorSubTab;
    }
    return s.tab === activeTab;
  });

  const handlePrevStep = () => {
    if (currentFlatIndex > 0) {
      const prev = flatSteps[currentFlatIndex - 1];
      setActiveTab(prev.tab as MainTabType);
      if (prev.subTab) {
        setVendorSubTab(prev.subTab as any);
        localStorage.setItem(`a3_shipment_${shipmentId}_sub_tab`, prev.subTab);
      }
    }
  };

  const handleNextStep = () => {
    if (currentFlatIndex >= 0 && currentFlatIndex < flatSteps.length - 1) {
      const next = flatSteps[currentFlatIndex + 1];
      setActiveTab(next.tab as MainTabType);
      if (next.subTab) {
        setVendorSubTab(next.subTab as any);
        localStorage.setItem(`a3_shipment_${shipmentId}_sub_tab`, next.subTab);
      }
    }
  };

  return (
    <div className="bg-[#F4F5F7] min-h-[calc(100vh-56px)] font-sans flex w-full">
      {/* Left Sidebar */}
      <aside
        className={`bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto custom-scrollbar z-20 ${
          isSidebarCollapsed ? 'w-16' : 'w-72 sm:w-80'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>All Shipments</span>
            </button>
            <button
              onClick={() => toggleSidebar(!isSidebarCollapsed)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <>
              {/* Shipment Info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 font-mono tracking-tight">
                    {shipment.shipment_no}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                    {shipment.status || 'DRAFT'}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-500">
                  FY: {shipment.shipment_no?.split('/')?.[2] || '2026-27'} &bull; Currency: {shipment.currency || 'INR'}
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Port: {shipment.destination || 'Colombo Port, Sri Lanka'}
                </p>
              </div>

              {/* Margins Row */}
              <div className="flex items-center gap-1.5 text-[11px] pt-1">
                <span className="text-slate-400 font-medium">Margins (Cell B11):</span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <span className="bg-[#FFC000] text-amber-950 px-1.5 py-0.5 rounded font-bold">
                    IN: {Number(shipment.indian_invoice_margin_pct ?? 15).toFixed(4)}%
                  </span>
                  <span className="text-amber-400 font-bold">|</span>
                  <span className="bg-[#FFC000] text-amber-950 px-1.5 py-0.5 rounded font-bold">
                    LK: {Number(shipment.colombo_invoice_margin_pct ?? 15).toFixed(4)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pipeline Navigation */}
        {!isSidebarCollapsed && (
          <div className="p-3 space-y-1 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1.5">
              SHIPMENT PIPELINE
            </div>

            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = activeTab === step.id;

              return (
                <div key={step.id} className="space-y-1">
                  <button
                    onClick={() => setActiveTab(step.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50/90 text-[#0C66E4] font-bold border-l-4 border-[#0C66E4] rounded-l-none'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0C66E4]' : 'text-slate-400'}`} />
                      <span className="truncate">{step.title}</span>
                    </div>
                    {step.badge !== undefined && step.badge > 0 && (
                      <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {step.badge}
                      </span>
                    )}
                  </button>

                  {/* Render Sub-Steps for Step 4 (Vendor Process) - Always open */}
                  {step.id === 'customer_alloc' && (
                    <div className="pl-6 space-y-0.5 border-l-2 border-blue-100 ml-5 my-1">
                      {VENDOR_SUB_STEPS.map((sub) => {
                        const isSubActive = activeTab === 'customer_alloc' && vendorSubTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setActiveTab('customer_alloc');
                              setVendorSubTab(sub.id as any);
                              localStorage.setItem(`a3_shipment_${shipmentId}_sub_tab`, sub.id);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                              isSubActive
                                ? 'bg-blue-100/80 text-[#0C66E4] font-bold shadow-2xs'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* Right Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F4F5F7]">
        {/* Top Header / Breadcrumb Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-14 z-10 shadow-2xs flex-wrap gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Shipments</span>
            <span>/</span>
            <span className="font-bold text-slate-800">{shipment.shipment_no}</span>
            <span>/</span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold text-xs">
              {activeTab === 'customer_alloc'
                ? `Step 4: ${VENDOR_SUB_STEPS.find(s => s.id === vendorSubTab)?.label || 'Vendor Process'}`
                : PIPELINE_STEPS.find(s => s.id === activeTab)?.title || 'Step Details'
              }
            </span>
          </div>

          {/* Top Actions: Prev/Next & Full Workbook */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevStep}
              disabled={currentFlatIndex <= 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev Step</span>
            </button>

            <button
              onClick={handleNextStep}
              disabled={currentFlatIndex >= flatSteps.length - 1}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-[#0C66E4] hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <span>Next Step</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <a
              href={apiClient.getFullWorkbookExcelUrl(shipment.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Full Workbook (.xlsx)</span>
            </a>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="p-6 space-y-6 flex-1 max-w-7xl w-full mx-auto overflow-y-auto">
          {/* Step 1: Configuration & Assumptions */}
          {activeTab === 'config' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    <span>Step 1: Configure Shipment Assumptions & Rates</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define operational dates, currency assumptions, FX rates, and official margin percentages.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Shipment Date</label>
                    <input
                      type="date"
                      value={configData.shipment_date}
                      onChange={e => setConfigData({ ...configData, shipment_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Shipment Status</label>
                    <select
                      value={configData.status}
                      onChange={e => setConfigData({ ...configData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="CONFIGURED">CONFIGURED</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Country / Port</label>
                    <input
                      type="text"
                      value={configData.destination}
                      onChange={e => setConfigData({ ...configData, destination: e.target.value })}
                      placeholder="e.g. Colombo Port, Sri Lanka"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Shipment Base Currency</label>
                    <select
                      value={configData.currency}
                      onChange={e => setConfigData({ ...configData, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold"
                    >
                      <option value="INR">INR (₹ Indian Rupee)</option>
                      <option value="USD">USD ($ US Dollar)</option>
                      <option value="LKR">LKR (Rs Sri Lankan Rupee)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">USD Exchange Rate (LKR per USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={configData.usd_rate}
                      onChange={e => setConfigData({ ...configData, usd_rate: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LKR → INR Exchange Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={configData.lkr_inr_rate}
                      onChange={e => setConfigData({ ...configData, lkr_inr_rate: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Profit Margin Target %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={configData.profit_margin_pct}
                      onChange={e => setConfigData({ ...configData, profit_margin_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Margin Formula Rule (Req 13)</label>
                    <select
                      value={configData.margin_mode}
                      onChange={e => setConfigData({ ...configData, margin_mode: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-blue-900 bg-blue-50/40"
                    >
                      <option value="MARGIN_ON_REVENUE">Margin on Revenue: Cost / (1 - Margin%)</option>
                      <option value="MARKUP_ON_COST">Markup on Cost: Cost * (1 + Margin%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Common Freight/Expenses (LKR)</label>
                    <input
                      type="number"
                      step="1"
                      value={configData.common_expenses_lkr}
                      onChange={e => setConfigData({ ...configData, common_expenses_lkr: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Official Invoice Margin Configuration (Cell B11) */}
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFC000] ring-2 ring-amber-400"></span>
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">Official Invoice Margin Configuration</span>
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-[#FFC000] text-amber-950 shadow-xs">
                        Cell B11 (#FFC000)
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-800/80 font-medium">Controls rates & headers in generated Excel/PDF invoices</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-xs">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-800">Indian Invoice Margin %</label>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          USD Invoice
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={configData.indian_invoice_margin_pct}
                          onChange={e => setConfigData({ ...configData, indian_invoice_margin_pct: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 pr-8"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Reflects in AEC-10 Indian Export Invoice header (yellow #FFC000) and FOB USD unit rates.</p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-xs">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-800">Colombo Invoice Margin %</label>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          LKR/USD Bank
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={configData.colombo_invoice_margin_pct}
                          onChange={e => setConfigData({ ...configData, colombo_invoice_margin_pct: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 pr-8"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Reflects in Colombo Bank Invoice header (yellow #FFC000) and bank invoice unit rates.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Save & Recalculate Assumptions
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#0C66E4] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Continue to Step 2: Customer Consignees</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Customer Consignees */}
          {activeTab === 'customers' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span>Step 2: Customer Consignees</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure one or more buyer consignees receiving products in Shipment {shipment.shipment_no}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveManagedCustomers}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Customer Consignees</span>
                </button>
              </div>

              <CustomerSelectionTable
                customers={manageCustomerProfiles}
                onChange={setManageCustomerProfiles}
                allCustomers={allCustomers}
                title="Assigned Consignees"
                subtitle="Enter or search existing customer profiles from master directory"
              />

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('config')}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ← Step 1: Overview & Rates
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveManagedCustomers();
                    setActiveTab('customer_alloc');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Save & Continue to Step 4: Vendor Process</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

      {/* Tab 1: Products & Excel Upload */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Excel Upload Drag and Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
            }}
            className={`border-2 border-dashed rounded-xl p-6 transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100/80'
              }`}
          >
            <div className="text-center">
              <UploadCloud className="w-9 h-9 text-blue-600 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-sm">Step 5: Products & Excel Bulk Upload (Bulk Import & Catalog)</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Upload your Excel file (.xlsx / .csv) to automatically import items, match tariff codes, and calculate duty formulas.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={downloadSampleExcelTemplate}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Download Sample Template (.csv)
                </button>

                <label className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer shadow-xs transition-colors">
                  <FileSpreadsheet className="w-4 h-4" />
                  {uploadingExcel ? 'Reading & Calculating Excel...' : 'Choose Excel File (.xlsx)'}
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowFormatGuide(!showFormatGuide)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline cursor-pointer px-2 py-1"
                >
                  {showFormatGuide ? 'Hide Column Guide ▲' : 'View Excel Column Format Guide ▼'}
                </button>
              </div>
            </div>

            {/* Column Format Specifications Guide */}
            {showFormatGuide && (
              <div className="mt-4 pt-4 border-t border-slate-200 text-left bg-white p-4 rounded-xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-blue-600" />
                    <span>Excel Column Specifications & Required Header Format</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">Case-insensitive headers supported</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2">Header Name</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Description</th>
                        <th className="p-2">Sample Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Customer</td>
                        <td className="p-2"><span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px]">Optional</span></td>
                        <td className="p-2 font-sans text-slate-600">Customer Name matching assigned customers</td>
                        <td className="p-2 text-slate-800">Customer 1 Test</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Product Name</td>
                        <td className="p-2"><span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Required</span></td>
                        <td className="p-2 font-sans text-slate-600">Item description or product name</td>
                        <td className="p-2 text-slate-800">Cotton Woven Fabrics</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Category</td>
                        <td className="p-2"><span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">Optional</span></td>
                        <td className="p-2 font-sans text-slate-600">Product category or tariff chapter name</td>
                        <td className="p-2 text-slate-800">Textiles</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">HSN Code</td>
                        <td className="p-2"><span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px]">Recommended</span></td>
                        <td className="p-2 font-sans text-slate-600">4, 6 or 8-digit Customs HS Code</td>
                        <td className="p-2 text-slate-800">5208.11</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Qty</td>
                        <td className="p-2"><span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Required</span></td>
                        <td className="p-2 font-sans text-slate-600">Quantity of goods imported</td>
                        <td className="p-2 text-slate-800">100</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Unit</td>
                        <td className="p-2"><span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">Optional</span></td>
                        <td className="p-2 font-sans text-slate-600">Unit of measurement (KG, PCS, Units, Boxes)</td>
                        <td className="p-2 text-slate-800">KG</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Price</td>
                        <td className="p-2"><span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">Required</span></td>
                        <td className="p-2 font-sans text-slate-600">Purchase price per unit</td>
                        <td className="p-2 text-slate-800">350.00</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Currency</td>
                        <td className="p-2"><span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">Optional</span></td>
                        <td className="p-2 font-sans text-slate-600">Purchase currency (INR, USD, LKR)</td>
                        <td className="p-2 text-slate-800">INR</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-blue-700">Weight</td>
                        <td className="p-2"><span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">Optional</span></td>
                        <td className="p-2 font-sans text-slate-600">Total item weight value</td>
                        <td className="p-2 text-slate-800">100.0</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-slate-800">
                Itemized Products ({shipment.products.filter(p => p.is_active !== false).length})
              </h3>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Dynamic Quotation: Rendering {shipment.products.filter(p => p.is_active !== false).length} Rows
              </span>
              {selectedProdIds.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold">
                  {selectedProdIds.length} Selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedProdIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkSoftRemove}
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs"
                  title="Soft-remove selected products from active requirement with audit history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Selected ({selectedProdIds.length})
                </button>
              )}

              <button
                type="button"
                onClick={openRemovalHistoryModal}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                title="View Product Removal Audit Log"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                Removal Audit Log
              </button>

              <button
                type="button"
                onClick={async () => {
                  const approver = window.prompt('Approve Preliminary Quotation & Proceed to Purchase Stage?\nApproved By:', 'Customer Representative');
                  if (approver) {
                    const notes = window.prompt('Approval Notes / PO Remarks:', 'Customer approved quotation after product adjustments');
                    try {
                      const updated = await apiClient.approveQuotationAndCreatePo(shipmentId, approver, notes || undefined);
                      setShipment(updated);
                      alert('Quotation Approved! Shipment moved to Stage 9 (Purchase) and Vendor Purchase Orders generated.');
                    } catch (err) {
                      console.error('Failed to approve quotation:', err);
                    }
                  }
                }}
                className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs"
                title="Approve Preliminary Quotation and proceed to Purchase Stage"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve & Proceed to Purchase
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (shipment) {
                    const updated = await apiClient.updateShipmentConfig(shipment.id, {});
                    setShipment(updated);
                    alert('Recalculated all pricing, margins, freight allocations & total quotations!');
                  }
                }}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs"
                title="Recalculate C&F, Duties, Margins & Totals across all products"
              >
                <Calculator className="w-3.5 h-3.5" />
                Recalculate Totals
              </button>

              <button
                onClick={openAddProductModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Product Manually
              </button>
            </div>
          </div>

          {/* Product Data Table */}
          {shipment.products.filter(p => p.is_active !== false).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
              No products added yet. Use Excel upload above or click <b>Add Product Manually</b>.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-800 text-white font-semibold">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedProdIds.length > 0 &&
                          selectedProdIds.length === shipment.products.filter(p => p.is_active !== false).length
                        }
                        onChange={toggleSelectAllProducts}
                        className="rounded border-slate-400 cursor-pointer"
                        title="Select All Products"
                      />
                    </th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">HSN Code</th>
                    <th className="p-3">Classification</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Purchase Price</th>
                    <th className="p-3 text-right">Base LKR</th>
                    <th className="p-3 text-right">C&F Price</th>
                    <th className="p-3 text-right">Customs Duty</th>
                    <th className="p-3 text-right">Total Cost</th>
                    <th className="p-3 text-right">Suggested Price</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {shipment.products.filter(p => p.is_active !== false).map(p => {
                    const isSelected = selectedProdIds.includes(p.id);
                    return (
                      <tr key={p.id} className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/70 font-medium' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectProduct(p.id)}
                            className="rounded border-slate-300 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-semibold text-slate-700">{p.customer_name}</td>
                        <td className="p-3 font-bold text-slate-800">{p.product_name}</td>
                        <td className="p-3 font-mono text-blue-700">{p.hsn_code || '-'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            p.item_classification === 'SCL'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : p.item_classification === 'LICENSED'
                              ? 'bg-purple-100 text-purple-900 border-purple-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {p.item_classification || 'NORMAL'}
                          </span>
                        </td>

                        {/* In-Line Editable Quantity (Req 14) */}
                        <td className="p-3 text-right font-semibold">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={p.quantity}
                              onBlur={async e => {
                                const newQ = parseFloat(e.target.value);
                                if (!isNaN(newQ) && newQ !== p.quantity) {
                                  const updated = await apiClient.updateProduct(shipmentId, p.id, { quantity: newQ });
                                  setShipment(updated);
                                }
                              }}
                              className="w-20 px-1.5 py-0.5 text-right border border-slate-300 rounded font-semibold text-xs bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-slate-500">{p.unit}</span>
                          </div>
                        </td>

                        {/* In-Line Editable Purchase Price & Currency (Req 14) */}
                        <td className="p-3 text-right font-mono">
                          <div className="flex items-center justify-end gap-1">
                            <select
                              value={p.currency || 'INR'}
                              onChange={async e => {
                                const updated = await apiClient.updateProduct(shipmentId, p.id, { currency: e.target.value });
                                setShipment(updated);
                              }}
                              className="px-1 py-0.5 text-[11px] border border-slate-300 rounded bg-white font-bold"
                            >
                              <option value="INR">INR</option>
                              <option value="USD">USD</option>
                              <option value="LKR">LKR</option>
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={p.purchase_price}
                              onBlur={async e => {
                                const newP = parseFloat(e.target.value);
                                if (!isNaN(newP) && newP !== p.purchase_price) {
                                  const updated = await apiClient.updateProduct(shipmentId, p.id, { purchase_price: newP });
                                  setShipment(updated);
                                }
                              }}
                              className="w-20 px-1.5 py-0.5 text-right border border-slate-300 rounded font-mono text-xs bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </td>

                        <td className="p-3 text-right font-mono text-slate-600">LKR {p.base_price_lkr}</td>
                        <td className="p-3 text-right font-mono text-slate-600">LKR {p.cnf_price}</td>
                        <td className="p-3 text-right font-mono text-amber-700 font-semibold">LKR {p.calculated_duty_lkr}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">LKR {p.total_cost_lkr}</td>

                        {/* In-Line Editable Final Quotation Price (Req 14) */}
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[11px] text-slate-500 font-normal">LKR</span>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={p.suggested_price}
                              onBlur={async e => {
                                const newFP = parseFloat(e.target.value);
                                if (!isNaN(newFP) && newFP !== p.suggested_price) {
                                  const updated = await apiClient.updateProduct(shipmentId, p.id, { final_quotation_price: newFP });
                                  setShipment(updated);
                                }
                              }}
                              className="w-24 px-1.5 py-0.5 text-right border border-emerald-300 rounded font-mono text-xs font-bold text-emerald-800 bg-emerald-50/50 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                            />
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const r = window.prompt(`Remove "${p.product_name}" from active shipment requirement?\nReason:`, 'Customer requested removal from quotation');
                                if (r !== null) {
                                  apiClient.softRemoveProduct(shipmentId, p.id, r).then(updated => {
                                    setShipment(updated);
                                    alert(`"${p.product_name}" soft-removed and recorded in audit trail.`);
                                  });
                                }
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold transition-all cursor-pointer"
                              title="Soft-remove product with audit history"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md"
                              title="Permanent Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 5 Footer Navigation */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('customer_alloc')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              ← Step 4: Vendor Process
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quotations')}
              className="px-4 py-2 bg-[#0C66E4] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Proceed to Step 6: Duty & Quotations</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

          </div>
        </div>
      )}

      {/* Step 4: Vendor Process Breakdown */}
      {activeTab === 'customer_alloc' && (
        <VendorAllocationStep
          shipmentId={shipment.id}
          activeSubTab={vendorSubTab}
          onSubTabChange={(tab) => {
            setVendorSubTab(tab);
            localStorage.setItem(`a3_shipment_${shipment.id}_sub_tab`, tab);
          }}
          onFinish={() => setActiveTab('products')}
          onBack={() => setActiveTab('customers')}
        />
      )}

      {/* Tab: Customer Quotations (P_1, P_2 Sheets Breakdown) */}
      {activeTab === 'quotations' && (
        <div className="space-y-6">
          {/* Customer Sub-Tabs Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Customer Quotation Sheet:</span>
              <div className="flex items-center gap-1.5">
                {shipment.customers.map((c, idx) => {
                  const custId = c.id;
                  const isSelected = (selectedQuotCustId || shipment.customers[0]?.id) === custId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedQuotCustId(custId)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                      <span>Sheet P_{idx + 1} ({c.name})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={apiClient.getFullWorkbookExcelUrl(shipment.id)}
                target="_blank"
                rel="noreferrer"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Full 11-Sheet Workbook (.xlsx)</span>
              </a>
            </div>
          </div>

          {/* Customer Specific Financial Summary Banner */}
          {(() => {
            const num = (v: any) => (v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
            const currentCustId = selectedQuotCustId || shipment.customers[0]?.id;
            const custProds = shipment.products.filter(p => p.customer_id === currentCustId);

            const totalGrossSales = custProds.reduce((sum, p) => sum + (num(p.quantity) * num(p.final_quotation_price)), 0);
            const totalDiscounts = custProds.reduce((sum, p) => sum + (num(p.quantity) * num(p.discount_lkr)), 0);
            const totalShortages = custProds.reduce((sum, p) => sum + num(p.short_amt_lkr), 0);
            const totalNetSettlement = custProds.reduce((sum, p) => sum + num(p.net_settlement_lkr), 0);
            const totalCost = custProds.reduce((sum, p) => sum + (num(p.quantity) * num(p.total_cost_lkr)), 0);
            const netProfit = totalNetSettlement - totalCost;
            const profitMarginPct = totalNetSettlement > 0 ? (netProfit / totalNetSettlement) * 100 : 0;

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-400">Gross Sales</span>
                    <div className="text-sm font-bold font-mono text-slate-800 mt-0.5">LKR {totalGrossSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-400">Total Discounts</span>
                    <div className="text-sm font-bold font-mono text-amber-600 mt-0.5">LKR {totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-400">Shortage Deductions</span>
                    <div className="text-sm font-bold font-mono text-rose-600 mt-0.5">LKR {totalShortages.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
                    <span className="text-[11px] font-semibold text-blue-700">Net Settlement</span>
                    <div className="text-sm font-bold font-mono text-blue-900 mt-0.5">LKR {totalNetSettlement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
                    <span className="text-[11px] font-semibold text-emerald-700">Net Customer Profit</span>
                    <div className="text-sm font-bold font-mono text-emerald-800 mt-0.5">
                      LKR {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({profitMarginPct.toFixed(1)}%)
                    </div>
                  </div>
                </div>

                {/* Quotation Itemized Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Customer Item Quotation & Settlement Matrix</h3>
                      <p className="text-xs text-slate-500">Edit price per pkt, discounts, and shortage deductions directly inline.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-3">#</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">HSN Code</th>
                          <th className="p-3 text-right">Qty</th>
                          <th className="p-3 text-right">NetBuy (INR)</th>
                          <th className="p-3 text-right">Landed Cost (LKR)</th>
                          <th className="p-3 text-right">Price/Pkt (LKR)</th>
                          <th className="p-3 text-right">Discount (LKR)</th>
                          <th className="p-3 text-right">Set Price (LKR)</th>
                          <th className="p-3 text-right">Short Qty</th>
                          <th className="p-3 text-right">Net Settlement (LKR)</th>
                          <th className="p-3 text-right">Profit %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {custProds.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="p-6 text-center text-slate-400 italic font-sans">
                              No products assigned to this customer yet.
                            </td>
                          </tr>
                        ) : (
                          custProds.map((p, idx) => {
                            const qty = num(p.quantity);
                            const netBuyInr = num(p.purchase_price) * qty;
                            const landedCostLkr = num(p.total_cost_lkr) * qty;
                            const finalPriceLkr = num(p.final_quotation_price);
                            const discountLkr = num(p.discount_lkr);
                            const setPriceLkr = num(p.set_price_lkr);
                            const shortQty = num(p.short_qty);
                            const netSettlementLkr = num(p.net_settlement_lkr);
                            const profitPct = landedCostLkr > 0 ? (((netSettlementLkr - landedCostLkr) / landedCostLkr) * 100) : 0;

                            return (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="p-3 font-semibold">{idx + 1}</td>
                                <td className="p-3 font-bold font-sans text-slate-800">{p.product_name}</td>
                                <td className="p-3 font-mono text-slate-600">{p.hsn_code || '-'}</td>
                                <td className="p-3 text-right font-bold">{qty.toLocaleString('en-US')}</td>
                                <td className="p-3 text-right font-mono text-slate-600">Rs. {netBuyInr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="p-3 text-right font-mono text-slate-700">LKR {landedCostLkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="p-3 text-right font-mono text-blue-700 font-bold">
                                  LKR {finalPriceLkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-right font-mono text-amber-700">
                                  LKR {discountLkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900">
                                  LKR {setPriceLkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-right font-mono text-rose-600">
                                  {shortQty.toLocaleString('en-US')}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-emerald-700">
                                  LKR {netSettlementLkr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-right font-mono font-bold">
                                  <span className={`px-1.5 py-0.5 rounded ${profitPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                    {profitPct >= 0 ? `+${profitPct.toFixed(1)}%` : `${profitPct.toFixed(1)}%`}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Step 6 Footer Navigation */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              ← Step 5: Products & Excel Bulk Upload
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className="px-4 py-2 bg-[#0C66E4] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Continue to Step 7: Invoices & Export Studio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Quotation & PDF Output Studio */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Price Override Studio */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Interactive Suggested Price Adjustment</h3>
                <p className="text-xs text-slate-500">Modify quoted price per item before generating official Customer Quotations.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold">
                    <th className="p-3">Customer</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-right">Total Cost</th>
                    <th className="p-3 text-right">System Suggested Price</th>
                    <th className="p-3 text-right">Final Quoted Price</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {shipment.products.map(p => (
                    <tr key={p.id}>
                      <td className="p-3 font-semibold">{p.customer_name}</td>
                      <td className="p-3 font-bold">{p.product_name}</td>
                      <td className="p-3 text-right font-mono">LKR {p.total_cost_lkr}</td>
                      <td className="p-3 text-right font-mono text-blue-700 font-semibold">LKR {p.suggested_price}</td>
                      <td className="p-3 text-right font-mono">
                        {editingPriceId === p.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={overridePriceVal}
                            onChange={e => setOverridePriceVal(parseFloat(e.target.value) || 0)}
                            className="w-28 px-2 py-1 border border-blue-500 rounded-md text-right font-mono text-xs"
                          />
                        ) : (
                          <span className="font-bold text-emerald-700">LKR {p.final_quotation_price}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {editingPriceId === p.id ? (
                          <button
                            onClick={() => savePriceOverride(p.id)}
                            className="px-2 py-1 bg-emerald-600 text-white rounded-md text-xs font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPriceId(p.id);
                              setOverridePriceVal(p.final_quotation_price || 0);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs cursor-pointer"
                          >
                            Edit Price
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Generator Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Quotation PDF Downloads */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                <FileText className="w-4 h-4" />
                <span>STEP 10 &bull; CUSTOMER QUOTATIONS (PDF)</span>
              </div>
              <p className="text-xs text-slate-500">Download customer-specific quotation documents with negotiated final prices.</p>

              <div className="space-y-2">
                {shipment.customers.map(c => (
                  <a
                    key={c.id}
                    href={apiClient.getQuotationUrl(shipment.id, c.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors text-xs font-semibold text-blue-800"
                  >
                    <span>Quotation for {c.name} ({c.code})</span>
                    <Download className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Shipment-level Documents */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <Download className="w-4 h-4" />
                <span>STEPS 11 & 12 &bull; SHIPMENT INVOICES & REPORTS</span>
              </div>
              <p className="text-xs text-slate-500">Generate commercial export/import entry invoices and duty reports.</p>

              {/* Featured Excel Document Downloads */}
              <div className="space-y-3">
                {/* Colombo Bank Document */}
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span>Official AEC-10 Colombo Bank Excel Format</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-[#FFC000] text-amber-950 text-[10px] font-black px-2 py-0.5 rounded shadow-xs">
                        Margin: {shipment.colombo_invoice_margin_pct ?? 15}%
                      </span>
                      <span className="bg-emerald-200 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full">Bank Ready (.xlsx)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Exact format matching <b>AEC-10 CMB BANK DOCUMENT</b> with C&F USD Commercial Invoice.
                  </p>
                  <a
                    href={apiClient.getCmbBankExcelUrl(shipment.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white p-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Colombo Bank Invoice (.xlsx)</span>
                  </a>
                </div>

                {/* Indian Export Invoice */}
                <div className="bg-blue-50/80 border border-blue-300 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                      <span>Official AEC-10 Indian Export Invoice</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-[#FFC000] text-amber-950 text-[10px] font-black px-2 py-0.5 rounded shadow-xs">
                        Margin: {shipment.indian_invoice_margin_pct ?? 15}%
                      </span>
                      <span className="bg-blue-200 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full">Invoice Only (.xlsx)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    Exact format matching <b>AEC-10 CMB.xls</b> with FOB USD Invoice.
                  </p>
                  <a
                    href={apiClient.getIndianExcelUrl(shipment.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-blue-700 hover:bg-blue-800 text-white p-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Indian Export Invoice (.xlsx)</span>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={apiClient.getIndianInvoiceUrl(shipment.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <span>Indian Invoice (INR)</span>
                  <Download className="w-4 h-4" />
                </a>

                <a
                  href={apiClient.getColomboInvoiceUrl(shipment.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-800"
                >
                  <span>Colombo Invoice (LKR)</span>
                  <Download className="w-4 h-4" />
                </a>

                <a
                  href={apiClient.getPackingListUrl(shipment.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <span>Packing List PDF</span>
                  <Download className="w-4 h-4" />
                </a>

                <a
                  href={apiClient.getDutyReportUrl(shipment.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 text-xs font-semibold text-purple-800"
                >
                  <span>Duty Report PDF</span>
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Step 6 Footer Navigation */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('quotations')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              ← Step 5: Duty & Quotations
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('actuals')}
              className="px-4 py-2 bg-[#0C66E4] hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Continue to Step 7: Actuals & Settlement</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Predicted vs Actual & OCR */}
      {activeTab === 'actuals' && (
        <div className="space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase">Customs Duty Comparison</span>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Predicted Duty:</span>
                  <span className="font-mono font-bold">LKR {totalPredictedDuty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Actual Duty Paid:</span>
                  <span className="font-mono font-bold text-amber-700">LKR {(shipment.actuals?.actual_duty_lkr || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-1">
                  <span className="font-semibold">Variance:</span>
                  <span className={`font-mono font-bold ${(shipment.actuals?.actual_duty_lkr || 0) <= totalPredictedDuty ? 'text-emerald-600' : 'text-red-600'}`}>
                    LKR {((shipment.actuals?.actual_duty_lkr || 0) - totalPredictedDuty).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase">Total Shipment Cost</span>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Predicted Cost:</span>
                  <span className="font-mono font-bold">LKR {totalPredictedCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Actual Total Cost:</span>
                  <span className="font-mono font-bold text-blue-700">LKR {(shipment.actuals?.actual_cost_lkr || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-1">
                  <span className="font-semibold">Variance:</span>
                  <span className="font-mono font-bold text-slate-700">
                    LKR {((shipment.actuals?.actual_cost_lkr || 0) - totalPredictedCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase">Profit Realization</span>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Predicted Profit:</span>
                  <span className="font-mono font-bold text-emerald-600">LKR {totalPredictedProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Actual Realized Profit:</span>
                  <span className="font-mono font-bold text-emerald-700">LKR {(shipment.actuals?.actual_profit_lkr || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs border-t pt-1">
                  <span className="font-semibold">Variance:</span>
                  <span className="font-mono font-bold text-slate-700">
                    LKR {((shipment.actuals?.actual_profit_lkr || 0) - totalPredictedProfit).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* OCR Upload & Manual Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 15 PDF OCR Reader */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>STEP 15 &bull; AUTOMATED PDF INVOICE READER / OCR</span>
              </div>
              <p className="text-xs text-slate-500">
                Upload vendor duty bills or customs clearing invoices (PDF) to auto-extract actual duty & cost figures.
              </p>

              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/50 hover:bg-purple-50 cursor-pointer transition-colors">
                <FileSearch className="w-8 h-8 text-purple-600 mb-2" />
                <span className="text-xs font-bold text-purple-900">
                  {ocrUploading ? 'Extracting text with PDF OCR...' : 'Click to Upload Vendor Duty Invoice PDF'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleOcrUpload(e.target.files[0])}
                />
              </label>

              {shipment.actuals?.ocr_source_file && (
                <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  Last OCR Source File: <b>{shipment.actuals.ocr_source_file}</b>
                </div>
              )}
            </div>

            {/* Manual Actuals Form */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Record Actual Financial Figures</h3>
              <form onSubmit={handleSaveActuals} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Duty Paid (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={actualsForm.actual_duty_lkr}
                      onChange={e => setActualsForm({ ...actualsForm, actual_duty_lkr: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Total Cost (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={actualsForm.actual_cost_lkr}
                      onChange={e => setActualsForm({ ...actualsForm, actual_cost_lkr: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Revenue (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={actualsForm.actual_revenue_lkr}
                      onChange={e => setActualsForm({ ...actualsForm, actual_revenue_lkr: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Realized Profit (LKR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={actualsForm.actual_profit_lkr}
                      onChange={e => setActualsForm({ ...actualsForm, actual_profit_lkr: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Save Actual Figures
                </button>
              </form>
            </div>
          </div>

          {/* Step 7 Footer Navigation */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              ← Step 6: Invoices & Export Studio
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>View Step 8: Product Removal Audit Trail</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 8: Product Removal Audit Trail (Req 15) */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                <span>Step 8: Product Removal Audit Trail (Req 15)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete historical trail of items removed from active purchase requirements for Shipment {shipment.shipment_no}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                apiClient.getShipmentRemovalHistory(shipmentId)
                  .then(hist => setRemovalHistory(hist))
                  .catch(() => {});
              }}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Refresh History
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            {removalHistory.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic text-sm">
                No items have been removed from this shipment yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">Date / Time</th>
                    <th className="p-3">Product Removed</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3">Removed By</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Previous State</th>
                    <th className="p-3">New State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {removalHistory.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(item.removed_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{item.product_name}</td>
                      <td className="p-3 text-right font-semibold text-amber-900">{item.quantity}</td>
                      <td className="p-3 font-semibold text-slate-700">{item.removed_by || 'Sales Agent'}</td>
                      <td className="p-3 text-slate-600">{item.reason || 'Customer requested removal'}</td>
                      <td className="p-3 font-mono text-[10px] text-slate-500 max-w-xs truncate" title={JSON.stringify(item.previous_state)}>
                        {JSON.stringify(item.previous_state)}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-rose-600 max-w-xs truncate" title={JSON.stringify(item.new_state)}>
                        {JSON.stringify(item.new_state)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab('actuals')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              ← Step 7: Actuals & Settlement
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              Return to Step 1: Overview
            </button>
          </div>
        </div>
      )}
      </main>

      {/* Manual Product Add/Edit Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add Product to Shipment</h2>
                <p className="text-xs text-slate-500">Search Tariff DB by HS code/description or load from Item Master.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Fill from Item Master */}
            {savedItems.length > 0 && (
              <div className="mb-4 bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
                  <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Select from Saved Item Master:</span>
                </div>
                <select
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) selectFromItemMaster(parseInt(e.target.value));
                  }}
                  className="px-2.5 py-1.5 text-xs border border-indigo-300 rounded-lg bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">-- Pick from Item Master ({savedItems.length} saved) --</option>
                  {savedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.item_name} ({item.hs_code || 'No HSN'}) - ₹{item.price_per_kg || 0}/kg
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {shipment.customers.length === 0 ? (
                <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-2">
                  <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span>No customer assigned to this shipment yet.</span>
                    <span className="text-[11px] text-amber-700 font-medium">Enter customer details below</span>
                  </div>
                  <CustomerSearchInput
                    label="Customer"
                    customerData={quickAddCustomer}
                    onChange={setQuickAddCustomer}
                    allCustomers={allCustomers}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to Customer *</label>
                  <select
                    required
                    value={productForm.customer_id}
                    onChange={e => setProductForm({ ...productForm, customer_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                  >
                    {shipment.customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product Name & Category Section with Tokenized Typeahead Search */}
              <div ref={typeaheadWrapperRef} className="relative space-y-4">
                {/* Field 1: Product Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Product Name / Brand *</span>
                    <span className="text-[11px] text-blue-600 font-normal">Auto-detects weight & searches Tariff DB</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={productForm.product_name}
                      onChange={e => handleProductNameSearchChange(e.target.value)}
                      placeholder="Type brand/item name e.g. 50-50 BISCUIT 140.6 G..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-500 pr-9"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      {searchLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Package className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Parsed Product Info Badge */}
                  {parsedNotice && (
                    <div className="mt-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-semibold text-amber-900 flex items-center gap-1.5 animate-fadeIn">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{parsedNotice}</span>
                    </div>
                  )}
                </div>

                {/* Product Category / Tariff Line Description & HSN Code Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative">
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Product Category / Tariff Line Description *</span>
                      <span className="text-[11px] text-blue-600 font-normal">Searches Tariff DB & Favorites</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={productForm.product_category}
                        onChange={e => handleCategorySearchChange(e.target.value)}
                        placeholder="Search Tariff DB e.g. Sweet biscuits..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium bg-white focus:ring-2 focus:ring-blue-500 pr-9"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        {searchLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <Search className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">HSN Code</label>
                    <input
                      type="text"
                      value={productForm.hsn_code}
                      onChange={e => setProductForm({ ...productForm, hsn_code: e.target.value })}
                      placeholder="e.g. 1905.31.10"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white font-semibold text-blue-700"
                    />
                  </div>
                </div>

                {/* Unified Suggestions Overlay */}
                {tariffDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {unifiedSuggestions.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 italic">
                        No matches found. You can type a custom category or tariff description.
                      </div>
                    ) : (
                      unifiedSuggestions.map(s => (
                        <div
                          key={`${s.source}_${s.id || s.item_name}`}
                          onClick={() => selectProductSuggestion(s)}
                          className="p-3 hover:bg-blue-50/80 cursor-pointer transition-colors space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              {s.source === 'FAVORITE' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Favorite
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
                                  Tariff DB
                                </span>
                              )}
                              <span className="font-bold text-slate-800 truncate">{s.item_name}</span>
                            </div>

                            {s.hs_code && (
                              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                                {s.hs_code}
                              </span>
                            )}
                          </div>

                          {s.description && s.description !== s.item_name && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">
                              {s.description}
                            </div>
                          )}

                          {/* Duty & Price Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {s.purchase_price ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                Price: ₹{s.purchase_price}
                              </span>
                            ) : null}

                            {s.weight_val ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                Weight: {s.weight_val} {s.weight_unit || 'KG'}
                              </span>
                            ) : null}

                            {s.general_duty_rate && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                Duty: {s.general_duty_rate}
                              </span>
                            )}
                            {s.vat_rate && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                VAT: {s.vat_rate}
                              </span>
                            )}
                            {s.pal_rate && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                                PAL: {s.pal_rate}
                              </span>
                            )}
                            {s.cess_rate && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200">
                                CESS: {s.cess_rate}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Tariff Duty Rate Banner */}
              {selectedTariff && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Selected Tariff Line ({selectedTariff.hs_code}):</span>
                  </div>
                  <div className="text-slate-600">{selectedTariff.description}</div>
                  <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                    <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-800">
                      Gen Duty: <b>{selectedTariff.general_duty_rate || '0%'}</b>
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-800">
                      VAT: <b>{selectedTariff.vat_rate || '0%'}</b>
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-800">
                      PAL: <b>{selectedTariff.pal_rate || '0%'}</b>
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-800">
                      CESS: <b>{selectedTariff.cess_rate || '0%'}</b>
                    </span>
                  </div>
                </div>
              )}

              {/* Unit of Measurement Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Unit of Measurement</span>
                  <span className="text-[11px] text-slate-400">Select preset or type custom unit</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['KG', 'Units', 'Pcs', 'Liters', 'Meters', 'Boxes'].map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setProductForm({ ...productForm, unit: u })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${productForm.unit.toUpperCase() === u.toUpperCase()
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-102'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={productForm.unit}
                  onChange={e => setProductForm({ ...productForm, unit: e.target.value.toUpperCase() })}
                  placeholder="Custom unit (e.g. KG, BUNDLES)..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-white"
                />
              </div>

              {/* Price, Currency & Quantity Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price per {productForm.unit || 'Unit'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.purchase_price}
                    onChange={e => setProductForm({ ...productForm, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={productForm.currency}
                    onChange={e => setProductForm({ ...productForm, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="LKR">LKR (Rs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Qty ({productForm.unit || 'Units'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.quantity}
                    onChange={e => setProductForm({ ...productForm, quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white font-semibold"
                  />
                </div>
              </div>

              {/* Weight Breakdown (Optional) */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Weight Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.weight_val || 0}
                    onChange={e => setProductForm({ ...productForm, weight_val: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 10.5"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Weight Unit</label>
                  <select
                    value={productForm.weight_unit || 'KG'}
                    onChange={e => setProductForm({ ...productForm, weight_unit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="KG">KG</option>
                    <option value="Grams">Grams</option>
                    <option value="TONS">Tons</option>
                    <option value="LB">Pounds (LB)</option>
                  </select>
                </div>
              </div>

              {/* Save to Favorites Checkbox */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={productForm.save_to_favorite}
                    onChange={e => setProductForm({ ...productForm, save_to_favorite: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded-md border-amber-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <span>Save / Update this product in Item Master Favorites</span>
                </label>
                <span className="text-[10px] text-amber-700 font-medium">Auto-fills next time!</span>
              </div>

              {/* Calculated Total Banner */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-900">Total Purchase Value:</span>
                <span className="font-mono font-bold text-sm text-blue-900">
                  {productForm.currency === 'INR' ? '₹' : productForm.currency === 'USD' ? '$' : 'Rs.'}{' '}
                  {(productForm.quantity * productForm.purchase_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  Save & Calculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Manage Modal */}
      {showCustomerManageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add & Edit Shipment Customers</h2>
                <p className="text-xs text-slate-500">Configure customer details for Shipment {shipment.shipment_no}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerManageModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <CustomerSelectionTable
                customers={manageCustomerProfiles}
                onChange={setManageCustomerProfiles}
                allCustomers={allCustomers}
                title="Shipment Customers"
                subtitle="Add, remove, or edit customer consignee records"
              />
            </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomerManageModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManagedCustomers}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer shadow-xs font-semibold"
                >
                  Save Customers
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Requirement 15: Product Removal History Audit Log Modal */}
      {showRemovalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-600" />
                  Product Removal Audit History Log (Req 15)
                </h3>
                <p className="text-xs text-slate-500">Historical trail of products removed from active shipment requirements.</p>
              </div>
              <button onClick={() => setShowRemovalModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
              {removalHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No products have been removed from this shipment yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">Date / Time</th>
                      <th className="p-3">Product Removed</th>
                      <th className="p-3 text-right">Quantity</th>
                      <th className="p-3">Removed By</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Previous State</th>
                      <th className="p-3">New State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {removalHistory.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {new Date(item.removed_at).toLocaleString()}
                        </td>
                        <td className="p-3 font-bold text-slate-800">{item.product_name}</td>
                        <td className="p-3 text-right font-semibold text-amber-900">{item.quantity}</td>
                        <td className="p-3 font-semibold text-slate-700">{item.removed_by || 'Sales Agent'}</td>
                        <td className="p-3 text-slate-600">{item.reason || 'Customer requested removal'}</td>
                        <td className="p-3 font-mono text-[10px] text-slate-500">
                          {JSON.stringify(item.previous_state)}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-red-600">
                          {JSON.stringify(item.new_state)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRemovalModal(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
