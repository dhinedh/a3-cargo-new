# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal

class TariffLineBase(BaseModel):
    hs_code: Optional[str] = None
    description: str
    unit: Optional[str] = None
    icl_slsi: Optional[str] = None
    general_duty_rate: Optional[str] = None
    preferential_rates: Dict[str, Any] = Field(default_factory=dict)
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    excise_rate: Optional[str] = None
    scl_rate: Optional[str] = None
    notes: Optional[str] = None
    indent_level: int = 0
    raw_row_text: Optional[str] = None
    page_number: Optional[int] = None
    is_verified: bool = False

class TariffLineCreate(TariffLineBase):
    chapter_id: int

class TariffLineUpdate(BaseModel):
    hs_code: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    icl_slsi: Optional[str] = None
    general_duty_rate: Optional[str] = None
    preferential_rates: Optional[Dict[str, Any]] = None
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    excise_rate: Optional[str] = None
    scl_rate: Optional[str] = None
    notes: Optional[str] = None
    indent_level: Optional[int] = None
    is_verified: Optional[bool] = None

class TariffLineResponse(TariffLineBase):
    id: int
    chapter_id: int

    class Config:
        from_attributes = True

class ChapterBase(BaseModel):
    chapter_number: int
    section_number: Optional[str] = None
    section_title: Optional[str] = None
    chapter_title: Optional[str] = None
    source_pdf_filename: Optional[str] = None

class ChapterResponse(ChapterBase):
    id: int
    last_imported_at: Optional[datetime] = None
    total_lines: Optional[int] = 0

    class Config:
        from_attributes = True

class ImportLogResponse(BaseModel):
    id: int
    filename: str
    status: str
    rows_extracted: int
    errors: List[Any] = Field(default_factory=list)
    imported_at: datetime

    class Config:
        from_attributes = True

class BatchImportSummary(BaseModel):
    total_files_processed: int
    successful_files: int
    failed_files: int
    total_rows_extracted: int
    logs: List[ImportLogResponse]


# ─── Item Entry Schemas ────────────────────────────────────────────────────────

class TariffSearchResult(BaseModel):
    """Lightweight result for item name typeahead search."""
    tariff_line_id: int
    hs_code: Optional[str] = None
    description: str
    unit: Optional[str] = None
    chapter_number: Optional[int] = None
    chapter_title: Optional[str] = None
    section_number: Optional[str] = None
    general_duty_rate: Optional[str] = None
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    excise_rate: Optional[str] = None

    class Config:
        from_attributes = True


class ItemEntryBase(BaseModel):
    item_name: str
    item_category: Optional[str] = None
    unit: Optional[str] = "KG"
    notes: Optional[str] = None
    currency: str = "LKR"

    # Tariff-linked
    tariff_line_id: Optional[int] = None
    hs_code: Optional[str] = None
    tariff_description: Optional[str] = None
    general_duty_rate: Optional[str] = None
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    excise_rate: Optional[str] = None
    scl_rate: Optional[str] = None

    # Weight and Favorite fields
    weight_val: Optional[Decimal] = None
    weight_unit: Optional[str] = "KG"
    is_favorite: Optional[bool] = True

    # Pricing
    purchase_price: Optional[Decimal] = None
    price_per_kg: Optional[Decimal] = None
    total_quantity_kg: Optional[Decimal] = None
    per_month_qty_kg: Optional[Decimal] = None
    total_value: Optional[Decimal] = None
    per_month_value: Optional[Decimal] = None


class ItemEntryCreate(ItemEntryBase):
    pass


class ItemEntryUpdate(BaseModel):
    item_name: Optional[str] = None
    item_category: Optional[str] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    currency: Optional[str] = None
    tariff_line_id: Optional[int] = None
    hs_code: Optional[str] = None
    tariff_description: Optional[str] = None
    general_duty_rate: Optional[str] = None
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    excise_rate: Optional[str] = None
    scl_rate: Optional[str] = None
    weight_val: Optional[Decimal] = None
    weight_unit: Optional[str] = None
    is_favorite: Optional[bool] = None
    purchase_price: Optional[Decimal] = None
    price_per_kg: Optional[Decimal] = None
    total_quantity_kg: Optional[Decimal] = None
    per_month_qty_kg: Optional[Decimal] = None
    total_value: Optional[Decimal] = None
    per_month_value: Optional[Decimal] = None


