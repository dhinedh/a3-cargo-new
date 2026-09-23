from typing import Dict, Any, List, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from models import (
    Shipment, Customer, ShipmentCustomer, ShipmentProduct,
    ShipmentCustomerRequirement, ShipmentVendorAllocation,
    ShipmentVendorProformaItem, ShipmentPurchaseOrder, ShipmentVendorPayment,
    ShipmentVendorDelivery, ShipmentReceivingVerification, ShipmentPackingList,
    ShipmentPackingListItem, ShipmentActual, Vendor, TariffLine, ItemEntry,
    ShipmentActivityLog, ShipmentMilestone
)

INDIA_COLOMBO_MILESTONES = [
    ("1_FOCUS_BILL", "Focus Bill Filing", 1),
    ("2_SHIPPING_BILL", "Shipping Bill / ICEGATE Filing", 2),
    ("3_WAY_BILL", "Way Bill / E-Way Bill", 3),
    ("4_TRANSPORT", "Transport Movement", 4),
    ("5_CONTAINER_PROC", "LCL / FCL Container Process", 5),
    ("6_CRO", "CRO (Container Release Order)", 6),
    ("7_EXAMINATION", "Customs Examination", 7),
    ("8_STUFFING", "Container Stuffing", 8),
    ("9_SEAL", "Container Seal Verification", 9),
    ("10_GATE_OUT", "Port Gate Out", 10),
    ("11_FORM_13", "Form 13 Issuance", 11),
    ("12_VGM", "VGM (Verified Gross Mass)", 12),
    ("13_BL_DRAFT", "BL Draft & Checklist Verification", 13),
    ("14_PO_CREATED", "Purchase Orders Issued to Vendors", 14),
    ("15_VENDOR_DELIVERY", "Vendor Goods Dispatched & Delivered", 15),
    ("16_PACKING_LIST", "Packing List (PL-001) Generated", 16),
    ("17_INDIAN_INVOICE", "Indian Commercial Invoice Issued", 17),
    ("18_COLOMBO_INVOICE", "Colombo Invoice Prepared", 18),
    ("19_COO_PREFERENCE", "COO & Tariff Preferences (ISFTA/SAFTA)", 19),
    ("20_BL_FINAL", "BL Confirmation & Final BL Issued", 20),
    ("21_CLEARING_EXPENSE", "Vinayaka Clearing Expense Invoice", 21),
    ("22_DELIVERY_ORDER", "Delivery Order (DO) Issued", 22),
    ("23_EGM_CLOSURE", "EGM Filing & Shipment Closure", 23)
]

def init_shipment_milestones(db: Session, shipment_id: int, workflow_mode: str = "SEA_FCL") -> List[ShipmentMilestone]:
    """Initializes standard 23 India -> Colombo shipment tracking milestones if not present."""
    existing = db.query(ShipmentMilestone).filter(ShipmentMilestone.shipment_id == shipment_id).all()
    if existing:
        return existing

    created = []
    for code, name, seq in INDIA_COLOMBO_MILESTONES:
        m = ShipmentMilestone(
            shipment_id=shipment_id,
            milestone_code=code,
            milestone_name=name,
            sequence=seq,
            status="PENDING",
            workflow_mode=workflow_mode,
            owner_person="Operations Manager"
        )
        db.add(m)
        created.append(m)
    
    db.commit()
    return created


