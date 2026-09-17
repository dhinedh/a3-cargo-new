from typing import Optional, Any
# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    chapter_number = Column(Integer, unique=True, index=True, nullable=False)
    section_number = Column(String, index=True, nullable=True)
    section_title = Column(String, nullable=True)
    chapter_title = Column(String, nullable=True)
    source_pdf_filename = Column(String, nullable=True)
    last_imported_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tariff_lines = relationship("TariffLine", back_populates="chapter", cascade="all, delete-orphan")


class TariffLine(Base):
    __tablename__ = "tariff_lines"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False, index=True)
    hs_code = Column(String, index=True, nullable=True)
    description = Column(Text, nullable=False)
    unit = Column(String, nullable=True)
    icl_slsi = Column(String, nullable=True)  # Import Control License / SLSI regulation
    general_duty_rate = Column(String, nullable=True)
    preferential_rates = Column(JSON, default=dict)  # {"ISFTA": "Free", "PSFTA": "Free", "SAFTA": "10%"}
    vat_rate = Column(String, nullable=True)
    pal_rate = Column(String, nullable=True)
    cess_rate = Column(String, nullable=True)
    sscl_rate = Column(String, nullable=True) # Social Security Contribution Levy
    excise_rate = Column(String, nullable=True)
    scl_rate = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    indent_level = Column(Integer, default=0)
    raw_row_text = Column(Text, nullable=True)
    page_number = Column(Integer, nullable=True)
    is_verified = Column(Boolean, default=False)

    chapter = relationship("Chapter", back_populates="tariff_lines")


class ImportLog(Base):
    __tablename__ = "import_logs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)  # "SUCCESS", "FAILED", "WARNING"
    rows_extracted = Column(Integer, default=0)
    errors = Column(JSON, default=list)
    imported_at = Column(DateTime, default=datetime.utcnow)


class ItemEntry(Base):
    __tablename__ = "item_entries"

    id = Column(Integer, primary_key=True, index=True)

    # User-provided item details
    item_name = Column(String, nullable=False, index=True)
    item_category = Column(String, nullable=True)  # Auto-filled from chapter title or manually set
    item_classification = Column(String, default="NORMAL")  # "NORMAL", "LICENSED", "SCL"
    unit = Column(String, default="KG", nullable=True)  # Unit of measurement: KG, Units, Pcs, Liters, etc.
    notes = Column(Text, nullable=True)
    currency = Column(String, default="LKR", nullable=False)

    # Tariff-linked data (auto-filled from tariff_lines search)
    tariff_line_id = Column(Integer, ForeignKey("tariff_lines.id"), nullable=True, index=True)
    hs_code = Column(String, nullable=True, index=True)
    tariff_description = Column(Text, nullable=True)  # Description from tariff line
    general_duty_rate = Column(String, nullable=True)
    vat_rate = Column(String, nullable=True)
    pal_rate = Column(String, nullable=True)
    cess_rate = Column(String, nullable=True)
    sscl_rate = Column(String, nullable=True)
    excise_rate = Column(String, nullable=True)
    scl_rate = Column(String, nullable=True)

    # Weight and favorite metadata
    weight_val = Column(Numeric(precision=18, scale=4), default=0.0)
    weight_unit = Column(String, default="KG")
    is_favorite = Column(Boolean, default=True, index=True)

    # Pricing fields
    purchase_price = Column(Numeric(precision=18, scale=4), nullable=True)
    price_per_kg = Column(Numeric(precision=18, scale=4), nullable=True)
    total_quantity_kg = Column(Numeric(precision=18, scale=4), nullable=True)
    per_month_qty_kg = Column(Numeric(precision=18, scale=4), nullable=True)
    total_value = Column(Numeric(precision=18, scale=4), nullable=True)  # price_per_kg * total_quantity_kg
    per_month_value = Column(Numeric(precision=18, scale=4), nullable=True)  # price_per_kg * per_month_qty_kg

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    tariff_line = relationship("TariffLine")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String, default="Sri Lanka")  # "India", "Sri Lanka", etc.
    tax_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ShipmentSequence(Base):
    __tablename__ = "shipment_sequences"

    id = Column(Integer, primary_key=True, index=True)
    financial_year = Column(String, unique=True, nullable=False)  # e.g. "2026-27"
    last_sequence = Column(Integer, default=0, nullable=False)