class UnifiedProductSearchResult(BaseModel):
    source: str  # "FAVORITE" or "TARIFF"
    id: Optional[int] = None  # ItemEntry ID or TariffLine ID
    tariff_line_id: Optional[int] = None
    item_name: str
    hs_code: Optional[str] = None
    description: Optional[str] = None
    product_category: Optional[str] = None
    unit: Optional[str] = "PCS"
    currency: Optional[str] = "INR"
    purchase_price: Optional[Decimal] = None
    weight_val: Optional[Decimal] = None
    weight_unit: Optional[str] = "KG"
    general_duty_rate: Optional[str] = None
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    excise_rate: Optional[str] = None
    scl_rate: Optional[str] = None

    class Config:
        from_attributes = True


class ItemEntryResponse(ItemEntryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedItemEntryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[ItemEntryResponse]


# ─── Customer Schemas ─────────────────────────────────────────────────────────

class CustomerBase(BaseModel):
    name: str
    code: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = "Sri Lanka"
    tax_id: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    tax_id: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Shipment Schemas ─────────────────────────────────────────────────────────

class ShipmentCreate(BaseModel):
    financial_year: Optional[str] = None # e.g. "2026-27"
    shipment_date: Optional[str] = None
    destination: Optional[str] = "Colombo Port, Sri Lanka"
    currency: Optional[str] = "INR"
    customer_ids: List[int] = Field(default_factory=list)
    customer_names: List[str] = Field(default_factory=list)
    customer_addresses: List[str] = Field(default_factory=list)
    customer_details: List[Dict[str, Any]] = Field(default_factory=list)
    usd_rate: Optional[Decimal] = Decimal("1.0")
    lkr_inr_rate: Optional[Decimal] = Decimal("1.0")
    profit_margin_pct: Optional[Decimal] = Decimal("15.0")
    indian_invoice_margin_pct: Optional[Decimal] = Decimal("15.0")
    colombo_invoice_margin_pct: Optional[Decimal] = Decimal("15.0")
    margin_mode: Optional[str] = "MARGIN_ON_REVENUE"
    common_expenses_inr: Optional[Decimal] = Decimal("0.0")
    common_expenses_lkr: Optional[Decimal] = Decimal("0.0")
    port_expenses_lkr: Optional[Decimal] = Decimal("0.0")
    freight_allocation_mode: Optional[str] = "WEIGHT"
    notes: Optional[str] = None

class ShipmentConfigUpdate(BaseModel):
    shipment_date: Optional[str] = None
    status: Optional[str] = None
    destination: Optional[str] = None
    currency: Optional[str] = None
    current_stage: Optional[str] = None
    usd_rate: Optional[Decimal] = None
    lkr_inr_rate: Optional[Decimal] = None
    profit_margin_pct: Optional[Decimal] = None
    indian_invoice_margin_pct: Optional[Decimal] = None
    colombo_invoice_margin_pct: Optional[Decimal] = None
    margin_mode: Optional[str] = None
    common_expenses_inr: Optional[Decimal] = None
    common_expenses_lkr: Optional[Decimal] = None
    port_expenses_lkr: Optional[Decimal] = None
    freight_allocation_mode: Optional[str] = None
    notes: Optional[str] = None
    customer_ids: Optional[List[int]] = None
    customer_names: Optional[List[str]] = None
    customer_addresses: Optional[List[str]] = None
    customer_details: Optional[List[Dict[str, Any]]] = None

class ShipmentProductBase(BaseModel):
    customer_id: int
    product_name: str
    product_category: Optional[str] = None
    hsn_code: Optional[str] = None
    item_classification: Optional[str] = "NORMAL"
    is_active: Optional[bool] = True
    stage_status: Optional[str] = "REQUESTED"
    quantity: Decimal = Decimal("1.0")
    weight_val: Optional[Decimal] = Decimal("0.0")
    weight_unit: Optional[str] = "KG"
    unit: Optional[str] = "PCS"
    purchase_price: Decimal = Decimal("0.0")
    currency: Optional[str] = "INR"
    pkt_size_g: Optional[Decimal] = Decimal("0.0")
    no_bags_qty: Optional[Decimal] = Decimal("0.0")
    net_weight_kg: Optional[Decimal] = Decimal("0.0")
    gross_weight_kg: Optional[Decimal] = Decimal("0.0")
    discount_lkr: Optional[Decimal] = Decimal("0.0")
    set_price_lkr: Optional[Decimal] = Decimal("0.0")
    short_qty: Optional[Decimal] = Decimal("0.0")
    short_amt_lkr: Optional[Decimal] = Decimal("0.0")
    net_settlement_lkr: Optional[Decimal] = Decimal("0.0")

class ShipmentProductCreate(ShipmentProductBase):
    save_to_favorite: Optional[bool] = False

class ShipmentProductUpdate(BaseModel):
    customer_id: Optional[int] = None
    product_name: Optional[str] = None
    product_category: Optional[str] = None
    hsn_code: Optional[str] = None
    item_classification: Optional[str] = None
    is_active: Optional[bool] = None
    stage_status: Optional[str] = None
    quantity: Optional[Decimal] = None
    weight_val: Optional[Decimal] = None
    weight_unit: Optional[str] = None
    unit: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    currency: Optional[str] = None
    pkt_size_g: Optional[Decimal] = None
    no_bags_qty: Optional[Decimal] = None
    net_weight_kg: Optional[Decimal] = None
    gross_weight_kg: Optional[Decimal] = None
    discount_lkr: Optional[Decimal] = None
    set_price_lkr: Optional[Decimal] = None
    short_qty: Optional[Decimal] = None
    short_amt_lkr: Optional[Decimal] = None
    net_settlement_lkr: Optional[Decimal] = None
    final_quotation_price: Optional[Decimal] = None

class ShipmentProductResponse(ShipmentProductBase):
    id: int
    shipment_id: int
    freight_allocation_lkr: Optional[Decimal] = Decimal("0.0")
    port_charges_lkr: Optional[Decimal] = Decimal("0.0")
    base_price_lkr: Optional[Decimal] = Decimal("0.0")
    cnf_price: Optional[Decimal] = Decimal("0.0")
    general_duty_rate: Optional[str] = None
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    calculated_duty_lkr: Optional[Decimal] = Decimal("0.0")
    total_cost_lkr: Optional[Decimal] = Decimal("0.0")
    indian_price: Optional[Decimal] = Decimal("0.0")
    srilankan_price: Optional[Decimal] = Decimal("0.0")
    suggested_price: Optional[Decimal] = Decimal("0.0")
    final_quotation_price: Optional[Decimal] = Decimal("0.0")
    predicted_profit: Optional[Decimal] = Decimal("0.0")
    customer_name: Optional[str] = None

    class Config:
        from_attributes = True

class ShipmentActualBase(BaseModel):
    actual_duty_inr: Decimal = Decimal("0.0")
    actual_duty_lkr: Decimal = Decimal("0.0")
    actual_cost_inr: Decimal = Decimal("0.0")
    actual_cost_lkr: Decimal = Decimal("0.0")
    actual_revenue_inr: Decimal = Decimal("0.0")
    actual_revenue_lkr: Decimal = Decimal("0.0")
    actual_profit_lkr: Decimal = Decimal("0.0")
    notes: Optional[str] = None

class ShipmentActualUpdate(ShipmentActualBase):
    pass

class ShipmentActualResponse(ShipmentActualBase):
    id: int
    shipment_id: int
    ocr_source_file: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True

class ShipmentPurchaseOrderResponse(BaseModel):
    id: int
    shipment_id: int
    vendor_id: int
    po_number: str
    po_date: Optional[str] = None
    total_amount: Decimal
    currency: str
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ShipmentResponse(BaseModel):
    id: int
    shipment_no: str
    sequence_number: int
    financial_year: str
    shipment_date: Optional[str] = None
    status: str
    destination: Optional[str] = "Colombo Port, Sri Lanka"
    currency: Optional[str] = "INR"
    current_stage: Optional[str] = "1_SHIPMENT_CREATION"
    usd_rate: Decimal
    lkr_inr_rate: Decimal
    profit_margin_pct: Decimal
    indian_invoice_margin_pct: Optional[Decimal] = Decimal("15.0")
    colombo_invoice_margin_pct: Optional[Decimal] = Decimal("15.0")
    common_expenses_inr: Decimal
    common_expenses_lkr: Decimal
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    customers: List[CustomerResponse] = Field(default_factory=list)
    products: List[ShipmentProductResponse] = Field(default_factory=list)
    actuals: Optional[ShipmentActualResponse] = None
    purchase_orders: List[ShipmentPurchaseOrderResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ─── Vendor Schemas ────────────────────────────────────────────────────────────

class VendorProductMappingBase(BaseModel):
    product_category: str
    notes: Optional[str] = None

class VendorProductMappingCreate(VendorProductMappingBase):
    pass

class VendorProductMappingResponse(VendorProductMappingBase):
    id: int
    vendor_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class VendorBase(BaseModel):
    name: str
    code: Optional[str] = None
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    company_type: Optional[str] = "Proprietorship"
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = "India"
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    main_category: Optional[str] = None
    sub_categories: Optional[List[str]] = Field(default_factory=list)
    products_supplied: Optional[List[str]] = Field(default_factory=list)
    status: Optional[str] = "Active Supplier"

    @field_validator("sub_categories", "products_supplied", mode="before")
    @classmethod
    def default_empty_list(cls, v):
        if v is None:
            return []
        return v

class VendorCreate(VendorBase):
    pass

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    company_type: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    gstin: Optional[str] = None
    pan_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    main_category: Optional[str] = None
    sub_categories: Optional[List[str]] = None
    products_supplied: Optional[List[str]] = None
    status: Optional[str] = None

class VendorResponse(VendorBase):
    id: int
    created_at: Optional[datetime] = None
    mappings: List[VendorProductMappingResponse] = Field(default_factory=list)

    @field_validator("created_at", mode="before")
    @classmethod
    def default_created_at(cls, v):
        if v is None:
            return datetime.utcnow()
        return v

    class Config:
        from_attributes = True

class VendorProductMatchResponse(BaseModel):
    product_name: str
    last_allocated_vendor: Optional[VendorResponse] = None
    matching_vendors: List[VendorResponse] = Field(default_factory=list)
    all_vendors: List[VendorResponse] = Field(default_factory=list)


# ─── Customer Requirement & History Schemas ───────────────────────────────────

class ShipmentCustomerRequirementBase(BaseModel):
    customer_id: int
    product_name: str
    hsn_code: Optional[str] = None
    required_quantity: Decimal = Decimal("1.0")
    unit: str = "PCS"
    notes: Optional[str] = None

class ShipmentCustomerRequirementCreate(ShipmentCustomerRequirementBase):
    pass

class ShipmentCustomerRequirementUpdate(BaseModel):
    product_name: Optional[str] = None
    hsn_code: Optional[str] = None
    required_quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    notes: Optional[str] = None

class CustomerRequirementHistoryResponse(BaseModel):
    id: int
    requirement_id: int
    shipment_id: int
    customer_id: int
    product_name: str
    old_quantity: Optional[Decimal] = None
    new_quantity: Decimal
    unit: str
    action_type: str
    modified_at: datetime
    customer: Optional[CustomerResponse] = None

    class Config:
        from_attributes = True

class ShipmentCustomerRequirementResponse(ShipmentCustomerRequirementBase):
    id: int
    shipment_id: int
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerResponse] = None
    history: List[CustomerRequirementHistoryResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


# ─── Vendor Allocation & Proforma Schemas ─────────────────────────────────────

class ShipmentVendorAllocationBase(BaseModel):
    requirement_id: int
    vendor_id: int
    allocated_quantity: Decimal = Decimal("1.0")
    allocated_unit: str = "PCS"
    status: str = "PENDING_PI"
    notes: Optional[str] = None

class ShipmentVendorAllocationCreate(ShipmentVendorAllocationBase):
    pass

class ShipmentVendorAllocationUpdate(BaseModel):
    allocated_quantity: Optional[Decimal] = None
    allocated_unit: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class ShipmentVendorProformaItemBase(BaseModel):
    allocation_id: Optional[int] = None
    vendor_id: int
    product_name: str
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    proforma_qty: Decimal = Decimal("1.0")
    cartons_count: Decimal = Decimal("0.0")
    units_per_carton: Decimal = Decimal("0.0")
    unit_weight_val: Decimal = Decimal("0.0")
    unit_weight_unit: str = "KG"
    net_weight_kg: Decimal = Decimal("0.0")
    gross_weight_kg: Decimal = Decimal("0.0")
    proforma_price: Decimal = Decimal("0.0")
    mrp: Optional[Decimal] = Decimal("0.0")
    discount_pct: Optional[Decimal] = Decimal("0.0")
    gst_pct: Optional[Decimal] = Decimal("0.0")
    total_payable: Optional[Decimal] = Decimal("0.0")
    price_per_kg: Optional[Decimal] = Decimal("0.0")
    currency: str = "INR"
    notes: Optional[str] = None

class ShipmentVendorProformaItemCreate(ShipmentVendorProformaItemBase):
    pass

class ShipmentVendorProformaItemResponse(ShipmentVendorProformaItemBase):
    id: int
    shipment_id: int
    created_at: datetime
    vendor: Optional[VendorResponse] = None

    class Config:
        from_attributes = True

class ShipmentVendorAllocationResponse(ShipmentVendorAllocationBase):
    id: int
    shipment_id: int
    created_at: datetime
    updated_at: datetime
    requirement: Optional[ShipmentCustomerRequirementResponse] = None
    vendor: Optional[VendorResponse] = None
    proforma_items: List[ShipmentVendorProformaItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

class BulkSoftRemoveRequest(BaseModel):
    product_ids: List[int]
    removed_by: Optional[str] = "Sales Agent"
    reason: Optional[str] = "Customer requested removal from preliminary quotation"

class ShipmentProductRemovalHistoryResponse(BaseModel):
    id: int
    shipment_id: int
    product_id: int
    product_name: str
    quantity: Decimal
    removed_by: Optional[str] = None
    removed_at: datetime
    reason: Optional[str] = None
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class ApproveQuotationRequest(BaseModel):
    approved_by: Optional[str] = "Customer Representative"
    approval_notes: Optional[str] = "Customer approved preliminary quotation after product adjustments"


# ─── Dashboard & Summary Schemas ──────────────────────────────────────────────

class CustomerProfitSummary(BaseModel):
    customer_id: int
    customer_name: str
    customer_code: str
    total_shipments: int
    total_sales_lkr: Decimal
    total_cost_lkr: Decimal
    total_profit_lkr: Decimal
    pending_amount_lkr: Decimal

class DashboardSummaryResponse(BaseModel):
    total_shipments: int
    total_sales_lkr: Decimal
    total_duty_lkr: Decimal
    total_cost_lkr: Decimal
    total_profit_lkr: Decimal
    total_loss_lkr: Decimal
    customer_summaries: List[CustomerProfitSummary]
    year_wise_summary: Dict[str, Dict[str, Any]]


# ─── Quotation Simulator Schemas ──────────────────────────────────────────────

class QuotationSimulationRequest(BaseModel):
    product_name: str
    hsn_code: Optional[str] = None
    quantity: Decimal = Decimal("26000.0")
    unit: Optional[str] = "KG"
    container_count: Optional[Decimal] = Decimal("1.0")
    net_weight_kg: Optional[Decimal] = Decimal("26000.0")
    gross_weight_kg: Optional[Decimal] = Decimal("27300.0")
    purchase_price: Decimal = Decimal("65.0")
    purchase_currency: Optional[str] = "INR"
    lkr_inr_rate: Optional[Decimal] = Decimal("4.0")
    usd_lkr_rate: Optional[Decimal] = Decimal("300.0")
    profit_margin_pct: Optional[Decimal] = Decimal("15.0")
    margin_mode: Optional[str] = "MARGIN_ON_REVENUE"
    freight_expense_inr: Optional[Decimal] = Decimal("85000.0")
    freight_expense_lkr: Optional[Decimal] = Decimal("0.0")
    port_expense_lkr: Optional[Decimal] = Decimal("45000.0")

class QuotationSimulationResponse(BaseModel):
    product_name: str
    hsn_code: str
    hsn_status: str
    is_hsn_unresolved: bool
    tariff_description: Optional[str] = None
    
    quantity: float
    unit: str
    container_count: float
    net_weight_kg: float
    gross_weight_kg: float
    
    purchase_price: float
    purchase_currency: str
    lkr_inr_rate: float
    usd_lkr_rate: float
    profit_margin_pct: float
    margin_mode: str
    
    general_duty_rate: Optional[str] = None
    vat_rate: Optional[str] = None
    pal_rate: Optional[str] = None
    cess_rate: Optional[str] = None
    sscl_rate: Optional[str] = None
    scl_rate: Optional[str] = None
    
    gen_duty_pct: float
    vat_pct: float
    pal_pct: float
    cess_pct: float
    sscl_pct: float
    
    per_unit_duty_lkr: float
    total_duty_lkr: float
    
    base_price_lkr: float
    per_unit_freight_lkr: float
    total_freight_lkr: float
    per_unit_port_lkr: float
    total_port_lkr: float
    
    cnf_price_lkr: float
    unit_cost_lkr: float
    total_cost_lkr: float
    
    suggested_selling_price_lkr: float
    total_sales_revenue_lkr: float
    predicted_profit_lkr: float
    profit_per_kg_lkr: float
    
    formatted_quotation_text: str


