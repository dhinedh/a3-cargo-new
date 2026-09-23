import React, { useState, useMemo } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  Calculator,
  Scale,
  DollarSign,
  TrendingUp,
  Percent,
  Receipt,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  Box,
  Truck,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import type { Shipment } from '../types';

interface RightCalculationReportSidebarProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onUpdateRates?: (usdRate: number, lkrInrRate: number) => void;
  onOpenTraceability?: (type: string, id: number) => void;
}

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
      setUsdRateSim(shipment.usd_rate || 305.0);
      setLkrInrRateSim(shipment.lkr_inr_rate || 3.65);
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
        commonExpensesLkr: shipment?.common_expenses_lkr || 0,
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
      const qty = p.quantity || 1;
      const weight = (p.weight_val || 0) * (p.weight_unit === 'Grams' ? 0.001 : p.weight_unit === 'TONS' ? 1000 : 1);
      const purchaseInr = (p.purchase_price || 0) * qty;
      const dutyLkr = p.calculated_duty_lkr || 0;
      const freightLkr = p.freight_allocation_lkr || 0;
      const costLkr = p.total_cost_lkr || 0;
      const finalRevLkr = (p.final_quotation_price || 0) * qty;

      totalQty += qty;
      totalWeight += weight;
      totalInrVal += purchaseInr;
      totalDutyLkr += dutyLkr;
      totalFreightLkr += freightLkr;
      totalCostLkr += costLkr;
      totalRevLkr += finalRevLkr;

      // Approximate breakdown estimation based on Sri Lanka customs tariff formulas
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
    const commonExp = shipment.common_expenses_lkr || 0;
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
      effectiveDutyPct,
      totalFreightLkr: totalFreightLkr,
      commonExpensesLkr: commonExp,
      totalCostLkr: grandCostLkr,
      totalQuotationRevenueLkr: totalRevLkr,
      totalProjectedProfitLkr: grandProfitLkr,
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

  // If panel is closed, render subtle persistent right floating trigger badge
  if (!isOpen) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="fixed top-28 right-0 z-50 bg-slate-900 text-white shadow-2xl rounded-l-xl px-3 py-3.5 flex flex-col items-center gap-2 hover:bg-slate-800 transition-all border-l border-y border-indigo-500/50 group cursor-pointer"
        title="Open Live Duty & Calculation Report Panel"
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
      
      {/* Header Bar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              Live Duty & Profit Report
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                Live
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
          title="Close Sidebar"
        >
          <PanelRightClose className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-4 bg-slate-950 p-1 border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('duty')}
          className={`py-2 px-1 text-center rounded-lg transition-all cursor-pointer ${
            activeTab === 'duty'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('breakdown')}
          className={`py-2 px-1 text-center rounded-lg transition-all cursor-pointer ${
            activeTab === 'breakdown'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Duty Tax
        </button>
        <button
          onClick={() => setActiveTab('unit_metrics')}
          className={`py-2 px-1 text-center rounded-lg transition-all cursor-pointer ${
            activeTab === 'unit_metrics'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Items ({calculations.totalProducts})
        </button>
        <button
          onClick={() => setActiveTab('rates')}
          className={`py-2 px-1 text-center rounded-lg transition-all cursor-pointer ${
            activeTab === 'rates'
              ? 'bg-indigo-600 text-white font-bold shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Rates ⚙️
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* TAB 1: OVERVIEW & PROFIT METRICS */}
        {activeTab === 'duty' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Top Highlight Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Calculated Duty
                </span>
                <span className="text-base font-extrabold font-mono text-emerald-400">
                  LKR {calculations.totalCalculatedDutyLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  ₹ {calculations.totalCalculatedDutyInr.toLocaleString('en-US', { maximumFractionDigits: 0 })} INR
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Effective Duty %
                </span>
                <span className="text-base font-extrabold font-mono text-amber-400">
                  {calculations.effectiveDutyPct.toFixed(2)}%
                </span>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Ratio to CIF Value
                </div>
              </div>
            </div>

            {/* Total Financial Summary Box */}
            <div
              onClick={() => shipment && onOpenTraceability && onOpenTraceability('SHIPMENT', shipment.id)}
              className={`bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 transition-all ${
                onOpenTraceability ? 'hover:border-indigo-500/50 cursor-pointer group' : ''
              }`}
              title={onOpenTraceability ? 'Click to open dynamic Traceability Graph for this shipment' : undefined}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  Financial Summary Report
                </span>
                {onOpenTraceability && (
                  <span className="text-[10px] text-indigo-300 font-semibold flex items-center gap-1 bg-indigo-950/80 border border-indigo-500/30 px-1.5 py-0.5 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <ArrowUpRight className="w-3 h-3" />
                    Trace Graph
                  </span>
                )}
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Total Purchase Value:</span>
                  <span className="font-mono font-semibold">
                    ₹ {calculations.totalPurchaseInr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">CIF Value (LKR):</span>
                  <span className="font-mono font-semibold text-slate-200">
                    LKR {calculations.totalPurchaseLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Sri Lanka Customs Duty:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    + LKR {calculations.totalCalculatedDutyLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Freight & Common Exp:</span>
                  <span className="font-mono font-semibold text-blue-400">
                    + LKR {(calculations.totalFreightLkr + calculations.commonExpensesLkr).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-slate-100 font-bold">
                  <span>Grand Total Cost (LKR):</span>
                  <span className="font-mono text-indigo-300">
                    LKR {calculations.totalCostLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-100 font-bold">
                  <span>Projected Sales Revenue:</span>
                  <span className="font-mono text-emerald-400">
                    LKR {calculations.totalQuotationRevenueLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-2.5 flex justify-between items-center mt-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                      Net Projected Profit
                    </span>
                    <span className="text-xs font-mono text-emerald-200">
                      Margin: {calculations.totalCostLkr > 0 ? ((calculations.totalProjectedProfitLkr / calculations.totalCostLkr) * 100).toFixed(1) : '15.0'}%
                    </span>
                  </div>
                  <span className="font-mono font-extrabold text-sm text-emerald-300">
                    LKR {calculations.totalProjectedProfitLkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-indigo-400" />
                  Total Net Weight:
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {calculations.totalWeightKg.toLocaleString('en-US', { maximumFractionDigits: 2 })} KG
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-blue-400" />
                  Avg Duty per KG:
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  LKR {calculations.avgDutyPerKg.toFixed(2)} / kg
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-amber-400" />
                  Avg Duty per Unit:
                </span>
                <span className="font-mono font-bold text-amber-300">
                  LKR {calculations.avgDutyPerUnit.toFixed(2)} / unit
                </span>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DUTY TAX BREAKDOWN (AUTOMATIC REPORT VIEW) */}
        {activeTab === 'breakdown' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2 flex items-center justify-between">
                <span>Customs Duty Tax Breakdown</span>
                <span className="text-[10px] text-slate-400 font-mono">Sri Lanka Tariff</span>
              </h4>

              <div className="space-y-2.5 text-xs">
                {/* IDD */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">General Duty (IDD)</span>
                    <span className="text-[10px] text-slate-400">Import Duty Rate (Standard 0-30%)</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    LKR {calculations.dutyBreakdown.iddLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* VAT */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">Value Added Tax (VAT)</span>
                    <span className="text-[10px] text-slate-400">Standard 18.0% on (CIF + Duty)</span>
                  </div>
                  <span className="font-mono font-bold text-indigo-400 text-sm">
                    LKR {calculations.dutyBreakdown.vatLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* PAL */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">Ports & Airports Levy (PAL)</span>
                    <span className="text-[10px] text-slate-400">Standard 10.0% on CIF Value</span>
                  </div>
                  <span className="font-mono font-bold text-blue-400 text-sm">
                    LKR {calculations.dutyBreakdown.palLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* SSCL */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">SSCL Levy</span>
                    <span className="text-[10px] text-slate-400">Social Security Contribution 2.5%</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    LKR {calculations.dutyBreakdown.ssclLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* CESS / SCL */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-slate-200 block">CESS / SCL Duty</span>
                    <span className="text-[10px] text-slate-400">Commodity & Special Commodity Levy</span>
                  </div>
                  <span className="font-mono font-bold text-purple-400 text-sm">
                    LKR {calculations.dutyBreakdown.cessLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* Total Duty */}
                <div className="bg-indigo-950/80 border border-indigo-500/40 p-3 rounded-xl flex justify-between items-center mt-3">
                  <span className="font-extrabold text-indigo-200">Total Customs Duty Payable:</span>
                  <span className="font-mono font-extrabold text-base text-emerald-400">
                    LKR {calculations.totalCalculatedDutyLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ITEM-WISE DUTY & PROFIT QUICK EXPLORER */}
        {activeTab === 'unit_metrics' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Item-wise Duty Breakdown</span>
              <span className="text-[10px] text-indigo-400 font-mono">{calculations.totalProducts} Items</span>
            </h4>

            {calculations.productSummaries.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800">
                No items added to this shipment yet.
              </div>
            ) : (
              <div className="space-y-2">
                {calculations.productSummaries.map(p => (
                  <div
                    key={p.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div
                      className="flex justify-between items-start cursor-pointer"
                      onClick={() => setExpandedHsn(expandedHsn === p.hsn ? null : p.hsn)}
                    >
                      <div>
                        <h5 className="font-bold text-slate-100 flex items-center gap-1.5">
                          {p.name}
                        </h5>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                          HSN: {p.hsn}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        LKR {p.dutyLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Qty & Weight</span>
                        <span className="text-slate-200 font-bold">{p.qty} {p.unit} ({p.weightKg.toFixed(1)} kg)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Duty / KG</span>
                        <span className="text-emerald-400 font-bold">LKR {p.dutyPerKg.toFixed(2)}/kg</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Duty / Unit</span>
                        <span className="text-amber-300 font-bold">LKR {p.dutyPerUnit.toFixed(2)}/unit</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase">Est. Profit</span>
                        <span className="text-emerald-300 font-bold">LKR {p.profitLkr.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Sliders className="w-3.5 h-3.5" />
                Live Rate Simulator
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">USD Rate (LKR)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={usdRateSim}
                    onChange={e => setUsdRateSim(parseFloat(e.target.value) || 305.0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">LKR / INR Conversion Rate</label>
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
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
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
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Auto-Calculated Report
        </span>
        <span className="text-slate-300 font-bold">
          1 INR = {lkrInrRateSim} LKR
        </span>
      </div>

    </aside>
  );
};