class Shipment(Base):
    __tablename__ = "shipments"

    id: Any = Column(Integer, primary_key=True, index=True)
    shipment_no: Any = Column(String, unique=True, index=True, nullable=False)  # e.g. AEC/10/2026-27
    sequence_number: Any = Column(Integer, nullable=False)
    financial_year: Any = Column(String, nullable=False)  # 2026-27
    shipment_date: Any = Column(String, nullable=True)
    status: Any = Column(String, default="DRAFT")  # DRAFT, CONFIGURED, SHIPPED, COMPLETED, CANCELLED

    # Destination, Currency & Lifecycle Stage Tracker
    destination: Any = Column(String, default="Colombo Port, Sri Lanka")
    currency: Any = Column(String, default="INR")
    current_stage: Any = Column(String, default="1_SHIPMENT_CREATION")

    # Configurations
    usd_rate: Any = Column(Numeric(precision=18, scale=4), default=1.0)
    lkr_inr_rate: Any = Column(Numeric(precision=18, scale=4), default=1.0)
    profit_margin_pct: Any = Column(Numeric(precision=18, scale=4), default=15.0)
    indian_invoice_margin_pct: Any = Column(Numeric(precision=18, scale=4), default=15.0)
    colombo_invoice_margin_pct: Any = Column(Numeric(precision=18, scale=4), default=15.0)
    margin_mode: Any = Column(String, default="MARGIN_ON_REVENUE")  # "MARGIN_ON_REVENUE" or "MARKUP_ON_COST"
    common_expenses_inr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    common_expenses_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    port_expenses_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    freight_allocation_mode: Any = Column(String, default="WEIGHT")  # "WEIGHT" or "QUANTITY"
    notes: Any = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customers = relationship("ShipmentCustomer", back_populates="shipment", cascade="all, delete-orphan")
    products = relationship("ShipmentProduct", back_populates="shipment", cascade="all, delete-orphan")
    actuals = relationship("ShipmentActual", back_populates="shipment", uselist=False, cascade="all, delete-orphan")
    requirements = relationship("ShipmentCustomerRequirement", back_populates="shipment", cascade="all, delete-orphan")
    allocations = relationship("ShipmentVendorAllocation", back_populates="shipment", cascade="all, delete-orphan")
    proforma_items = relationship("ShipmentVendorProformaItem", back_populates="shipment", cascade="all, delete-orphan")
    purchase_orders = relationship("ShipmentPurchaseOrder", back_populates="shipment", cascade="all, delete-orphan")
    vendor_payments = relationship("ShipmentVendorPayment", back_populates="shipment", cascade="all, delete-orphan")
    vendor_deliveries = relationship("ShipmentVendorDelivery", back_populates="shipment", cascade="all, delete-orphan")
    receiving_verifications = relationship("ShipmentReceivingVerification", back_populates="shipment", cascade="all, delete-orphan")
    activity_logs = relationship("ShipmentActivityLog", back_populates="shipment", cascade="all, delete-orphan")
    packing_lists = relationship("ShipmentPackingList", back_populates="shipment", cascade="all, delete-orphan")


class ShipmentCustomer(Base):
    __tablename__ = "shipment_customers"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    allocation_pct = Column(Numeric(precision=18, scale=4), default=0.0)

    shipment = relationship("Shipment", back_populates="customers")
    customer = relationship("Customer")


class ShipmentProduct(Base):
    __tablename__ = "shipment_products"

    id: Any = Column(Integer, primary_key=True, index=True)
    shipment_id: Any = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    customer_id: Any = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)

    product_name: Any = Column(String, nullable=False)
    product_category: Any = Column(String, nullable=True)
    hsn_code: Any = Column(String, nullable=True, index=True)
    item_classification: Any = Column(String, default="NORMAL")  # "NORMAL", "LICENSED", "SCL"
    is_active: Any = Column(Boolean, default=True, index=True)
    stage_status: Any = Column(String, default="REQUESTED")  # STATUS TIMELINE
    quantity: Any = Column(Numeric(precision=18, scale=4), nullable=False, default=1.0)
    weight_val: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    weight_unit: Any = Column(String, default="KG")  # Grams, KG, Pcs
    unit: Any = Column(String, default="PCS")
    purchase_price: Any = Column(Numeric(precision=18, scale=4), nullable=False, default=0.0)
    currency: Any = Column(String, default="INR")  # INR, USD, LKR

    # Detailed Packaging & Weight Fields (matching ProductList / InvoiceGen)
    pkt_size_g: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    no_bags_qty: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    net_weight_kg: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    gross_weight_kg: Any = Column(Numeric(precision=18, scale=4), default=0.0)

    # Customer Quotation & Discount Fields (matching P_1 / P_2)
    discount_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    set_price_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    short_qty: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    short_amt_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    net_settlement_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)

    # Formula Output & Allocation Fields
    freight_allocation_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    port_charges_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    base_price_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    cnf_price: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    general_duty_rate: Any = Column(String, nullable=True)
    vat_rate: Any = Column(String, nullable=True)
    pal_rate: Any = Column(String, nullable=True)
    cess_rate: Any = Column(String, nullable=True)
    sscl_rate: Any = Column(String, nullable=True)

    calculated_duty_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    total_cost_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    indian_price: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    srilankan_price: Any = Column(Numeric(precision=18, scale=4), default=0.0)

    suggested_price: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    final_quotation_price: Any = Column(Numeric(precision=18, scale=4), default=0.0)  # Manually adjustable
    predicted_profit: Any = Column(Numeric(precision=18, scale=4), default=0.0)

    shipment = relationship("Shipment", back_populates="products")
    customer = relationship("Customer")