def sync_milestones_from_shipment_actions(db: Session, shipment: Shipment):
    """Auto-updates milestone statuses based on actual backend documents and data presence."""
    milestones = db.query(ShipmentMilestone).filter(ShipmentMilestone.shipment_id == shipment.id).all()
    if not milestones:
        milestones = init_shipment_milestones(db, shipment.id)

    ms_dict = {m.milestone_code: m for m in milestones}
    dirty = False

    # 1. Check POs
    if shipment.purchase_orders and len(shipment.purchase_orders) > 0:
        po_ms = ms_dict.get("14_PO_CREATED")
        if po_ms and po_ms.status != "COMPLETED":
            po_ms.status = "COMPLETED"
            po_ms.actual_date = datetime.utcnow()
            po_ms.remarks = f"Auto-completed: {len(shipment.purchase_orders)} PO(s) created."
            dirty = True

    # 2. Check Vendor Deliveries
    if shipment.vendor_deliveries and len(shipment.vendor_deliveries) > 0:
        deliv_ms = ms_dict.get("15_VENDOR_DELIVERY")
        if deliv_ms and deliv_ms.status != "COMPLETED":
            deliv_ms.status = "COMPLETED"
            deliv_ms.actual_date = datetime.utcnow()
            deliv_ms.remarks = f"Auto-completed: {len(shipment.vendor_deliveries)} Delivery record(s) logged."
            dirty = True

    # 3. Check Packing Lists
    if shipment.packing_lists and len(shipment.packing_lists) > 0:
        pl_ms = ms_dict.get("16_PACKING_LIST")
        if pl_ms and pl_ms.status != "COMPLETED":
            pl_ms.status = "COMPLETED"
            pl_ms.actual_date = datetime.utcnow()
            pl_ms.remarks = f"Auto-completed: Packing list {shipment.packing_lists[0].pl_number} generated."
            dirty = True

    # 4. Check Invoices & Products
    if shipment.products and len(shipment.products) > 0:
        ind_ms = ms_dict.get("17_INDIAN_INVOICE")
        if ind_ms and ind_ms.status != "COMPLETED":
            ind_ms.status = "COMPLETED"
            ind_ms.actual_date = datetime.utcnow()
            ind_ms.remarks = "Auto-completed: Indian invoice data active."
            dirty = True

        cmb_ms = ms_dict.get("18_COLOMBO_INVOICE")
        if cmb_ms and cmb_ms.status != "COMPLETED":
            cmb_ms.status = "COMPLETED"
            cmb_ms.actual_date = datetime.utcnow()
            cmb_ms.remarks = "Auto-completed: Colombo invoice duty & margin structure ready."
            dirty = True

    if dirty:
        db.commit()


def build_traceability_graph(db: Session, entity_type: str, entity_id: int) -> Dict[str, Any]:
    """
    Constructs a complete, dynamic hierarchical relationship graph for any root entity.
    Supports drill-down from Shipment, Customer, Requirement, Product, Vendor, PO, PI, Delivery,
    Packing List, Invoices, Expenses, Financials, Milestones, and Activities.
    """
    type_clean = str(entity_type).upper().strip()

    if type_clean == "SHIPMENT":
        return _build_shipment_graph(db, entity_id)
    elif type_clean in ["FINANCIAL", "P_AND_L", "PROFIT_LOSS"]:
        return _build_financial_graph(db, entity_id)
    elif type_clean in ["PRODUCT", "SHIPMENT_PRODUCT"]:
        return _build_product_graph(db, entity_id)
    elif type_clean == "VENDOR":
        return _build_vendor_graph(db, entity_id)
    elif type_clean == "CUSTOMER":
        return _build_customer_graph(db, entity_id)
    elif type_clean in ["INVOICE", "INDIAN_INVOICE", "COLOMBO_INVOICE"]:
        return _build_invoice_graph(db, entity_id)
    elif type_clean == "PO":
        return _build_po_graph(db, entity_id)
    elif type_clean in ["PI", "PROFORMA_ITEM"]:
        return _build_pi_graph(db, entity_id)
    elif type_clean == "PACKING_LIST":
        return _build_packing_list_graph(db, entity_id)
    elif type_clean == "EXPENSE":
        return _build_expense_graph(db, entity_id)
    else:
        # Fallback to shipment graph if entity_id is a shipment
        return _build_shipment_graph(db, entity_id)


