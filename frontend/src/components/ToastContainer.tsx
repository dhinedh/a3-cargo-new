import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toast, type ToastMessage } from '../utils/toast';

export const ToastContainer: React.FC = () => {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe(setMessages);
    return () => {
      unsubscribe();
    };
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none font-sans">
      {messages.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-start justify-between gap-3 backdrop-blur-md transition-all duration-300 animate-slide-in ${
            t.type === 'success'
              ? 'bg-slate-900/95 text-white border-emerald-500/50 shadow-emerald-950/20'
              : t.type === 'error'
              ? 'bg-red-950/95 text-white border-red-500/50 shadow-red-950/20'
              : 'bg-slate-900/95 text-white border-blue-500/50 shadow-blue-950/20'
          }`}
        >
          <div className="flex items-start gap-3">
            {t.type === 'success' ? (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-400/30">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : t.type === 'error' ? (
              <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5 border border-red-400/30">
                <AlertCircle className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-400/30">
                <Info className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {t.type === 'success' ? 'Notification' : t.type === 'error' ? 'Notice' : 'Information'}
              </div>
              <p className="text-xs font-semibold text-white whitespace-pre-line mt-0.5 leading-relaxed">
                {t.message}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
