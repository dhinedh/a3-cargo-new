import React, { useState, useEffect } from 'react';
import {
  Truck,
  Upload,
  Download,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Check,
  X,
  PackageCheck,
  AlertCircle,
  Plus,
  ArrowLeft,
  Star,
  Tag,
  Sparkles,
  Zap,
  Building2,
  Edit2,
  Trash2,
  Box,
  FileSpreadsheet,
  Send,
  CreditCard,
  FileCheck,
  Calculator
} from 'lucide-react';
import { apiClient } from '../api/client';
import { ProductSearchSelect } from './ProductSearchSelect';
import { QuotationSimulatorModal } from './QuotationSimulatorModal';
import type { ProductOption } from './ProductSearchSelect';
import type {
  ShipmentCustomerRequirement,
  Vendor,
  ShipmentVendorAllocation,
  ShipmentVendorProformaItem,
  VendorProductMatchResponse
} from '../types';

interface VendorAllocationStepProps {
  shipmentId: number;
  initialTab?: 'allocation' | 'proforma' | 'quotation' | 'payments' | 'audit' | 'packing_lists';
  activeSubTab?: 'allocation' | 'proforma' | 'quotation' | 'payments' | 'audit' | 'packing_lists';
  onSubTabChange?: (tab: 'allocation' | 'proforma' | 'quotation' | 'payments' | 'audit' | 'packing_lists') => void;
  onFinish: () => void;
  onBack?: () => void;
}

