import React, { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { CustomerSelectionTable } from './CustomerSelectionTable';
import type { CustomerFormData } from './CustomerSearchInput';
import { CustomerRequirementsStep } from './CustomerRequirementsStep';
import { VendorAllocationStep } from './VendorAllocationStep';
import type { Shipment, Customer } from '../types';

interface ShipmentWizardModalProps {
  isOpen?: boolean;
  initialShipmentId?: number;
  initialStep?: number;
  onClose: () => void;
  onSelectShipment?: (shipmentId: number) => void;
  onShipmentCreated?: (shipmentId: number) => void;
}

export const ShipmentWizardModal: React.FC<ShipmentWizardModalProps> = ({
  initialShipmentId,
  initialStep,
  onClose,
  onSelectShipment,
  onShipmentCreated
}) => {
  const [currentStep, setCurrentStepState] = useState<number>(initialStep || 1);
  const [createdShipment, setCreatedShipment] = useState<Shipment | null>(null);

  const setCurrentStep = (step: number) => {
    setCurrentStepState(step);
    if (createdShipment) {
      localStorage.setItem('a3_last_wizard_shipment_id', String(createdShipment.id));
      localStorage.setItem('a3_last_wizard_step', String(step));
    }
  };

  // Step 1 Form state
  const [nextSeqInfo, setNextSeqInfo] = useState<{ financial_year: string; next_sequence: number; shipment_no: string } | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<CustomerFormData[]>([
    { name: '', country: 'Sri Lanka' },
    { name: '', country: 'Sri Lanka' }
  ]);
  const [configForm, setConfigForm] = useState({
    shipment_date: new Date().toISOString().split('T')[0],
    usd_rate: 305.0,
    lkr_inr_rate: 3.65,
    profit_margin_pct: 15.0,
    indian_invoice_margin_pct: 15.0,
    colombo_invoice_margin_pct: 15.0,
    common_expenses_inr: 0.0,
    common_expenses_lkr: 0.0,
    notes: ''
  });
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    const initData = async () => {
      try {
        if (initialShipmentId) {
          const s = await apiClient.getShipmentDetails(initialShipmentId);
          setCreatedShipment(s);
          if (initialStep) setCurrentStepState(initialStep);
          localStorage.setItem('a3_last_wizard_shipment_id', String(s.id));
          localStorage.setItem('a3_last_wizard_step', String(initialStep || 2));
        }

        const [seq, custs] = await Promise.all([
          apiClient.getNextShipmentNumber(),
          apiClient.getCustomers().catch(() => [])
        ]);
        setNextSeqInfo(seq);
        setAllCustomers(custs || []);
      } catch (err) {
        console.error('Failed to initialize wizard modal:', err);
      }
    };
    initData();
  }, [initialShipmentId, initialStep]);

  const handleCreateHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextSeqInfo) return;

    try {
      setCreating(true);
      const validProfiles = customerProfiles.filter(p => p.name.trim() !== '');
      const sh = await apiClient.createShipment({
        financial_year: nextSeqInfo.financial_year,
        shipment_date: configForm.shipment_date,
        customer_names: validProfiles.map(p => p.name),
        customer_details: validProfiles,
        usd_rate: configForm.usd_rate,
        lkr_inr_rate: configForm.lkr_inr_rate,
        profit_margin_pct: configForm.profit_margin_pct,
        indian_invoice_margin_pct: configForm.indian_invoice_margin_pct,
        colombo_invoice_margin_pct: configForm.colombo_invoice_margin_pct,
        common_expenses_inr: configForm.common_expenses_inr,
        common_expenses_lkr: configForm.common_expenses_lkr,
        notes: configForm.notes
      });
      setCreatedShipment(sh);
      setCurrentStep(2);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create shipment header');
    } finally {
      setCreating(false);
    }
  };

  const handleQuickDraft = async () => {
    if (!nextSeqInfo) return;
    try {
      setCreating(true);
      const sh = await apiClient.createShipment({
        financial_year: nextSeqInfo.financial_year,
        shipment_date: configForm.shipment_date,
        customer_names: ['Customer 1', 'Customer 2'],
        customer_details: [
          { name: 'Customer 1', country: 'Sri Lanka' },
          { name: 'Customer 2', country: 'Sri Lanka' }
        ],
        usd_rate: configForm.usd_rate,
        lkr_inr_rate: configForm.lkr_inr_rate,
        profit_margin_pct: configForm.profit_margin_pct,
        indian_invoice_margin_pct: configForm.indian_invoice_margin_pct,
        colombo_invoice_margin_pct: configForm.colombo_invoice_margin_pct,
        common_expenses_inr: configForm.common_expenses_inr,
        common_expenses_lkr: configForm.common_expenses_lkr,
        notes: 'Quick Draft Shipment'
      });
      setCreatedShipment(sh);
      setCurrentStep(2);
    } catch (err: any) {
      alert('Failed to quick-create draft shipment header');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Wizard Header & Progress Bar (Sticky Top) */}
        <div className="p-6 pb-4 border-b border-slate-100 shrink-0 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span>Create New Shipment Pipeline</span>
                {createdShipment && (
                  <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                    {createdShipment.shipment_no}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Step-by-step shipment initialization, customer requirements, vendor process, and core calculation.
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Wizard Step Indicator Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${currentStep === 1 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</div>
              <span>Shipment Header & Customers</span>
            </button>

            <button
              type="button"
              disabled={!createdShipment}
              onClick={() => createdShipment && setCurrentStep(2)}
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${!createdShipment ? 'opacity-50 cursor-not-allowed text-slate-400' : 'cursor-pointer'} ${currentStep === 2 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</div>
              <span>Customer Requirements</span>
            </button>

            <button
              type="button"
              disabled={!createdShipment}
              onClick={() => createdShipment && setCurrentStep(3)}
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${!createdShipment ? 'opacity-50 cursor-not-allowed text-slate-400' : 'cursor-pointer'} ${currentStep === 3 ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</div>
              <span>Supplier Allocation & RFQ</span>
            </button>
          </div>
        </div>

        {/* Scrollable Wizard Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step 1: Header & Customers */}
          {currentStep === 1 && (
            <form onSubmit={handleCreateHeader} className="space-y-5">
              {/* 1-Click Quick Draft Creation Banner */}
              <div className="bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-transparent border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[10px] font-black uppercase">Fastest Option</span>
                    <span>Skip Setup & Start Draft Instantly</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Auto-creates shipment <strong>{nextSeqInfo?.shipment_no || 'Pipeline'}</strong> with default settings & jumps straight to Customer Requirements!
                  </div>
                </div>

                <button
                  type="button"
                  disabled={creating || !nextSeqInfo}
                  onClick={handleQuickDraft}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition-all shrink-0 flex items-center gap-1.5"
                >
                  <span>⚡ 1-Click Start Requirements</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Auto Generated Shipment ID Banner */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">Auto Generated Shipment ID</span>
                  <div className="text-2xl font-mono font-black text-blue-900">{nextSeqInfo?.shipment_no || 'Generating...'}</div>
                  <div className="text-[11px] text-blue-700/80 mt-0.5">Auto-sequence logic is maintained even if deleted/cancelled.</div>
                </div>
                <div className="text-right text-xs text-blue-800 space-y-0.5">
                  <div>Seq #: <strong className="font-mono text-sm font-bold text-blue-900">{nextSeqInfo?.next_sequence || '-'}</strong></div>
                  <div>Financial Year: <strong className="font-mono text-sm font-bold text-blue-900">{nextSeqInfo?.financial_year || '-'}</strong></div>
                </div>
              </div>

              {/* Config & Rates Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shipment Date *</label>
                  <input
                    type="date"
                    required
                    value={configForm.shipment_date}
                    onChange={e => setConfigForm({ ...configForm, shipment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Profit Margin % *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={configForm.profit_margin_pct}
                    onChange={e => setConfigForm({ ...configForm, profit_margin_pct: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">USD Rate (LKR per USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={configForm.usd_rate}
                    onChange={e => setConfigForm({ ...configForm, usd_rate: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">LKR → INR Exchange Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={configForm.lkr_inr_rate}
                    onChange={e => setConfigForm({ ...configForm, lkr_inr_rate: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Invoice Margin Configuration (Margin Config) */}
              <div className="p-4 bg-amber-50/70 border border-amber-300/80 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFC000] ring-2 ring-amber-400"></span>
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">Margin Configuration</span>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-[#FFC000] text-amber-950 shadow-xs">
                      Invoice Margin Config
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-800/80 font-medium">Applied to Invoice Rates & Documents</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-800">
                        Indian Invoice Margin % *
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        USD Invoice
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={configForm.indian_invoice_margin_pct}
                        onChange={e => setConfigForm({ ...configForm, indian_invoice_margin_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 pr-8"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Calculates Indian customs invoice unit rates & totals.</p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-800">
                        Colombo Invoice Margin % *
                      </label>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        LKR/USD Bank
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={configForm.colombo_invoice_margin_pct}
                        onChange={e => setConfigForm({ ...configForm, colombo_invoice_margin_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 pr-8"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Calculates Colombo bank invoice unit rates & totals.</p>
                  </div>
                </div>
              </div>

              {/* Customer Selection Table */}
              <div className="pt-2 border-t border-slate-200">
                <CustomerSelectionTable
                  customers={customerProfiles}
                  onChange={setCustomerProfiles}
                  allCustomers={allCustomers}
                  title="Shipment Customers"
                  subtitle="Add & manage consignees: inline fast editing or click details to edit address & tax info"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span>{creating ? 'Creating...' : 'Next: Customer Requirements'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Customer Requirements */}
          {currentStep === 2 && createdShipment && (
            <CustomerRequirementsStep
              shipmentId={createdShipment.id}
              customers={createdShipment.customers || []}
              onNext={() => {
                localStorage.removeItem(`a3_shipment_${createdShipment.id}_sub_tab`);
                setCurrentStep(3);
              }}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {/* Step 3: Vendor Process & PI */}
          {currentStep === 3 && createdShipment && (
            <VendorAllocationStep
              shipmentId={createdShipment.id}
              initialTab="allocation"
              onBack={() => setCurrentStep(2)}
              onFinish={() => {
                if (onSelectShipment) onSelectShipment(createdShipment.id);
                if (onShipmentCreated) onShipmentCreated(createdShipment.id);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
