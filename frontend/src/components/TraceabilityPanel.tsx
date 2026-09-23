import React, { useState, useEffect } from 'react';
import {
  GitFork,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
  ExternalLink,
  DollarSign,
  Package,
  Users,
  Truck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Calendar,
  Building,
  RefreshCw,
  Info
} from 'lucide-react';
import type { TraceabilityNode, TraceabilityGroup, TraceabilityTreeResponse } from '../types';
import { apiClient } from '../api/client';

interface TraceabilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  rootEntityType?: string;
  rootEntityId?: number;
  onSelectEntity?: (entityType: string, entityId: number) => void;
}

export const TraceabilityPanel: React.FC<TraceabilityPanelProps> = ({
  isOpen,
  onClose,
  rootEntityType = 'SHIPMENT',
  rootEntityId,
  onSelectEntity
}) => {
  const [currentEntityType, setCurrentEntityType] = useState<string>(rootEntityType);
  const [currentEntityId, setCurrentEntityId] = useState<number | undefined>(rootEntityId);

  const [treeData, setTreeData] = useState<TraceabilityTreeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [historyStack, setHistoryStack] = useState<{ type: string; id: number; label: string }[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Financials': true,
    'Customers': true,
    'Products & Pricing': true,
    'Vendors & Sourcing': true
  });
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<TraceabilityNode | null>(null);

  // Sync props when changed from outside
  useEffect(() => {
    if (rootEntityId) {
      setCurrentEntityType(rootEntityType);
      setCurrentEntityId(rootEntityId);
      setHistoryStack([]);
    }
  }, [rootEntityType, rootEntityId]);

  // Fetch Tree Data
  const fetchTree = async (type: string, id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getTraceabilityTree(type, id);
      setTreeData(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load traceability graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentEntityId) {
      fetchTree(currentEntityType, currentEntityId);
    }
  }, [isOpen, currentEntityType, currentEntityId]);

  if (!isOpen) return null;

  const handleDrillDown = (node: TraceabilityNode) => {
    if (treeData?.root) {
      setHistoryStack(prev => [...prev, {
        type: currentEntityType,
        id: currentEntityId!,
        label: treeData.root.label
      }]);
    }
    setCurrentEntityType(node.entity_type);
    setCurrentEntityId(node.entity_id);
    setSelectedNodeDetail(null);
  };

  const handlePopHistory = (index: number) => {
    const target = historyStack[index];
    setHistoryStack(prev => prev.slice(0, index));
    setCurrentEntityType(target.type);
    setCurrentEntityId(target.id);
    setSelectedNodeDetail(null);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: prev[groupName] === undefined ? false : !prev[groupName]
    }));
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'SHIPMENT': return <Layers className="w-4 h-4 text-blue-400" />;
      case 'CUSTOMER': return <Users className="w-4 h-4 text-emerald-400" />;
      case 'VENDOR': return <Truck className="w-4 h-4 text-amber-400" />;
      case 'PRODUCT': return <Package className="w-4 h-4 text-purple-400" />;
      case 'FINANCIAL': return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'PO': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'PI': return <ReceiptIcon className="w-4 h-4 text-amber-400" />;
      case 'INVOICE': case 'INDIAN_INVOICE': case 'COLOMBO_INVOICE': return <FileText className="w-4 h-4 text-indigo-400" />;
      default: return <GitFork className="w-4 h-4 text-slate-400" />;
    }
  };

  const ReceiptIcon = FileText;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] lg:w-[540px] bg-[#091E42] border-l border-[#253858] shadow-2xl z-50 flex flex-col font-sans text-slate-200 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-[#253858] bg-[#0C1E3A] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0C66E4]/20 border border-[#4C9AFF]/30 flex items-center justify-center text-[#4C9AFF]">
            <GitFork className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Traceability & ERP Drill-Down</span>
              <span className="text-[10px] bg-[#172B4D] text-[#4C9AFF] px-2 py-0.5 rounded border border-[#253858] font-mono">
                LIVE
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Trace source transaction, vendor & financial paths</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#172B4D] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* History Breadcrumb Navigation */}
      {historyStack.length > 0 && (
        <div className="px-4 py-2 border-b border-[#253858] bg-[#172B4D]/60 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 scrollbar-none">
          <button
            onClick={() => handlePopHistory(0)}
            className="text-[#4C9AFF] hover:underline font-bold shrink-0"
          >
            Root
          </button>
          {historyStack.map((item, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
              <button
                onClick={() => handlePopHistory(idx)}
                className="text-slate-300 hover:text-white truncate max-w-[120px] shrink-0"
                title={item.label}
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 text-[#4C9AFF] animate-spin mx-auto" />
            <p className="text-xs font-semibold">Tracing ERP relationships & source transactions...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-900/20 border border-red-700/50 rounded-xl text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <div className="text-xs font-bold text-red-300">Traceability Lookup Error</div>
            <p className="text-[11px] text-slate-300">{error}</p>
          </div>
        ) : treeData?.root ? (
          <div className="space-y-4">
            {/* Root Entity Card */}
            <div className="bg-[#172B4D] border border-[#253858] rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#091E42] border border-[#253858]">
                    {getNodeIcon(treeData.root.entity_type)}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#4C9AFF] tracking-wider uppercase">
                      ROOT {treeData.root.entity_type}
                    </div>
                    <div className="text-sm font-black text-white">{treeData.root.label}</div>
                  </div>
                </div>

                {treeData.root.status && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    treeData.root.status === 'COMPLETED' || treeData.root.status === 'PROFITABLE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  }`}>
                    {treeData.root.status}
                  </span>
                )}
              </div>

              {/* Root Metadata Breakdown */}
              {treeData.root.metadata && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#253858] text-xs">
                  {Object.entries(treeData.root.metadata).map(([k, v]) => (
                    <div key={k} className="bg-[#091E42]/60 p-2 rounded-lg border border-[#253858]/50">
                      <div className="text-[10px] text-slate-400 uppercase tracking-tight">{k.replace(/_/g, ' ')}</div>
                      <div className="font-semibold text-slate-200 truncate">
                        {typeof v === 'number' && (k.includes('price') || k.includes('profit') || k.includes('lkr') || k.includes('amt') || k.includes('cost') || k.includes('sales'))
                          ? `LKR ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tree Groups & Sub-nodes */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                <Layers className="w-3.5 h-3.5 text-[#4C9AFF]" />
                <span>Connected ERP Relationships</span>
              </div>

              {treeData.children?.map((item, idx) => {
                // If item is a group container
                if ('group' in item && item.group) {
                  const groupContainer = item as TraceabilityGroup;
                  const isExpanded = expandedGroups[groupContainer.group] !== false;

                  return (
                    <div key={idx} className="bg-[#172B4D]/60 border border-[#253858] rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleGroup(groupContainer.group)}
                        className="w-full px-3.5 py-2.5 bg-[#172B4D] hover:bg-[#1E3A66] flex items-center justify-between text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`w-4 h-4 text-[#4C9AFF] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <span>{groupContainer.group}</span>
                        </div>
                        <span className="text-[10px] bg-[#091E42] text-slate-300 px-2 py-0.5 rounded-full font-mono border border-[#253858]">
                          {groupContainer.items.length}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="p-2 space-y-1.5 divide-y divide-[#253858]/40">
                          {groupContainer.items.length === 0 ? (
                            <div className="p-3 text-center text-[11px] text-slate-500 italic">
                              No related records linked.
                            </div>
                          ) : (
                            groupContainer.items.map((node, nIdx) => (
                              <div
                                key={nIdx}
                                className="pt-1.5 first:pt-0 p-2.5 rounded-lg hover:bg-[#1E3A66]/40 transition-colors flex items-center justify-between gap-3 group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="p-1.5 rounded-md bg-[#091E42] border border-[#253858] shrink-0">
                                    {getNodeIcon(node.entity_type)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                      <span className="truncate">{node.label}</span>
                                      {node.ref_number && (
                                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                          ({node.ref_number})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                      <span className="text-[10px] bg-[#091E42] px-1.5 py-0.2 rounded font-mono text-[#4C9AFF]">
                                        {node.entity_type}
                                      </span>
                                      {node.amount !== undefined && (
                                        <span className="font-mono text-emerald-400 font-semibold">
                                          {node.currency || 'LKR'} {node.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => setSelectedNodeDetail(node)}
                                    className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-[#091E42]"
                                    title="View Details"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDrillDown(node)}
                                    className="p-1 text-[#4C9AFF] hover:text-white hover:bg-[#0C66E4] rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold px-2 py-1"
                                    title="Trace deeper into this node"
                                  >
                                    <span>Trace</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // Direct standalone node
                const nodeItem = item as TraceabilityNode;
                return (
                  <div key={idx} className="bg-[#172B4D] border border-[#253858] p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[#091E42]">
                        {getNodeIcon(nodeItem.entity_type)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{nodeItem.label}</div>
                        {nodeItem.amount !== undefined && (
                          <div className="text-xs font-mono text-emerald-400">
                            {nodeItem.currency || 'LKR'} {nodeItem.amount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDrillDown(nodeItem)}
                      className="px-2.5 py-1 bg-[#0C66E4] hover:bg-[#0052CC] text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <span>Drill Down</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Node Detail Inspection Modal / Drawer Overlay */}
      {selectedNodeDetail && (
        <div className="p-4 bg-[#0C1E3A] border-t border-[#253858] space-y-3 shrink-0 animate-in slide-in-from-bottom duration-150">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#4C9AFF] flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              <span>Entity Attributes: {selectedNodeDetail.label}</span>
            </div>
            <button
              onClick={() => setSelectedNodeDetail(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#091E42] p-2 rounded-lg border border-[#253858]">
              <div className="text-[10px] text-slate-400">Entity Type</div>
              <div className="font-mono text-white font-bold">{selectedNodeDetail.entity_type}</div>
            </div>
            <div className="bg-[#091E42] p-2 rounded-lg border border-[#253858]">
              <div className="text-[10px] text-slate-400">Entity ID</div>
              <div className="font-mono text-white font-bold">#{selectedNodeDetail.entity_id}</div>
            </div>

            {selectedNodeDetail.metadata && Object.entries(selectedNodeDetail.metadata).map(([k, v]) => (
              <div key={k} className="bg-[#091E42] p-2 rounded-lg border border-[#253858]">
                <div className="text-[10px] text-slate-400 uppercase">{k.replace(/_/g, ' ')}</div>
                <div className="font-semibold text-slate-200 truncate">{String(v)}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => handleDrillDown(selectedNodeDetail)}
            className="w-full py-2 bg-[#0C66E4] hover:bg-[#0052CC] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <span>Focus Trace Context On This Node</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