export const VendorAllocationStep: React.FC<VendorAllocationStepProps> = ({
  shipmentId,
  initialTab,
  activeSubTab,
  onSubTabChange,
  onFinish,
  onBack
}) => {
  const [requirements, setRequirements] = useState<ShipmentCustomerRequirement[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allocations, setAllocations] = useState<ShipmentVendorAllocation[]>([]);
  const [proformaItems, setProformaItems] = useState<ShipmentVendorProformaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploadingPI, setUploadingPI] = useState<boolean>(false);
  const [converting, setConverting] = useState<boolean>(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState<boolean>(false);
  type TabType = 'allocation' | 'proforma' | 'quotation' | 'payments' | 'audit' | 'packing_lists';
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    if (activeSubTab) return activeSubTab;
    if (initialTab) return initialTab;
    const saved = localStorage.getItem(`a3_shipment_${shipmentId}_sub_tab`);
    return (saved as TabType) || 'allocation';
  });

  const setActiveTab = (tab: TabType) => {
    localStorage.setItem(`a3_shipment_${shipmentId}_sub_tab`, tab);
    setActiveTabState(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  useEffect(() => {
    if (activeSubTab && activeSubTab !== activeTab) {
      setActiveTabState(activeSubTab);
      if (activeSubTab === 'quotation') loadPreliminaryQuotation();
    }
  }, [activeSubTab]);

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem(`a3_shipment_${shipmentId}_sub_tab`) as TabType;
      if (saved && saved !== activeTab) {
        setActiveTabState(saved);
        if (saved === 'quotation') loadPreliminaryQuotation();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [shipmentId, activeTab]);

  // Preliminary Quotation & Customer Approval State
  const [quotationItems, setQuotationItems] = useState<any[]>([]);
  const [quotationHistory, setQuotationHistory] = useState<any[]>([]);
  const [loadingQuotation, setLoadingQuotation] = useState<boolean>(false);
  const [showNegotiateModal, setShowNegotiateModal] = useState<boolean>(false);
  const [selectedQuotItem, setSelectedQuotItem] = useState<any | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [negotiateNotes, setNegotiateNotes] = useState<string>('');

  // Requirement product matches map: reqId -> VendorProductMatchResponse
  const [productMatchMap, setProductMatchMap] = useState<Record<number, VendorProductMatchResponse>>({});

  // Manual & Multi-vendor allocation modal state
  const [selectedReqId, setSelectedReqId] = useState<number>(0);
  const [selectedVendorIds, setSelectedVendorIds] = useState<number[]>([]);
  const [allocatedQty, setAllocatedQty] = useState<number>(1);
  const [allocatedUnit, setAllocatedUnit] = useState<string>('PCS');
  const [showAllocModal, setShowAllocModal] = useState<boolean>(false);

  // Handle requirement selection change in modal -> auto-select matching vendors
  const handleReqSelectInModal = (reqId: number) => {
    setSelectedReqId(reqId);
    const reqObj = requirements.find(r => r.id === reqId);
    if (reqObj) {
      setAllocatedQty(reqObj.required_quantity);
      setAllocatedUnit(reqObj.unit);

      const matchInfo = productMatchMap[reqId];
      const defaultIds: number[] = [];

      if (matchInfo?.last_allocated_vendor) {
        defaultIds.push(matchInfo.last_allocated_vendor.id);
      }
      if (matchInfo?.matching_vendors) {
        for (const mv of matchInfo.matching_vendors) {
          if (!defaultIds.includes(mv.id)) {
            defaultIds.push(mv.id);
          }
        }
      }
      if (defaultIds.length === 0 && vendors.length > 0) {
        defaultIds.push(vendors[0].id);
      }

      setSelectedVendorIds(defaultIds);
    }
  };

  const toggleVendorSelection = (vendorId: number) => {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
    );
  };

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqId || selectedVendorIds.length === 0) {
      alert('Please select a customer requirement and at least one vendor');
      return;
    }

    try {
      for (const vId of selectedVendorIds) {
        const exists = allocations.some(a => a.requirement_id === selectedReqId && a.vendor_id === vId);
        if (!exists) {
          await apiClient.createVendorAllocation(shipmentId, {
            requirement_id: selectedReqId,
            vendor_id: vId,
            allocated_quantity: allocatedQty,
            allocated_unit: allocatedUnit
          });
        }
      }

      setShowAllocModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to allocate requirement to selected vendors');
    }
  };

  // Proforma Item Modal state (Add / Edit)
  const [showPiModal, setShowPiModal] = useState<boolean>(false);
  const [editingPiId, setEditingPiId] = useState<number | null>(null);
  const [piForm, setPiForm] = useState<{
    vendor_id: number;
    product_name: string;
    sku: string;
    hsn_code: string;
    proforma_qty: number;
    cartons_count: number;
    max_required_qty?: number;
    units_per_carton: number;
    unit_weight_val: number;
    unit_weight_unit: string;
    net_weight_kg: number;
    gross_weight_kg: number;
    proforma_price: number;
    price_basis: 'PER_UNIT' | 'PER_CARTON' | 'PER_KG' | 'TOTAL_LOT';
    price_per_carton: number;
    price_per_kg: number;
    mrp: number;
    discount_pct: number;
    gst_pct: number;
    total_payable: number;
    currency: string;
    notes: string;
  }>({
    vendor_id: 0,
    product_name: '',
    sku: '',
    hsn_code: '',
    proforma_qty: 1,
    cartons_count: 1,
    max_required_qty: 1,
    units_per_carton: 12,
    unit_weight_val: 0.5,
    unit_weight_unit: 'KG',
    net_weight_kg: 6.0,
    gross_weight_kg: 6.3,
    proforma_price: 50,
    price_basis: 'PER_UNIT',
    price_per_carton: 600,
    price_per_kg: 100,
    mrp: 60,
    discount_pct: 5,
    gst_pct: 18,
    total_payable: 600,
    currency: 'INR',
    notes: ''
  });


  // Requirement 18: Vendor Payment State
  const [paymentSummaryList, setPaymentSummaryList] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState({
    vendor_id: 0,
    total_purchase_amount: 100000,
    advance_paid: 60000,
    payment_ref: 'TT-' + Math.floor(100000 + Math.random() * 900000),
    payment_method: 'BANK_TT',
    payment_type: 'ADVANCE',
    notes: 'Advance Payment against Vendor Proforma PI'
  });

  const loadVendorPayments = async () => {
    try {
      const summary = await apiClient.getVendorPaymentSummary(shipmentId);
      setPaymentSummaryList(summary);
    } catch (err) {
      console.error('Failed to load vendor payment summary:', err);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.vendor_id) {
      alert('Please select Vendor');
      return;
    }
    if (!paymentForm.payment_ref.trim()) {
      alert('Please enter Payment Reference (e.g. TT / LC Number)');
      return;
    }

    try {
      await apiClient.recordVendorPayment(shipmentId, paymentForm);
      alert('Vendor Payment recorded successfully!');
      setShowPaymentModal(false);
      loadVendorPayments();
    } catch (err) {
      alert('Failed to record vendor payment');
    }
  };

  // Requirement 19: Actual Vendor Invoice Comparison State
  const [actualComparisonList, setActualComparisonList] = useState<any[]>([]);
  const [showActualInvoiceModal, setShowActualInvoiceModal] = useState<boolean>(false);
  const [selectedActualVendorId, setSelectedActualVendorId] = useState<number>(0);
  const [actualInvoiceRows, setActualInvoiceRows] = useState<any[]>([]);

  const loadActualComparison = async () => {
    try {
      const data = await apiClient.getProformaActualComparison(shipmentId);
      setActualComparisonList(data);
    } catch (err) {
      console.error('Failed to load actual invoice comparison audit:', err);
    }
  };

  const handleRunComparison = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActualVendorId) {
      alert('Please select Vendor');
      return;
    }

    try {
      await apiClient.compareProformaActualInvoice(shipmentId, selectedActualVendorId, actualInvoiceRows);
      alert('Actual Vendor Invoice comparison audit completed!');
      setShowActualInvoiceModal(false);
      loadActualComparison();
    } catch (err) {
      alert('Failed to run actual invoice comparison audit');
    }
  };

  // Requirement 21: Continuous Packing List Generation State
  const [packingListRecords, setPackingListRecords] = useState<any[]>([]);

  const loadPackingLists = async () => {
    try {
      const data = await apiClient.getShipmentPackingLists(shipmentId);
      setPackingListRecords(data);
    } catch (err) {
      console.error('Failed to load packing lists:', err);
    }
  };

  const handleGenerateNextPackingList = async () => {
    try {
      const res = await apiClient.generatePackingListFromReceiving(shipmentId, undefined, 'Generated continuous Packing List after physical receiving verification');
      alert(`Continuous Packing List generated: ${res.pl_number} (Sequence #${res.sequence_val})`);
      loadPackingLists();
    } catch (err) {
      alert('Failed to generate continuous Packing List');
    }
  };

  useEffect(() => {
    loadActualComparison();
    loadPackingLists();
  }, [shipmentId]);

  // Post-Partial Arrival Product Modification Modal State (Req 27)
  const [showModifyReqModal, setShowModifyReqModal] = useState<boolean>(false);
  const [selectedModifyReq, setSelectedModifyReq] = useState<any | null>(null);
  const [modifyReqForm, setModifyReqForm] = useState<{
    new_qty: number;
    unit: string;
    reason: string;
    notes: string;
  }>({
    new_qty: 1,
    unit: 'CTNS',
    reason: 'Customer Emergency',
    notes: ''
  });

  const handleSaveModifyReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModifyReq) return;

    try {
      await apiClient.updateRequirement(shipmentId, selectedModifyReq.id, {
        required_quantity: modifyReqForm.new_qty,
        unit: modifyReqForm.unit,
        notes: `Modified Post-Partial Arrival (${modifyReqForm.reason}): ${modifyReqForm.notes || 'No extra notes'}`
      });

      setShowModifyReqModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to modify pending requirement:', err);
    }
  };

  // Quick Create Vendor Modal State (Requirement 8: Inline Vendor Registration)
  const [showCreateVendorModal, setShowCreateVendorModal] = useState<boolean>(false);
  const [creatingVendor, setCreatingVendor] = useState<boolean>(false);
  const [newVendorForm, setNewVendorForm] = useState({
    name: '',
    gstin: '',
    phone: '',
    contact_person: '',
    email: '',
    address: '',
    main_category: 'General Foods & Provisions'
  });

  const handleQuickCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorForm.name.trim()) {
      alert('Please enter Vendor Name');
      return;
    }

    try {
      setCreatingVendor(true);
      const created = await apiClient.createVendor(newVendorForm);
      alert(`Vendor "${created.name}" (${created.code}) registered successfully!`);
      
      const updatedVendors = await apiClient.getVendors();
      setVendors(updatedVendors);
      setSelectedVendorIds(prev => prev.includes(created.id) ? prev : [...prev, created.id]);
      setPiForm(prev => ({ ...prev, vendor_id: created.id }));
      
      setShowCreateVendorModal(false);
      setNewVendorForm({
        name: '',
        gstin: '',
        phone: '',
        contact_person: '',
        email: '',
        address: '',
        main_category: 'General Foods & Provisions'
      });
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to register new vendor');
    } finally {
      setCreatingVendor(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqs, vends, allocs, pis] = await Promise.all([
        apiClient.getCustomerRequirements(shipmentId).catch(() => []),
        apiClient.getVendors().catch(() => []),
        apiClient.getVendorAllocations(shipmentId).catch(() => []),
        apiClient.getVendorProformaItems(shipmentId).catch(() => [])
      ]);

      setRequirements(reqs);
      setVendors(vends);
      setAllocations(allocs);
      setProformaItems(pis);

      if (vends.length > 0 && selectedVendorIds.length === 0) {
        setSelectedVendorIds([vends[0].id]);
      }
      if (reqs.length > 0 && !selectedReqId) {
        setSelectedReqId(reqs[0].id);
      }

      // Fetch auto-matched vendors for all requirements in parallel
      if (reqs.length > 0) {
        const matchesArray = await Promise.all(
          reqs.map(async (r) => {
            try {
              const matchRes = await apiClient.getMatchingVendorsForProduct(r.product_name);
              return { id: r.id, matchRes };
            } catch (mErr) {
              return { id: r.id, matchRes: null };
            }
          })
        );

        const matches: Record<number, VendorProductMatchResponse> = {};
        for (const item of matchesArray) {
          if (item.matchRes) {
            matches[item.id] = item.matchRes;
          }
        }
        setProductMatchMap(matches);
      }
    } catch (err) {
      console.error('Failed to load vendor allocation data:', err);
    } finally {
      setLoading(false);
    }
  };


  const loadPreliminaryQuotation = async () => {
    try {
      setLoadingQuotation(true);
      const items = await apiClient.getPreliminaryQuotation(shipmentId);
      setQuotationItems(items);
      const history = await apiClient.getQuotationHistory(shipmentId);
      setQuotationHistory(history);
    } catch (err) {
      console.error('Failed to load preliminary quotation:', err);
    } finally {
      setLoadingQuotation(false);
    }
  };

  const handleApproveQuotItem = async (itemId: number) => {
    try {
      await apiClient.approveQuotationItem(shipmentId, itemId);
      loadPreliminaryQuotation();
    } catch (err) {
      alert('Failed to approve product');
    }
  };

  const handleRemoveQuotItem = async (itemId: number) => {
    try {
      await apiClient.removeQuotationItem(shipmentId, itemId);
      loadPreliminaryQuotation();
    } catch (err) {
      alert('Failed to remove product');
    }
  };

  const handleNegotiateQuotItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuotItem) return;
    try {
      await apiClient.negotiateQuotationItem(shipmentId, selectedQuotItem.id, editQty, targetPrice, negotiateNotes);
      setShowNegotiateModal(false);
      loadPreliminaryQuotation();
    } catch (err) {
      alert('Failed to submit quantity/price negotiation request');
    }
  };
  useEffect(() => {
    fetchData();
    loadVendorPayments();
    loadPreliminaryQuotation();
  }, [shipmentId]);

  // Quick 1-Click Allocate to Last Selected or Matched Vendor
  const handleQuickAllocate = async (req: ShipmentCustomerRequirement, vendorId: number) => {
    try {
      await apiClient.createVendorAllocation(shipmentId, {
        requirement_id: req.id,
        vendor_id: vendorId,
        allocated_quantity: req.required_quantity,
        allocated_unit: req.unit
      });
      fetchData();
    } catch (err) {
      alert('Failed to quick-allocate vendor');
    }
  };

  // Download Sample Vendor PI Excel / CSV Template
  const downloadSampleVendorPiExcel = () => {
    const csvHeader = "Vendor Code,Product Name,Quantity,Cartons,Units Per Carton,Unit Weight,Net Weight,Gross Weight,Proforma Price,Currency,Notes\n";
    const sampleRows = [
      "VEND-001,Ragi Grain (Vendor A),120,10,12,0.5,60.0,63.0,45.00,INR,Vendor A packing configuration (12 units per carton)",
      "VEND-002,Maida Flour (Vendor B),240,10,24,1.0,240.0,252.0,50.00,INR,Vendor B packing configuration (24 units per carton)",
      "VEND-003,Atta Flour (Vendor C),50,10,5,2.0,100.0,105.0,110.00,INR,Vendor C packing configuration (5 units per carton)",
      "VEND-004,White Sugar (Vendor D - 30kg Bag),300,10,1,30.0,300.0,305.0,1500.00,INR,Vendor D packing configuration (30 kg bag)"
    ].join("\n");

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'A3_Vendor_Proforma_Invoice_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePIExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPI(true);
      const items = await apiClient.uploadVendorProformaExcel(shipmentId, file);
      setProformaItems(items);
      alert('Vendor Proforma Invoice (PI) file uploaded and imported successfully!');
      fetchData();
    } catch (err) {
      alert('Failed to upload Vendor Proforma Invoice file');
    } finally {
      setUploadingPI(false);
      e.target.value = '';
    }
  };

  // Auto-detect HSN Code and Allocated Vendor when Product Name changes in Proforma Item Modal
  const handleProductChangeInPiForm = async (prodName: string) => {
    // Find matching requirement from Stage 1
    const matchingReq = requirements.find(r => r.product_name.toLowerCase().trim() === prodName.toLowerCase().trim());
    const reqQty = matchingReq ? (matchingReq.required_quantity || 1) : 1;
    const reqHsn = matchingReq ? (matchingReq.hsn_code || '') : '';

    // Find vendor allocated to this requirement
    let autoVendorId = 0;
    if (matchingReq) {
      const matchAlloc = allocations.find(a => a.requirement_id === matchingReq.id);
      if (matchAlloc) autoVendorId = matchAlloc.vendor_id;
    }

    let detectedHsn = reqHsn;
    try {
      if (!detectedHsn && prodName.trim().length >= 2) {
        const mainQuery = prodName.split('(')[0].trim();
        const innerQuery = prodName.match(/\(([^)]+)\)/)?.[1]?.trim() || '';

        // 1st priority: Unified Product Search
        let results = await apiClient.searchAllProducts(prodName);
        if (results.length === 0 && mainQuery) {
          results = await apiClient.searchAllProducts(mainQuery);
        }
        if (results.length === 0 && innerQuery) {
          results = await apiClient.searchAllProducts(innerQuery);
        }

        if (results.length > 0 && results[0].hs_code) {
          detectedHsn = results[0].hs_code;
        } else {
          // 2nd priority: Tariff Line Search
          let tResults = await apiClient.searchTariffByName(mainQuery || prodName);
          if (tResults.length === 0 && innerQuery) {
            tResults = await apiClient.searchTariffByName(innerQuery);
          }
          if (tResults.length > 0 && tResults[0].hs_code) {
            detectedHsn = tResults[0].hs_code;
          }
        }
      }
    } catch (err) {
      console.log('HSN search fallback error:', err);
    }

    setPiForm(prev => {
      const cartons = reqQty;
      const unitsPerCarton = prev.units_per_carton || 12;
      const uWeight = prev.unit_weight_val || 0.5;
      const totalUnits = cartons * unitsPerCarton;
      const netWt = totalUnits * uWeight;
      const grossWt = Number((netWt * 1.05).toFixed(2));

      return {
        ...prev,
        product_name: prodName,
        vendor_id: autoVendorId || prev.vendor_id || (vendors.length > 0 ? vendors[0].id : 0),
        hsn_code: detectedHsn || prev.hsn_code,
        cartons_count: cartons,
        units_per_carton: unitsPerCarton,
        proforma_qty: totalUnits,
        net_weight_kg: netWt,
        gross_weight_kg: grossWt
      };
    });
  };

  const openPiModal = (item?: ShipmentVendorProformaItem) => {
    if (item) {
      const matchingReq = requirements.find(r => r.product_name.toLowerCase().trim() === item.product_name.toLowerCase().trim());
      const maxReqCartons = matchingReq ? (matchingReq.required_quantity || item.cartons_count || 1) : (item.cartons_count || 1);

      const defPrice = item.proforma_price || 0;
      const defCartons = item.cartons_count || 1;
      const defUnitsCtn = item.units_per_carton || 12;
      const defTotalUnits = item.proforma_qty || (defCartons * defUnitsCtn);
      const defNet = item.net_weight_kg || 0;
      const defTotalPay = item.total_payable || (defPrice * defTotalUnits);
      const defCtnPrice = defPrice * defUnitsCtn;
      const defKgPrice = defNet > 0 ? defTotalPay / defNet : 0;

      setEditingPiId(item.id);
      setPiForm({
        vendor_id: item.vendor_id,
        product_name: item.product_name,
        sku: item.sku || '',
        hsn_code: item.hsn_code || '',
        proforma_qty: defTotalUnits,
        cartons_count: defCartons,
        max_required_qty: maxReqCartons,
        units_per_carton: defUnitsCtn,
        unit_weight_val: item.unit_weight_val,
        unit_weight_unit: item.unit_weight_unit || 'KG',
        net_weight_kg: defNet,
        gross_weight_kg: item.gross_weight_kg,
        proforma_price: Number(defPrice.toFixed(4)),
        price_basis: 'PER_CARTON',
        price_per_carton: Number(defCtnPrice.toFixed(2)),
        price_per_kg: Number(defKgPrice.toFixed(2)),
        mrp: item.mrp || 0,
        discount_pct: item.discount_pct || 0,
        gst_pct: item.gst_pct || 18,
        total_payable: Number(defTotalPay.toFixed(2)),
        currency: item.currency || 'INR',
        notes: item.notes || ''
      });
    } else {
      setEditingPiId(null);
      const req = requirements.length > 0 ? requirements[0] : null;
      const defProdName = req ? req.product_name : '';
      const defCartons = req ? (req.required_quantity || 1) : 1;
      const maxReqCartons = defCartons;
      const defHsn = req ? (req.hsn_code || '') : '';
      
      const matchingAlloc = allocations.find(a => {
        const reqProd = a.requirement?.product_name || requirements.find(r => r.id === a.requirement_id)?.product_name || '';
        return reqProd.toLowerCase().trim() === defProdName.toLowerCase().trim();
      });
      const defVendorId = matchingAlloc ? matchingAlloc.vendor_id : (vendors.length > 0 ? vendors[0].id : 0);

      const defUnitsPerCarton = 12;
      const defUnitWeight = 0.5;
      const defTotalUnits = defCartons * defUnitsPerCarton;
      const defNet = defTotalUnits * defUnitWeight;
      const defGross = Number((defNet * 1.05).toFixed(2));
      const defPrice = 45;
      const defTotalPay = defPrice * defTotalUnits;
      const defCtnPrice = defPrice * defUnitsPerCarton;
      const defKgPrice = defNet > 0 ? defTotalPay / defNet : 0;

      setPiForm({
        vendor_id: defVendorId,
        product_name: defProdName,
        sku: '',
        hsn_code: defHsn,
        proforma_qty: defTotalUnits,
        cartons_count: defCartons,
        max_required_qty: maxReqCartons,
        units_per_carton: defUnitsPerCarton,
        unit_weight_val: defUnitWeight,
        unit_weight_unit: 'KG',
        net_weight_kg: defNet,
        gross_weight_kg: defGross,
        proforma_price: Number(defPrice.toFixed(4)),
        price_basis: 'PER_CARTON',
        price_per_carton: Number(defCtnPrice.toFixed(2)),
        price_per_kg: Number(defKgPrice.toFixed(2)),
        mrp: 60,
        discount_pct: 5,
        gst_pct: 18,
        total_payable: Number(defTotalPay.toFixed(2)),
        currency: 'INR',
        notes: ''
      });
    }
    setShowPiModal(true);
  };

  // Handle Proforma Form Field Changes with Live Math & Multi-Unit Pricing Recalculation
  const updatePiFormField = (field: string, val: any) => {
    setPiForm(prev => {
      let finalVal = val;
      // Enforce max quantity restriction (can reduce, but cannot increase above max_required_qty)
      if (field === 'cartons_count') {
        const numVal = Math.abs(Number(val) || 0);
        const maxCap = prev.max_required_qty;
        if (maxCap && maxCap > 0 && numVal > maxCap) {
          finalVal = maxCap;
        } else {
          finalVal = numVal;
        }
      }

      const updated = { ...prev, [field]: finalVal };

      // Recalculate weights & total quantity when packing fields change
      const cartons = field === 'cartons_count' ? Math.abs(Number(finalVal) || 0) : Math.abs(prev.cartons_count || 0);
      const unitsPerCarton = field === 'units_per_carton' ? Math.abs(Number(val) || 0) : Math.abs(prev.units_per_carton || 0);
      const uWeight = field === 'unit_weight_val' ? Math.abs(Number(val) || 0) : Math.abs(prev.unit_weight_val || 0);

      const totalUnits = cartons * unitsPerCarton;
      const netWt = Number((totalUnits * uWeight).toFixed(2));
      const grossWt = Number((netWt * 1.05).toFixed(2));

      if (field === 'cartons_count' || field === 'units_per_carton' || field === 'unit_weight_val') {
        updated.proforma_qty = totalUnits;
        updated.net_weight_kg = netWt;
        updated.gross_weight_kg = grossWt;
      }

      const activeBasis = field === 'price_basis' ? val : (prev.price_basis || 'PER_CARTON');
      updated.price_basis = activeBasis;

      const currentTotalUnits = updated.proforma_qty || 1;
      const currentNetWeight = updated.net_weight_kg || 0;
      const currentUnitsPerCarton = updated.units_per_carton || 1;

      let pUnit = prev.proforma_price || 0;
      let pCarton = prev.price_per_carton || (pUnit * currentUnitsPerCarton);
      let pKg = prev.price_per_kg || (currentNetWeight > 0 ? (pUnit * currentTotalUnits) / currentNetWeight : 0);
      let pTotal = prev.total_payable || (pUnit * currentTotalUnits);

      if (field === 'proforma_price') {
        pUnit = Math.abs(Number(val) || 0);
        pCarton = pUnit * currentUnitsPerCarton;
        pTotal = pUnit * currentTotalUnits;
        pKg = currentNetWeight > 0 ? pTotal / currentNetWeight : 0;
      } else if (field === 'price_per_carton') {
        pCarton = Math.abs(Number(val) || 0);
        pUnit = currentUnitsPerCarton > 0 ? pCarton / currentUnitsPerCarton : pCarton;
        pTotal = pUnit * currentTotalUnits;
        pKg = currentNetWeight > 0 ? pTotal / currentNetWeight : 0;
      } else if (field === 'price_per_kg') {
        pKg = Math.abs(Number(val) || 0);
        pTotal = currentNetWeight > 0 ? pKg * currentNetWeight : pKg * currentTotalUnits;
        pUnit = currentTotalUnits > 0 ? pTotal / currentTotalUnits : 0;
        pCarton = pUnit * currentUnitsPerCarton;
      } else if (field === 'total_payable') {
        pTotal = Math.abs(Number(val) || 0);
        pUnit = currentTotalUnits > 0 ? pTotal / currentTotalUnits : 0;
        pCarton = pUnit * currentUnitsPerCarton;
        pKg = currentNetWeight > 0 ? pTotal / currentNetWeight : 0;
      } else {
        // When packing dimensions, quantity, or price_basis change, re-evaluate derived values based on activeBasis
        if (activeBasis === 'PER_UNIT') {
          pCarton = pUnit * currentUnitsPerCarton;
          pTotal = pUnit * currentTotalUnits;
          pKg = currentNetWeight > 0 ? pTotal / currentNetWeight : 0;
        } else if (activeBasis === 'PER_CARTON') {
          pUnit = currentUnitsPerCarton > 0 ? pCarton / currentUnitsPerCarton : pCarton;
          pTotal = pUnit * currentTotalUnits;
          pKg = currentNetWeight > 0 ? pTotal / currentNetWeight : 0;
        } else if (activeBasis === 'PER_KG') {
          pTotal = currentNetWeight > 0 ? pKg * currentNetWeight : pKg * currentTotalUnits;
          pUnit = currentTotalUnits > 0 ? pTotal / currentTotalUnits : 0;
          pCarton = pUnit * currentUnitsPerCarton;
        } else if (activeBasis === 'TOTAL_LOT') {
          pUnit = currentTotalUnits > 0 ? pTotal / currentTotalUnits : 0;
          pCarton = pUnit * currentUnitsPerCarton;
          pKg = currentNetWeight > 0 ? pTotal / currentNetWeight : 0;
        }
      }

      updated.proforma_price = Number(pUnit.toFixed(4));
      updated.price_per_carton = Number(pCarton.toFixed(2));
      updated.price_per_kg = Number(pKg.toFixed(2));
      updated.total_payable = Number(pTotal.toFixed(2));

      return updated;
    });
  };

  // Preset Packing Configuration Handler (e.g. Vendor A: 12/ctn, Vendor B: 24/ctn, Vendor C: 5/ctn, Vendor D: 30kg bag)
  const applyPackingPreset = (presetName: string) => {
    let units = 12;
    let uWeight = 0.5;
    let note = 'Vendor A configuration (12 units/carton)';

    if (presetName === 'VENDOR_B_24') {
      units = 24;
      uWeight = 1.0;
      note = 'Vendor B configuration (24 units/carton)';
    } else if (presetName === 'VENDOR_C_5') {
      units = 5;
      uWeight = 2.0;
      note = 'Vendor C configuration (5 units/carton)';
    } else if (presetName === 'VENDOR_D_BAG_30') {
      units = 1;
      uWeight = 30.0;
      note = 'Vendor D configuration (30 kg bag)';
    }

    setPiForm(prev => {
      const cartons = prev.cartons_count || 10;
      const totalQty = cartons * units;
      const net = totalQty * uWeight;
      const gross = presetName === 'VENDOR_D_BAG_30' ? Number((net + (cartons * 0.5)).toFixed(2)) : Number((net * 1.05).toFixed(2));

      const activeBasis = prev.price_basis || 'PER_UNIT';
      let pUnit = prev.proforma_price || 0;
      let pCarton = prev.price_per_carton || (pUnit * units);
      let pKg = prev.price_per_kg || (net > 0 ? (pUnit * totalQty) / net : 0);
      let pTotal = prev.total_payable || (pUnit * totalQty);

      if (activeBasis === 'PER_UNIT') {
        pCarton = pUnit * units;
        pTotal = pUnit * totalQty;
        pKg = net > 0 ? pTotal / net : 0;
      } else if (activeBasis === 'PER_CARTON') {
        pUnit = units > 0 ? pCarton / units : pCarton;
        pTotal = pUnit * totalQty;
        pKg = net > 0 ? pTotal / net : 0;
      } else if (activeBasis === 'PER_KG') {
        pTotal = net > 0 ? pKg * net : pKg * totalQty;
        pUnit = totalQty > 0 ? pTotal / totalQty : 0;
        pCarton = pUnit * units;
      } else if (activeBasis === 'TOTAL_LOT') {
        pUnit = totalQty > 0 ? pTotal / totalQty : 0;
        pCarton = pUnit * units;
        pKg = net > 0 ? pTotal / net : 0;
      }

      return {
        ...prev,
        units_per_carton: units,
        unit_weight_val: uWeight,
        proforma_qty: totalQty,
        net_weight_kg: net,
        gross_weight_kg: gross,
        proforma_price: Number(pUnit.toFixed(4)),
        price_per_carton: Number(pCarton.toFixed(2)),
        price_per_kg: Number(pKg.toFixed(2)),
        total_payable: Number(pTotal.toFixed(2)),
        notes: note
      };
    });
  };

  // Save Proforma Invoice Item (Add or Update)
  const handleSavePiItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!piForm.vendor_id || !piForm.product_name) {
      alert('Please select a vendor and enter a product name');
      return;
    }

    try {
      if (editingPiId) {
        await apiClient.updateVendorProformaItem(shipmentId, editingPiId, piForm);
      } else {
        await apiClient.createVendorProformaItem(shipmentId, piForm);
      }
      setShowPiModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to save Vendor Proforma Invoice item');
    }
  };

  // Delete Proforma Invoice Item
  const handleDeletePiItem = async (itemId: number) => {
    if (!window.confirm('Are you sure you want to remove this Proforma Invoice item?')) return;
    try {
      await apiClient.deleteVendorProformaItem(shipmentId, itemId);
      fetchData();
    } catch (err) {
      alert('Failed to delete Proforma Invoice item');
    }
  };

  const handleConvertToProductsAndFinish = async () => {
    try {
      setConverting(true);
      await apiClient.convertToShipmentProducts(shipmentId);
      onFinish();
    } catch (err) {
      alert('Failed to convert vendor items into shipment products');
    } finally {
      setConverting(false);
    }
  };

  const openModalForRequirement = (req: ShipmentCustomerRequirement) => {
    handleReqSelectInModal(req.id);
    setShowAllocModal(true);
  };
  void applyPackingPreset;
  void openModalForRequirement;

  const subTabs: TabType[] = ['allocation', 'proforma', 'quotation', 'payments', 'audit', 'packing_lists'];
  const currentSubIndex = subTabs.indexOf(activeTab);

  const subTabLabels: Record<TabType, string> = {
    allocation: '4.1 Requirement Allocation',
    proforma: '4.2 Vendor Proforma Invoice (PI)',
    quotation: '4.3 Preliminary Quotation & Approval',
    payments: '4.4 Advance & TT Payments',
    audit: '4.5 Actual Invoice Comparison',
    packing_lists: '4.6 Continuous Packing Lists',
  };

  const goToNextSubStep = () => {
    if (currentSubIndex < subTabs.length - 1) {
      const nextTab = subTabs[currentSubIndex + 1];
      setActiveTab(nextTab);
      if (nextTab === 'quotation') loadPreliminaryQuotation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (onFinish) {
      onFinish();
    }
  };

  const goToPrevSubStep = () => {
    if (currentSubIndex > 0) {
      const prevTab = subTabs[currentSubIndex - 1];
      setActiveTab(prevTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (onBack) {
      onBack();
    }
  };


  return (
    <div className="space-y-6 font-sans">
      {/* Stage 2 Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Stage 2: Vendor Process & Proforma Invoice (PI)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Allocate suppliers, ingest vendor packing specifications, track payments, audit invoices, and generate packing lists.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quotation Simulator Button */}
          <button
            type="button"
            onClick={() => setShowSimulatorModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            title="Simulate landed cost, tariff duty & model quotation for container products"
          >
            <Calculator className="w-4 h-4 text-blue-200" />
            <span>Quotation Simulator</span>
          </button>

          {/* Quick Create New Vendor Button */}
          <button
            type="button"
            onClick={() => setShowCreateVendorModal(true)}
            className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            title="Register a new supplier directly from shipment workflow"
          >
            <Building2 className="w-4 h-4 text-purple-600" />
            <span>+ Create New Vendor</span>
          </button>
        </div>
      </div>



      {/* TAB 1: Supplier Allocation & RFQ */}
      {activeTab === 'allocation' && (
        <div className="space-y-6">
          {/* Top Banner: Business Rule Context Notice */}
          <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>Dynamic Vendor Packing Rules (Proforma Invoice Stage):</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                At the Customer Requirement stage, only <strong>Product + Required Quantity</strong> is known.
                Carton packaging sizes (e.g. Vendor A: 12 units/ctn, Vendor B: 24 units/ctn, Vendor C: 5 units/ctn, Vendor D: 30 kg bag) are provided when vendors submit their <strong>Proforma Invoice (PI)</strong>. The system supports full dynamic packing configuration for each vendor.
              </p>
            </div>
          </div>

          {/* Section 1: Customer Requirements & Auto-Matched Vendor Recommendations */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Customer Requirements & Supplier Allocation
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {requirements.length} Requirements Registered
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Matching requirements to vendor catalogs...</div>
            ) : requirements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                No customer requirements found for this shipment. Please add requirements in Stage 1 first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requirements.map(req => {
                  const matchData = productMatchMap[req.id];
                  const lastVendor = matchData?.last_allocated_vendor;
                  const matchingVendors = matchData?.matching_vendors || [];
                  const reqAllocations = allocations.filter(a => a.requirement_id === req.id);

                  // Calculate Top Favorite / Most Sent Vendor for this requirement card
                  const favVendor = lastVendor || (matchingVendors.length > 0 ? matchingVendors[0] : (vendors.length > 0 ? vendors[0] : null));
                  const isLastSelected = !!lastVendor;
                  const isCatalogMatch = !lastVendor && matchingVendors.length > 0;

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Requirement Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                              <Tag className="w-4 h-4 text-blue-600" />
                              {req.product_name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 font-medium">
                              Customer: <span className="font-semibold text-slate-800">{req.customer?.name || 'Standard Customer'}</span>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl font-mono text-xs font-black shadow-2xs">
                            {req.required_quantity} {req.unit}
                          </span>
                        </div>

                        {/* Allocation Status Pill */}
                        {reqAllocations.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Allocated to: {reqAllocations.map(a => a.vendor?.name).join(', ')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 font-bold">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Pending Vendor Allocation</span>
                          </div>
                        )}

                        {/* Favorite / Last Time / Most Sent Vendor Highlight Card */}
                        {favVendor && (
                          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 p-3 rounded-2xl space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between text-[11px] font-bold text-amber-950">
                              <span className="flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                {isLastSelected
                                  ? `Favorite / Last Selected Vendor for ${req.product_name}`
                                  : isCatalogMatch
                                  ? `Top Matched Supplier for ${req.product_name}`
                                  : `Most Sent Supplier in Directory`}
                              </span>
                              <span className="font-mono text-[10px] text-amber-800 font-black">{favVendor.code}</span>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold text-slate-900">{favVendor.legal_name || favVendor.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {favVendor.phone ? `Phone: ${favVendor.phone}` : `Category: ${favVendor.main_category || 'General'}`}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleQuickAllocate(req, favVendor.id)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
                                title={`1-Click allocate full requirement to ${favVendor.name}`}
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>1-Click Send RFQ</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* All Available / Registered Vendors Quick-Selection */}
                        {vendors.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Quick Allocate to Registered Vendors:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {vendors.map(v => {
                                const isAllocated = reqAllocations.some(a => a.vendor_id === v.id);
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => handleQuickAllocate(req, v.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                                      isAllocated
                                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold'
                                        : favVendor?.id === v.id
                                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                                    }`}
                                  >
                                    <span>{v.name}</span>
                                    {isAllocated ? (
                                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Plus className="w-3 h-3 text-slate-400" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {reqAllocations.length > 0 ? `${reqAllocations.length} Vendor(s) Assigned` : 'No vendor assigned'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleReqSelectInModal(req.id);
                            setShowAllocModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Allocate / Multi-Vendor RFQ</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Send Requirement to Vendor Cards Studio */}
          {vendors.length > 0 && allocations.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Send className="w-4.5 h-4.5 text-blue-600" />
                    Requirement 9 &bull; Send Requirement to Vendor (Per-Vendor Breakdown)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generates vendor request containing <strong>only</strong> the products allocated to that specific supplier.
                  </p>
                </div>
                <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  Per-Vendor Request Sheets
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vendors.map(v => {
                  const vAllocs = allocations.filter(a => a.vendor_id === v.id);
                  if (vAllocs.length === 0) return null;

                  return (
                    <div key={v.id} className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                          <div>
                            <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-blue-600" />
                              {v.name}
                            </span>
                            <div className="text-[11px] text-slate-500 font-mono">Supplier Code: {v.code} | Phone: {v.phone || 'N/A'}</div>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[11px] font-bold">
                            {vAllocs.length} Allocated Items
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-600">Exclusive allocated products for {v.name}:</div>
                          <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-medium max-h-40 overflow-y-auto">
                            {vAllocs.map(a => {
                              const reqItem = requirements.find(r => r.id === a.requirement_id);
                              return (
                                <div key={a.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                                  <span className="font-bold text-slate-800 flex items-center gap-1">
                                    <Box className="w-3 h-3 text-blue-500" />
                                    {reqItem?.product_name || `Requirement #${a.requirement_id}`}
                                  </span>
                                  <span className="font-mono text-blue-700 font-bold">
                                    {a.allocated_quantity} {a.unit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100">
                        <a
                          href={apiClient.getVendorRfqPdfUrl(shipmentId, v.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Send RFQ (PDF)</span>
                        </a>

                        <a
                          href={apiClient.getVendorRfqExcelUrl(shipmentId, v.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Send RFQ (Excel)</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Proforma Invoices & Packing Ratios */}
      {activeTab === 'proforma' && (
        <div className="space-y-6">
          {/* Action Toolbar for PI Ingestion */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">Proforma Invoice Ingestion Actions</h3>
                <p className="text-xs text-slate-500">Upload vendor excel, run AI OCR on PDF/images, or manually add packing items.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadSampleVendorPiExcel}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                title="Download sample Excel template"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Sample Excel Template</span>
              </button>

              <label className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>{uploadingPI ? 'Uploading...' : 'Option 1: Upload PI Excel'}</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handlePIExcelUpload}
                  className="hidden"
                  disabled={uploadingPI}
                />
              </label>

              <a
                href={apiClient.getStage2ProformaExportExcelUrl(shipmentId)}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                title="Export Stage 2 Proforma Items as Excel"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Export Proforma Excel</span>
              </a>

              <a
                href={apiClient.getStage2ProformaExportPdfUrl(shipmentId)}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                title="Export Stage 2 Proforma Audit Report as PDF"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Export Proforma PDF</span>
              </a>

              <label className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Option 3: Upload PDF / Image (OCR)</span>
                <input
                  type="file"
                  accept=".pdf, .png, .jpg, .jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingPI(true);
                      await apiClient.uploadVendorProformaOcr(shipmentId, file);
                      alert(`Vendor PDF/Image "${file.name}" processed via AI OCR and proforma items extracted successfully!`);
                      fetchData();
                    } catch (err: any) {
                      alert('Failed to process vendor PDF/Image file');
                    } finally {
                      setUploadingPI(false);
                    }
                  }}
                  className="hidden"
                  disabled={uploadingPI}
                />
              </label>

              <button
                type="button"
                onClick={() => openPiModal()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Proforma Item</span>
              </button>
            </div>
          </div>

          {/* Vendor Proforma Invoice Items & Dynamic Packing Configurations Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            {proformaItems.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <PackageCheck className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="font-bold text-slate-700 text-sm">No Proforma Invoice Items Recorded Yet</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Upload a Vendor PI Excel/CSV file or click <strong>Add Proforma Item</strong> to manually record vendor-specific packing configurations (e.g. Vendor A: 12/ctn, Vendor B: 24/ctn, Vendor C: 5/ctn, Vendor D: 30kg bag).
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={downloadSampleVendorPiExcel}
                    className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Download Sample Excel Template
                  </button>
                  <button
                    type="button"
                    onClick={() => openPiModal()}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer"
                  >
                    Add Manual Proforma Item
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Vendor</th>
                      <th className="py-3 px-3">Product Name</th>
                      <th className="py-3 px-3 text-center">Cartons</th>
                      <th className="py-3 px-3 text-center">Units / Ctn</th>
                      <th className="py-3 px-3 text-center">Total Qty</th>
                      <th className="py-3 px-3 text-right">Unit Wt</th>
                      <th className="py-3 px-3 text-right">Net Wt (KG)</th>
                      <th className="py-3 px-3 text-right">Gross Wt (KG)</th>
                      <th className="py-3 px-3 text-right">Unit Price</th>
                      <th className="py-3 px-3 text-right text-emerald-900 bg-emerald-50/80 font-extrabold">Net Price / KG</th>
                      <th className="py-3 px-3 text-right text-blue-950 bg-blue-50/80 font-extrabold">Total Amount</th>
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {proformaItems.map(item => {
                      const netWt = Math.abs(item.net_weight_kg || 0);
                      const grossWt = Math.abs(item.gross_weight_kg || 0);
                      const unitWt = Math.abs(item.unit_weight_val || 0);
                      const totalQty = Math.abs(item.proforma_qty || 0);
                      const unitPrice = item.proforma_price || 0;
                      const lineTotal = totalQty * unitPrice;
                      const pricePerKg = netWt > 0 ? (lineTotal / netWt) : (unitWt > 0 ? (unitPrice / unitWt) : 0);
                      const currSymbol = item.currency === 'USD' ? '$' : '₹';

                      return (
                      <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.vendor?.name || `Vendor #${item.vendor_id}`}</span>
                          </div>
                          {item.vendor?.code && (
                            <div className="text-[10px] font-mono text-slate-400 font-normal">{item.vendor.code}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {item.product_name}
                          {item.notes && (
                            <div className="text-[10px] text-slate-500 font-normal line-clamp-1">{item.notes}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {item.cartons_count}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-md font-mono text-[11px] font-bold">
                            <Box className="w-3 h-3 text-blue-600" />
                            {item.units_per_carton} / ctn
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                          {totalQty.toLocaleString('en-US')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {unitWt} {item.unit_weight_unit || 'KG'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40">
                          {netWt.toFixed(2)} KG
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-600">
                          {grossWt.toFixed(2)} KG
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {currSymbol}{unitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/60">
                          {currSymbol}{pricePerKg.toFixed(2)} / kg
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-blue-900 bg-blue-50/60">
                          {currSymbol}{lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openPiModal(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                              title="Edit Proforma Item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePiItem(item.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Delete Proforma Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
          </div>

          {/* Action Card to Proceed to Preliminary Quotation */}
          {proformaItems.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-800 rounded-xl">
                  <Sparkles className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Preliminary Quotation Automatically Calculated!</h4>
                  <p className="text-xs text-slate-600">Based on your {proformaItems.length} recorded PI items, selling prices have been dynamically generated.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('quotation');
                  loadPreliminaryQuotation();
                }}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>Proceed to Preliminary Quotation & Customer Approval</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Preliminary Quotation & Customer Approval */}
      {activeTab === 'quotation' && (
        <div className="space-y-6 font-sans">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-amber-800/40">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Dynamic Preliminary Quotation</span>
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">Customer Quotation & Product Approval Studio</h3>
              <p className="text-xs text-amber-200/80 mt-1 max-w-2xl">
                Automatically calculated from completed Vendor Proforma Invoices (PI). Review products, approve/reject individual items, or log customer price negotiations. <b>Only approved products move to Stage 3.</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadPreliminaryQuotation}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Recalculate Quotation</span>
              </button>
            </div>
          </div>

          {/* Quotations Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Quotation Line Items ({quotationItems.length})</h4>
                <p className="text-xs text-slate-500">Customer product decisions: Approve, Remove, or Request Price Negotiation.</p>
              </div>

              {vendors.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-300 flex items-center gap-1">
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    Re-send Updated Sheet to Vendor:
                  </span>
                  {vendors.map(v => (
                    <div key={v.id} className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-blue-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-800 font-sans">{v.name}:</span>
                      <a
                        href={apiClient.getVendorRfqPdfUrl(shipmentId, v.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        title={`Download & Send Updated Requirement PDF to ${v.name}`}
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </a>
                      <a
                        href={apiClient.getVendorRfqExcelUrl(shipmentId, v.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        title={`Download & Send Updated Requirement Excel to ${v.name}`}
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>Excel</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loadingQuotation ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading preliminary quotation...</div>
            ) : quotationItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                <div className="font-bold text-slate-700">No vendor proforma items available yet.</div>
                <p className="text-slate-400">Complete vendor allocations or upload vendor proforma PI excel to calculate preliminary quotation.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Product Name</th>
                      <th className="py-3 px-3 text-center">HSN</th>
                      <th className="py-3 px-3 text-center">Qty</th>
                      <th className="py-3 px-3 text-right">Vendor Price (INR)</th>
                      <th className="py-3 px-3 text-right">Cost (LKR)</th>
                      <th className="py-3 px-3 text-right bg-amber-50/60 text-amber-900 font-extrabold">Selling Price (LKR)</th>
                      <th className="py-3 px-3 text-center">Customer Target</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Customer Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {quotationItems.map((qItem: any) => {
                      const isApproved = qItem.approval_status === 'APPROVED';
                      const isRejected = qItem.approval_status === 'REJECTED';
                      const isNegotiated = qItem.approval_status === 'NEGOTIATED';

                      return (
                        <tr key={qItem.id} className={`hover:bg-slate-50 transition-colors ${
                          isApproved ? 'bg-emerald-50/30' : isRejected ? 'bg-rose-50/30 opacity-60' : isNegotiated ? 'bg-amber-50/40' : ''
                        }`}>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {qItem.product_name}
                            <div className="text-[10px] text-slate-400 font-normal">Supplier: {qItem.vendor_name}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600">
                            {qItem.hsn_code || '-'}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800">
                            {qItem.quantity} {qItem.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700">
                            ₹{qItem.unit_price_inr?.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700">
                            Rs. {qItem.unit_cost_lkr?.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-950 bg-amber-50/40">
                            Rs. {qItem.estimated_selling_price_lkr?.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-purple-700">
                            {qItem.customer_target_price ? `Rs. ${qItem.customer_target_price.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isRejected
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isNegotiated
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}>
                              {qItem.approval_status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveQuotItem(qItem.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isApproved
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300'
                                }`}
                                title="Approve Product for Next Stage"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveQuotItem(qItem.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isRejected
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                                }`}
                                title="Remove Product from Quotation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedQuotItem(qItem);
                                  setEditQty(qItem.quantity);
                                  setTargetPrice(qItem.customer_target_price || qItem.estimated_selling_price_lkr);
                                  setNegotiateNotes(qItem.notes || '');
                                  setShowNegotiateModal(true);
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Modify Quantity or Request Price Negotiation"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Modify / Negotiate</span>
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
          </div>

          {/* Quotation Audit Log */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-slate-600" />
              Customer Approval, Removal & Negotiation Audit History Log
            </h4>

            {quotationHistory.length === 0 ? (
              <div className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                No customer approval or removal actions logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                      <th className="py-2.5 px-3">Details / Qty / Price Change</th>
                      <th className="py-2.5 px-3">Audit Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                    {quotationHistory.map((hLog: any) => (
                      <tr key={hLog.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-500 font-sans">
                          {new Date(hLog.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-bold font-sans text-slate-900">{hLog.product_name}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            hLog.action_type === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : hLog.action_type === 'REMOVED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {hLog.action_type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {hLog.old_value} → {hLog.new_value}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-sans">{hLog.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Quantity & Price Negotiation Modal */}
      {showNegotiateModal && selectedQuotItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Modify Quantity / Price Negotiation</h3>
                <p className="text-xs text-slate-500">{selectedQuotItem.product_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNegotiateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleNegotiateQuotItem} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Customer Quantity ({selectedQuotItem.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editQty}
                    onChange={e => setEditQty(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-amber-50/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Reduce or increase quantity</p>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Target Price (LKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={targetPrice}
                    onChange={e => setTargetPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Modified selling price</p>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Negotiation Reason / Audit Notes</label>
                <textarea
                  rows={3}
                  value={negotiateNotes}
                  onChange={e => setNegotiateNotes(e.target.value)}
                  placeholder="e.g. Customer requested quantity increase to 50 CTN and price target of 220 LKR..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveQuotItem(selectedQuotItem.id);
                    setShowNegotiateModal(false);
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Product</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNegotiateModal(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: Vendor Payments & Ledger */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Vendor Payment Studio (Req 18: Advance vs Balance Tracking)
              </h3>
              <p className="text-xs text-slate-500">Track total purchase amount, advance paid, and balance pending per vendor.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (vendors.length > 0) {
                  setPaymentForm(prev => ({ ...prev, vendor_id: vendors[0].id }));
                }
                setShowPaymentModal(true);
              }}
              className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + Record Vendor Payment
            </button>
          </div>

          {paymentSummaryList.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-slate-500 text-xs space-y-2">
              <CreditCard className="w-8 h-8 text-purple-300 mx-auto" />
              <div className="font-bold text-slate-700">No vendor payments recorded yet.</div>
              <p className="text-slate-400">Click <b>+ Record Vendor Payment</b> above to record TT/LC advance or balance payments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentSummaryList.map(vPymt => (
                <div key={vPymt.vendor_id} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{vPymt.vendor_name}</h4>
                      <span className="text-[11px] font-mono text-slate-500">{vPymt.vendor_code}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      vPymt.payment_status === 'FULLY_PAID'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : vPymt.payment_status === 'PARTIALLY_PAID'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}>
                      {vPymt.payment_status === 'FULLY_PAID' ? '✓ FULLY PAID' : vPymt.payment_status === 'PARTIALLY_PAID' ? 'PARTIALLY PAID' : 'UNPAID'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-semibold">Vendor Total</span>
                      <span className="font-mono font-bold text-slate-900">₹{vPymt.total_purchase_amount?.toLocaleString()}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 block font-semibold">Advance Paid</span>
                      <span className="font-mono font-bold text-emerald-900">₹{vPymt.advance_amount?.toLocaleString()}</span>
                    </div>
                    <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
                      <span className="text-[10px] text-amber-800 block font-semibold">Balance Pending</span>
                      <span className="font-mono font-bold text-amber-900">₹{vPymt.pending_amount?.toLocaleString()}</span>
                    </div>
                  </div>

                  {vPymt.payments_list && vPymt.payments_list.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-700 block">Transaction Ledger:</span>
                      {vPymt.payments_list.map((tx: any) => (
                        <div key={tx.id} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-md border border-slate-200 text-[11px] font-mono">
                          <div>
                            <span className="font-bold text-purple-900">{tx.payment_ref}</span>
                            <span className="text-slate-500 ml-2">({tx.payment_type})</span>
                          </div>
                          <div className="font-bold text-emerald-800">
                            ₹{tx.amount_paid?.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Actual Vendor Invoice Audit */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                Actual Vendor Invoice Audit Studio (Req 19: Proforma vs Actual Mismatch Audit)
              </h3>
              <p className="text-xs text-slate-500">Automated 5-point comparison: Price, Quantity, Weight, Missing Products, and Additional Products.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (vendors.length > 0) {
                  const vId = vendors[0].id;
                  setSelectedActualVendorId(vId);
                  const vPis = proformaItems.filter(p => p.vendor_id === vId);
                  if (vPis.length > 0) {
                    setActualInvoiceRows(vPis.map(p => ({
                      product_name: p.product_name,
                      actual_price: p.proforma_price,
                      actual_cartons: p.cartons_count,
                      actual_units: p.proforma_qty,
                      actual_net_weight_kg: p.net_weight_kg,
                      actual_gross_weight_kg: p.gross_weight_kg
                    })));
                  } else {
                    setActualInvoiceRows([
                      { product_name: 'Product A', actual_price: 105, actual_cartons: 10, actual_units: 120, actual_net_weight_kg: 100, actual_gross_weight_kg: 105 }
                    ]);
                  }
                }
                setShowActualInvoiceModal(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              + Audit Actual Vendor Invoice
            </button>
          </div>

          {actualComparisonList.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-slate-500 text-xs space-y-2">
              <FileCheck className="w-8 h-8 text-indigo-300 mx-auto" />
              <div className="font-bold text-slate-700">No actual invoice audit executed yet.</div>
              <p className="text-slate-400">Click <b>+ Audit Actual Vendor Invoice</b> above to compare Proforma vs Actual delivery invoice.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-center bg-blue-50/50">PROFORMA</th>
                    <th className="py-2.5 px-3 text-center bg-indigo-50/50">ACTUAL INVOICE</th>
                    <th className="py-2.5 px-3 text-center">MISMATCH FLAGS</th>
                    <th className="py-2.5 px-3">AUDIT REMARKS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {actualComparisonList.map((rec: any, idx: number) => {
                    const isMissing = rec.notes?.includes('Missing Product');
                    const isAdditional = rec.notes?.includes('Additional Product');
                    const isPriceMismatch = rec.price_mismatch;
                    const isQtyMismatch = rec.qty_mismatch;
                    const isWeightMismatch = rec.weight_mismatch;

                    return (
                      <tr key={idx} className={`hover:bg-slate-50 ${isMissing || isAdditional || isPriceMismatch || isQtyMismatch || isWeightMismatch ? 'bg-rose-50/30' : ''}`}>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900">
                          {rec.product_name}
                        </td>
                        <td className="py-2.5 px-3 text-center bg-blue-50/20 text-slate-700">
                          ₹{rec.proforma_price} | {rec.proforma_cartons} CTNS | {rec.proforma_units} Units ({rec.proforma_net_weight_kg}kg)
                        </td>
                        <td className={`py-2.5 px-3 text-center font-bold ${
                          isPriceMismatch || isQtyMismatch ? 'text-rose-700 bg-rose-50/50' : 'text-emerald-800 bg-indigo-50/20'
                        }`}>
                          ₹{rec.actual_price} | {rec.actual_cartons} CTNS | {rec.actual_units} Units ({rec.actual_net_weight_kg}kg)
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {isPriceMismatch && <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-300">PRICE MISMATCH</span>}
                            {isQtyMismatch && !isMissing && !isAdditional && <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300">QTY MISMATCH</span>}
                            {isWeightMismatch && <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-300">WEIGHT MISMATCH</span>}
                            {isMissing && <span className="bg-rose-200 text-rose-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-400">MISSING PRODUCT</span>}
                            {isAdditional && <span className="bg-purple-100 text-purple-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-purple-300">ADDITIONAL PRODUCT</span>}
                            {!isPriceMismatch && !isQtyMismatch && !isWeightMismatch && !isMissing && !isAdditional && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-300">PERFECT MATCH</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans text-[11px]">
                          {rec.notes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Continuous Packing Lists */}
      {activeTab === 'packing_lists' && (
        <div className="space-y-6">
          {/* Req 23 & 24: Per-Vendor In-Transit & Partial Delivery Status Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  Per-Vendor In-Transit & Partial Delivery Status (Req 23 & 24)
                </h3>
                <p className="text-xs text-slate-500">
                  Track in-transit status per vendor and process partial arrivals independently without waiting for all suppliers to arrive.
                </p>
              </div>
              <span className="text-xs font-extrabold text-blue-800 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Multi-Vendor Partial Arrival Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vendors.length === 0 ? (
                <div className="col-span-3 text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-200">
                  No allocated vendors found in this shipment.
                </div>
              ) : (
                vendors.map(v => {
                  const vAllocs = allocations.filter(a => a.vendor_id === v.id);
                  const hasPL = packingListRecords.some((pl: any) => pl.vendor_id === v.id || pl.vendor_name === v.name);
                  const status = hasPL ? 'DELIVERED' : 'IN_TRANSIT';

                  return (
                    <div key={v.id} className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                      status === 'DELIVERED' ? 'bg-emerald-50/40 border-emerald-300' : 'bg-blue-50/30 border-blue-200'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            {v.name}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {status === 'DELIVERED' ? '✅ DELIVERED' : '🚚 IN TRANSIT'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono">Supplier Code: {v.code}</div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Allocated Products ({vAllocs.length}):</div>
                          {vAllocs.map(a => {
                            const r = requirements.find(req => req.id === a.requirement_id);
                            return (
                              <div key={a.id} className="flex justify-between items-center text-[11px] py-0.5">
                                <span className="font-semibold text-slate-800">{r?.product_name || `Req #${a.requirement_id}`}</span>
                                <span className="font-mono text-blue-700 font-bold">{a.allocated_quantity} {a.unit}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80">
                        {status === 'DELIVERED' ? (
                          <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Physical Arrival Verified & PL Generated
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleGenerateNextPackingList();
                            }}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Verify Arrival & Generate PL</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Req 25 & 26: Continuous Packing List Studio (Post-Receiving Sequence) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-teal-600" />
                  Continuous Packing List Studio (Req 25 & 26: Sequence PL-001, PL-002...)
                </h3>
                <p className="text-xs text-slate-500">
                  Sequence numbers never restart per vendor. Vendor A receives PL-001, PL-002; Vendor B receives PL-003, PL-004 continuously.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateNextPackingList}
                className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                + Generate Continuous Packing List
              </button>
            </div>

            {packingListRecords.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-slate-500 text-xs space-y-2">
                <PackageCheck className="w-8 h-8 text-teal-300 mx-auto" />
                <div className="font-bold text-slate-700">No packing list generated yet.</div>
                <p className="text-slate-400">Click <b>+ Generate Continuous Packing List</b> above to generate PL from actual receiving & weight data.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packingListRecords.map((pl: any) => (
                  <div key={pl.id} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <span className="font-mono font-bold text-teal-900 text-sm bg-teal-100 border border-teal-300 px-2.5 py-0.5 rounded-md">
                          {pl.pl_number}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 ml-2">{pl.vendor_name}</span>
                      </div>
                      <a
                        href={apiClient.getPackingListUrl(shipmentId)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PDF
                      </a>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-slate-600 text-[11px]">
                        <strong>Generated:</strong> {new Date(pl.generated_at).toLocaleString()}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        <strong>Remarks:</strong> {pl.notes}
                      </p>
                    </div>

                    {pl.items && pl.items.length > 0 && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="bg-slate-100 text-slate-700 font-bold">
                            <tr>
                              <th className="py-1.5 px-2 font-sans">Product</th>
                              <th className="py-1.5 px-2 text-right">Cartons</th>
                              <th className="py-1.5 px-2 text-right">Qty</th>
                              <th className="py-1.5 px-2 text-right">Net Wt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {pl.items.map((it: any) => (
                              <tr key={it.id}>
                                <td className="py-1.5 px-2 font-sans font-semibold text-slate-900">{it.product_name}</td>
                                <td className="py-1.5 px-2 text-right">{it.cartons_count} CTNS</td>
                                <td className="py-1.5 px-2 text-right font-bold text-teal-800">{it.qty_units}</td>
                                <td className="py-1.5 px-2 text-right text-slate-600">{it.net_weight_kg} kg</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Req 27: Shipment Modification Control Panel After Partial Arrival */}
          <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-amber-600" />
                  Shipment Modification Control Panel (Req 27: Post-Partial Arrival Updates)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modify selected pending products (container capacity, customer emergency, delivery delay, price change) without corrupting already processed/delivered vendor data.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Safe Modification Guard Active
              </span>
            </div>

            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 text-xs space-y-3">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Pending Vendor Items Eligible for Post-Arrival Modification:</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {requirements.map(r => (
                  <div key={r.id} className="bg-white p-3 rounded-xl border border-amber-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">{r.product_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">HSN: {r.hsn_code || '-'} | Required Qty: {r.required_quantity} {r.unit}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModifyReq(r);
                        setModifyReqForm({
                          new_qty: Number(r.required_quantity) || 1,
                          unit: r.unit || 'CTNS',
                          reason: 'Customer Emergency Request',
                          notes: ''
                        });
                        setShowModifyReqModal(true);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      Modify Pending Qty
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal 1: Multi-Vendor Allocation & RFQ Request Modal */}
      {showAllocModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Allocate Requirement & Send Vendor RFQs</h3>
                <p className="text-xs text-slate-500">Send this product requirement to one or multiple vendors to request price quotes.</p>
              </div>
              <button onClick={() => setShowAllocModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAllocation} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Customer Requirement *</label>
                <select
                  value={selectedReqId}
                  onChange={e => handleReqSelectInModal(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value={0}>-- Select Requirement --</option>
                  {requirements.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.product_name} ({r.required_quantity} {r.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Requirement Qty</label>
                  <div className="text-sm font-mono font-black text-slate-900">{allocatedQty}</div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Unit</label>
                  <div className="text-sm font-mono font-bold text-slate-800">{allocatedUnit}</div>
                </div>
              </div>

              {/* Multi-Vendor Checkbox Selection List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Select Vendors to Send RFQ * ({selectedVendorIds.length} Selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVendorIds(vendors.map(v => v.id))}
                      className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedVendorIds([])}
                      className="text-[11px] text-slate-500 hover:text-slate-700 font-medium underline cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateVendorModal(true)}
                      className="text-[11px] text-purple-700 font-bold underline cursor-pointer"
                    >
                      + New Vendor
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                  {vendors.map(v => {
                    const isChecked = selectedVendorIds.includes(v.id);
                    const isLast = productMatchMap[selectedReqId]?.last_allocated_vendor?.id === v.id;
                    const isMatch = productMatchMap[selectedReqId]?.matching_vendors.some(mv => mv.id === v.id);

                    return (
                      <label
                        key={v.id}
                        onClick={() => toggleVendorSelection(v.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by label onClick
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{v.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-normal">({v.code})</span>
                          </div>
                        </div>

                        {isLast ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-bold text-[10px] flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            Last Selected
                          </span>
                        ) : isMatch ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-bold text-[10px]">
                            ✓ Matching Supplier
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500 font-mono">
                  {selectedVendorIds.length > 0
                    ? `Full requirement (${allocatedQty} ${allocatedUnit}) sent to ${selectedVendorIds.length} supplier(s)`
                    : 'Select at least 1 vendor'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllocModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedVendorIds.length === 0}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {selectedVendorIds.length === 0
                        ? 'Select Vendors'
                        : `Save & Send RFQ (${selectedVendorIds.length} ${selectedVendorIds.length === 1 ? 'Vendor' : 'Vendors'})`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Vendor Proforma Invoice Item (Add & Edit with Packing Presets) */}
      {showPiModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  {editingPiId ? 'Edit Vendor Proforma Invoice Item' : 'Add Vendor Proforma Invoice Item'}
                </h3>
                <p className="text-xs text-slate-500">Configure vendor-specific carton packing ratio & weight details.</p>
              </div>
              <button onClick={() => setShowPiModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePiItem} className="space-y-4">
              {/* Quick Select Product from Customer Requirements */}
              {requirements.length > 0 && (
                <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-200/80 space-y-1.5">
                  <label className="block text-[11px] font-bold text-blue-900 flex items-center gap-1">
                    <span>Select Product from Customer Requirements:</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {requirements.map(req => {
                      const isSelected = piForm.product_name.toLowerCase().trim() === req.product_name.toLowerCase().trim();
                      const allocObj = allocations.find(a => a.requirement_id === req.id);
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => handleProductChangeInPiForm(req.product_name)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-blue-100 border-slate-200'
                          }`}
                        >
                          <span>{req.product_name}</span>
                          {allocObj?.vendor && (
                            <span className={`ml-1.5 text-[10px] px-1 py-0.2 rounded font-normal ${isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                              ({allocObj.vendor.name.split(' ')[0]})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>

                  <ProductSearchSelect
                    label="Product Name"
                    value={piForm.product_name}
                    onChange={(val) => handleProductChangeInPiForm(val)}
                    onSelectProduct={(opt: ProductOption) => {
                      handleProductChangeInPiForm(opt.item_name);
                      if (opt.hs_code) {
                        updatePiFormField('hs_code', opt.hs_code);
                      }
                      if (opt.unit) {
                        updatePiFormField('unit', opt.unit);
                      }
                    }}
                    required
                    placeholder="Search product name, HSN code, or category..."
                  />
                </div>


                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Select Vendor *</label>
                    <button
                      type="button"
                      onClick={() => setShowCreateVendorModal(true)}
                      className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-0.5 cursor-pointer underline"
                    >
                      + Create New Vendor
                    </button>
                  </div>
                  <select
                    required
                    value={piForm.vendor_id}
                    onChange={e => updatePiFormField('vendor_id', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                  >
                    <option value={0}>-- Select Vendor --</option>
                    {vendors.map(v => {
                      const isAllocated = allocations.some(a => a.vendor_id === v.id && (a.requirement?.product_name || '').toLowerCase() === piForm.product_name.toLowerCase());
                      return (
                        <option key={v.id} value={v.id}>
                          {isAllocated ? `⭐ [Allocated Supplier] ${v.name}` : `${v.name} (${v.code})`}
                        </option>
                      );
                    })}
                  </select>
                  {allocations.some(a => a.vendor_id === piForm.vendor_id && (a.requirement?.product_name || '').toLowerCase() === piForm.product_name.toLowerCase()) && (
                    <div className="text-[10px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                      <span>✓ Auto-matched to Allocated Vendor for this product</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SKU & HSN Code Fields (Requirement 12) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Vendor Material Code</label>
                  <input
                    type="text"
                    value={piForm.sku}
                    onChange={e => updatePiFormField('sku', e.target.value)}
                    placeholder="e.g. SKU-GHEE-500G"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">HSN Code</label>
                    {piForm.hsn_code && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        ⚡ Auto-Detected
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={piForm.hsn_code}
                    onChange={e => updatePiFormField('hsn_code', e.target.value)}
                    placeholder="e.g. 0405.90.20"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-blue-700 bg-white"
                  />
                </div>
              </div>

              {/* Dynamic Packaging Grid */}
              <div className="grid grid-cols-3 gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-200/80">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cartons / Outer Bags *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={piForm.cartons_count}
                    onChange={e => updatePiFormField('cartons_count', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units per Carton / Bag *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={piForm.units_per_carton}
                    onChange={e => updatePiFormField('units_per_carton', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Weight (KG) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={piForm.unit_weight_val}
                    onChange={e => updatePiFormField('unit_weight_val', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Calculated Summary Banner */}
              <div className="grid grid-cols-3 gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs">
                <div>
                  <div className="text-[10px] text-emerald-800 font-bold">Total Calculated Units:</div>
                  <div className="font-mono font-bold text-emerald-950 text-sm">{piForm.proforma_qty} Units</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-800 font-bold">Calculated Net Weight:</div>
                  <div className="font-mono font-bold text-emerald-950 text-sm">{piForm.net_weight_kg} KG</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-800 font-bold">Estimated Gross Weight:</div>
                  <div className="font-mono font-bold text-emerald-950 text-sm">{piForm.gross_weight_kg} KG</div>
                </div>
              </div>

              {/* Dynamic Multi-Unit Pricing & Auto-Calculation Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    <span>Pricing Unit Basis, Unit Price, Quantity & Total Price</span>
                  </label>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    ⚡ Auto-calculates across all fields
                  </span>
                </div>

                {/* 4 Interactive Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  
                  {/* 1. Dropdown Button to Select Unit Basis */}
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-bold text-slate-700 mb-1 min-h-[28px] flex items-end leading-tight">
                      <span>1. Select Pricing Unit *</span>
                    </label>
                    <select
                      value={piForm.price_basis}
                      onChange={e => updatePiFormField('price_basis', e.target.value as any)}
                      className="w-full px-2 py-2 border-2 border-blue-400 focus:border-blue-600 rounded-lg text-xs font-bold text-blue-900 bg-blue-50/50 shadow-xs cursor-pointer"
                    >
                      <option value="PER_CARTON">Per Carton</option>
                      <option value="PER_UNIT">Per Unit (PCS)</option>
                      <option value="PER_KG">Per KG Net</option>
                      <option value="TOTAL_LOT">Whole Lot</option>
                    </select>
                    <span className="block text-[10px] text-slate-400 mt-1 font-medium leading-tight">
                      Basis for calculation
                    </span>
                  </div>

                  {/* 2. Text Box to Enter Price of Per Unit */}
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-bold text-blue-900 mb-1 min-h-[28px] flex items-end leading-tight">
                      <span>2. Price (per {piForm.price_basis === 'PER_CARTON' ? 'Carton' : piForm.price_basis === 'PER_UNIT' ? 'Unit' : piForm.price_basis === 'PER_KG' ? 'KG' : 'Lot'}) *</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-500">
                        {piForm.currency === 'USD' ? '$' : '₹'}
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={
                          piForm.price_basis === 'PER_UNIT'
                            ? piForm.proforma_price
                            : piForm.price_basis === 'PER_CARTON'
                            ? piForm.price_per_carton
                            : piForm.price_basis === 'PER_KG'
                            ? piForm.price_per_kg
                            : piForm.total_payable
                        }
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (piForm.price_basis === 'PER_UNIT') updatePiFormField('proforma_price', val);
                          else if (piForm.price_basis === 'PER_CARTON') updatePiFormField('price_per_carton', val);
                          else if (piForm.price_basis === 'PER_KG') updatePiFormField('price_per_kg', val);
                          else if (piForm.price_basis === 'TOTAL_LOT') updatePiFormField('total_payable', val);
                        }}
                        placeholder="0.00"
                        className="w-full pl-7 pr-2 py-2 border-2 border-blue-500 focus:border-blue-700 rounded-lg text-xs font-mono font-extrabold text-blue-950 bg-white shadow-xs"
                      />
                    </div>
                    <span className="block text-[10px] text-blue-600 mt-1 font-medium leading-tight">
                      Price per selected unit
                    </span>
                  </div>

                  {/* 3. Text Box for Quantity */}
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-bold text-slate-700 mb-1 min-h-[28px] flex items-end leading-tight">
                      <span>3. Quantity ({piForm.price_basis === 'PER_CARTON' ? 'Cartons' : piForm.price_basis === 'PER_KG' ? 'KG' : piForm.price_basis === 'PER_UNIT' ? 'Units' : 'Lot'}) *</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        required
                        min="1"
                        max={piForm.max_required_qty || undefined}
                        value={piForm.cartons_count}
                        onChange={e => {
                          let val = Number(e.target.value);
                          if (piForm.max_required_qty && val > piForm.max_required_qty) {
                            val = piForm.max_required_qty;
                          }
                          updatePiFormField('cartons_count', val);
                        }}
                        className={`w-full px-3 py-2 border-2 rounded-lg text-xs font-mono font-bold bg-white shadow-xs ${
                          piForm.max_required_qty && piForm.cartons_count >= piForm.max_required_qty
                            ? 'border-amber-400 text-amber-950'
                            : 'border-emerald-500 text-emerald-950'
                        }`}
                      />
                    </div>
                    {piForm.max_required_qty ? (
                      <span className="block text-[10px] text-amber-700 mt-1 font-medium leading-tight">
                        🔒 Required Qty: {piForm.max_required_qty} (Max)
                      </span>
                    ) : (
                      <span className="block text-[10px] text-slate-400 mt-1 font-medium leading-tight">
                        Total quantity count
                      </span>
                    )}
                  </div>

                  {/* 4. Text Box for Total Price */}
                  <div className="flex flex-col justify-between">
                    <label className="block text-xs font-bold text-emerald-900 mb-1 min-h-[28px] flex items-end leading-tight">
                      <span>4. Total Price ({piForm.currency}) *</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-emerald-600">
                        {piForm.currency === 'USD' ? '$' : '₹'}
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={piForm.total_payable}
                        onChange={e => updatePiFormField('total_payable', Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-2 py-2 border-2 border-emerald-500 focus:border-emerald-700 rounded-lg text-xs font-mono font-extrabold text-emerald-950 bg-emerald-50/50 shadow-xs"
                      />
                    </div>
                    <span className="block text-[10px] text-emerald-700 mt-1 font-medium leading-tight">
                      ⚡ Auto-computed (editable)
                    </span>
                  </div>

                </div>

                {/* Currency & Quick Select */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Currency:</span>
                    <select
                      value={piForm.currency}
                      onChange={e => updatePiFormField('currency', e.target.value)}
                      className="px-3 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-600">
                    <span className="text-[10px] text-slate-500">Quick Select:</span>
                    <button
                      type="button"
                      onClick={() => updatePiFormField('price_basis', 'PER_CARTON')}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                        piForm.price_basis === 'PER_CARTON' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      Per Carton
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePiFormField('price_basis', 'PER_UNIT')}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                        piForm.price_basis === 'PER_UNIT' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      Per Unit
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePiFormField('price_basis', 'PER_KG')}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                        piForm.price_basis === 'PER_KG' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      Per KG
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePiFormField('price_basis', 'TOTAL_LOT')}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                        piForm.price_basis === 'TOTAL_LOT' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      Whole Lot
                    </button>
                  </div>
                </div>

                {/* Auto-Calculated Units Breakdown (4 Cards Grid) */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>⚡ Auto-Calculated Price Across All Units:</span>
                    <span className="text-[10px] text-slate-500 italic">(Editing any field recalculates remaining units)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    
                    {/* Card 1: Per Unit */}
                    <div
                      onClick={() => updatePiFormField('price_basis', 'PER_UNIT')}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        piForm.price_basis === 'PER_UNIT'
                          ? 'bg-blue-100/80 border-blue-500 ring-2 ring-blue-400 text-blue-950 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Per Unit</span>
                        {piForm.price_basis === 'PER_UNIT' && <span className="text-[9px] text-blue-700 font-extrabold">Active</span>}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold text-slate-600">{piForm.currency === 'USD' ? '$' : '₹'}</span>
                        <input
                          type="number"
                          step="any"
                          value={piForm.proforma_price}
                          onChange={e => updatePiFormField('proforma_price', Number(e.target.value))}
                          onClick={e => e.stopPropagation()}
                          className="w-full text-right font-mono font-bold bg-transparent focus:bg-white px-1 border-b border-dashed border-slate-400 focus:border-blue-600 outline-none text-xs text-blue-950"
                        />
                      </div>
                    </div>

                    {/* Card 2: Per Carton */}
                    <div
                      onClick={() => updatePiFormField('price_basis', 'PER_CARTON')}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        piForm.price_basis === 'PER_CARTON'
                          ? 'bg-blue-100/80 border-blue-500 ring-2 ring-blue-400 text-blue-950 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Per Carton</span>
                        {piForm.price_basis === 'PER_CARTON' && <span className="text-[9px] text-blue-700 font-extrabold">Active</span>}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold text-slate-600">{piForm.currency === 'USD' ? '$' : '₹'}</span>
                        <input
                          type="number"
                          step="any"
                          value={piForm.price_per_carton}
                          onChange={e => updatePiFormField('price_per_carton', Number(e.target.value))}
                          onClick={e => e.stopPropagation()}
                          className="w-full text-right font-mono font-bold bg-transparent focus:bg-white px-1 border-b border-dashed border-slate-400 focus:border-blue-600 outline-none text-xs text-blue-950"
                        />
                      </div>
                    </div>

                    {/* Card 3: Per KG */}
                    <div
                      onClick={() => updatePiFormField('price_basis', 'PER_KG')}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        piForm.price_basis === 'PER_KG'
                          ? 'bg-blue-100/80 border-blue-500 ring-2 ring-blue-400 text-blue-950 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Per KG Net</span>
                        {piForm.price_basis === 'PER_KG' && <span className="text-[9px] text-blue-700 font-extrabold">Active</span>}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold text-slate-600">{piForm.currency === 'USD' ? '$' : '₹'}</span>
                        <input
                          type="number"
                          step="any"
                          value={piForm.price_per_kg}
                          onChange={e => updatePiFormField('price_per_kg', Number(e.target.value))}
                          onClick={e => e.stopPropagation()}
                          className="w-full text-right font-mono font-bold bg-transparent focus:bg-white px-1 border-b border-dashed border-slate-400 focus:border-blue-600 outline-none text-xs text-blue-950"
                        />
                      </div>
                    </div>

                    {/* Card 4: Whole Lot */}
                    <div
                      onClick={() => updatePiFormField('price_basis', 'TOTAL_LOT')}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        piForm.price_basis === 'TOTAL_LOT'
                          ? 'bg-blue-100/80 border-blue-500 ring-2 ring-blue-400 text-blue-950 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Whole Lot</span>
                        {piForm.price_basis === 'TOTAL_LOT' && <span className="text-[9px] text-blue-700 font-extrabold">Active</span>}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold text-slate-600">{piForm.currency === 'USD' ? '$' : '₹'}</span>
                        <input
                          type="number"
                          step="any"
                          value={piForm.total_payable}
                          onChange={e => updatePiFormField('total_payable', Number(e.target.value))}
                          onClick={e => e.stopPropagation()}
                          className="w-full text-right font-mono font-bold bg-transparent focus:bg-white px-1 border-b border-dashed border-slate-400 focus:border-blue-600 outline-none text-xs text-blue-950"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Remarks / Notes</label>
                <input
                  type="text"
                  value={piForm.notes}
                  onChange={e => updatePiFormField('notes', e.target.value)}
                  placeholder="e.g. Vendor A 12/ctn packing configuration details..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPiModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {editingPiId ? 'Update Proforma Item' : 'Save Proforma Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Inline Vendor Registration Modal (Requirement 8) */}
      {showCreateVendorModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <span>Register New Vendor (Inline Shipment Workflow)</span>
              </h3>
              <button onClick={() => setShowCreateVendorModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Create a new vendor profile directly from this shipment without navigating away to Vendor Master.
            </p>

            <form onSubmit={handleQuickCreateVendor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={newVendorForm.name}
                  onChange={e => setNewVendorForm({ ...newVendorForm, name: e.target.value })}
                  placeholder="e.g. Ravi Traders Pvt Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GST Number (GSTIN)</label>
                  <input
                    type="text"
                    value={newVendorForm.gstin}
                    onChange={e => setNewVendorForm({ ...newVendorForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newVendorForm.phone}
                    onChange={e => setNewVendorForm({ ...newVendorForm, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    value={newVendorForm.contact_person}
                    onChange={e => setNewVendorForm({ ...newVendorForm, contact_person: e.target.value })}
                    placeholder="e.g. Ravi Kumar"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newVendorForm.email}
                    onChange={e => setNewVendorForm({ ...newVendorForm, email: e.target.value })}
                    placeholder="e.g. ravi@ravitraders.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Address</label>
                <input
                  type="text"
                  value={newVendorForm.address}
                  onChange={e => setNewVendorForm({ ...newVendorForm, address: e.target.value })}
                  placeholder="e.g. 123 Grain Market, Madurai, Tamil Nadu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateVendorModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVendor}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{creatingVendor ? 'Registering...' : 'Register & Select Vendor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Record Vendor Payment Modal (Requirement 18) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Record Vendor Payment (Req 18)
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Vendor *</label>
                <select
                  required
                  value={paymentForm.vendor_id}
                  onChange={e => setPaymentForm({ ...paymentForm, vendor_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value={0}>-- Select Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Purchase Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.total_purchase_amount}
                    onChange={e => setPaymentForm({ ...paymentForm, total_purchase_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Paid Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.advance_paid}
                    onChange={e => setPaymentForm({ ...paymentForm, advance_paid: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-800 bg-emerald-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Type</label>
                  <select
                    value={paymentForm.payment_type}
                    onChange={e => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="ADVANCE">Advance Paid</option>
                    <option value="BALANCE">Balance Paid</option>
                    <option value="FULL">Full Settlement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference *</label>
                  <input
                    type="text"
                    required
                    value={paymentForm.payment_ref}
                    onChange={e => setPaymentForm({ ...paymentForm, payment_ref: e.target.value })}
                    placeholder="e.g. TT-984021 / LC-1002"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-purple-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value="BANK_TT">Bank Telegraphic Transfer (TT)</option>
                  <option value="LETTER_OF_CREDIT">Letter of Credit (LC)</option>
                  <option value="BANK_WIRE">Bank Wire Transfer</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Remarks / Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="e.g. Advance paid upon PO confirmation"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Save Payment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Actual Vendor Invoice Comparison Modal (Requirement 19) */}
      {showActualInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                Capture & Compare Actual Vendor Delivery Invoice (Req 19)
              </h3>
              <button onClick={() => setShowActualInvoiceModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleRunComparison} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Vendor *</label>
                <select
                  required
                  value={selectedActualVendorId}
                  onChange={e => {
                    const vId = Number(e.target.value);
                    setSelectedActualVendorId(vId);
                    const vPis = proformaItems.filter(p => p.vendor_id === vId);
                    if (vPis.length > 0) {
                      setActualInvoiceRows(vPis.map(p => ({
                        product_name: p.product_name,
                        actual_price: p.proforma_price,
                        actual_cartons: p.cartons_count,
                        actual_units: p.proforma_qty,
                        actual_net_weight_kg: p.net_weight_kg,
                        actual_gross_weight_kg: p.gross_weight_kg
                      })));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value={0}>-- Select Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Actual Delivery Invoice Line Items:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActualInvoiceRows([
                        ...actualInvoiceRows,
                        { product_name: 'New Additional Product', actual_price: 100, actual_cartons: 5, actual_units: 50, actual_net_weight_kg: 25, actual_gross_weight_kg: 26 }
                      ]);
                    }}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                  >
                    + Add Product Row
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-2 text-right">Actual Price (₹)</th>
                        <th className="py-2 px-2 text-right">Actual Cartons</th>
                        <th className="py-2 px-2 text-right">Actual Units</th>
                        <th className="py-2 px-2 text-right">Net Wt (kg)</th>
                        <th className="py-2 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {actualInvoiceRows.map((r, i) => (
                        <tr key={i}>
                          <td className="p-1.5 font-sans">
                            <input
                              type="text"
                              required
                              value={r.product_name}
                              onChange={e => {
                                const next = [...actualInvoiceRows];
                                next[i].product_name = e.target.value;
                                setActualInvoiceRows(next);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={r.actual_price}
                              onChange={e => {
                                const next = [...actualInvoiceRows];
                                next[i].actual_price = parseFloat(e.target.value) || 0;
                                setActualInvoiceRows(next);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right font-bold"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              value={r.actual_cartons}
                              onChange={e => {
                                const next = [...actualInvoiceRows];
                                next[i].actual_cartons = parseFloat(e.target.value) || 0;
                                setActualInvoiceRows(next);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              value={r.actual_units}
                              onChange={e => {
                                const next = [...actualInvoiceRows];
                                next[i].actual_units = parseFloat(e.target.value) || 0;
                                setActualInvoiceRows(next);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              step="0.1"
                              value={r.actual_net_weight_kg}
                              onChange={e => {
                                const next = [...actualInvoiceRows];
                                next[i].actual_net_weight_kg = parseFloat(e.target.value) || 0;
                                setActualInvoiceRows(next);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-right"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => setActualInvoiceRows(actualInvoiceRows.filter((_, idx) => idx !== i))}
                              className="text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActualInvoiceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Run 5-Way Comparison Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Post-Partial Arrival Product Modification Modal (Req 27) */}
      {showModifyReqModal && selectedModifyReq && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-amber-600" />
                  Modify Pending Product Quantity (Req 27)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update requirement quantity without altering or corrupting already delivered/processed vendor data.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModifyReqModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModifyReq} className="space-y-4 text-xs">
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 space-y-1">
                <div className="font-bold text-slate-800 text-sm">{selectedModifyReq.product_name}</div>
                <div className="text-[11px] font-mono text-slate-500">
                  HSN: {selectedModifyReq.hsn_code || '-'} | Current Qty: <strong className="text-amber-800">{selectedModifyReq.required_quantity} {selectedModifyReq.unit}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">New Required Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={modifyReqForm.new_qty}
                    onChange={(e) => setModifyReqForm({ ...modifyReqForm, new_qty: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Packaging Unit *</label>
                  <select
                    value={modifyReqForm.unit}
                    onChange={(e) => setModifyReqForm({ ...modifyReqForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="CTNS">CTNS (Cartons)</option>
                    <option value="BAGS">BAGS (30kg/50kg Bags)</option>
                    <option value="PCS">PCS (Units)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="BOXES">BOXES</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Modification Reason *</label>
                <select
                  value={modifyReqForm.reason}
                  onChange={(e) => setModifyReqForm({ ...modifyReqForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800"
                >
                  <option value="Customer Emergency Request">🚨 Customer Emergency Request</option>
                  <option value="Container Capacity Adjustment">🚢 Container Capacity Adjustment</option>
                  <option value="Supplier Delivery Delay">⏱️ Supplier Delivery Delay</option>
                  <option value="Cost / Freight Rate Change">💰 Cost / Freight Rate Change</option>
                  <option value="Product Availability Adjustment">📦 Product Availability Adjustment</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Audit Notes / Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Customer requested extra cartons due to urgent store opening"
                  value={modifyReqForm.notes}
                  onChange={(e) => setModifyReqForm({ ...modifyReqForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModifyReqModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Modification & Log Audit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Sub-Step Footer Navigation Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mt-6">
        <button
          type="button"
          onClick={goToPrevSubStep}
          className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>{currentSubIndex === 0 ? 'Step 3: Demands & Excel Upload' : `Prev: ${subTabLabels[subTabs[currentSubIndex - 1]]}`}</span>
        </button>

        <button
          type="button"
          onClick={goToNextSubStep}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition-all"
        >
          <span>
            {currentSubIndex === subTabs.length - 1
              ? 'Continue to Step 5: Duty & Quotations'
              : `Next: ${subTabLabels[subTabs[currentSubIndex + 1]]}`}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quotation Simulator Modal */}
      <QuotationSimulatorModal
        isOpen={showSimulatorModal}
        onClose={() => setShowSimulatorModal(false)}
      />
    </div>
  );
};

