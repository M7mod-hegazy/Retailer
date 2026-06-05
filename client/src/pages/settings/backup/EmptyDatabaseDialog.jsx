import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eraser, ShieldAlert, Lock, Loader2, CheckCircle2, Database } from "lucide-react";
import Overlay from "./Overlay";

const MODES = [
  {
    id: "keep-setup",
    title: "تفريغ الحركات مع الإبقاء على الإعدادات",
    desc: "حذف الفواتير والمبيعات والمشتريات والورديات وحركات المخزون والمدفوعات، مع الإبقاء على المستخدمين والأصناف والعملاء والموردين والإعدادات. بداية جديدة لفترة محاسبية.",
  },
  {
    id: "factory-reset",
    title: "إعادة ضبط كاملة (مصنع)",
    desc: "حذف كل شيء والعودة إلى نظام فارغ تماماً — يبقى حساب المالك والإعدادات الافتراضية فقط. كأن النظام جديد.",
  },
];

export default function EmptyDatabaseDialog({ open, onClose, onConfirm }) {
  const [mode, setMode] = useState("keep-setup");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("keep-setup");
      setPassword("");
    }
  }, [open]);

  const ready = Boolean(mode) && password.length > 0;

  return (
    <Overlay
      open={open}
      onClose={submitting ? undefined : onClose}
      title="تفريغ قاعدة البيانات"
      subtitle="عملية حساسة — اقرأ التحذيرات جيداً قبل المتابعة."
      icon={<Eraser className="h-4 w-4" />}
      accent="rose"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-sm border border-rose-200 bg-rose-50/60 p-3 text-[11px] font-bold leading-relaxed text-rose-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>هذه العملية لا يمكن التراجع عنها يدوياً. سيتم إنشاء نسخة احتياطية كاملة تلقائياً قبل التفريغ لإمكانية الاستعادة لاحقاً.</span>
        </div>

        <div className="space-y-2">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex w-full items-start gap-3 rounded-sm border p-3 text-right transition-all ${
                  active ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-200" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    active ? "border-rose-500 bg-rose-500 text-white" : "border-slate-300"
                  }`}
                >
                  {active && <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span>
                  <span className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <Database className="h-3.5 w-3.5 text-slate-400" /> {m.title}
                  </span>
                  <span className="mt-1 block text-[11px] font-bold leading-relaxed text-slate-500">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50/50 p-3 text-[11px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          نسخة أمان تلقائية قبل التفريغ — خطوة إجبارية لا يمكن تخطيها.
        </div>

        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <Lock className="h-3 w-3" /> كلمة مرور المالك للتأكيد
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete="off"
            className="w-full rounded-sm border border-slate-200 px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-rose-400 ltr:text-left"
            placeholder="••••••"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 rounded-sm border border-slate-200 px-5 text-2sm font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            إلغاء
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: ready ? 0.95 : 1 }}
            disabled={!ready || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm(mode, password);
              } finally {
                setSubmitting(false);
              }
            }}
            className="flex h-9 items-center gap-2 rounded-sm bg-rose-600 px-6 text-2sm font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            تفريغ الآن
          </motion.button>
        </div>
      </div>
    </Overlay>
  );
}
