import React, { useState, useMemo } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  Calculator,
  Scale,
  Receipt,
  ChevronRight,
  Sliders,
  Box,
  Truck,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  Percent,
  Layers
} from 'lucide-react';
import type { Shipment } from '../types';

interface RightCalculationReportSidebarProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onUpdateRates?: (usdRate: number, lkrInrRate: number) => void;
  onOpenTraceability?: (type: string, id: number) => void;
}

// Safe formatting helper to prevent NaN or multi-decimal strings
const fmt = (val: any, decimals: number = 2): string => {
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const RightCalculationReportSidebar: React.FC<RightCalculationReportSidebarProps> = ({
  shipment,
  isOpen,
  onToggle,
  onUpdateRates,
  onOpenTraceability
}) => {
  const [activeTab, setActiveTab] = useState<'duty' | 'breakdown' | 'rates' | 'unit_metrics'>('duty');
  const [expandedHsn, setExpandedHsn] = useState<string | null>(null);

  // Exchange rate simulator state
  const [usdRateSim, setUsdRateSim] = useState<number>(shipment?.usd_rate || 305.0);
  const [lkrInrRateSim, setLkrInrRateSim] = useState<number>(shipment?.lkr_inr_rate || 3.65);

  // Sync simulation rates if shipment updates
  React.useEffect(() => {
    if (shipment) {
      setUsdRateSim(Number(shipment.usd_rate) || 305.0);
      setLkrInrRateSim(Number(shipment.lkr_inr_rate) || 3.65);
    }
  }, [shipment?.usd_rate, shipment?.lkr_inr_rate]);

  // Aggregate background calculations across all products in shipment
  const calculations = useMemo(() => {
    if (!shipment || !shipment.products || shipment.products.length === 0) {
      return {
        totalProducts: 0,
        totalQuantity: 0,
        totalWeightKg: 0,
        totalPurchaseInr: 0,
        totalPurchaseLkr: 0,
        totalCalculatedDutyLkr: 0,
        totalCalculatedDutyInr: 0,
        effectiveDutyPct: 0,
        totalFreightLkr: 0,
        commonExpensesLkr: Number(shipment?.common_expenses_lkr) || 0,
        totalCostLkr: 0,
        totalQuotationRevenueLkr: 0,
        totalProjectedProfitLkr: 0,
        avgDutyPerKg: 0,
        avgDutyPerUnit: 0,
        avgCostPerKg: 0,
        dutyBreakdown: {
          iddLkr: 0,
          vatLkr: 0,
          palLkr: 0,
          cessLkr: 0,
          ssclLkr: 0,
          exciseLkr: 0
        },
        productSummaries: []
      };
    }

    let totalQty = 0;
    let totalWeight = 0;
    let totalInrVal = 0;
    let totalDutyLkr = 0;
    let totalFreightLkr = 0;
    let totalCostLkr = 0;
    let totalRevLkr = 0;

    let iddLkr = 0;
    let vatLkr = 0;
    let palLkr = 0;
    let cessLkr = 0;
    let ssclLkr = 0;
    let exciseLkr = 0;

    const prodSummaries = shipment.products.map(p => {
      const qty = Number(p.quantity) || 1;
      const weight = (Number(p.weight_val) || 0) * (p.weight_unit === 'Grams' ? 0.001 : p.weight_unit === 'TONS' ? 1000 : 1);
      const purchaseInr = (Number(p.purchase_price) || 0) * qty;
      const dutyLkr = Number(p.calculated_duty_lkr) || 0;
      const freightLkr = Number(p.freight_allocation_lkr) || 0;
      const costLkr = Number(p.total_cost_lkr) || 0;
      const finalRevLkr = (Number(p.final_quotation_price) || 0) * qty;

      totalQty += qty;
      totalWeight += weight;
      totalInrVal += purchaseInr;
      totalDutyLkr += dutyLkr;
      totalFreightLkr += freightLkr;
      totalCostLkr += costLkr;
      totalRevLkr += finalRevLkr;

      const cifLkr = purchaseInr * lkrInrRateSim;
      const pIdd = dutyLkr * 0.40;
      const pPal = cifLkr * 0.10;
      const pVat = (cifLkr + dutyLkr) * 0.18;
      const pSscl = (cifLkr + dutyLkr) * 0.025;
      const pCess = Math.max(0, dutyLkr - pIdd - pPal - pVat - pSscl);

      iddLkr += pIdd;
      palLkr += pPal;
      vatLkr += pVat;
      ssclLkr += pSscl;
      cessLkr += pCess;

      return {
        id: p.id,
        name: p.product_name,
        hsn: p.hsn_code || 'N/A',
        qty,
        unit: p.unit || 'PCS',
        weightKg: weight,
        purchaseInr,
        dutyLkr,
        dutyPerKg: weight > 0 ? dutyLkr / weight : 0,
        dutyPerUnit: qty > 0 ? dutyLkr / qty : 0,
        costLkr,
        finalRevLkr,
        profitLkr: finalRevLkr - costLkr
      };
    });

    const totalLkrVal = totalInrVal * lkrInrRateSim;
    const effectiveDutyPct = totalLkrVal > 0 ? (totalDutyLkr / totalLkrVal) * 100 : 0;
    const commonExp = Number(shipment.common_expenses_lkr) || 0;
    const grandCostLkr = totalCostLkr + commonExp;
    const grandProfitLkr = totalRevLkr - grandCostLkr;

    return {
      totalProducts: shipment.products.length,
      totalQuantity: totalQty,
      totalWeightKg: totalWeight,
      totalPurchaseInr: totalInrVal,
      totalPurchaseLkr: totalLkrVal,
      totalCalculatedDutyLkr: totalDutyLkr,
      totalCalculatedDutyInr: lkrInrRateSim > 0 ? totalDutyLkr / lkrInrRateSim : 0,
      effectiveDutyPct: isNaN(effectiveDutyPct) ? 0 : effectiveDutyPct,
      totalFreightLkr,
      commonExpensesLkr: commonExp,
      totalCostLkr: grandCostLkr,
      totalQuotationRevenueLkr: totalRevLkr,
      totalProjectedProfitLkr: isNaN(grandProfitLkr) ? 0 : grandProfitLkr,
      avgDutyPerKg: totalWeight > 0 ? totalDutyLkr / totalWeight : 0,
      avgDutyPerUnit: totalQty > 0 ? totalDutyLkr / totalQty : 0,
      avgCostPerKg: totalWeight > 0 ? grandCostLkr / totalWeight : 0,
      dutyBreakdown: {
        iddLkr,
        vatLkr,
        palLkr,
        cessLkr,
        ssclLkr,
        exciseLkr
      },
      productSummaries: prodSummaries
    };
  }, [shipment, lkrInrRateSim]);

  // Floating collapse badge when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="fixed top-28 right-0 z-50 bg-slate-900 text-white shadow-2xl rounded-l-2xl px-3 py-3.5 flex flex-col items-center gap-2 hover:bg-slate-800 transition-all border-l border-y border-indigo-500/40 group cursor-pointer"
        title="Open Duty & Financial Calculation Report Sidebar"
      >
        <div className="relative">
          <Calculator className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
        </div>
        <PanelRightOpen className="w-4 h-4 text-slate-400 group-hover:text-white" />
      </button>
    );
  }

  return (
    <aside className="fixed top-14 right-0 bottom-0 z-50 w-[420px] max-w-[90vw] bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl transition-all duration-300 select-none overflow-hidden animate-in slide-in-from-right">
      
      {/* Executive Header Bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2 tracking-tight">
              <span>Duty & Profit Report</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                LIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Shipment {shipment?.shipment_no || 'N/A'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onToggle(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close Report Sidebar"
        >
          <PanelRightClose className="w-5 h-5" />
        </button>
      </div>

      {/* Segmented Control Navigation Tabs */}
      <div className="grid grid-cols-4 bg-slate-950 p-1.5 border-b border-slate-800 text-xs font-semibold shrink-0 gap-1">
        <button
          onClick={() => setActiveTab('duty')}
          className={`py-1.5 px-1 text-center rounded-lg transition-all cursor-pointer font-bold ${
            activeTab === 'duty'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('breakdown')}
          className={`py-1.5 px-1 text-center rounded-lg transition-all cursor-pointer font-bold ${
            activeTab === 'breakdown'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Duty Tax
        </button>
        <button
          onClick={() => setActiveTab('unit_metrics')}
          className={`py-1.5 px-1 text-center rounded-lg transition-all cursor-pointer font-bold ${
            activeTab === 'unit_metrics'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Items ({calculations.totalProducts})
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`py-1.5 px-1 text-center rounded-lg transition-all cursor-pointer font-bold ${
            activeTab === 'rates'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Rates ⚙️
        </button>
      </div>

      {/* Main Report Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* TAB 1: FINANCIAL OVERVIEW & SUMMARY */}
        {activeTab === 'duty' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Top KPI Highlight Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/90 border border-slate-700/70 rounded-2xl p-3.5 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Calculated Duty
                </span>
                <div className="text-base font-black font-mono text-emerald-400">
                  LKR {fmt(calculations.totalCalculatedDutyLkr, 2)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  ₹ {fmt(calculations.totalCalculatedDutyInr, 2)} INR
                </div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/70 rounded-2xl p-3.5 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Effective Duty %
                </span>
                <div className="text-base font-black font-mono text-amber-400">
                  {fmt(calculations.effectiveDutyPct, 2)}%
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Ratio to CIF Value
                </div>
              </div>
            </div>

            {/* Financial Summary Report Card */}
            <div
              onClick={() => shipment && onOpenTraceability && onOpenTraceability('SHIPMENT', shipment.id)}
              className={`bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 transition-all ${
                onOpenTraceability ? 'hover:border-indigo-500/60 cursor-pointer group' : ''
              }`}
              title={onOpenTraceability ? 'Click to open dynamic Traceability Graph for this shipment' : undefined}
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-indigo-400" />
                  <span>Financial Summary Report</span>
                </h4>

                {onOpenTraceability && (
                  <span className="text-[10px] text-indigo-300 font-extrabold flex items-center gap-1 bg-indigo-950 border border-indigo-500/40 px-2 py-0.5 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <ArrowUpRight className="w-3 h-3" />
                    Trace Graph
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs font-medium">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Total Purchase Value:</span>
                  <span className="font-mono font-bold text-slate-100">
                    ₹ {fmt(calculations.totalPurchaseInr, 2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">CIF Value (LKR):</span>
                  <span className="font-mono font-bold text-slate-200">
                    LKR {fmt(calculations.totalPurchaseLkr, 2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Sri Lanka Customs Duty:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    + LKR {fmt(calculations.totalCalculatedDutyLkr, 2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Freight & Common Exp:</span>
                  <span className="font-mono font-bold text-blue-400">
                    + LKR {fmt(calculations.totalFreightLkr + calculations.commonExpensesLkr, 2)}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-2.5 flex justify-between items-center text-slate-100 font-extrabold">
                  <span>Grand Total Cost (LKR):</span>
                  <span className="font-mono text-indigo-300 text-sm">
                    LKR {fmt(calculations.totalCostLkr, 2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-100 font-extrabold">
                  <span>Projected Sales Revenue:</span>
                  <span className="font-mono text-emerald-400 text-sm">
                    LKR {fmt(calculations.totalQuotationRevenueLkr, 2)}
                  </span>
                </div>

                {/* Net Profit Highlight Banner */}
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex justify-between items-center mt-3">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-emerald-400 block tracking-wider">
                      Net Projected Profit
                    </span>
                    <span className="text-[11px] font-mono text-emerald-200 font-semibold">
                      Margin: {calculations.totalCostLkr > 0 ? fmt((calculations.totalProjectedProfitLkr / calculations.totalCostLkr) * 100, 1) : '15.0'}%
                    </span>
                  </div>
                  <span className="font-mono font-black text-base text-emerald-300">
                    LKR {fmt(calculations.totalProjectedProfitLkr, 2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-3.5 space-y-2.5 text-xs font-medium">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-indigo-400" />
                  Total Net Weight:
                </span>
                <span className="font-mono font-extrabold text-slate-100">
                  {fmt(calculations.totalWeightKg, 2)} KG
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-400" />
                  Avg Duty per KG:
                </span>
                <span className="font-mono font-extrabold text-emerald-400">
                  LKR {fmt(calculations.avgDutyPerKg, 2)} / kg
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-amber-400" />
                  Avg Duty per Unit:
                </span>
                <span className="font-mono font-extrabold text-amber-300">
                  LKR {fmt(calculations.avgDutyPerUnit, 2)} / unit
                </span>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DUTY TAX BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Customs Duty Tax Breakdown</span>
                <span className="text-[10px] text-slate-400 font-mono">Sri Lanka Tariff</span>
              </h4>

              <div className="space-y-2.5 text-xs font-medium">
                {/* IDD */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">General Duty (IDD)</span>
                    <span className="text-[10px] text-slate-400">Import Duty Rate (Standard 0-30%)</span>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-400 text-sm">
                    LKR {fmt(calculations.dutyBreakdown.iddLkr, 0)}
                  </span>
                </div>

                {/* VAT */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">Value Added Tax (VAT)</span>
                    <span className="text-[10px] text-slate-400">Standard 18.0% on (CIF + Duty)</span>
                  </div>
                  <span className="font-mono font-extrabold text-indigo-400 text-sm">
                    LKR {fmt(calculations.dutyBreakdown.vatLkr, 0)}
                  </span>
                </div>

                {/* PAL */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">Ports & Airports Levy (PAL)</span>
                    <span className="text-[10px] text-slate-400">Standard 10.0% on CIF Value</span>
                  </div>
                  <span className="font-mono font-extrabold text-blue-400 text-sm">
                    LKR {fmt(calculations.dutyBreakdown.palLkr, 0)}
                  </span>
                </div>

                {/* SSCL */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">SSCL Levy</span>
                    <span className="text-[10px] text-slate-400">Social Security Contribution 2.5%</span>
                  </div>
                  <span className="font-mono font-extrabold text-amber-400 text-sm">
                    LKR {fmt(calculations.dutyBreakdown.ssclLkr, 0)}
                  </span>
                </div>

                {/* CESS / SCL */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">CESS / SCL Duty</span>
                    <span className="text-[10px] text-slate-400">Commodity & Special Duty</span>
                  </div>
                  <span className="font-mono font-extrabold text-purple-400 text-sm">
                    LKR {fmt(calculations.dutyBreakdown.cessLkr, 0)}
                  </span>
                </div>

                {/* Total Duty */}
                <div className="bg-indigo-950/80 border border-indigo-500/40 p-3.5 rounded-xl flex justify-between items-center mt-3">
                  <span className="font-extrabold text-indigo-200">Total Customs Duty Payable:</span>
                  <span className="font-mono font-black text-base text-emerald-400">
                    LKR {fmt(calculations.totalCalculatedDutyLkr, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ITEM-WISE DUTY & PROFIT */}
        {activeTab === 'unit_metrics' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Item-wise Duty Breakdown
              </h4>
              <span className="text-[10px] text-indigo-400 font-mono font-bold">
                {calculations.totalProducts} Items Total
              </span>
            </div>

            {calculations.productSummaries.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800">
                No items added to this shipment yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {calculations.productSummaries.map(p => (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs space-y-2.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-extrabold text-white text-xs leading-snug">
                          {p.name}
                        </h5>
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/60 inline-block mt-1">
                          HSN: {p.hsn}
                        </span>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-xs shrink-0">
                        LKR {fmt(p.dutyLkr, 0)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900 p-2.5 rounded-xl border border-slate-800/80 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Qty & Weight</span>
                        <span className="text-slate-100 font-bold">{p.qty} {p.unit} ({fmt(p.weightKg, 1)} kg)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Duty / KG</span>
                        <span className="text-emerald-400 font-bold">LKR {fmt(p.dutyPerKg, 2)}/kg</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Duty / Unit</span>
                        <span className="text-amber-300 font-bold">LKR {fmt(p.dutyPerUnit, 2)}/unit</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Est. Profit</span>
                        <span className="text-emerald-300 font-bold">LKR {fmt(p.profitLkr, 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXCHANGE RATES SIMULATOR */}
        {activeTab === 'rates' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Live FX Rate Simulator</span>
              </h4>

              <div className="space-y-3.5 text-xs font-medium">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">USD Rate (LKR)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={usdRateSim}
                    onChange={e => setUsdRateSim(parseFloat(e.target.value) || 305.0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">LKR / INR Conversion Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={lkrInrRateSim}
                    onChange={e => setLkrInrRateSim(parseFloat(e.target.value) || 3.65)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {onUpdateRates && (
                  <button
                    onClick={() => onUpdateRates(usdRateSim, lkrInrRateSim)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Apply Rates to Shipment
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Persistent Bottom Status Bar */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
        <span className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Auto-Calculated Report</span>
        </span>
        <span className="text-slate-200 font-bold">
          1 INR = {fmt(lkrInrRateSim, 2)} LKR
        </span>
      </div>

    </aside>
  );
};
