import React, { useState, useEffect } from 'react';
import type { Chapter, TariffLine } from '../types';
import { apiClient } from '../api/client';
import { CheckSquare, Save, CheckCircle, Edit3, FileText, ChevronRight } from 'lucide-react';

interface VerificationStudioPageProps {
  chapters: Chapter[];
  onDataUpdated: () => void;
}

export const VerificationStudioPage: React.FC<VerificationStudioPageProps> = ({ chapters, onDataUpdated }) => {
  const [selectedChapterId, setSelectedChapterId] = useState<number | undefined>(
    chapters.length > 0 ? chapters[0].id : undefined
  );
  const [lines, setLines] = useState<TariffLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<TariffLine | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form edit states
  const [editHsCode, setEditHsCode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editGeneralDuty, setEditGeneralDuty] = useState('');
  const [editVat, setEditVat] = useState('');
  const [editPal, setEditPal] = useState('');
  const [editCess, setEditCess] = useState('');
  const [editExcise, setEditExcise] = useState('');
  const [editScl, setEditScl] = useState('');

  const fetchChapterLines = async (chapId?: number) => {
    if (!chapId) return;
    setLoading(true);
    try {
      const res = await apiClient.getTariffLines({
        chapter_id: chapId,
        page: 1,
        page_size: 200,
      });
      setLines(res.items);
      if (res.items.length > 0) {
        selectLineForEditing(res.items[0]);
      } else {
        setSelectedLine(null);
      }
    } catch (err) {
      console.error('Error fetching chapter lines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChapterId) {
      fetchChapterLines(selectedChapterId);
    }
  }, [selectedChapterId]);

  const selectLineForEditing = (line: TariffLine) => {
    setSelectedLine(line);
    setEditHsCode(line.hs_code || '');
    setEditDescription(line.description || '');
    setEditUnit(line.unit || '');
    setEditGeneralDuty(line.general_duty_rate || '');
    setEditVat(line.vat_rate || '');
    setEditPal(line.pal_rate || '');
    setEditCess(line.cess_rate || '');
    setEditExcise(line.excise_rate || '');
    setEditScl(line.scl_rate || '');
  };

  const handleSaveEdits = async () => {
    if (!selectedLine) return;
    setSaving(true);
    try {
      const updated = await apiClient.updateTariffLine(selectedLine.id, {
        hs_code: editHsCode || undefined,
        description: editDescription,
        unit: editUnit || undefined,
        general_duty_rate: editGeneralDuty || undefined,
        vat_rate: editVat || undefined,
        pal_rate: editPal || undefined,
        cess_rate: editCess || undefined,
        excise_rate: editExcise || undefined,
        scl_rate: editScl || undefined,
      });

      setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setSelectedLine(updated);
      onDataUpdated();
      alert('Tariff line updated successfully.');
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyLine = async () => {
    if (!selectedLine) return;
    try {
      const verified = await apiClient.verifyTariffLine(selectedLine.id);
      setLines((prev) => prev.map((l) => (l.id === verified.id ? verified : l)));
      setSelectedLine(verified);
      onDataUpdated();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Human Verification & Editing Studio</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review parsed tariff rows side-by-side with original PDF raw text and correct misparsed entries before final verification.
          </p>
        </div>

        {/* Chapter Select */}
        <div className="w-full md:w-72">
          <select
            value={selectedChapterId || ''}
            onChange={(e) => setSelectedChapterId(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-indigo-500 shadow-lg"
          >
            {chapters.map((chap) => (
              <option key={chap.id} value={chap.id}>
                Chapter {chap.chapter_number.toString().padStart(2, '0')}: {chap.chapter_title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Side-by-Side Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Extracted Lines Table List */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              Extracted Lines ({lines.length})
            </h3>
            <span className="text-xs text-slate-400">Click a row to inspect & edit</span>
          </div>

          <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading chapter rows...</div>
            ) : lines.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No lines found for this chapter.</div>
            ) : (
              lines.map((line) => {
                const isSelected = selectedLine?.id === line.id;
                return (
                  <div
                    key={line.id}
                    onClick={() => selectLineForEditing(line)}
                    className={`p-4 cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-400">
                          {line.hs_code || 'Heading Line'}
                        </span>
                        {line.is_verified ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Verified
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Unverified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-2">{line.description}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono pt-1">
                        <span>Duty: {line.general_duty_rate || '-'}</span>
                        <span>VAT: {line.vat_rate || '-'}</span>
                        <span>PAL: {line.pal_rate || '-'}</span>
                        <span>CESS: {line.cess_rate || '-'}</span>
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 mt-1 transition-transform ${isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600'}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Edit & Verification Panel */}
        <div className="lg:col-span-5 space-y-6">
          {selectedLine ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  Line Inspector & Editor
                </h3>
                <span className="text-xs font-mono text-slate-400">ID: #{selectedLine.id}</span>
              </div>

              {/* Editable Fields Form */}
              <div className="space-y-4 text-xs">
                {/* HS Code */}
                <div>
                  <label className="block text-slate-400 font-medium mb-1">HS Tariff Code</label>
                  <input
                    type="text"
                    value={editHsCode}
                    onChange={(e) => setEditHsCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Description of Goods</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Unit & Gen Duty */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Unit</label>
                    <input
                      type="text"
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">General Duty Rate</label>
                    <input
                      type="text"
                      value={editGeneralDuty}
                      onChange={(e) => setEditGeneralDuty(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-mono font-semibold"
                    />
                  </div>
                </div>

                {/* Tax & Levy Rates Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">VAT Rate</label>
                    <input
                      type="text"
                      value={editVat}
                      onChange={(e) => setEditVat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">PAL Rate</label>
                    <input
                      type="text"
                      value={editPal}
                      onChange={(e) => setEditPal(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">CESS Rate</label>
                    <input
                      type="text"
                      value={editCess}
                      onChange={(e) => setEditCess(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-400 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Excise Rate</label>
                    <input
                      type="text"
                      value={editExcise}
                      onChange={(e) => setEditExcise(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">SCL Rate</label>
                    <input
                      type="text"
                      value={editScl}
                      onChange={(e) => setEditScl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>

                {/* Raw PDF Text Reference Box */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-indigo-400" />
                    Original PDF Extracted Text:
                  </span>
                  <p className="font-mono text-[11px] text-slate-400 leading-relaxed">
                    {selectedLine.raw_row_text || 'No raw text stored.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveEdits}
                  disabled={saving}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Edits</span>
                </button>

                <button
                  onClick={handleVerifyLine}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm & Mark Verified</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              Select a tariff line from the list to inspect and edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