def _build_shipment_graph(db: Session, shipment_id: int) -> Dict[str, Any]:
    s = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not s:
        return {"error": "Shipment not found", "entity_type": "SHIPMENT", "entity_id": shipment_id}

    sync_milestones_from_shipment_actions(db, s)

    lkr_inr_rate = float(s.lkr_inr_rate or 1.0)
    usd_rate = float(s.usd_rate or 1.0)

    # Customers
    cust_nodes = []
    for sc in s.customers:
        c = sc.customer
        if c:
            cust_nodes.append({
                "relationship": "customer",
                "entity_type": "CUSTOMER",
                "entity_id": c.id,
                "label": f"Customer: {c.name}",
                "ref_number": c.code,
                "status": "ACTIVE",
                "metadata": {"allocation_pct": float(sc.allocation_pct or 0.0), "email": c.email, "phone": c.phone}
            })

    # Requirements
    req_nodes = []
    for req in s.requirements:
        c_name = req.customer.name if req.customer else "Customer"
        alloc_count = len(req.allocations)
        req_nodes.append({
            "relationship": "requirement",
            "entity_type": "REQUIREMENT",
            "entity_id": req.id,
            "label": f"Req: {req.product_name}",
            "ref_number": req.hsn_code or "No HSN",
            "amount": float(req.required_quantity or 0.0),
            "currency": req.unit,
            "status": "ALLOCATED" if alloc_count > 0 else "UNALLOCATED",
            "metadata": {"customer_name": c_name, "allocations_count": alloc_count}
        })

    # Products & Financials
    total_purchase_inr = 0.0
    total_duty_lkr = 0.0
    total_freight_lkr = 0.0
    total_cost_lkr = 0.0
    total_sales_lkr = 0.0
    total_profit_lkr = 0.0

    prod_nodes = []
    for p in s.products:
        q = float(p.quantity or 1.0)
        p_price = float(p.purchase_price or 0.0)
        curr = (p.currency or "INR").upper()

        if curr == "LKR":
            base_lkr = p_price
        elif curr == "INR":
            base_lkr = p_price / lkr_inr_rate if lkr_inr_rate != 0 else p_price
        elif curr == "USD":
            base_lkr = p_price * usd_rate
        else:
            base_lkr = p_price

        purchase_inr = p_price * q if curr == "INR" else (base_lkr * lkr_inr_rate * q)
        duty_lkr = float(p.calculated_duty_lkr or 0.0) * q
        freight_lkr = float(p.freight_allocation_lkr or 0.0) * q
        cost_lkr = float(p.total_cost_lkr or 0.0) * q
        sales_lkr = float(p.net_settlement_lkr or 0.0)
        profit_lkr = float(p.predicted_profit or 0.0)

        total_purchase_inr += purchase_inr
        total_duty_lkr += duty_lkr
        total_freight_lkr += freight_lkr
        total_cost_lkr += cost_lkr
        total_sales_lkr += sales_lkr
        total_profit_lkr += profit_lkr

        prod_nodes.append({
            "relationship": "product",
            "entity_type": "PRODUCT",
            "entity_id": p.id,
            "label": p.product_name,
            "ref_number": p.hsn_code or "-",
            "amount": float(p.final_quotation_price or 0.0),
            "currency": "LKR",
            "status": p.stage_status or "REQUESTED",
            "metadata": {
                "quantity": q,
                "unit": p.unit or "PCS",
                "purchase_price": p_price,
                "purchase_currency": curr,
                "calculated_duty_lkr": float(p.calculated_duty_lkr or 0.0),
                "suggested_price": float(p.suggested_price or 0.0),
                "net_settlement_lkr": sales_lkr,
                "predicted_profit_lkr": profit_lkr
            }
        })

    # Vendors & Allocations
    vendor_nodes = []
    seen_vendors = set()
    for alloc in s.allocations:
        v = alloc.vendor
        if v and v.id not in seen_vendors:
            seen_vendors.add(v.id)
            vendor_nodes.append({
                "relationship": "vendor",
                "entity_type": "VENDOR",
                "entity_id": v.id,
                "label": f"Vendor: {v.name}",
                "ref_number": v.code,
                "status": v.status or "ACTIVE",
                "metadata": {"gstin": v.gstin, "contact_person": v.contact_person}
            })

    # Purchase Orders
    po_nodes = []
    for po in s.purchase_orders:
        po_nodes.append({
            "relationship": "purchase_order",
            "entity_type": "PO",
            "entity_id": po.id,
            "label": f"PO: {po.po_number}",
            "ref_number": po.vendor.name if po.vendor else "-",
            "amount": float(po.total_amount or 0.0),
            "currency": po.currency or "INR",
            "status": po.status or "CONFIRMED",
            "metadata": {"po_date": po.po_date}
        })

    # Proforma Items
    pi_nodes = []
    for pi in s.proforma_items:
        pi_nodes.append({
            "relationship": "proforma_item",
            "entity_type": "PI",
            "entity_id": pi.id,
            "label": f"PI Item: {pi.product_name}",
            "ref_number": pi.vendor.name if pi.vendor else "-",
            "amount": float(pi.total_payable or 0.0),
            "currency": pi.currency or "INR",
            "status": "RECEIVED",
            "metadata": {"proforma_qty": float(pi.proforma_qty or 0.0), "proforma_price": float(pi.proforma_price or 0.0)}
        })

    # Vendor Deliveries
    delivery_nodes = []
    for d in s.vendor_deliveries:
        delivery_nodes.append({
            "relationship": "delivery",
            "entity_type": "VENDOR_DELIVERY",
            "entity_id": d.id,
            "label": f"Delivery: Waybill {d.tracking_number or 'N/A'}",
            "ref_number": d.vendor.name if d.vendor else "-",
            "status": d.delivery_status or "DISPATCHED",
            "metadata": {"container_number": d.container_number, "dispatch_date": d.dispatch_date}
        })

    # Packing Lists
    pl_nodes = []
    for pl in s.packing_lists:
        pl_nodes.append({
            "relationship": "packing_list",
            "entity_type": "PACKING_LIST",
            "entity_id": pl.id,
            "label": f"Packing List: {pl.pl_number}",
            "ref_number": pl.vendor.name if pl.vendor else "All Vendors",
            "status": "GENERATED",
            "metadata": {"generated_at": pl.generated_at.isoformat() if pl.generated_at else None, "items_count": len(pl.items)}
        })

    # Sales Invoices
    invoice_nodes = [
        {
            "relationship": "invoice",
            "entity_type": "INDIAN_INVOICE",
            "entity_id": s.id,
            "label": f"Indian Export Invoice ({s.shipment_no})",
            "ref_number": "INR Invoice",
            "amount": total_purchase_inr,
            "currency": "INR",
            "status": "GENERATED"
        },
        {
            "relationship": "invoice",
            "entity_type": "COLOMBO_INVOICE",
            "entity_id": s.id,
            "label": f"Colombo Import Invoice ({s.shipment_no})",
            "ref_number": "LKR Invoice",
            "amount": total_sales_lkr,
            "currency": "LKR",
            "status": "GENERATED"
        }
    ]

    # Expenses
    common_exp_lkr = float(s.common_expenses_lkr or 0.0)
    if s.common_expenses_inr and float(s.common_expenses_inr) > 0:
        common_exp_lkr += float(s.common_expenses_inr) * (1.0 / lkr_inr_rate if lkr_inr_rate != 0 else 1.0)

    port_exp_lkr = float(getattr(s, "port_expenses_lkr", 0.0) or 0.0)

    expense_nodes = [
        {
            "relationship": "expense",
            "entity_type": "EXPENSE",
            "entity_id": 1,
            "label": "Common Ocean/Air Freight Expenses",
            "amount": common_exp_lkr,
            "currency": "LKR",
            "status": "ALLOCATED",
            "metadata": {"expenses_inr": float(s.common_expenses_inr or 0.0), "expenses_lkr": float(s.common_expenses_lkr or 0.0)}
        },
        {
            "relationship": "expense",
            "entity_type": "EXPENSE",
            "entity_id": 2,
            "label": "Colombo Port & Clearance Expenses",
            "amount": port_exp_lkr,
            "currency": "LKR",
            "status": "ALLOCATED"
        }
    ]

    # Financial P&L
    purchase_lkr = total_purchase_inr / lkr_inr_rate if lkr_inr_rate != 0 else total_purchase_inr
    total_investment_lkr = purchase_lkr + common_exp_lkr + port_exp_lkr + total_duty_lkr
    profit_pct = (total_profit_lkr / total_sales_lkr * 100.0) if total_sales_lkr > 0 else 0.0

    financial_node = {
        "relationship": "financial",
        "entity_type": "FINANCIAL",
        "entity_id": s.id,
        "label": f"Shipment P&L ({s.shipment_no})",
        "amount": total_profit_lkr,
        "currency": "LKR",
        "status": "PROFITABLE" if total_profit_lkr >= 0 else "LOSS",
        "metadata": {
            "purchase_inr": total_purchase_inr,
            "purchase_lkr": purchase_lkr,
            "total_duty_lkr": total_duty_lkr,
            "common_freight_lkr": common_exp_lkr,
            "port_expenses_lkr": port_exp_lkr,
            "total_investment_lkr": total_investment_lkr,
            "total_sales_lkr": total_sales_lkr,
            "net_profit_lkr": total_profit_lkr,
            "profit_margin_pct": profit_pct
        }
    }

    # Milestones Summary
    ms_count = len(s.milestones)
    completed_ms = sum(1 for m in s.milestones if m.status == "COMPLETED")
    milestone_summary_node = {
        "relationship": "milestone_summary",
        "entity_type": "MILESTONE",
        "entity_id": s.id,
        "label": f"Operational Progress ({completed_ms}/{ms_count} Milestones)",
        "status": s.status or "DRAFT",
        "metadata": {"total_milestones": ms_count, "completed": completed_ms, "stage": s.current_stage}
    }

    return {
        "root": {
            "entity_type": "SHIPMENT",
            "entity_id": s.id,
            "label": f"Shipment {s.shipment_no}",
            "ref_number": s.financial_year,
            "status": s.status,
            "date": s.shipment_date,
            "metadata": {
                "destination": s.destination,
                "usd_rate": usd_rate,
                "lkr_inr_rate": lkr_inr_rate,
                "profit_margin_pct": float(s.profit_margin_pct or 15.0),
                "margin_mode": s.margin_mode
            }
        },
        "children": [
            financial_node,
            milestone_summary_node,
            {"group": "Customers", "items": cust_nodes},
            {"group": "Customer Requirements", "items": req_nodes},
            {"group": "Products & Pricing", "items": prod_nodes},
            {"group": "Vendors & Sourcing", "items": vendor_nodes},
            {"group": "Purchase Orders & PIs", "items": po_nodes + pi_nodes},
            {"group": "Deliveries & Shipping", "items": delivery_nodes + pl_nodes},
            {"group": "Invoices", "items": invoice_nodes},
            {"group": "Expenses", "items": expense_nodes}
        ]
    }


