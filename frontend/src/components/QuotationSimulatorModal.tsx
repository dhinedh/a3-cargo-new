import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Sparkles, 
  Copy, 
  Check, 
  X, 
  Package, 
  DollarSign, 
  Percent, 
  Truck, 
  ShieldAlert, 
  ShieldCheck, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../api/client';

interface QuotationSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductName?: string;
  initialQty?: number;
  initialPrice?: number;
}

export const QuotationSimulatorModal: React.FC<QuotationSimulatorModalProps> = ({
  isOpen,
  onClose,
  initialProductName = 'Urad Dal',
  initialQty = 26000,
  initialPrice = 65
}) => {
  const [productName, setProductName] = useState<string>(initialProductName);
  const [hsnCode, setHsnCode] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(initialQty);
  const [unit, setUnit] = useState<string>('KG');
  const [containerCount, setContainerCount] = useState<number>(1);
  const [netWeightKg, setNetWeightKg] = useState<number>(26000);
  const [purchasePrice, setPurchasePrice] = useState<number>(initialPrice);
  const [purchaseCurrency, setPurchaseCurrency] = useState<string>('INR');
  const [lkrInrRate, setLkrInrRate] = useState<number>(4.0);
  const [usdLkrRate, setUsdLkrRate] = useState<number>(300.0);
  const [profitMarginPct, setProfitMarginPct] = useState<number>(15.0);
  const [marginMode, setMarginMode] = useState<string>('MARGIN_ON_REVENUE');
  const [freightExpenseInr, setFreightExpenseInr] = useState<number>(85000);
  const [portExpenseLkr, setPortExpenseLkr] = useState<number>(45000);

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Quick Preset Handlers
  const handlePresetUradDal = () => {
    setProductName('Urad Dal');
    setHsnCode('0713.31');
    setQuantity(26000);
    setUnit('KG');
    setContainerCount(1);
    setNetWeightKg(26000);
    setPurchasePrice(65.0);
    setPurchaseCurrency('INR');
    setFreightExpenseInr(85000);
    setPortExpenseLkr(45000);
  };

  const handlePresetRagiGrain = () => {
    setProductName('Ragi Grain');
    setHsnCode('1008.291');
    setQuantity(12000);
    setUnit('KG');
    setContainerCount(1);
    setNetWeightKg(12000);
    setPurchasePrice(45.0);
    setPurchaseCurrency('INR');
    setFreightExpenseInr(65000);
    setPortExpenseLkr(35000);
  };

  const handlePresetSugar = () => {
    setProductName('White Sugar');
    setHsnCode('1701.99');
    setQuantity(25000);
    setUnit('KG');
    setContainerCount(1);
    setNetWeightKg(25000);
    setPurchasePrice(55.0);
    setPurchaseCurrency('INR');
    setFreightExpenseInr(90000);
    setPortExpenseLkr(50000);
  };

  const runSimulation = async () => {
    if (!productName.trim()) return;
    try {
      setLoading(true);
      const res = await apiClient.simulateQuotation({
        product_name: productName,
        hsn_code: hsnCode || undefined,
        quantity: Number(quantity) || 1,
        unit: unit,
        container_count: Number(containerCount) || 1,
        net_weight_kg: Number(netWeightKg) || Number(quantity),
        gross_weight_kg: (Number(netWeightKg) || Number(quantity)) * 1.05,
        purchase_price: Number(purchasePrice) || 0,
        purchase_currency: purchaseCurrency,
        lkr_inr_rate: Number(lkrInrRate) || 4.0,
        usd_lkr_rate: Number(usdLkrRate) || 300.0,
        profit_margin_pct: Number(profitMarginPct) || 15.0,
        margin_mode: marginMode,
        freight_expense_inr: Number(freightExpenseInr) || 0,
        port_expense_lkr: Number(portExpenseLkr) || 0
      });
      setSimulationResult(res);
      if (res.hsn_code && !hsnCode) {
        setHsnCode(res.hsn_code);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runSimulation();
    }
  }, [isOpen]);

  const handleCopySummary = () => {
    if (!simulationResult?.formatted_quotation_text) return;
    navigator.clipboard.writeText(simulationResult.formatted_quotation_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900/60 via-slate-900 to-indigo-900/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Quotation & Cost Simulator
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Model Quotation Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">Simulate container landed costs, tariff duty, and suggested selling prices instantly</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Quick Presets:
          </span>
          <button 
            onClick={handlePresetUradDal}
            className="text-xs px-3 py-1 bg-slate-800 hover:bg-blue-900/50 text-slate-200 hover:text-blue-300 rounded-lg border border-slate-700 transition shrink-0"
          >
            1 Container Urad Dal (26,000 KG @ ₹65)
          </button>
          <button 
            onClick={handlePresetSugar}
            className="text-xs px-3 py-1 bg-slate-800 hover:bg-blue-900/50 text-slate-200 hover:text-blue-300 rounded-lg border border-slate-700 transition shrink-0"
          >
            1 Container Sugar (25,000 KG @ ₹55)
          </button>
          <button 
            onClick={handlePresetRagiGrain}
            className="text-xs px-3 py-1 bg-slate-800 hover:bg-blue-900/50 text-slate-200 hover:text-blue-300 rounded-lg border border-slate-700 transition shrink-0"
          >
            1 Container Ragi (12,000 KG @ ₹45)
          </button>
        </div>

        {/* Modal Body Grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1">
          
          {/* Left Column: Input Form (5 cols) */}
          <div className="lg:col-span-5 space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              1. Product & Shipment Details
            </h4>

            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1">Product Name</label>
              <input 
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Urad Dal, White Sugar"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">HSN Code (Optional)</label>
                <input 
                  type="text"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="Auto-maps if blank"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Unit</label>
                <select 
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                  <option value="BAGS">BAGS</option>
                  <option value="CARTONS">CARTONS</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Total Quantity</label>
                <input 
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    const q = Number(e.target.value);
                    setQuantity(q);
                    setNetWeightKg(q);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">No. of Containers</label>
                <input 
                  type="number"
                  value={containerCount}
                  onChange={(e) => setContainerCount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider pt-2 flex items-center gap-2 border-t border-slate-800">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              2. Purchase Price & Currency Rates
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Purchase Price / unit</label>
                <input 
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Currency</label>
                <select 
                  value={purchaseCurrency}
                  onChange={(e) => setPurchaseCurrency(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="LKR">LKR (Rs.)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">LKR / INR Rate</label>
                <input 
                  type="number"
                  step="0.1"
                  value={lkrInrRate}
                  onChange={(e) => setLkrInrRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Profit Margin %</label>
                <input 
                  type="number"
                  step="0.5"
                  value={profitMarginPct}
                  onChange={(e) => setProfitMarginPct(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider pt-2 flex items-center gap-2 border-t border-slate-800">
              <Truck className="w-4 h-4 text-purple-400" />
              3. Freight & Port Clearance
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Freight (INR / Container)</label>
                <input 
                  type="number"
                  value={freightExpenseInr}
                  onChange={(e) => setFreightExpenseInr(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Port Clearance (LKR)</label>
                <input 
                  type="number"
                  value={portExpenseLkr}
                  onChange={(e) => setPortExpenseLkr(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              onClick={runSimulation}
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Calculating Tariff & Duties...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Run Model Quotation Simulation
                </>
              )}
            </button>
          </div>

          {/* Right Column: Simulation Results & Model Quotation (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            {simulationResult ? (
              <div className="space-y-4 flex-1">
                
                {/* HSN & Tariff Status Card */}
                <div className={`p-4 rounded-xl border ${
                  simulationResult.is_hsn_unresolved 
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                } flex items-center justify-between`}>
                  <div className="flex items-center space-x-3">
                    {simulationResult.is_hsn_unresolved ? (
                      <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">HSN & Tariff Status</div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        HSN: {simulationResult.hsn_code || 'Unassigned'}
                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                          simulationResult.is_hsn_unresolved ? 'bg-amber-500/30 text-amber-300' : 'bg-emerald-500/30 text-emerald-300'
                        }`}>
                          {simulationResult.hsn_status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">{simulationResult.tariff_description}</div>
                    </div>
                  </div>
                </div>

                {/* KPI Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-xs text-slate-400 block font-medium">Landed Cost / unit</span>
                    <span className="text-base font-bold text-white">LKR {simulationResult.unit_cost_lkr.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 block pt-0.5">Total: LKR {simulationResult.total_cost_lkr.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-xs text-slate-400 block font-medium">Total Tariff Duty</span>
                    <span className="text-base font-bold text-amber-400">LKR {simulationResult.total_duty_lkr.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 block pt-0.5">LKR {simulationResult.per_unit_duty_lkr.toLocaleString()}/unit</span>
                  </div>

                  <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
                    <span className="text-xs text-slate-400 block font-medium">Suggested Selling Price</span>
                    <span className="text-base font-bold text-emerald-400">LKR {simulationResult.suggested_selling_price_lkr.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 block pt-0.5">Margin: {simulationResult.profit_margin_pct}%</span>
                  </div>
                </div>

                {/* Detailed Breakdown Card */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Cost & Duty Breakdown Details
                  </h5>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-900 text-slate-300">
                      <span>Base Purchase Price:</span>
                      <span className="font-semibold text-white">LKR {simulationResult.base_price_lkr.toLocaleString()} / unit</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900 text-slate-300">
                      <span>General Duty Rate:</span>
                      <span className="font-semibold text-white">{simulationResult.general_duty_rate || '0%'}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-900 text-slate-300">
                      <span>Allocated Freight Cost:</span>
                      <span className="font-semibold text-white">LKR {simulationResult.total_freight_lkr.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900 text-slate-300">
                      <span>VAT Rate:</span>
                      <span className="font-semibold text-white">{simulationResult.vat_rate || '0%'}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-900 text-slate-300">
                      <span>Port Clearance Cost:</span>
                      <span className="font-semibold text-white">LKR {simulationResult.total_port_lkr.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900 text-slate-300">
                      <span>PAL / CESS Rates:</span>
                      <span className="font-semibold text-white">{simulationResult.pal_rate || '0%'} / {simulationResult.cess_rate || '0%'}</span>
                    </div>
                  </div>

                  {/* Net Profit Summary */}
                  <div className="bg-gradient-to-r from-emerald-950/50 to-teal-950/50 p-3 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-emerald-300 font-semibold block">Predicted Net Profit ({simulationResult.container_count} Container)</span>
                      <span className="text-lg font-extrabold text-emerald-400">LKR {simulationResult.predicted_profit_lkr.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-emerald-300 block font-medium">Profit / KG</span>
                      <span className="text-sm font-bold text-white">LKR {simulationResult.profit_per_kg_lkr.toLocaleString()} / KG</span>
                    </div>
                  </div>
                </div>

                {/* Formatted Model Quotation Output */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Shareable Model Quotation Text
                    </span>
                    <button
                      onClick={handleCopySummary}
                      className="text-xs px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded flex items-center gap-1 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied to Clipboard!' : 'Copy Summary'}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 overflow-x-auto whitespace-pre-wrap max-h-36">
                    {simulationResult.formatted_quotation_text}
                  </pre>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950/40 rounded-xl border border-slate-800/60 text-center">
                <Calculator className="w-12 h-12 text-slate-600 mb-3" />
                <h4 className="text-base font-semibold text-slate-300">Enter Simulation Details</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Adjust product specs, container quantity, purchase price, or choose a quick preset on the left to view the complete model quotation breakdown.
                </p>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
