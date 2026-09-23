export interface Chapter {
  id: number;
  chapter_number: number;
  section_number?: string;
  section_title?: string;
  chapter_title?: string;
  source_pdf_filename?: string;
  last_imported_at?: string;
  total_lines: number;
}

export interface TariffLine {
  id: number;
  chapter_id: number;
  chapter_number?: number;
  section_number?: string;
  hs_code?: string;
  description: string;
  unit?: string;
  icl_slsi?: string;
  general_duty_rate?: string;
  preferential_rates?: Record<string, string>;
  vat_rate?: string;
  pal_rate?: string;
  cess_rate?: string;
  sscl_rate?: string;
  excise_rate?: string;
  scl_rate?: string;
  notes?: string;
  indent_level: number;
  raw_row_text?: string;
  page_number?: number;
  is_verified: boolean;
}

export interface ImportLog {
  id: number;
  filename: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  rows_extracted: number;
  errors: string[];
  imported_at: string;
}

export interface BatchImportSummary {
  total_files_processed: number;
  successful_files: number;
  failed_files: number;
  total_rows_extracted: number;
  logs: ImportLog[];
}

export interface PaginatedTariffResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: TariffLine[];
}

export interface TariffSearchResult {
  tariff_line_id?: number;
  hs_code?: string;
  description: string;
  unit?: string;
  chapter_number?: number;
  chapter_title?: string;
  section_number?: string;
  general_duty_rate?: string;
  vat_rate?: string;
  pal_rate?: string;
  cess_rate?: string;
  sscl_rate?: string;
  excise_rate?: string;
}

export interface UnifiedProductSearchResult {
  item_category: string;
  source: 'FAVORITE' | 'TARIFF';
  id?: number;
  tariff_line_id?: number;
  item_name: string;
  hs_code?: string;
  description?: string;
  product_category?: string;
  unit?: string;
  currency?: string;
  purchase_price?: number;
  weight_val?: number;
  weight_unit?: string;
  general_duty_rate?: string;
  vat_rate?: string;
  pal_rate?: string;
  cess_rate?: string;
  sscl_rate?: string;
  excise_rate?: string;
  scl_rate?: string;
}

export interface ItemEntry {
  id: number;
  item_name: string;
  item_category?: string;
  unit?: string;
  notes?: string;
  currency: string;
  tariff_line_id?: number;
  hs_code?: string;
  tariff_description?: string;
  general_duty_rate?: string;
  vat_rate?: string;
  pal_rate?: string;
  cess_rate?: string;
  sscl_rate?: string;
  excise_rate?: string;
  scl_rate?: string;
  weight_val?: number;
  weight_unit?: string;
  is_favorite?: boolean;
  purchase_price?: number | string;
  price_per_kg?: number | string;
  total_quantity_kg?: number | string;
  per_month_qty_kg?: number | string;
  total_value?: number | string;
  per_month_value?: number | string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedItemEntryResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: ItemEntry[];
}

export interface Customer {
  id: number;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  tax_id?: string;
  created_at: string;
}

export interface ShipmentProduct {
  id: number;
  shipment_id: number;
  customer_id: number;
  customer_name?: string;
  product_name: string;
  product_category?: string;
  hsn_code?: string;
  quantity: number;
  weight_val?: number;
  weight_unit?: string;
  unit?: string;
  purchase_price: number;
  currency?: string;
  pkt_size_g?: number;
  no_bags_qty?: number;
  net_weight_kg?: number;
  gross_weight_kg?: number;
  discount_lkr?: number;
  set_price_lkr?: number;
  short_qty?: number;
  short_amt_lkr?: number;
  net_settlement_lkr?: number;
  freight_allocation_lkr?: number;
  port_charges_lkr?: number;
  base_price_lkr?: number;
  cnf_price?: number;
  general_duty_rate?: string;
  vat_rate?: string;
  pal_rate?: string;
  cess_rate?: string;
  sscl_rate?: string;
  calculated_duty_lkr?: number;
  total_cost_lkr?: number;
  indian_price?: number;
  srilankan_price?: number;
  suggested_price?: number;
  final_quotation_price?: number;
  predicted_profit?: number;
  is_active?: boolean;
  item_classification?: string;
  notes?: string;
}

export interface ShipmentActual {
  id: number;
  shipment_id: number;
  actual_duty_inr: number;
  actual_duty_lkr: number;
  actual_cost_inr: number;
  actual_cost_lkr: number;
  actual_revenue_inr: number;
  actual_revenue_lkr: number;
  actual_profit_lkr: number;
  ocr_source_file?: string;
  notes?: string;
  updated_at: string;
}

export interface VendorProductMapping {
  id: number;
  vendor_id: number;
  product_category: string;
  notes?: string;
  created_at: string;
}

export interface Vendor {
  id: number;
  name: string;
  code: string;
  legal_name?: string;
  trade_name?: string;
  company_type?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  gstin?: string;
  pan_number?: string;
  bank_account_number?: string;
  bank_ifsc_code?: string;
  bank_name?: string;
  bank_branch?: string;
  main_category?: string;
  sub_categories?: string[];
  products_supplied?: string[];
  status?: 'Active Supplier' | 'Pending Review' | 'Inactive';
  created_at: string;
  mappings?: VendorProductMapping[];
}

export interface VendorProductMatchResponse {
  product_name: string;
  last_allocated_vendor?: Vendor;
  matching_vendors: Vendor[];
  all_vendors: Vendor[];
}