def _build_financial_graph(db: Session, shipment_id: int) -> Dict[str, Any]:
    s_graph = _build_shipment_graph(db, shipment_id)
    if "error" in s_graph:
        return s_graph
    
    root = s_graph["root"]
    financial_items = []
    
    for group in s_graph.get("children", []):
        if isinstance(group, dict) and "group" in group:
            if group["group"] in ["Products & Pricing", "Expenses", "Invoices"]:
                financial_items.extend(group.get("items", []))
        elif isinstance(group, dict) and group.get("entity_type") == "FINANCIAL":
            financial_meta = group.get("metadata", {})
            root_fin = {
                "entity_type": "FINANCIAL",
                "entity_id": shipment_id,
                "label": f"P&L Statement - {root['label']}",
                "ref_number": root['ref_number'],
                "amount": group.get("amount", 0.0),
                "currency": "LKR",
                "status": group.get("status"),
                "metadata": financial_meta
            }
            return {
                "root": root_fin,
                "children": [
                    {
                        "group": "Parent Shipment",
                        "items": [root]
                    },
                    {
                        "group": "Financial Streams & Items",
                        "items": financial_items
                    }
                ]
            }

    return s_graph


def _build_product_graph(db: Session, product_id: int) -> Dict[str, Any]:
    p = db.query(ShipmentProduct).filter(ShipmentProduct.id == product_id).first()
    if not p:
        return {"error": "Product not found", "entity_type": "PRODUCT", "entity_id": product_id}

    s = p.shipment
    lkr_inr_rate = float(s.lkr_inr_rate or 1.0) if s else 3.65
    q = float(p.quantity or 1.0)
    p_price = float(p.purchase_price or 0.0)
    curr = (p.currency or "INR").upper()
    sales_lkr = float(p.net_settlement_lkr or 0.0)
    profit_lkr = float(p.predicted_profit or 0.0)

    # Tariff details
    tariff_line = None
    if p.hsn_code:
        clean = p.hsn_code.replace(".", "")
        tariff_line = db.query(TariffLine).filter(or_(TariffLine.hs_code == p.hsn_code, TariffLine.hs_code == clean)).first()

    # Vendor allocations for this product name
    alloc_nodes = []
    if s:
        allocs = db.query(ShipmentVendorAllocation).filter(
            ShipmentVendorAllocation.shipment_id == s.id
        ).all()
        for a in allocs:
            if a.requirement and a.requirement.product_name.lower() == p.product_name.lower():
                v = a.vendor
                alloc_nodes.append({
                    "relationship": "vendor_allocation",
                    "entity_type": "VENDOR_ALLOCATION",
                    "entity_id": a.id,
                    "label": f"Allocated Vendor: {v.name if v else 'Vendor'}",
                    "amount": float(a.allocated_quantity or 0.0),
                    "currency": a.allocated_unit,
                    "status": a.status
                })

    return {
        "root": {
            "entity_type": "PRODUCT",
            "entity_id": p.id,
            "label": p.product_name,
            "ref_number": p.hsn_code or "No HSN",
            "amount": sales_lkr,
            "currency": "LKR",
            "status": p.stage_status or "ACTIVE",
            "metadata": {
                "quantity": q,
                "unit": p.unit or "PCS",
                "purchase_price": p_price,
                "purchase_currency": curr,
                "base_price_lkr": float(p.base_price_lkr or 0.0),
                "freight_allocation_lkr": float(p.freight_allocation_lkr or 0.0),
                "calculated_duty_lkr": float(p.calculated_duty_lkr or 0.0),
                "total_cost_lkr": float(p.total_cost_lkr or 0.0),
                "suggested_price": float(p.suggested_price or 0.0),
                "final_quotation_price": float(p.final_quotation_price or 0.0),
                "predicted_profit": profit_lkr
            }
        },
        "children": [
            {
                "group": "Parent Shipment",
                "items": [
                    {
                        "relationship": "shipment",
                        "entity_type": "SHIPMENT",
                        "entity_id": s.id if s else 0,
                        "label": f"Shipment {s.shipment_no}" if s else "Shipment",
                        "ref_number": s.financial_year if s else "",
                        "status": s.status if s else ""
                    }
                ]
            },
            {
                "group": "Tariff & Tax levies",
                "items": [
                    {
                        "relationship": "tariff_line",
                        "entity_type": "TARIFF_LINE",
                        "entity_id": tariff_line.id if tariff_line else 0,
                        "label": f"HS {p.hsn_code}: {tariff_line.description[:30] if tariff_line else 'Tariff Record'}",
                        "status": "VERIFIED" if (tariff_line and tariff_line.is_verified) else "UNVERIFIED",
                        "metadata": {
                            "gen_duty": p.general_duty_rate,
                            "vat": p.vat_rate,
                            "pal": p.pal_rate,
                            "cess": p.cess_rate,
                            "sscl": p.sscl_rate
                        }
                    }
                ]
            },
            {
                "group": "Vendor Allocations",
                "items": alloc_nodes
            }
        ]
    }


