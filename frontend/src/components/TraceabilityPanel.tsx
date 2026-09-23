import React, { useState, useEffect } from 'react';
import {
  GitFork,
  X,
  ChevronRight,
  Layers,
  Search,
  DollarSign,
  Package,
  Users,
  Truck,
  FileText,
  AlertCircle,
  RefreshCw,
  Info,
  ArrowLeft,
  Building2,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  ChevronDown
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
  const [filterQuery, setFilterQuery] = useState<string>('');

  const [historyStack, setHistoryStack] = useState<{ type: string; id: number; label: string }[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // Sync props when changed from outside
  useEffect(() => {
    if (rootEntityId) {
      setCurrentEntityType(rootEntityType);
      setCurrentEntityId(rootEntityId);
      setHistoryStack([]);
      setExpandedNodeId(null);
      setFilterQuery('');
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
    setExpandedNodeId(null);
    setFilterQuery('');
    if (onSelectEntity) {
      onSelectEntity(node.entity_type, node.entity_id);
    }
  };

  const handleBack = () => {
    if (historyStack.length === 0) return;
    const last = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setCurrentEntityType(last.type);
    setCurrentEntityId(last.id);
    setExpandedNodeId(null);
    setFilterQuery('');
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: prev[groupName] === false ? true : false
    }));
  };

  const toggleNodeDetail = (nodeKey: string) => {
    setExpandedNodeId(prev => prev === nodeKey ? null : nodeKey);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'SHIPMENT': return <Layers className="w-4 h-4 text-blue-600" />;
      case 'CUSTOMER': return <Users className="w-4 h-4 text-emerald-600" />;
      case 'VENDOR': return <Building2 className="w-4 h-4 text-amber-600" />;
      case 'PRODUCT': return <Package className="w-4 h-4 text-purple-600" />;
      case 'FINANCIAL': return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'PO': return <FileText className="w-4 h-4 text-blue-600" />;
      case 'PI': return <Receipt className="w-4 h-4 text-amber-600" />;
      case 'PACKING_LIST': return <FileSpreadsheet className="w-4 h-4 text-teal-600" />;
      case 'INVOICE': case 'INDIAN_INVOICE': case 'COLOMBO_INVOICE': return <FileText className="w-4 h-4 text-indigo-600" />;
      default: return <GitFork className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatKeyName = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace('Inr', '(INR)')
      .replace('Lkr', '(LKR)')
      .replace('Usd', '(USD)')
      .replace('Pct', '%');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] lg:w-[500px] bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end">
      <div className="w-full bg-white h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            {historyStack.length > 0 ? (
              <button
                onClick={handleBack}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Go back to previous node"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-400">
                <GitFork className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>ERP Traceability Studio</span>
                <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  {currentEntityType}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                {treeData?.root?.label || 'Interactive relationship explorer'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Traceability Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* History Breadcrumb Navigation Bar */}
        {historyStack.length > 0 && (
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 custom-scrollbar">
            <button
              onClick={() => {
                const root = historyStack[0];
                setHistoryStack([]);
                setCurrentEntityType(root.type);
                setCurrentEntityId(root.id);
                setExpandedNodeId(null);
              }}
              className="text-indigo-600 hover:underline font-bold shrink-0 text-[11px]"
            >
              Root
            </button>
            {historyStack.map((item, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                <button
                  onClick={() => {
                    setHistoryStack(prev => prev.slice(0, idx));
                    setCurrentEntityType(item.type);
                    setCurrentEntityId(item.id);
                    setExpandedNodeId(null);
                  }}
                  className="text-slate-600 hover:text-slate-900 truncate max-w-[110px] shrink-0 text-[11px] font-medium"
                  title={item.label}
                >
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Quick Filter Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter connected nodes by keyword, PO, vendor..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 font-medium placeholder:text-slate-400"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Workspace Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold">Tracing ERP graph relationships...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <div className="text-xs font-bold text-red-900">Traceability Error</div>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          ) : treeData?.root ? (
            <div className="space-y-4">
              
              {/* Active Root Entity Hero Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3 border border-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 shrink-0">
                      {getNodeIcon(treeData.root.entity_type)}
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block">
                        Focus Entity
                      </span>
                      <h3 className="text-base font-extrabold text-white leading-tight">
                        {treeData.root.label}
                      </h3>
                      {treeData.root.ref_number && (
                        <span className="text-xs font-mono text-slate-400">
                          Ref: {treeData.root.ref_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {treeData.root.status && (
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                      treeData.root.status === 'COMPLETED' || treeData.root.status === 'PROFITABLE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}>
                      {treeData.root.status}
                    </span>
                  )}
                </div>

                {/* Formatted Key Metadata Summary Pills */}
                {treeData.root.metadata && Object.keys(treeData.root.metadata).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    {Object.entries(treeData.root.metadata).map(([k, v]) => (
                      <div key={k} className="bg-slate-800/70 p-2 rounded-xl border border-slate-700/60">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight truncate">
                          {formatKeyName(k)}
                        </div>
                        <div className="font-bold text-slate-100 truncate text-xs font-mono mt-0.5">
                          {typeof v === 'number' && (k.includes('price') || k.includes('profit') || k.includes('lkr') || k.includes('amt') || k.includes('cost') || k.includes('sales') || k.includes('duty'))
                            ? `LKR ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Related Connected ERP Groups */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Linked Transactions & Nodes</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {treeData.children?.length || 0} Connected Groups
                  </span>
                </div>

                {treeData.children?.map((item, idx) => {
                  // Handle Group Container
                  if ('group' in item && item.group) {
                    const groupContainer = item as TraceabilityGroup;
                    const isExpanded = expandedGroups[groupContainer.group] !== false;

                    // Filter items by query if present
                    const filteredItems = groupContainer.items.filter(node => {
                      if (!filterQuery.trim()) return true;
                      const q = filterQuery.toLowerCase();
                      return (
                        node.label.toLowerCase().includes(q) ||
                        (node.ref_number && node.ref_number.toLowerCase().includes(q)) ||
                        node.entity_type.toLowerCase().includes(q)
                      );
                    });

                    if (filterQuery.trim() && filteredItems.length === 0) return null;

                    return (
                      <div key={idx} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                        <button
                          onClick={() => toggleGroup(groupContainer.group)}
                          className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 transition-colors cursor-pointer border-b border-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                            <span>{groupContainer.group}</span>
                          </div>
                          <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-full text-[10px] font-extrabold font-mono">
                            {filteredItems.length}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="p-2 divide-y divide-slate-100">
                            {filteredItems.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400 italic">
                                No records linked in this group.
                              </div>
                            ) : (
                              filteredItems.map((node, nIdx) => {
                                const nodeKey = `${node.entity_type}_${node.entity_id}_${nIdx}`;
                                const isDetailOpen = expandedNodeId === nodeKey;

                                return (
                                  <div key={nIdx} className="pt-2 first:pt-0 pb-2 space-y-2">
                                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-indigo-50/60 transition-all group">
                                      <div
                                        onClick={() => handleDrillDown(node)}
                                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                                      >
                                        <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 shrink-0 group-hover:bg-white transition-colors">
                                          {getNodeIcon(node.entity_type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                            {node.label}
                                          </div>
                                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                            {node.ref_number && (
                                              <span className="font-mono text-slate-600 font-medium">
                                                {node.ref_number}
                                              </span>
                                            )}
                                            {node.amount !== undefined && (
                                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                                {node.currency || 'LKR'} {node.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {node.metadata && Object.keys(node.metadata).length > 0 && (
                                          <button
                                            onClick={() => toggleNodeDetail(nodeKey)}
                                            className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                              isDetailOpen ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                                            }`}
                                            title="Toggle Details"
                                          >
                                            <Info className="w-3.5 h-3.5" />
                                          </button>
                                        )}

                                        <button
                                          onClick={() => handleDrillDown(node)}
                                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                          title="Trace deeper into this entity"
                                        >
                                          <span>Trace</span>
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inline Expandable Detail Attributes */}
                                    {isDetailOpen && node.metadata && (
                                      <div className="mx-2 p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs animate-in fade-in duration-150">
                                        {Object.entries(node.metadata).map(([mk, mv]) => (
                                          <div key={mk} className="bg-white p-2 rounded-lg border border-slate-200">
                                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                                              {formatKeyName(mk)}
                                            </div>
                                            <div className="font-bold text-slate-800 font-mono text-[11px] truncate">
                                              {String(mv)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Standalone Node
                  const nodeItem = item as TraceabilityNode;
                  return (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs flex items-center justify-between hover:border-indigo-300 transition-colors"
                    >
                      <div
                        onClick={() => handleDrillDown(nodeItem)}
                        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      >
                        <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
                          {getNodeIcon(nodeItem.entity_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {nodeItem.label}
                          </div>
                          {nodeItem.amount !== undefined && (
                            <div className="text-xs font-mono font-bold text-emerald-600">
                              {nodeItem.currency || 'LKR'} {nodeItem.amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDrillDown(nodeItem)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <span>Trace</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Panel Footer Status Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0 font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Traceability Engine Active</span>
          </div>
          <span className="font-mono text-[10px]">A3 Cargo ERP</span>
        </div>

      </div>
    </div>
  );
};