class ShipmentActual(Base):
    __tablename__ = "shipment_actuals"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), unique=True, nullable=False)

    actual_duty_inr = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_duty_lkr = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_cost_inr = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_cost_lkr = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_revenue_inr = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_revenue_lkr = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_profit_lkr = Column(Numeric(precision=18, scale=4), default=0.0)

    ocr_source_file = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="actuals")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    legal_name = Column(String, nullable=True)
    trade_name = Column(String, nullable=True)
    company_type = Column(String, nullable=True)
    contact_person = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    country = Column(String, default="India")
    gstin = Column(String, nullable=True)
    pan_number = Column(String, nullable=True)
    bank_account_number = Column(String, nullable=True)
    bank_ifsc_code = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    bank_branch = Column(String, nullable=True)
    main_category = Column(String, nullable=True)
    sub_categories = Column(JSON, default=list)
    products_supplied = Column(JSON, default=list)
    status = Column(String, default="Active Supplier")
    created_at = Column(DateTime, default=datetime.utcnow)

    mappings = relationship("VendorProductMapping", back_populates="vendor", cascade="all, delete-orphan")


class VendorProductMapping(Base):
    __tablename__ = "vendor_product_mappings"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    product_category = Column(String, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor", back_populates="mappings")


class ShipmentCustomerRequirement(Base):
    __tablename__ = "shipment_customer_requirements"

    id: Any = Column(Integer, primary_key=True, index=True)
    shipment_id: Any = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    customer_id: Any = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)

    product_name: Any = Column(String, nullable=False)
    hsn_code: Any = Column(String, nullable=True)
    required_quantity: Any = Column(Numeric(precision=18, scale=4), nullable=False, default=1.0)
    unit: Any = Column(String, default="PCS", nullable=False)  # Carton, Pack, Piece, KG, Box
    notes: Any = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="requirements")
    customer = relationship("Customer")
    allocations = relationship("ShipmentVendorAllocation", back_populates="requirement", cascade="all, delete-orphan")
    history = relationship("CustomerRequirementHistory", back_populates="requirement", cascade="all, delete-orphan")


class CustomerRequirementHistory(Base):
    __tablename__ = "customer_requirement_history"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("shipment_customer_requirements.id"), nullable=False, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)

    product_name = Column(String, nullable=False)
    old_quantity = Column(Numeric(precision=18, scale=4), nullable=True)
    new_quantity = Column(Numeric(precision=18, scale=4), nullable=False)
    unit = Column(String, nullable=False)
    action_type = Column(String, nullable=False)  # CREATED, UPDATED, BULK_UPLOAD, ADDED_LATER
    modified_at = Column(DateTime, default=datetime.utcnow)

    requirement = relationship("ShipmentCustomerRequirement", back_populates="history")
    customer = relationship("Customer")


class ShipmentVendorAllocation(Base):
    __tablename__ = "shipment_vendor_allocations"

    id: Any = Column(Integer, primary_key=True, index=True)
    shipment_id: Any = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    requirement_id: Any = Column(Integer, ForeignKey("shipment_customer_requirements.id"), nullable=False, index=True)
    vendor_id: Any = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)

    allocated_quantity: Any = Column(Numeric(precision=18, scale=4), nullable=False, default=1.0)
    allocated_unit: Any = Column(String, default="PCS", nullable=False)
    status: Any = Column(String, default="PENDING_PI")  # PENDING_PI, PI_RECEIVED, CONFIRMED
    notes: Any = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="allocations")
    requirement = relationship("ShipmentCustomerRequirement", back_populates="allocations")
    vendor = relationship("Vendor")
    proforma_items = relationship("ShipmentVendorProformaItem", back_populates="allocation", cascade="all, delete-orphan")