def _build_vendor_graph(db: Session, vendor_id: int) -> Dict[str, Any]:
    v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not v:
        return {"error": "Vendor not found", "entity_type": "VENDOR", "entity_id": vendor_id}

    allocs = db.query(ShipmentVendorAllocation).filter(ShipmentVendorAllocation.vendor_id == vendor_id).all()
    shipment_ids = list(set(a.shipment_id for a in allocs))

    shipment_nodes = []
    shipments = db.query(Shipment).filter(Shipment.id.in_(shipment_ids)).all() if shipment_ids else []
    for s in shipments:
        shipment_nodes.append({
            "relationship": "shipment",
            "entity_type": "SHIPMENT",
            "entity_id": s.id,
            "label": f"Shipment {s.shipment_no}",
            "ref_number": s.financial_year,
            "status": s.status,
            "date": s.shipment_date
        })

    po_list = db.query(ShipmentPurchaseOrder).filter(ShipmentPurchaseOrder.vendor_id == vendor_id).all()
    po_nodes = [
        {
            "relationship": "purchase_order",
            "entity_type": "PO",
            "entity_id": po.id,
            "label": f"PO: {po.po_number}",
            "amount": float(po.total_amount or 0.0),
            "currency": po.currency or "INR",
            "status": po.status
        }
        for po in po_list
    ]

    deliv_list = db.query(ShipmentVendorDelivery).filter(ShipmentVendorDelivery.vendor_id == vendor_id).all()
    deliv_nodes = [
        {
            "relationship": "delivery",
            "entity_type": "VENDOR_DELIVERY",
            "entity_id": d.id,
            "label": f"Waybill {d.tracking_number or 'N/A'}",
            "status": d.delivery_status,
            "metadata": {"container_number": d.container_number, "dispatch_date": d.dispatch_date}
        }
        for d in deliv_list
    ]

    return {
        "root": {
            "entity_type": "VENDOR",
            "entity_id": v.id,
            "label": f"Vendor: {v.name}",
            "ref_number": v.code,
            "status": v.status or "ACTIVE",
            "metadata": {
                "gstin": v.gstin,
                "pan_number": v.pan_number,
                "contact_person": v.contact_person,
                "email": v.email,
                "bank_name": v.bank_name
            }
        },
        "children": [
            {"group": "Related Shipments", "items": shipment_nodes},
            {"group": "Purchase Orders", "items": po_nodes},
            {"group": "Vendor Deliveries", "items": deliv_nodes}
        ]
    }


