import re
from decimal import Decimal
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import or_
from models import Shipment, ShipmentProduct, TariffLine

def parse_percentage_rate(rate_str: str, base_value: Decimal) -> Decimal:
    """
    Parses rates like '15%', 'Free', 'Rs. 50/kg', '10% + Rs 20' into an estimated percentage value.
    If 'Free' or None, returns 0.
    """
    if not rate_str:
        return Decimal("0.0")
    
    clean_str = rate_str.strip().upper()
    if clean_str == "FREE" or clean_str == "NIL" or clean_str == "-":
        return Decimal("0.0")
    
    # Try matching standard percentage pattern like "15%" or "7.5%"
    match = re.search(r"(\d+(?:\.\d+)?)\s*%", clean_str)
    if match:
        try:
            return Decimal(match.group(1))
        except Exception:
            pass

    # If it's a numeric string directly
    try:
        return Decimal(clean_str)
    except Exception:
        return Decimal("0.0")


def recalculate_shipment(db: Session, shipment: Shipment):
    """
    Recalculates all pricing, duty, freight allocations, suggested prices, discounts,
    shortages, net settlements, and predicted profits for every product in the shipment.
    """
    products = shipment.products
    if not products:
        return

    # Currency rates
    usd_rate = float(shipment.usd_rate or 1.0)
    lkr_inr_rate = float(shipment.lkr_inr_rate or 1.0)
    target_margin_pct = float(shipment.profit_margin_pct or 15.0)
    mode = getattr(shipment, "freight_allocation_mode", "WEIGHT") or "WEIGHT"

    # Common expenses in LKR
    common_exp_lkr = float(shipment.common_expenses_lkr or 0)
    if shipment.common_expenses_inr and float(shipment.common_expenses_inr) > 0:
        common_exp_lkr += float(shipment.common_expenses_inr) * (1.0 / lkr_inr_rate if lkr_inr_rate != 0 else 1.0)

    port_exp_lkr = float(getattr(shipment, "port_expenses_lkr", 0) or 0)

    # Compute totals across shipment for allocation
    total_qty = sum(float(p.quantity or 0) for p in products) or 1.0
    
    # Calculate item total weights in KG
    product_weights = []
    for p in products:
        q = float(p.quantity or 1.0)
        w = float(p.net_weight_kg or p.weight_val or 0.0)
        # If weight unit is Grams, convert to KG
        if getattr(p, "weight_unit", "KG") and p.weight_unit.upper() in ["G", "GRAM", "GRAMS"]:
            w = w / 1000.0
        product_weights.append(w * q if w > 0 else q)

    total_shipment_weight = sum(product_weights) or 1.0

    for idx, p in enumerate(products):
        curr = (p.currency or "INR").upper()
        p_price = float(p.purchase_price or 0.0)
        qty = float(p.quantity or 1.0)
        item_weight_total = product_weights[idx]

        if curr == "LKR":
            base_price_lkr = p_price
        elif curr == "INR":
            base_price_lkr = p_price / lkr_inr_rate if lkr_inr_rate != 0 else p_price
        elif curr == "USD":
            base_price_lkr = p_price * usd_rate
        else:
            base_price_lkr = p_price

        # Freight & Port expense allocation
        if mode == "WEIGHT" and total_shipment_weight > 0:
            weight_ratio = item_weight_total / total_shipment_weight
            item_freight_lkr = common_exp_lkr * weight_ratio
            item_port_lkr = port_exp_lkr * weight_ratio
        else:
            qty_ratio = qty / total_qty
            item_freight_lkr = common_exp_lkr * qty_ratio
            item_port_lkr = port_exp_lkr * qty_ratio

        per_unit_freight_lkr = item_freight_lkr / qty if qty > 0 else 0.0
        per_unit_port_lkr = item_port_lkr / qty if qty > 0 else 0.0

        # Search Tariff Database by HSN Code
        tariff_line = None
        if p.hsn_code:
            raw_hsn = p.hsn_code.strip()
            clean_hsn = raw_hsn.replace(".", "")
            # Try exact match first
            tariff_line = db.query(TariffLine).filter(
                or_(
                    TariffLine.hs_code == raw_hsn,
                    TariffLine.hs_code == clean_hsn
                )
            ).first()

            # If no exact match or matched line has no rates (category heading), find first leaf line with rates
            if not tariff_line or (not tariff_line.general_duty_rate and not tariff_line.vat_rate and not tariff_line.pal_rate and not tariff_line.cess_rate):
                fallback = db.query(TariffLine).filter(
                    or_(
                        TariffLine.hs_code.like(f"{raw_hsn}%"),
                        TariffLine.hs_code.like(f"{clean_hsn}%")
                    ),
                    or_(
                        TariffLine.general_duty_rate.isnot(None),
                        TariffLine.vat_rate.isnot(None),
                        TariffLine.pal_rate.isnot(None),
                        TariffLine.cess_rate.isnot(None)
                    )
                ).first()
                if fallback:
                    tariff_line = fallback
                    # Auto-update product's HSN code to the specific 8-digit tariff line
                    if fallback.hs_code:
                        p.hsn_code = fallback.hs_code

        gen_duty_pct = 0.0
        vat_pct = 0.0
        pal_pct = 0.0
        cess_pct = 0.0
        sscl_pct = 0.0

        if tariff_line:
            p.general_duty_rate = tariff_line.general_duty_rate
            p.vat_rate = tariff_line.vat_rate
            p.pal_rate = tariff_line.pal_rate
            p.cess_rate = tariff_line.cess_rate
            p.sscl_rate = tariff_line.sscl_rate

            gen_duty_pct = float(parse_percentage_rate(tariff_line.general_duty_rate, Decimal(base_price_lkr)))
            vat_pct = float(parse_percentage_rate(tariff_line.vat_rate, Decimal(base_price_lkr)))
            pal_pct = float(parse_percentage_rate(tariff_line.pal_rate, Decimal(base_price_lkr)))
            cess_pct = float(parse_percentage_rate(tariff_line.cess_rate, Decimal(base_price_lkr)))
            sscl_pct = float(parse_percentage_rate(tariff_line.sscl_rate, Decimal(base_price_lkr)))

        # Check SCL / Licensed priority classification
        is_scl = (getattr(p, "item_classification", "NORMAL") == "SCL") or (tariff_line and tariff_line.scl_rate) or ("ghee" in p.product_name.lower())
        if is_scl:
            p.item_classification = "SCL"

        # Duty calculation with SCL priority
        if is_scl and tariff_line and tariff_line.scl_rate:
            scl_val = float(parse_percentage_rate(tariff_line.scl_rate, Decimal(base_price_lkr)))
            if scl_val > 0:
                calculated_duty_lkr = base_price_lkr * (scl_val / 100.0)
            else:
                duty_pct_total = gen_duty_pct + vat_pct + pal_pct + cess_pct + sscl_pct
                calculated_duty_lkr = base_price_lkr * (duty_pct_total / 100.0)
        else:
            duty_pct_total = gen_duty_pct + vat_pct + pal_pct + cess_pct + sscl_pct
            calculated_duty_lkr = base_price_lkr * (duty_pct_total / 100.0)

        # C&F Price (Purchase price + allocated freight per unit)
        cnf_price_lkr = base_price_lkr + per_unit_freight_lkr

        # Total Cost LKR per unit (C&F + Duty + Port)
        total_cost_lkr = cnf_price_lkr + calculated_duty_lkr + per_unit_port_lkr

        # Configurable Margin Rule Formula (Requirement 13)
        margin_mode = getattr(shipment, "margin_mode", "MARGIN_ON_REVENUE") or "MARGIN_ON_REVENUE"
        margin_decimal = target_margin_pct / 100.0

        if margin_mode == "MARKUP_ON_COST":
            suggested_price_lkr = total_cost_lkr * (1.0 + margin_decimal)
        else: # MARGIN_ON_REVENUE (Default)
            if margin_decimal >= 1.0:
                margin_decimal = 0.99
            suggested_price_lkr = total_cost_lkr / (1.0 - margin_decimal)

        # Final quotation price defaults to suggested price if not set manually
        final_price_lkr = float(p.final_quotation_price or 0.0)
        if final_price_lkr <= 0.0:
            final_price_lkr = suggested_price_lkr
            p.final_quotation_price = Decimal(str(round(final_price_lkr, 2)))

        # Customer Quotation calculations (P_1 / P_2 fields)
        discount_lkr = float(p.discount_lkr or 0.0)
        set_price_lkr = final_price_lkr - discount_lkr
        p.set_price_lkr = Decimal(str(round(set_price_lkr, 2)))

        short_qty = float(p.short_qty or 0.0)
        short_amt_lkr = short_qty * set_price_lkr
        p.short_amt_lkr = Decimal(str(round(short_amt_lkr, 2)))

        gross_sell_amt_lkr = set_price_lkr * qty
        net_settlement_lkr = gross_sell_amt_lkr - short_amt_lkr
        p.net_settlement_lkr = Decimal(str(round(net_settlement_lkr, 2)))

        # Predicted profit
        total_item_cost_lkr = total_cost_lkr * qty
        predicted_profit_lkr = net_settlement_lkr - total_item_cost_lkr

        # Indian Price (in INR) & Sri Lankan Price (LKR)
        indian_price_inr = p_price if curr == "INR" else (base_price_lkr * lkr_inr_rate)
        srilankan_price_lkr = final_price_lkr

        # Store back in product model
        p.freight_allocation_lkr = Decimal(str(round(item_freight_lkr, 2)))
        p.port_charges_lkr = Decimal(str(round(item_port_lkr, 2)))
        p.base_price_lkr = Decimal(str(round(base_price_lkr, 2)))
        p.cnf_price = Decimal(str(round(cnf_price_lkr, 2)))
        p.calculated_duty_lkr = Decimal(str(round(calculated_duty_lkr, 2)))
        p.total_cost_lkr = Decimal(str(round(total_cost_lkr, 2)))
        p.indian_price = Decimal(str(round(indian_price_inr, 2)))
        p.srilankan_price = Decimal(str(round(srilankan_price_lkr, 2)))
        p.suggested_price = Decimal(str(round(suggested_price_lkr, 2)))
        p.predicted_profit = Decimal(str(round(predicted_profit_lkr, 2)))

    db.commit()
