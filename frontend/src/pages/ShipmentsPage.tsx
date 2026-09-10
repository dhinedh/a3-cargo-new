import React, { useState, useEffect, useMemo } from 'react';
import {
  Ship,
  Plus,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Layers,
  Search,
  LayoutGrid,
  List,
  RotateCw,
  MapPin,
  Users,
  Box,
  SlidersHorizontal,
  FolderGit2
} from 'lucide-react';
import type { Shipment } from '../types';
import { apiClient } from '../api/client';

interface ShipmentsPageProps {
  onSelectShipment: (shipmentId: number) => void;
}

export const ShipmentsPage: React.FC<ShipmentsPageProps> = ({ onSelectShipment }) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fyFilter, setFyFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const loadData = async () => {
    setLoading(true);
    try {
      const sData = await apiClient.getShipments();
      setShipments(sData);
    } catch (err) {
      console.error('Failed to load shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Most recent in-progress shipment for 1-click resumption
  const inProgressShipment = shipments.find(s => s.status !== 'COMPLETED' && s.status !== 'CANCELLED') || shipments[0];

  const handleResumeShipment = (s: Shipment) => {
    onSelectShipment(s.id);
  };

  const handleCreateNewShipment = async () => {
    try {
      const nextNo = await apiClient.getNextShipmentNumber();
      const newShipment = await apiClient.createShipment({
        shipment_no: nextNo.shipment_no,
        financial_year: nextNo.financial_year,
        status: 'DRAFT',
        destination: 'Colombo Port, Sri Lanka',
        currency: 'INR',
        usd_rate: 305.0,
        lkr_inr_rate: 3.65,
        profit_margin_pct: 15.0,
        indian_invoice_margin_pct: 15.0,
        colombo_invoice_margin_pct: 15.0,
        margin_mode: 'MARGIN_ON_REVENUE',
        customers: []
      });
      localStorage.setItem(`a3_shipment_${newShipment.id}_main_tab`, 'config');
      onSelectShipment(newShipment.id);
    } catch (err: any) {
      alert('Failed to initialize shipment: ' + (err.response?.data?.detail || err.message || 'Unknown error'));
    }
  };

  // Distinct Financial Years for filter
  const distinctFYs = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach(s => {
      if (s.financial_year) set.add(s.financial_year);
    });
    return Array.from(set);
  }, [shipments]);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNo = s.shipment_no.toLowerCase().includes(q);
        const matchesDest = s.destination?.toLowerCase().includes(q);
        const matchesCustomer = s.customers?.some(c => c.name.toLowerCase().includes(q));
        if (!matchesNo && !matchesDest && !matchesCustomer) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && s.status !== statusFilter) {
        return false;
      }

      // FY filter
      if (fyFilter !== 'ALL' && s.financial_year !== fyFilter) {
        return false;
      }

      return true;
    });
  }, [shipments, searchQuery, statusFilter, fyFilter]);

  // Status counters
  const counts = useMemo(() => {
    const res = { ALL: shipments.length, DRAFT: 0, CONFIGURED: 0, SHIPPED: 0, COMPLETED: 0 };
    shipments.forEach(s => {
      if (s.status === 'DRAFT') res.DRAFT++;
      else if (s.status === 'CONFIGURED') res.CONFIGURED++;
      else if (s.status === 'SHIPPED') res.SHIPPED++;
      else if (s.status === 'COMPLETED') res.COMPLETED++;
    });
    return res;
  }, [shipments]);

  const getStatusLozenge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#E3FCEF] text-[#006644] border border-[#ABF5D1]">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#DEEBFF] text-[#0747A6] border border-[#B3D4FF]">
            <Ship className="w-3 h-3" />
            SHIPPED
          </span>
        );
      case 'CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#FFF0B3] text-[#172B4D] border border-[#FFE380]">
            <Clock className="w-3 h-3" />
            CONFIGURED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#FFEBE6] text-[#DE350B] border border-[#FFBDAD]">
            <XCircle className="w-3 h-3" />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#EBECF0] text-[#42526E] border border-[#DFE1E6]">
            <AlertCircle className="w-3 h-3" />
            DRAFT
          </span>
        );
    }
  };

  const getStageLabel = (s: Shipment) => {
    if (s.status === 'COMPLETED') return 'Stage 4: Executed & Cleared';
    if (s.products && s.products.length > 0) return `Stage 3: ${s.products.length} Products Configured`;
    return 'Stage 2: Customer Requirements & RFQ';
  };

  return (
    <div className="space-y-4 font-sans max-w-full text-[#091E42]">
      {/* 1. Atlassian Breadcrumb & Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#DFE1E6] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5E6C84] mb-1 font-medium">
            <span>Workspaces</span>
            <span>/</span>
            <span>A3 Express Cargo</span>
            <span>/</span>
            <span className="text-[#091E42] font-semibold">Shipments Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#091E42] flex items-center gap-2.5">
              <FolderGit2 className="w-6 h-6 text-[#0C66E4]" />
              Shipments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-[#EBECF0] text-[#172B4D] border border-[#DFE1E6]">
              {shipments.length}
            </span>
          </div>
          <p className="text-xs text-[#5E6C84] mt-1">
            Track freight pipelines, manage customer demand allocation, automate tariff duty calculations, and generate export documents.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={loadData}
            title="Refresh Shipments"
            className="p-2 text-[#5E6C84] hover:text-[#091E42] hover:bg-[#EBECF0] rounded-md border border-[#DFE1E6] transition-colors cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0C66E4]' : ''}`} />
          </button>

          <button
            onClick={handleCreateNewShipment}
            className="px-3.5 py-2 bg-[#0C66E4] hover:bg-[#0052CC] text-white rounded-md text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" />
            <span>Create Shipment</span>
          </button>
        </div>
      </div>

      {/* 2. Atlassian Spotlight: Active Work-In-Progress Shipment Banner */}
      {!loading && inProgressShipment && (
        <div className="bg-[#E9F2FF] border border-[#B3D4FF] rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#4C9AFF]">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#0C66E4] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Ship className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#0052CC] text-white">
                  ACTIVE WORKSPACE
                </span>
                <span className="w-2 h-2 rounded-full bg-[#0C66E4] animate-ping" />
                <span className="font-mono text-sm font-bold text-[#0C66E4]">
                  #{inProgressShipment.shipment_no}
                </span>
                {getStatusLozenge(inProgressShipment.status)}
              </div>

              <div className="flex items-center gap-3 text-xs text-[#42526E] flex-wrap">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-[#5E6C84]" />
                  {inProgressShipment.shipment_date || 'Date Pending'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#5E6C84]" />
                  {inProgressShipment.destination || 'Colombo Port, Sri Lanka'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[#0052CC] font-semibold">
                  <Layers className="w-3.5 h-3.5" />
                  {getStageLabel(inProgressShipment)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleResumeShipment(inProgressShipment)}
            className="px-4 py-2 bg-[#0C66E4] hover:bg-[#0052CC] text-white text-xs font-bold rounded-md transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 self-start md:self-auto"
          >
            <span>Resume Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Jira-Style Enterprise Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-[#DFE1E6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search & Quick Filters */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-[#5E6C84] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by shipment #, customer, destination..."
              className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-md border border-[#DFE1E6] bg-[#FAFBFC] focus:bg-white focus:border-[#4C9AFF] focus:ring-2 focus:ring-[#4C9AFF]/20 text-[#091E42] outline-none transition-all placeholder:text-[#5E6C84]"
            />
          </div>

          {/* Status Lozenge Pills */}
          <div className="flex items-center gap-1 bg-[#F4F5F7] p-0.5 rounded-lg border border-[#DFE1E6] overflow-x-auto text-xs">
            {(['ALL', 'DRAFT', 'CONFIGURED', 'SHIPPED', 'COMPLETED'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer select-none flex items-center gap-1 ${
                  statusFilter === st
                    ? 'bg-white text-[#0C66E4] shadow-xs border border-[#DFE1E6]'
                    : 'text-[#5E6C84] hover:text-[#091E42]'
                }`}
              >
                <span>{st === 'ALL' ? 'All' : st}</span>
                <span className={`px-1 py-0.2 rounded text-[10px] ${statusFilter === st ? 'bg-[#E9F2FF] text-[#0C66E4]' : 'bg-[#EBECF0] text-[#5E6C84]'}`}>
                  {counts[st]}
                </span>
              </button>
            ))}
          </div>

          {/* Financial Year Selector */}
          {distinctFYs.length > 1 && (
            <div className="flex items-center gap-1.5">
              <select
                value={fyFilter}
                onChange={e => setFyFilter(e.target.value)}
                className="px-2 py-1.5 text-xs rounded-md border border-[#DFE1E6] bg-[#FAFBFC] text-[#091E42] font-semibold outline-none focus:border-[#4C9AFF] cursor-pointer"
              >
                <option value="ALL">All Financial Years</option>
                {distinctFYs.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View Mode Switcher (Table vs Cards) */}
        <div className="flex items-center gap-1 bg-[#F4F5F7] p-0.5 rounded-lg border border-[#DFE1E6] shrink-0 self-end md:self-auto">
          <button
            onClick={() => setViewMode('table')}
            title="List / Table View"
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-[#0C66E4] shadow-xs border border-[#DFE1E6]'
                : 'text-[#5E6C84] hover:text-[#091E42]'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            title="Grid / Card View"
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-[#0C66E4] shadow-xs border border-[#DFE1E6]'
                : 'text-[#5E6C84] hover:text-[#091E42]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Main Content: Table View or Cards View */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-[#DFE1E6] text-center space-y-3 shadow-xs">
          <RotateCw className="w-8 h-8 text-[#0C66E4] animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#5E6C84]">Loading shipment pipelines...</p>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-[#DFE1E6] text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#F4F5F7] border border-[#DFE1E6] flex items-center justify-center mx-auto text-[#5E6C84]">
            <Ship className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#091E42]">
              {shipments.length === 0 ? 'No Shipments Initialized' : 'No Shipments Found'}
            </h3>
            <p className="text-xs text-[#5E6C84] max-w-sm mx-auto mt-1">
              {shipments.length === 0
                ? 'Initialize a new shipment pipeline to start managing customer demands, duty calculations, and invoices.'
                : 'No shipments match your current search query or filter lozenges. Try clearing the filter.'}
            </p>
          </div>
          {shipments.length === 0 ? (
            <button
              onClick={handleCreateNewShipment}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0C66E4] hover:bg-[#0052CC] text-white rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Shipment Pipeline</span>
            </button>
          ) : (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setFyFilter('ALL'); }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#EBECF0] hover:bg-[#DFE1E6] text-[#091E42] rounded-md text-xs font-bold transition-all cursor-pointer"
            >
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Jira Enterprise Data Grid (Table Mode) */
        <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F4F5F7] border-b border-[#DFE1E6] text-[#5E6C84] text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="py-3 px-4 font-semibold">Shipment Key</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">Date & FY</th>
                  <th className="py-3 px-4 font-semibold">Consignee Buyers</th>
                  <th className="py-3 px-4 font-semibold">Pipeline Stage</th>
                  <th className="py-3 px-3 font-semibold">Items</th>
                  <th className="py-3 px-3 font-semibold">Destination</th>
                  <th className="py-3 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE1E6]">
                {filteredShipments.map(s => {
                  const customerNames = s.customers && s.customers.length > 0
                    ? s.customers.map(c => c.name).join(', ')
                    : 'Pending Allocation';

                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleResumeShipment(s)}
                      className="hover:bg-[#FAFBFC] transition-colors cursor-pointer group"
                    >
                      {/* Shipment Key */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0C66E4] group-hover:underline">
                        #{s.shipment_no}
                      </td>

                      {/* Status Lozenge */}
                      <td className="py-3 px-3">
                        {getStatusLozenge(s.status)}
                      </td>

                      {/* Date & FY */}
                      <td className="py-3 px-3 text-[#42526E]">
                        <div className="font-semibold text-[#091E42]">{s.shipment_date || 'N/A'}</div>
                        <div className="text-[10px] text-[#5E6C84] font-mono">{s.financial_year}</div>
                      </td>

                      {/* Consignee Buyers */}
                      <td className="py-3 px-4">
                        <div className="max-w-[240px] truncate font-medium text-[#091E42]" title={customerNames}>
                          {s.customers && s.customers.length > 0 ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-[#5E6C84] shrink-0" />
                              <span className="truncate">{customerNames}</span>
                            </span>
                          ) : (
                            <span className="text-[#8993A4] italic">None Assigned</span>
                          )}
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 text-xs text-[#0052CC] font-semibold bg-[#DEEBFF]/60 px-2 py-1 rounded border border-[#B3D4FF]/60">
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[220px]">{getStageLabel(s)}</span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3 px-3 text-[#42526E] font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Box className="w-3 h-3 text-[#5E6C84]" />
                          <span>{s.products?.length || 0} products</span>
                        </span>
                      </td>

                      {/* Destination */}
                      <td className="py-3 px-3 text-[#42526E]">
                        <span className="truncate max-w-[160px] block" title={s.destination}>
                          {s.destination || 'Colombo Port, Sri Lanka'}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0C66E4] group-hover:text-[#0052CC]">
                          <span>Open</span>
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-[#FAFBFC] border-t border-[#DFE1E6] px-4 py-2.5 flex items-center justify-between text-xs text-[#5E6C84]">
            <span>Showing <strong>{filteredShipments.length}</strong> of <strong>{shipments.length}</strong> total shipments</span>
            <span className="font-mono text-[11px]">A3 Express Cargo Enterprise Hub</span>
          </div>
        </div>
      ) : (
        /* Jira Card / Kanban Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShipments.map(s => {
            const customerNames = s.customers && s.customers.length > 0
              ? s.customers.map(c => c.name).join(', ')
              : 'Pending Allocation';

            return (
              <div
                key={s.id}
                onClick={() => handleResumeShipment(s)}
                className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-xs hover:shadow-md hover:border-[#4C9AFF] cursor-pointer transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2.5">
                  {/* Card Header: Key + Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-[#0C66E4] group-hover:underline">
                      #{s.shipment_no}
                    </span>
                    {getStatusLozenge(s.status)}
                  </div>

                  {/* Card Metadata Box */}
                  <div className="text-xs text-[#42526E] space-y-2 bg-[#FAFBFC] p-3 rounded-lg border border-[#DFE1E6]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#5E6C84] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Date:</span>
                      </span>
                      <strong className="text-[#091E42]">{s.shipment_date || 'N/A'}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5E6C84] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>Buyers:</span>
                      </span>
                      <strong className="text-[#091E42] max-w-[150px] truncate text-right" title={customerNames}>
                        {customerNames}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5E6C84] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Port:</span>
                      </span>
                      <span className="text-[#091E42] font-semibold truncate max-w-[150px]">
                        {s.destination || 'Colombo Port'}
                      </span>
                    </div>

                    <div className="text-[#0052CC] font-bold flex items-center gap-1.5 pt-1 border-t border-[#DFE1E6]">
                      <Layers className="w-3.5 h-3.5 text-[#0C66E4]" />
                      <span className="truncate">{getStageLabel(s)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-2 border-t border-[#DFE1E6] flex items-center justify-between text-xs text-[#0C66E4] font-bold group-hover:text-[#0052CC]">
                  <span>Resume Workspace</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