def _build_customer_graph(db: Session, customer_id: int) -> Dict[str, Any]:
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        return {"error": "Customer not found", "entity_type": "CUSTOMER", "entity_id": customer_id}

    scs = db.query(ShipmentCustomer).filter(ShipmentCustomer.customer_id == customer_id).all()
    shipment_ids = list(set(sc.shipment_id for sc in scs))

    shipment_nodes = []
    shipments = db.query(Shipment).filter(Shipment.id.in_(shipment_ids)).all() if shipment_ids else []
    for s in shipments:
        shipment_nodes.append({
            "relationship": "shipment",
            "entity_type": "SHIPMENT",
            "entity_id": s.id,
            "label": f"Shipment {s.shipment_no}",
            "ref_number": s.financial_year,
            "status": s.status,
            "date": s.shipment_date
        })

    return {
        "root": {
            "entity_type": "CUSTOMER",
            "entity_id": c.id,
            "label": f"Customer: {c.name}",
            "ref_number": c.code,
            "status": "ACTIVE",
            "metadata": {"email": c.email, "phone": c.phone, "address": c.address, "tax_id": c.tax_id}
        },
        "children": [
            {"group": "Customer Shipments", "items": shipment_nodes}
        ]
    }


def _build_invoice_graph(db: Session, shipment_id: int) -> Dict[str, Any]:
    return _build_shipment_graph(db, shipment_id)


