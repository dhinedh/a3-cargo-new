import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  SkipForward,
  PlayCircle,
  Calendar,
  User,
  FileText,
  Edit2,
  RefreshCw,
  Plus
} from 'lucide-react';
import type { ShipmentMilestone } from '../types';
import { apiClient } from '../api/client';

interface ShipmentTrackingTimelineProps {
  shipmentId: number;
}

export const ShipmentTrackingTimeline: React.FC<ShipmentTrackingTimelineProps> = ({ shipmentId }) => {
  const [milestones, setMilestones] = useState<ShipmentMilestone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingMs, setEditingMs] = useState<ShipmentMilestone | null>(null);

  const [editForm, setEditForm] = useState({
    status: 'PENDING',
    delay_days: 0,
    delay_reason: '',
    owner_person: 'Operations Manager',
    remarks: ''
  });

  const fetchMilestones = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getShipmentMilestones(shipmentId);
      setMilestones(data);
    } catch (err: any) {
      console.error('Failed to fetch milestones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shipmentId) {
      fetchMilestones();
    }
  }, [shipmentId]);

  const handleOpenEdit = (m: ShipmentMilestone) => {
    setEditingMs(m);
    setEditForm({
      status: m.status,
      delay_days: m.delay_days || 0,
      delay_reason: m.delay_reason || '',
      owner_person: m.owner_person || 'Operations Manager',
      remarks: m.remarks || ''
    });
  };

  const handleSaveMilestone = async () => {
    if (!editingMs) return;
    try {
      await apiClient.updateShipmentMilestone(shipmentId, editingMs.id, editForm);
      await fetchMilestones();
      setEditingMs(null);
    } catch (err: any) {
      alert('Failed to update milestone: ' + (err.message || 'Unknown error'));
    }
  };

  const handleInitMilestones = async () => {
    if (!confirm('Re-initialize 23 India -> Colombo operational tracking milestones for this shipment?')) return;
    try {
      await apiClient.initShipmentMilestones(shipmentId, 'SEA_FCL');
      await fetchMilestones();
    } catch (err: any) {
      alert('Failed to initialize milestones: ' + (err.message || 'Unknown error'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> COMPLETED</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300"><PlayCircle className="w-3 h-3 text-blue-600 animate-pulse" /> IN PROGRESS</span>;
      case 'BLOCKED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-800 border border-red-300"><AlertTriangle className="w-3 h-3 text-red-600" /> BLOCKED</span>;
      case 'SKIPPED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300"><SkipForward className="w-3 h-3 text-slate-500" /> SKIPPED</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3 text-amber-500" /> PENDING</span>;
    }
  };

  const completedCount = milestones.filter(m => m.status === 'COMPLETED').length;
  const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Tracking Summary Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <span>India &rarr; Colombo Shipment Operational Tracking</span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded border border-blue-200">
              23 Standard Milestones
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status tracking for India clearance, sea transit, and Colombo port release.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:w-48 space-y-1">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Overall Progress</span>
              <span>{progressPct}% ({completedCount}/{milestones.length})</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleInitMilestones}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            title="Reset milestone sequence"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Sequence</span>
          </button>
        </div>
      </div>

      {/* Operational Milestone Timeline Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold">Loading shipment milestone timeline...</p>
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-slate-200 space-y-4 my-4">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`relative bg-white p-4 rounded-xl border transition-all ${
                m.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : m.status === 'BLOCKED'
                  ? 'border-red-300 bg-red-50/20'
                  : m.status === 'IN_PROGRESS'
                  ? 'border-blue-300 ring-2 ring-blue-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Timeline Bullet Node */}
              <div className={`absolute -left-[31px] top-4 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                m.status === 'COMPLETED'
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : m.status === 'BLOCKED'
                  ? 'border-red-500 bg-red-500 text-white'
                  : m.status === 'IN_PROGRESS'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300'
              }`}>
                {m.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      #{m.sequence}
                    </span>
                    <h4 className="text-xs font-black text-slate-800">{m.milestone_name}</h4>
                    {getStatusBadge(m.status)}
                    {m.delay_days > 0 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded border border-amber-300">
                        +{m.delay_days}d Delay
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>Owner: <strong className="text-slate-700">{m.owner_person || 'Operations'}</strong></span>
                    </div>

                    {m.actual_date && (
                      <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <Calendar className="w-3 h-3" />
                        <span>Completed: {new Date(m.actual_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {m.remarks && (
                      <div className="text-slate-600 italic">
                        &quot;{m.remarks}&quot;
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEdit(m)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer self-start sm:self-center"
                >
                  <Edit2 className="w-3 h-3 text-slate-500" />
                  <span>Update</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Milestone Modal */}
      {editingMs && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase">Update Operational Status</span>
                <h3 className="text-sm font-black text-slate-800">{editingMs.milestone_name}</h3>
              </div>
              <button onClick={() => setEditingMs(null)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg font-semibold text-slate-800"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="SKIPPED">SKIPPED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Delay (Days)</label>
                  <input
                    type="number"
                    value={editForm.delay_days}
                    onChange={(e) => setEditForm(prev => ({ ...prev, delay_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Responsible Owner</label>
                  <input
                    type="text"
                    value={editForm.owner_person}
                    onChange={(e) => setEditForm(prev => ({ ...prev, owner_person: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                  />
                </div>
              </div>

              {editForm.delay_days > 0 && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Delay Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Customs query on ICEGATE valuation"
                    value={editForm.delay_reason}
                    onChange={(e) => setEditForm(prev => ({ ...prev, delay_reason: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={editForm.remarks}
                  onChange={(e) => setEditForm(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-slate-800"
                  placeholder="Additional operational remarks..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 justify-end">
              <button
                onClick={() => setEditingMs(null)}
                className="px-4 py-2 border rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMilestone}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                Save Milestone Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