class ShipmentVendorProformaItem(Base):
    __tablename__ = "shipment_vendor_proforma_items"

    id: Any = Column(Integer, primary_key=True, index=True)
    shipment_id: Any = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    allocation_id: Any = Column(Integer, ForeignKey("shipment_vendor_allocations.id"), nullable=True, index=True)
    vendor_id: Any = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)

    product_name: Any = Column(String, nullable=False)
    sku: Any = Column(String, nullable=True)
    hsn_code: Any = Column(String, nullable=True)
    proforma_qty: Any = Column(Numeric(precision=18, scale=4), nullable=False, default=1.0)
    cartons_count: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    units_per_carton: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    unit_weight_val: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    unit_weight_unit: Any = Column(String, default="KG")  # KG, G
    net_weight_kg: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    gross_weight_kg: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    proforma_price: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    mrp: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    discount_pct: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    gst_pct: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    total_payable: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    currency: Any = Column(String, default="INR")
    notes: Any = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="proforma_items")
    allocation = relationship("ShipmentVendorAllocation", back_populates="proforma_items")
    vendor = relationship("Vendor")


class CustomerQuotationItem(Base):
    __tablename__ = "customer_quotation_items"

    id: Any = Column(Integer, primary_key=True, index=True)
    shipment_id: Any = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    requirement_id: Any = Column(Integer, ForeignKey("shipment_customer_requirements.id"), nullable=True, index=True)
    vendor_id: Any = Column(Integer, ForeignKey("vendors.id"), nullable=True, index=True)

    product_name: Any = Column(String, nullable=False)
    hsn_code: Any = Column(String, nullable=True)
    quantity: Any = Column(Numeric(precision=18, scale=4), default=1.0)
    unit: Any = Column(String, default="PCS")
    unit_price_inr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    unit_cost_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    estimated_selling_price_lkr: Any = Column(Numeric(precision=18, scale=4), default=0.0)
    customer_target_price: Any = Column(Numeric(precision=18, scale=4), nullable=True)
    approval_status: Any = Column(String, default="PENDING")  # PENDING, APPROVED, REJECTED, NEGOTIATED
    notes: Any = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shipment = relationship("Shipment")
    requirement = relationship("ShipmentCustomerRequirement")
    vendor = relationship("Vendor")


class CustomerQuotationHistory(Base):
    __tablename__ = "customer_quotation_history"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    quotation_item_id = Column(Integer, ForeignKey("customer_quotation_items.id"), nullable=True, index=True)

    product_name = Column(String, nullable=False)
    action_type = Column(String, nullable=False)  # APPROVED, REMOVED, PRICE_CHANGE_REQUESTED
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment")
    quotation_item = relationship("CustomerQuotationItem")


class ShipmentPurchaseOrder(Base):
    __tablename__ = "shipment_purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)

    po_number = Column(String, nullable=False, index=True)
    po_date = Column(String, nullable=True)
    total_amount = Column(Numeric(precision=18, scale=4), default=0.0)
    currency = Column(String, default="INR")
    status = Column(String, default="CONFIRMED")  # DRAFT, ISSUED, CONFIRMED, CANCELLED
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="purchase_orders")
    vendor = relationship("Vendor")


class ShipmentVendorPayment(Base):
    __tablename__ = "shipment_vendor_payments"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)

    payment_ref = Column(String, nullable=False, index=True)  # TT / LC / Bank Reference
    payment_type = Column(String, default="ADVANCE")  # ADVANCE, BALANCE, FULL
    amount_paid = Column(Numeric(precision=18, scale=4), default=0.0)
    currency = Column(String, default="INR")
    payment_date = Column(String, nullable=True)
    payment_method = Column(String, default="BANK_TT")  # BANK_TT, LETTER_OF_CREDIT, UPI
    status = Column(String, default="COMPLETED")  # PENDING, COMPLETED
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="vendor_payments")
    vendor = relationship("Vendor")


class ShipmentVendorDelivery(Base):
    __tablename__ = "shipment_vendor_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)

    tracking_number = Column(String, nullable=True)  # Waybill / LR Number
    container_number = Column(String, nullable=True)
    vessel_name = Column(String, nullable=True)
    dispatch_date = Column(String, nullable=True)
    eta_date = Column(String, nullable=True)
    actual_arrival_date = Column(String, nullable=True)
    delivery_status = Column(String, default="DISPATCHED")  # DISPATCHED, IN_TRANSIT, DELIVERED
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="vendor_deliveries")
    vendor = relationship("Vendor")