def _build_po_graph(db: Session, po_id: int) -> Dict[str, Any]:
    po = db.query(ShipmentPurchaseOrder).filter(ShipmentPurchaseOrder.id == po_id).first()
    if not po:
        return {"error": "PO not found", "entity_type": "PO", "entity_id": po_id}

    s = po.shipment
    v = po.vendor
    return {
        "root": {
            "entity_type": "PO",
            "entity_id": po.id,
            "label": f"PO: {po.po_number}",
            "ref_number": po.po_date or "",
            "amount": float(po.total_amount or 0.0),
            "currency": po.currency or "INR",
            "status": po.status or "CONFIRMED"
        },
        "children": [
            {
                "group": "Shipment & Vendor Context",
                "items": [
                    {
                        "relationship": "shipment",
                        "entity_type": "SHIPMENT",
                        "entity_id": s.id if s else 0,
                        "label": f"Shipment {s.shipment_no}" if s else "Shipment",
                        "status": s.status if s else ""
                    },
                    {
                        "relationship": "vendor",
                        "entity_type": "VENDOR",
                        "entity_id": v.id if v else 0,
                        "label": f"Vendor: {v.name}" if v else "Vendor",
                        "ref_number": v.code if v else ""
                    }
                ]
            }
        ]
    }


def _build_pi_graph(db: Session, pi_id: int) -> Dict[str, Any]:
    pi = db.query(ShipmentVendorProformaItem).filter(ShipmentVendorProformaItem.id == pi_id).first()
    if not pi:
        return {"error": "PI Item not found", "entity_type": "PI", "entity_id": pi_id}

    s = pi.shipment
    v = pi.vendor
    return {
        "root": {
            "entity_type": "PI",
            "entity_id": pi.id,
            "label": f"PI Item: {pi.product_name}",
            "ref_number": pi.hsn_code or "",
            "amount": float(pi.total_payable or 0.0),
            "currency": pi.currency or "INR",
            "status": "RECEIVED",
            "metadata": {"proforma_qty": float(pi.proforma_qty or 0.0), "proforma_price": float(pi.proforma_price or 0.0)}
        },
        "children": [
            {
                "group": "Shipment & Vendor Context",
                "items": [
                    {
                        "relationship": "shipment",
                        "entity_type": "SHIPMENT",
                        "entity_id": s.id if s else 0,
                        "label": f"Shipment {s.shipment_no}" if s else "Shipment"
                    },
                    {
                        "relationship": "vendor",
                        "entity_type": "VENDOR",
                        "entity_id": v.id if v else 0,
                        "label": f"Vendor: {v.name}" if v else "Vendor"
                    }
                ]
            }
        ]
    }


