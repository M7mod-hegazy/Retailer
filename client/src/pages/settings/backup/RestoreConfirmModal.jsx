import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, Loader2, ShieldCheck } from "lucide-react";
import Overlay from "./Overlay";
import { formatDateTime, formatBytes } from "./helpers";

const CONFIRM_PHRASE = "استعادة";

export default function RestoreConfirmModal({ open, snapshot, onClose, onConfirm }) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const matched = typed.trim() === CONFIRM_PHRASE;

  return (
    <Overlay
      open={open}
      onClose={submitting ? undefined : onClose}
      title="تأكيد استعادة البيانات"
      subtitle="ستحل هذه النسخة محل كل البيانات الحالية بشكل نهائي."
      icon={<AlertTriangle className="h-4 w-4" />}
      accent="rose"
    >
      <div className="space-y-4">
        <div className="rounded-sm border border-rose-200 bg-rose-50/60 p-3 text-[11px] font-bold leading-relaxed text-rose-700">
          سيتم استبدال قاعدة البيانات والصور الحالية بمحتوى هذه النسخة. يتم إنشاء نسخة أمان تلقائية قبل الاستبدال
          لإمكانية التراجع.
        </div>

        {snapshot && (
          <div className="space-y-1 rounded-sm border border-border-normal bg-bg-overlay/60 p-3 text-[11px] font-bold text-text-secondary">
            <div>التاريخ: <span className="text-text-primary">{formatDateTime(snapshot.createdAt)}</span></div>
            <div>الحجم: <span className="text-text-primary">{formatBytes(snapshot.sizeBytes)}</span></div>
            {snapshot.label && <div>الوصف: <span className="text-text-primary">“{snapshot.label}”</span></div>}
            {snapshot.appVersion && <div>إصدار النظام: <span className="text-text-primary">v{snapshot.appVersion}</span></div>}
            {snapshot.legacy && <div className="text-rose-600">نسخة قديمة — لا تحتوي على الصور.</div>}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-text-secondary">
            اكتب كلمة <span className="font-black text-rose-600">«{CONFIRM_PHRASE}»</span> للتأكيد
          </span>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            dir="rtl"
            className={`w-full rounded-sm border px-3 py-2 text-sm font-black outline-none transition-colors ${
              matched ? "border-emerald-400 text-emerald-700" : "border-border-normal text-text-primary focus:border-rose-400"
            }`}
            placeholder={CONFIRM_PHRASE}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 rounded-sm border border-border-normal px-5 text-2sm font-black uppercase tracking-widest text-text-secondary transition-all hover:bg-bg-overlay active:scale-95 disabled:opacity-50"
          >
            إلغاء
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: matched ? 0.95 : 1 }}
            disabled={!matched || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm(snapshot);
              } finally {
                setSubmitting(false);
              }
            }}
            className="flex h-9 items-center gap-2 rounded-sm btn-danger px-6 text-2sm font-black uppercase tracking-widest shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            استعادة الآن
          </motion.button>
        </div>
      </div>
    </Overlay>
  );
}