export interface CustomerRequirementHistory {
  id: number;
  requirement_id: number;
  shipment_id: number;
  customer_id: number;
  product_name: string;
  old_quantity?: number;
  new_quantity: number;
  unit: string;
  action_type: 'CREATED' | 'UPDATED' | 'BULK_UPLOAD' | 'ADDED_LATER';
  modified_at: string;
  customer?: Customer;
}

export interface ShipmentCustomerRequirement {
  id: number;
  shipment_id: number;
  customer_id: number;
  product_name: string;
  hsn_code?: string;
  required_quantity: number;
  unit: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  history?: CustomerRequirementHistory[];
}

export interface ShipmentVendorProformaItem {
  id: number;
  shipment_id: number;
  allocation_id?: number;
  vendor_id: number;
  product_name: string;
  sku?: string;
  hsn_code?: string;
  proforma_qty: number;
  cartons_count: number;
  units_per_carton: number;
  unit_weight_val: number;
  unit_weight_unit: string;
  net_weight_kg: number;
  gross_weight_kg: number;
  proforma_price: number;
  mrp?: number;
  discount_pct?: number;
  gst_pct?: number;
  total_payable?: number;
  currency: string;
  notes?: string;
  created_at: string;
  vendor?: Vendor;
}

export interface PreliminaryQuotationItem {
  id: number;
  shipment_id: number;
  requirement_id?: number;
  vendor_id?: number;
  vendor_name?: string;
  product_name: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  unit_price_inr: number;
  unit_cost_lkr: number;
  estimated_selling_price_lkr: number;
  customer_target_price?: number;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEGOTIATED';
  notes?: string;
}

export interface QuotationHistoryLog {
  id: number;
  shipment_id: number;
  quotation_item_id?: number;
  product_name: string;
  action_type: 'APPROVED' | 'REMOVED' | 'PRICE_CHANGE_REQUESTED';
  old_value?: string;
  new_value?: string;
  notes?: string;
  created_at: string;
}

export interface ShipmentVendorAllocation {
  unit?: string;
  id: number;
  shipment_id: number;
  requirement_id: number;
  vendor_id: number;
  allocated_quantity: number;
  allocated_unit: string;
  status: 'PENDING_PI' | 'PI_RECEIVED' | 'CONFIRMED';
  notes?: string;
  created_at: string;
  updated_at: string;
  requirement?: ShipmentCustomerRequirement;
  vendor?: Vendor;
  proforma_items?: ShipmentVendorProformaItem[];
}

export interface Shipment {
  id: number;
  shipment_no: string;
  sequence_number: number;
  financial_year: string;
  shipment_date?: string;
  status: 'DRAFT' | 'CONFIGURED' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  destination?: string;
  currency?: string;
  current_stage?: string;
  usd_rate: number;
  lkr_inr_rate: number;
  profit_margin_pct: number;
  indian_invoice_margin_pct?: number;
  colombo_invoice_margin_pct?: number;
  margin_mode?: 'MARGIN_ON_REVENUE' | 'MARKUP_ON_COST';
  common_expenses_inr: number;
  common_expenses_lkr: number;
  port_expenses_lkr?: number;
  freight_allocation_mode?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  customers: Customer[];
  products: ShipmentProduct[];
  actuals?: ShipmentActual;
  requirements?: ShipmentCustomerRequirement[];
  allocations?: ShipmentVendorAllocation[];
  proforma_items?: ShipmentVendorProformaItem[];
}

export interface CustomerProfitSummary {
  customer_id: number;
  customer_name: string;
  customer_code: string;
  total_shipments: number;
  total_sales_lkr: number;
  total_cost_lkr: number;
  total_profit_lkr: number;
  pending_amount_lkr: number;
}

export interface DashboardSummary {
  total_shipments: number;
  total_sales_lkr: number;
  total_duty_lkr: number;
  total_cost_lkr: number;
  total_profit_lkr: number;
  total_loss_lkr: number;
  customer_summaries: CustomerProfitSummary[];
  year_wise_summary: Record<string, any>;
}

export interface ShipmentMilestone {
  id: number;
  shipment_id: number;
  milestone_code: string;
  milestone_name: string;
  sequence: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'SKIPPED' | 'CANCELLED';
  workflow_mode?: string;
  planned_date?: string;
  due_date?: string;
  actual_date?: string;
  delay_days: number;
  delay_reason?: string;
  owner_person?: string;
  remarks?: string;
  source_entity_type?: string;
  source_entity_id?: number;
  created_at: string;
  updated_at: string;
}

export interface TraceabilityNode {
  relationship?: string;
  entity_type: string;
  entity_id: number;
  label: string;
  ref_number?: string;
  amount?: number;
  currency?: string;
  status?: string;
  date?: string;
  metadata?: Record<string, any>;
  children?: TraceabilityGroup[];
}

export interface TraceabilityGroup {
  group: string;
  items: TraceabilityNode[];
}

export interface TraceabilityTreeResponse {
  root: TraceabilityNode;
  children: (TraceabilityGroup | TraceabilityNode)[];
}

export interface GlobalSearchEntity {
  entity_type: string;
  entity_id: number;
  title: string;
  subtitle: string;
  badge: string;
}

export interface TrackingShipmentRow {
  shipment_id: number;
  shipment_no: string;
  financial_year: string;
  customer_names: string;
  destination: string;
  status: string;
  current_stage: string;
  progress_pct: number;
  total_milestones: number;
  completed_milestones: number;
  is_delayed: boolean;
  is_blocked: boolean;
  created_at?: string;
}

export interface TrackingDashboardSummary {
  kpis: {
    total_shipments: number;
    in_progress: number;
    completed: number;
    blocked: number;
    delayed: number;
    attention_required: number;
  };
  shipments: TrackingShipmentRow[];
}


