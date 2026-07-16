import React from "react";
import { AlertTriangle, Info, CheckCircle2, X, Loader2 } from "lucide-react";

// Replaces bare "هل أنت متأكد؟" confirms with a plain-language list of what
// will actually happen ("سيتم تعديل مخزون ١٢ صنف...").
//
// consequences: [{ text, tone: 'info' | 'warning' | 'danger' | 'success' }]
const TONE = {
  info:    { icon: Info,         cls: "text-primary bg-primary/10" },
  warning: { icon: AlertTriangle, cls: "text-warning-text bg-warning-bg" },
  danger:  { icon: AlertTriangle, cls: "text-danger-text bg-danger-bg" },
  success: { icon: CheckCircle2,  cls: "text-success-text bg-success-bg" },
};

export default function ConsequencePreview({
  open,
  title = "قبل التأكيد — سيحدث الآتي:",
  consequences = [],
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div dir="rtl" className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div
        className="relative w-full max-w-md rounded-3xl bg-bg-surface shadow-modal overflow-hidden animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-base transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6 pb-2">
          <h2 className="text-base font-black text-text-primary pl-8">{title}</h2>
        </div>

        <ul className="px-6 py-2 space-y-2 max-h-[50vh] overflow-y-auto">
          {consequences.filter(Boolean).map((c, i) => {
            const tone = TONE[c.tone] || TONE.info;
            const Icon = tone.icon;
            return (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-bg-base p-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.cls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[12px] font-bold text-text-secondary leading-relaxed pt-1">{c.text}</span>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-end gap-2 px-6 py-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl px-4 py-2.5 text-sm font-bold text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-black text-white shadow transition-all active:scale-95 disabled:opacity-60 ${
              danger ? "bg-danger" : "bg-primary"
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