def _build_packing_list_graph(db: Session, pl_id: int) -> Dict[str, Any]:
    pl = db.query(ShipmentPackingList).filter(ShipmentPackingList.id == pl_id).first()
    if not pl:
        return {"error": "Packing List not found", "entity_type": "PACKING_LIST", "entity_id": pl_id}

    s = pl.shipment
    item_nodes = [
        {
            "relationship": "packing_item",
            "entity_type": "PACKING_ITEM",
            "entity_id": item.id,
            "label": item.product_name,
            "amount": float(item.cartons_count or 0.0),
            "currency": "Cartons",
            "metadata": {"net_weight_kg": float(item.net_weight_kg or 0.0), "gross_weight_kg": float(item.gross_weight_kg or 0.0), "cbm": float(item.cbm or 0.0)}
        }
        for item in pl.items
    ]

    return {
        "root": {
            "entity_type": "PACKING_LIST",
            "entity_id": pl.id,
            "label": f"Packing List: {pl.pl_number}",
            "ref_number": pl.vendor.name if pl.vendor else "All Vendors",
            "status": "GENERATED"
        },
        "children": [
            {
                "group": "Parent Shipment",
                "items": [
                    {
                        "relationship": "shipment",
                        "entity_type": "SHIPMENT",
                        "entity_id": s.id if s else 0,
                        "label": f"Shipment {s.shipment_no}" if s else "Shipment"
                    }
                ]
            },
            {
                "group": "Packed Items",
                "items": item_nodes
            }
        ]
    }


def _build_expense_graph(db: Session, shipment_id: int) -> Dict[str, Any]:
    return _build_shipment_graph(db, shipment_id)


def search_traceability_entities(db: Session, query_str: str) -> List[Dict[str, Any]]:
    """Global search across Shipments, Customers, Vendors, Products, POs, Invoices, PLs."""
    q = str(query_str).strip()
    if not q:
        return []

    results = []

    # 1. Shipments
    shipments = db.query(Shipment).filter(
        or_(
            Shipment.shipment_no.like(f"%{q}%"),
            Shipment.financial_year.like(f"%{q}%"),
            Shipment.destination.like(f"%{q}%")
        )
    ).limit(5).all()
    for s in shipments:
        results.append({
            "entity_type": "SHIPMENT",
            "entity_id": s.id,
            "title": f"Shipment {s.shipment_no}",
            "subtitle": f"FY {s.financial_year} | {s.destination}",
            "badge": s.status or "DRAFT"
        })

    # 2. Customers
    customers = db.query(Customer).filter(
        or_(
            Customer.name.like(f"%{q}%"),
            Customer.code.like(f"%{q}%")
        )
    ).limit(5).all()
    for c in customers:
        results.append({
            "entity_type": "CUSTOMER",
            "entity_id": c.id,
            "title": f"Customer: {c.name}",
            "subtitle": f"Code: {c.code}",
            "badge": "ACTIVE"
        })

    # 3. Vendors
    vendors = db.query(Vendor).filter(
        or_(
            Vendor.name.like(f"%{q}%"),
            Vendor.code.like(f"%{q}%"),
            Vendor.gstin.like(f"%{q}%")
        )
    ).limit(5).all()
    for v in vendors:
        results.append({
            "entity_type": "VENDOR",
            "entity_id": v.id,
            "title": f"Vendor: {v.name}",
            "subtitle": f"GSTIN: {v.gstin or 'N/A'}",
            "badge": v.status or "ACTIVE"
        })

    # 4. Products
    products = db.query(ShipmentProduct).filter(
        or_(
            ShipmentProduct.product_name.like(f"%{q}%"),
            ShipmentProduct.hsn_code.like(f"%{q}%")
        )
    ).limit(5).all()
    for p in products:
        results.append({
            "entity_type": "PRODUCT",
            "entity_id": p.id,
            "title": p.product_name,
            "subtitle": f"HSN {p.hsn_code or '-'} | Shipment ID: {p.shipment_id}",
            "badge": p.stage_status or "ACTIVE"
        })

    # 5. Purchase Orders
    pos = db.query(ShipmentPurchaseOrder).filter(ShipmentPurchaseOrder.po_number.like(f"%{q}%")).limit(5).all()
    for po in pos:
        results.append({
            "entity_type": "PO",
            "entity_id": po.id,
            "title": f"PO: {po.po_number}",
            "subtitle": f"Amount: {po.currency} {po.total_amount:,.2f}",
            "badge": po.status or "CONFIRMED"
        })

    return results
