import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  ChevronRight,
  GitFork,
  Ship,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import type { TrackingDashboardSummary, TrackingShipmentRow } from '../types';
import { apiClient } from '../api/client';

interface TrackingDashboardPageProps {
  onSelectShipment?: (shipmentId: number) => void;
  onOpenTraceability?: (type: string, id: number) => void;
}

export const TrackingDashboardPage: React.FC<TrackingDashboardPageProps> = ({
  onSelectShipment,
  onOpenTraceability
}) => {
  const [data, setData] = useState<TrackingDashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const summary = await apiClient.getTrackingDashboard();
      setData(summary);
    } catch (err) {
      console.error('Failed to fetch tracking dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const filteredShipments = (data?.shipments || []).filter(s => {
    const matchesSearch =
      s.shipment_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customer_names.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.destination.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'DELAYED') return s.is_delayed;
    if (filterStatus === 'BLOCKED') return s.is_blocked;
    if (filterStatus === 'COMPLETED') return s.status === 'COMPLETED' || s.progress_pct === 100;
    if (filterStatus === 'IN_PROGRESS') return s.status !== 'COMPLETED' && s.status !== 'CANCELLED';

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Ship className="w-4 h-4" />
            <span>Operations & Cargo Tracking Hub</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Shipment Operational Status & Tracking</h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor real-time progress across all active shipments, milestone completion, and delay warnings.
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Tracking</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Shipments</div>
          <div className="text-2xl font-black text-slate-800">{data?.kpis.total_shipments || 0}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">In Progress</div>
          <div className="text-2xl font-black text-blue-700">{data?.kpis.in_progress || 0}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completed</div>
          <div className="text-2xl font-black text-emerald-700">{data?.kpis.completed || 0}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Delayed</div>
          <div className="text-2xl font-black text-amber-700">{data?.kpis.delayed || 0}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Blocked</div>
          <div className="text-2xl font-black text-red-700">{data?.kpis.blocked || 0}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Attention Required</div>
          <div className="text-2xl font-black text-purple-700">{data?.kpis.attention_required || 0}</div>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Shipment No, Customer, or Destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold">
          {['ALL', 'IN_PROGRESS', 'DELAYED', 'BLOCKED', 'COMPLETED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Shipment Tracking Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white font-semibold">
                <th className="p-3.5">Shipment No</th>
                <th className="p-3.5">Customer(s)</th>
                <th className="p-3.5">Destination</th>
                <th className="p-3.5">Current Stage</th>
                <th className="p-3.5 text-center">Milestones</th>
                <th className="p-3.5 text-center">Overall Progress</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">Loading tracking pipeline...</td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">No shipments found matching criteria.</td>
                </tr>
              ) : (
                filteredShipments.map((s) => (
                  <tr key={s.shipment_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-blue-700">
                      <button
                        onClick={() => onSelectShipment?.(s.shipment_id)}
                        className="hover:underline cursor-pointer"
                      >
                        {s.shipment_no}
                      </button>
                      <div className="text-[10px] text-slate-400 font-sans font-normal">FY {s.financial_year}</div>
                    </td>

                    <td className="p-3.5 font-semibold text-slate-800 max-w-xs truncate">
                      {s.customer_names}
                    </td>

                    <td className="p-3.5 text-slate-600">
                      {s.destination}
                    </td>

                    <td className="p-3.5 text-slate-800 font-medium">
                      {s.current_stage}
                    </td>

                    <td className="p-3.5 text-center font-mono text-slate-700">
                      <span className="font-bold text-emerald-700">{s.completed_milestones}</span> / {s.total_milestones}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${s.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold font-mono text-slate-700">{s.progress_pct}%</span>
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      {s.is_blocked ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded border border-red-300">BLOCKED</span>
                      ) : s.is_delayed ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded border border-amber-300">DELAYED</span>
                      ) : s.progress_pct === 100 ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-300">COMPLETED</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded border border-blue-300">IN PROGRESS</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onOpenTraceability?.('SHIPMENT', s.shipment_id)}
                          className="px-2.5 py-1 bg-[#091E42] text-[#4C9AFF] hover:bg-[#172B4D] hover:text-white rounded-lg text-xs font-bold border border-[#253858] transition-colors flex items-center gap-1 cursor-pointer"
                          title="Open Dynamic Traceability Tree"
                        >
                          <GitFork className="w-3.5 h-3.5" />
                          <span>Trace</span>
                        </button>
                        <button
                          onClick={() => onSelectShipment?.(s.shipment_id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Open Shipment Workspace"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
