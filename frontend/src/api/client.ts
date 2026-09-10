import axios from 'axios';
import type { Chapter, TariffLine, ImportLog, BatchImportSummary, PaginatedTariffResponse, TariffSearchResult, UnifiedProductSearchResult, ItemEntry, PaginatedItemEntryResponse, Customer, Shipment, ShipmentActual, DashboardSummary, Vendor, VendorProductMatchResponse, ShipmentCustomerRequirement, CustomerRequirementHistory, ShipmentVendorAllocation, ShipmentVendorProformaItem } from '../types';

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : 'https://a3expresscargo.onrender.com');
axios.defaults.baseURL = RAW_BASE;
const API_BASE = '/api/v1';

export const apiClient = {
  // Sections & Chapters
  getSections: async (): Promise<Chapter[]> => {
    const res = await axios.get(`${API_BASE}/tariff/sections`);
    return res.data;
  },

  // Search & Browse Tariff Lines
  getTariffLines: async (params: {
    query?: string;
    chapter_id?: number;
    section_number?: string;
    is_verified?: boolean;
    duty_type?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedTariffResponse> => {
    const res = await axios.get(`${API_BASE}/tariff/lines`, { params });
    return res.data;
  },

  // Update Tariff Line (Human verification / edit step)
  updateTariffLine: async (lineId: number, data: Partial<TariffLine>): Promise<TariffLine> => {
    const res = await axios.put(`${API_BASE}/tariff/lines/${lineId}`, data);
    return res.data;
  },

  // Confirm Verification
  verifyTariffLine: async (lineId: number): Promise<TariffLine> => {
    const res = await axios.post(`${API_BASE}/tariff/lines/${lineId}/verify`);
    return res.data;
  },

  // Batch Import
  triggerBatchImport: async (): Promise<BatchImportSummary> => {
    const res = await axios.post(`${API_BASE}/ingest/batch`);
    return res.data;
  },

  // Single PDF Upload
  uploadSinglePdf: async (file: File): Promise<ImportLog> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/ingest/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Get Ingestion Logs
  getImportLogs: async (): Promise<ImportLog[]> => {
    const res = await axios.get(`${API_BASE}/ingest/logs`);
    return res.data;
  },

  // Reset / Clear Database
  resetDatabase: async (): Promise<{ status: string; message: string }> => {
    const res = await axios.post(`${API_BASE}/ingest/reset`);
    return res.data;
  },


  // Download Export URLs
  getExportCsvUrl: (chapterId?: number, query?: string) => {
    const params = new URLSearchParams();
    if (chapterId) params.append('chapter_id', chapterId.toString());
    if (query) params.append('query', query);
    return `${API_BASE}/export/csv?${params.toString()}`;
  },

  getExportExcelUrl: (chapterId?: number, query?: string) => {
    const params = new URLSearchParams();
    if (chapterId) params.append('chapter_id', chapterId.toString());
    if (query) params.append('query', query);
    return `${API_BASE}/export/excel?${params.toString()}`;
  },

  // ── Item Entry ────────────────────────────────────────────────────────────

  /** Unified search: Item Master Favorites + Customs Tariff DB */
  searchAllProducts: async (q: string, limit = 15): Promise<UnifiedProductSearchResult[]> => {
    const res = await axios.get(`${API_BASE}/items/search-all`, { params: { q, limit } });
    return res.data;
  },

  /** Typeahead: search tariff_lines by item name / HS code fragment */
  searchTariffByName: async (q: string, limit = 10): Promise<TariffSearchResult[]> => {
    const res = await axios.get(`${API_BASE}/items/search-tariff`, { params: { q, limit } });
    return res.data;
  },

  /** Upsert favorite product in Item Master */
  upsertFavoriteItem: async (data: Partial<ItemEntry>): Promise<ItemEntry> => {
    const res = await axios.post(`${API_BASE}/items/upsert-favorite`, data);
    return res.data;
  },

  /** Bulk upload favorite products via Excel */
  bulkUploadFavoriteProducts: async (file: File): Promise<{ status: string; inserted: number; updated: number; total_processed: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/items/bulk-upload-excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** Create a new item entry */
  createItemEntry: async (data: Partial<ItemEntry>): Promise<ItemEntry> => {
    const res = await axios.post(`${API_BASE}/items`, data);
    return res.data;
  },

  /** List all item entries (paginated) */
  getItemEntries: async (params?: { query?: string; page?: number; page_size?: number }): Promise<PaginatedItemEntryResponse> => {
    const res = await axios.get(`${API_BASE}/items`, { params });
    return res.data;
  },

  /** Update an item entry */
  updateItemEntry: async (id: number, data: Partial<ItemEntry>): Promise<ItemEntry> => {
    const res = await axios.put(`${API_BASE}/items/${id}`, data);
    return res.data;
  },

  /** Delete an item entry */
  deleteItemEntry: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE}/items/${id}`);
  },

  // ── Customer Master ────────────────────────────────────────────────────────
  getCustomers: async (): Promise<Customer[]> => {
    const res = await axios.get(`${API_BASE}/customers`);
    return res.data;
  },

  createCustomer: async (data: Partial<Customer>): Promise<Customer> => {
    const res = await axios.post(`${API_BASE}/customers`, data);
    return res.data;
  },

  updateCustomer: async (id: number, data: Partial<Customer>): Promise<Customer> => {
    const res = await axios.put(`${API_BASE}/customers/${id}`, data);
    return res.data;
  },

  deleteCustomer: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE}/customers/${id}`);
  },

  // ── Shipment Master & Configuration ───────────────────────────────────────
  getNextShipmentNumber: async (fy?: string): Promise<{ financial_year: string; next_sequence: number; shipment_no: string }> => {
    const res = await axios.get(`${API_BASE}/shipments/next-number`, { params: { financial_year: fy } });
    return res.data;
  },

  getShipments: async (): Promise<Shipment[]> => {
    const res = await axios.get(`${API_BASE}/shipments`);
    return res.data;
  },

  createShipment: async (data: any): Promise<Shipment> => {
    const res = await axios.post(`${API_BASE}/shipments`, data);
    return res.data;
  },

  getShipmentDetails: async (id: number): Promise<Shipment> => {
    const res = await axios.get(`${API_BASE}/shipments/${id}`);
    return res.data;
  },

  updateShipmentConfig: async (id: number, data: any): Promise<Shipment> => {
    const res = await axios.put(`${API_BASE}/shipments/${id}/config`, data);
    return res.data;
  },

  // Products
  addProduct: async (shipmentId: number, data: any): Promise<Shipment> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/products`, data);
    return res.data;
  },

  updateProduct: async (shipmentId: number, productId: number, data: any): Promise<Shipment> => {
    const res = await axios.put(`${API_BASE}/shipments/${shipmentId}/products/${productId}`, data);
    return res.data;
  },

  deleteProduct: async (shipmentId: number, productId: number): Promise<Shipment> => {
    const res = await axios.delete(`${API_BASE}/shipments/${shipmentId}/products/${productId}`);
    return res.data;
  },

  uploadExcelProducts: async (shipmentId: number, file: File): Promise<Shipment> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/upload-excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Predicted vs Actual & OCR
  updateActuals: async (shipmentId: number, data: any): Promise<ShipmentActual> => {
    const res = await axios.put(`${API_BASE}/shipments/${shipmentId}/actuals`, data);
    return res.data;
  },

  ocrDutyInvoice: async (shipmentId: number, file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/ocr-duty-invoice`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Excel Workbook Ingestion
  ingestExcelWorkbook: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/excel/ingest`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // Documents & Exports Download URLs (Direct PDF & Excel)
  getQuotationUrl: (shipmentId: number, customerId: number) => {
    return `${RAW_BASE}${API_BASE}/shipments/${shipmentId}/documents/quotation?customer_id=${customerId}`;
  },

  getIndianInvoiceUrl: (shipmentId: number) => {
    return `${RAW_BASE}${API_BASE}/shipments/${shipmentId}/documents/indian-invoice`;
  },

  getColomboInvoiceUrl: (shipmentId: number) => {
    return `${RAW_BASE}${API_BASE}/shipments/${shipmentId}/documents/colombo-invoice`;
  },

  getPackingListUrl: (shipmentId: number) => {
    return `${RAW_BASE}${API_BASE}/shipments/${shipmentId}/documents/packing-list`;
  },

  getDutyReportUrl: (shipmentId: number) => {
    return `${RAW_BASE}${API_BASE}/shipments/${shipmentId}/documents/duty-report`;
  },

  getCmbBankExcelUrl: (shipmentId: number) => {
    return `${RAW_BASE}${API_BASE}/shipments/${shipmentId}/documents/cmb-bank-excel`;
  },

  getIndianExcelUrl: (shipmentId: number) => {
    return `${RAW_BASE}${API_BASE}/shipments/${shipmentId}/documents/indian-excel`;
  },



  // Soft Remove Product with Audit Trail
  softRemoveProduct: async (shipmentId: number, productId: number, reason: string): Promise<Shipment> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/products/${productId}/remove?reason=${encodeURIComponent(reason)}`);
    return res.data;
  },

  bulkSoftRemoveProducts: async (shipmentId: number, productIds: number[], reason?: string, removedBy?: string): Promise<Shipment> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/products/bulk-soft-remove`, {
      product_ids: productIds,
      reason: reason || "Customer requested removal from preliminary quotation",
      removed_by: removedBy || "Sales Agent"
    });
    return res.data;
  },

  getShipmentRemovalHistory: async (shipmentId: number): Promise<any[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/removal-history`);
    return res.data;
  },

  // Requirement 16: Customer Approval & Purchase Order Confirmation
  approveQuotationAndCreatePo: async (shipmentId: number, approvedBy?: string, notes?: string): Promise<Shipment> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/approve-quotation-and-create-po`, {
      approved_by: approvedBy || "Customer Representative",
      approval_notes: notes || "Customer approved preliminary quotation after product adjustments"
    });
    return res.data;
  },

  // Vendor Payment
  recordVendorPayment: async (shipmentId: number, payload: any): Promise<any> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/vendor-payments`, null, { params: payload });
    return res.data;
  },

  getVendorPayments: async (shipmentId: number): Promise<any[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/vendor-payments`);
    return res.data;
  },

  getVendorPaymentSummary: async (shipmentId: number): Promise<any[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/vendor-payments/summary`);
    return res.data;
  },

  // Proforma vs Actual Comparison
  compareProformaActualInvoice: async (shipmentId: number, vendorId: number, actualItems: any[]): Promise<any> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/proforma-actual-comparison?vendor_id=${vendorId}`, actualItems);
    return res.data;
  },

  getProformaActualComparison: async (shipmentId: number, vendorId?: number): Promise<any[]> => {
    const url = vendorId
      ? `${API_BASE}/shipments/${shipmentId}/proforma-actual-comparison?vendor_id=${vendorId}`
      : `${API_BASE}/shipments/${shipmentId}/proforma-actual-comparison`;
    const res = await axios.get(url);
    return res.data;
  },

  // Physical Receiving Verification
  recordReceivingVerification: async (shipmentId: number, payload: any): Promise<any> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/receiving-verification`, null, { params: payload });
    return res.data;
  },

  // Packing List Sequence & Generation
  getNextPackingListNumber: async (shipmentId: number, vendorId?: number): Promise<any> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/packing-lists/next-number`, null, { params: { vendor_id: vendorId } });
    return res.data;
  },

  generatePackingListFromReceiving: async (shipmentId: number, vendorId?: number, notes?: string): Promise<any> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/packing-lists/generate`, null, { params: { vendor_id: vendorId, notes } });
    return res.data;
  },

  getShipmentPackingLists: async (shipmentId: number): Promise<any[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/packing-lists`);
    return res.data;
  },

  getFullWorkbookExcelUrl: (shipmentId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/documents/full-workbook`;
  },

  getCooExcelUrl: (shipmentId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/documents/coo-excel`;
  },

  getCooPdfUrl: (shipmentId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/documents/coo-pdf`;
  },

  // Dashboard
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const res = await axios.get(`${API_BASE}/shipments/reports/dashboard`);
    return res.data;
  },

  // ── Vendors ──────────────────────────────────────────────────────────────
  getVendors: async (q?: string): Promise<Vendor[]> => {
    const res = await axios.get(`${API_BASE}/vendors`, { params: { q } });
    return res.data;
  },

  getMatchingVendorsForProduct: async (productName: string): Promise<VendorProductMatchResponse> => {
    const res = await axios.get(`${API_BASE}/vendors/matching-for-product`, { params: { product_name: productName } });
    return res.data;
  },

  getAllProductsCatalog: async (q?: string): Promise<string[]> => {
    const res = await axios.get(`${API_BASE}/vendors/products/all`, { params: { q } });
    return res.data;
  },

  createVendor: async (data: Partial<Vendor>): Promise<Vendor> => {
    const res = await axios.post(`${API_BASE}/vendors`, data);
    return res.data;
  },

  updateVendor: async (vendorId: number, data: Partial<Vendor>): Promise<Vendor> => {
    const res = await axios.put(`${API_BASE}/vendors/${vendorId}`, data);
    return res.data;
  },

  deleteVendor: async (vendorId: number): Promise<{ message: string }> => {
    const res = await axios.delete(`${API_BASE}/vendors/${vendorId}`);
    return res.data;
  },

  addVendorMapping: async (vendorId: number, productCategory: string, notes?: string): Promise<any> => {
    const res = await axios.post(`${API_BASE}/vendors/${vendorId}/mappings`, { product_category: productCategory, notes });
    return res.data;
  },

  // ── Customer Requirements ──────────────────────────────────────────────────
  getCustomerRequirements: async (shipmentId: number): Promise<ShipmentCustomerRequirement[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/requirements`);
    return res.data;
  },

  addCustomerRequirement: async (shipmentId: number, data: { customer_id: number; product_name: string; hsn_code?: string; required_quantity: number; unit: string; notes?: string }): Promise<ShipmentCustomerRequirement> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/requirements`, data);
    return res.data;
  },

  updateCustomerRequirement: async (shipmentId: number, reqId: number, data: { product_name?: string; hsn_code?: string; required_quantity?: number; unit?: string; notes?: string }): Promise<ShipmentCustomerRequirement> => {
    const res = await axios.put(`${API_BASE}/shipments/${shipmentId}/requirements/${reqId}`, data);
    return res.data;
  },

  updateRequirement: async (shipmentId: number, reqId: number, data: Partial<ShipmentCustomerRequirement>): Promise<ShipmentCustomerRequirement> => {
    const res = await axios.put(`${API_BASE}/shipments/${shipmentId}/requirements/${reqId}`, data);
    return res.data;
  },

  deleteCustomerRequirement: async (shipmentId: number, reqId: number): Promise<{ message: string }> => {
    const res = await axios.delete(`${API_BASE}/shipments/${shipmentId}/requirements/${reqId}`);
    return res.data;
  },

  deleteRequirement: async (shipmentId: number, reqId: number): Promise<void> => {
    await axios.delete(`${API_BASE}/shipments/${shipmentId}/requirements/${reqId}`);
  },

  uploadExcelRequirements: async (shipmentId: number, file: File): Promise<ShipmentCustomerRequirement[]> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/requirements/upload-excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getRequirementsExportExcelUrl: (shipmentId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/requirements/export/excel`;
  },

  getRequirementsExportPdfUrl: (shipmentId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/requirements/export/pdf`;
  },

  getRequirementHistory: async (shipmentId: number): Promise<CustomerRequirementHistory[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/requirements/history`);
    return res.data;
  },

  // ── Vendor Allocation & Proforma Invoice ────────────────────────────────────
  getVendorAllocations: async (shipmentId: number): Promise<ShipmentVendorAllocation[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/allocations`);
    return res.data;
  },

  createVendorAllocation: async (shipmentId: number, data: { requirement_id: number; vendor_id: number; allocated_quantity: number; allocated_unit: string; notes?: string }): Promise<ShipmentVendorAllocation> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/allocations`, data);
    return res.data;
  },

  getVendorProformaItems: async (shipmentId: number): Promise<ShipmentVendorProformaItem[]> => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/proforma-items`);
    return res.data;
  },

  createVendorProformaItem: async (shipmentId: number, data: Partial<ShipmentVendorProformaItem>): Promise<ShipmentVendorProformaItem> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/proforma-items`, data);
    return res.data;
  },

  updateVendorProformaItem: async (shipmentId: number, itemId: number, data: Partial<ShipmentVendorProformaItem>): Promise<ShipmentVendorProformaItem> => {
    const res = await axios.put(`${API_BASE}/shipments/${shipmentId}/proforma-items/${itemId}`, data);
    return res.data;
  },

  deleteVendorProformaItem: async (shipmentId: number, itemId: number): Promise<void> => {
    await axios.delete(`${API_BASE}/shipments/${shipmentId}/proforma-items/${itemId}`);
  },

  uploadVendorProformaExcel: async (shipmentId: number, file: File): Promise<ShipmentVendorProformaItem[]> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/proforma/upload-excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getStage2ProformaExportExcelUrl: (shipmentId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/proforma/export/excel`;
  },

  getStage2ProformaExportPdfUrl: (shipmentId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/proforma/export/pdf`;
  },

  // Option 3: PDF / Image OCR Proforma Ingestion (Requirement 11)
  uploadVendorProformaOcr: async (shipmentId: number, file: File): Promise<ShipmentVendorProformaItem[]> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/proforma/ocr-upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  getVendorRfqExcelUrl: (shipmentId: number, vendorId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/vendors/${vendorId}/rfq/excel`;
  },

  getVendorRfqPdfUrl: (shipmentId: number, vendorId: number) => {
    return `${API_BASE}/shipments/${shipmentId}/vendors/${vendorId}/rfq/pdf`;
  },

  getPreliminaryQuotation: async (shipmentId: number) => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/preliminary-quotation`);
    return res.data;
  },

  approveQuotationItem: async (shipmentId: number, itemId: number, quantity?: number, targetPrice?: number) => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/quotation/${itemId}/approve`, {
      quantity,
      target_price: targetPrice
    });
    return res.data;
  },

  removeQuotationItem: async (shipmentId: number, itemId: number) => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/quotation/${itemId}/remove`);
    return res.data;
  },

  negotiateQuotationItem: async (shipmentId: number, itemId: number, quantity?: number, targetPrice?: number, notes?: string) => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/quotation/${itemId}/negotiate`, {
      quantity,
      target_price: targetPrice,
      notes
    });
    return res.data;
  },

  getQuotationHistory: async (shipmentId: number) => {
    const res = await axios.get(`${API_BASE}/shipments/${shipmentId}/quotation/history`);
    return res.data;
  },

  convertToShipmentProducts: async (shipmentId: number): Promise<Shipment> => {
    const res = await axios.post(`${API_BASE}/shipments/${shipmentId}/convert-to-products`);
    return res.data;
  },
};