class ShipmentReceivingVerification(Base):
    __tablename__ = "shipment_receiving_verifications"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    product_name = Column(String, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)

    expected_qty = Column(Numeric(precision=18, scale=4), default=0.0)
    received_qty = Column(Numeric(precision=18, scale=4), default=0.0)
    expected_cartons = Column(Numeric(precision=18, scale=4), default=0.0)
    received_cartons = Column(Numeric(precision=18, scale=4), default=0.0)
    received_pieces = Column(Numeric(precision=18, scale=4), default=0.0)
    expected_net_wt_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    verified_net_wt_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    expected_gross_wt_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    verified_gross_wt_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    weight_variance_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    shortage_qty = Column(Numeric(precision=18, scale=4), default=0.0)
    damaged_qty = Column(Numeric(precision=18, scale=4), default=0.0)
    missing_qty = Column(Numeric(precision=18, scale=4), default=0.0)
    excess_qty = Column(Numeric(precision=18, scale=4), default=0.0)
    verification_status = Column(String, default="VERIFIED_OK")  # VERIFIED_OK, WEIGHT_MISMATCH, SHORTAGE, DAMAGED
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="receiving_verifications")
    vendor = relationship("Vendor")


class ShipmentActivityLog(Base):
    __tablename__ = "shipment_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)

    stage_name = Column(String, nullable=False)
    action_type = Column(String, nullable=False)  # CREATE, UPDATE, ALLOCATE, UPLOAD, PAY, RECEIVE, REMOVE
    action_title = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    performed_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment", back_populates="activity_logs")


class ShipmentProductRemovalHistory(Base):
    __tablename__ = "shipment_product_removal_history"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("shipment_products.id"), nullable=False, index=True)

    product_name = Column(String, nullable=False)
    quantity = Column(Numeric(precision=18, scale=4), default=0.0)
    removed_by = Column(String, default="System User")
    removed_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text, nullable=True)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)

    shipment = relationship("Shipment")
    product = relationship("ShipmentProduct")


class ShipmentActualVendorInvoiceItem(Base):
    __tablename__ = "shipment_actual_vendor_invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)

    product_name = Column(String, nullable=False)
    proforma_price = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_price = Column(Numeric(precision=18, scale=4), default=0.0)
    proforma_cartons = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_cartons = Column(Numeric(precision=18, scale=4), default=0.0)
    proforma_units = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_units = Column(Numeric(precision=18, scale=4), default=0.0)
    proforma_net_weight_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_net_weight_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    proforma_gross_weight_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    actual_gross_weight_kg = Column(Numeric(precision=18, scale=4), default=0.0)

    price_mismatch = Column(Boolean, default=False)
    qty_mismatch = Column(Boolean, default=False)
    weight_mismatch = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment")
    vendor = relationship("Vendor")


class PackingListSequence(Base):
    __tablename__ = "packing_list_sequences"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)

    pl_number = Column(String, unique=True, nullable=False, index=True)  # e.g. PL-001, PL-002...
    sequence_val = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    shipment = relationship("Shipment")
    vendor = relationship("Vendor")


class ShipmentPackingList(Base):
    __tablename__ = "shipment_packing_lists"

    id = Column(Integer, primary_key=True, index=True)
    shipment_id = Column(Integer, ForeignKey("shipments.id"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    pl_number = Column(String, nullable=False, index=True)  # PL-001, PL-002, ..., PL-015, PL-016
    generated_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)

    shipment = relationship("Shipment", back_populates="packing_lists")
    vendor = relationship("Vendor")
    items = relationship("ShipmentPackingListItem", back_populates="packing_list", cascade="all, delete-orphan")


class ShipmentPackingListItem(Base):
    __tablename__ = "shipment_packing_list_items"

    id = Column(Integer, primary_key=True, index=True)
    packing_list_id = Column(Integer, ForeignKey("shipment_packing_lists.id"), nullable=False, index=True)
    product_name = Column(String, nullable=False)
    cartons_count = Column(Numeric(precision=18, scale=4), default=0.0)
    qty_units = Column(Numeric(precision=18, scale=4), default=0.0)
    net_weight_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    gross_weight_kg = Column(Numeric(precision=18, scale=4), default=0.0)
    cbm = Column(Numeric(precision=18, scale=4), default=0.0)
    notes = Column(Text, nullable=True)

    packing_list = relationship("ShipmentPackingList", back_populates="items")


