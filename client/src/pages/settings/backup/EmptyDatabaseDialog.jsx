import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Eraser, ShieldAlert, Lock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import api from "../../../services/api";
import Overlay from "./Overlay";

const GROUPS = [
  { id: "transactions", title: "المعاملات والحركات", hint: "آمن نسبياً — يبدأ فترة جديدة مع الإبقاء على البيانات الرئيسية." },
  { id: "master", title: "البيانات الرئيسية", hint: "خطر — حذف الأصناف أو العملاء أو الموردين أو المستخدمين نفسها." },
];

function fmt(n) {
  try {
    return Number(n || 0).toLocaleString("ar-EG");
  } catch {
    return String(n || 0);
  }
}

export default function EmptyDatabaseDialog({ open, onClose, onConfirm }) {
  const [cats, setCats] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setPassword("");
    setLoading(true);
    api
      .get("/api/backup/purge-preview")
      .then((res) => setCats(res.data?.data?.categories || []))
      .catch(() => setCats([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Only categories whose tables actually exist in this DB.
  const present = useMemo(() => cats.filter((c) => c.present), [cats]);
  const byGroup = (g) => present.filter((c) => c.group === g);
  const labelOf = useMemo(() => {
    const m = {};
    for (const c of cats) m[c.id] = c.labelAr;
    return m;
  }, [cats]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleGroup = (g) => {
    const ids = byGroup(g).map((c) => c.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  // Advisor: a selected master category whose dependent transaction categories
  // (that still hold data) are NOT selected → kept rows would reference deleted
  // master records. Warn, never block.
  const warnings = useMemo(() => {
    const out = [];
    for (const c of present) {
      if (c.group !== "master" || !selected.has(c.id)) continue;
      const missing = (c.recommendAlso || []).filter((dep) => {
        const depCat = cats.find((x) => x.id === dep);
        return depCat?.present && depCat.count > 0 && !selected.has(dep);
      });
      if (missing.length) {
        out.push({ id: c.id, label: c.labelAr, deps: missing.map((d) => labelOf[d] || d) });
      }
    }
    return out;
  }, [present, selected, cats, labelOf]);

  const totalRows = useMemo(
    () => present.filter((c) => selected.has(c.id)).reduce((s, c) => s + (c.count || 0), 0),
    [present, selected],
  );

  const ready = selected.size > 0 && password.length > 0;

  const renderRow = (c) => {
    const active = selected.has(c.id);
    const danger = c.group === "master";
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => toggle(c.id)}
        className={`flex w-full items-center gap-2.5 rounded-sm border px-3 py-2 text-right transition-all ${
          active
            ? danger
              ? "border-rose-400 bg-rose-50/60 ring-1 ring-rose-200"
              : "border-slate-400 bg-slate-50 ring-1 ring-slate-200"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
            active ? (danger ? "border-rose-500 bg-rose-500 text-white" : "border-primary bg-primary text-white") : "border-slate-300"
          }`}
        >
          {active && <CheckCircle2 className="h-3 w-3" />}
        </span>
        <span className="flex-1 text-[11px] font-black text-slate-700">{c.labelAr}</span>
        {c.hasResets && (
          <span className="shrink-0 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">+ تصفير الأرصدة</span>
        )}
        <span className="shrink-0 rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-600">
          {fmt(c.count)}
        </span>
      </button>
    );
  };

  return (
    <Overlay
      open={open}
      onClose={submitting ? undefined : onClose}
      title="تفريغ قاعدة البيانات"
      subtitle="اختر بالتحديد ما تريد حذفه. عملية حساسة — اقرأ التحذيرات جيداً."
      icon={<Eraser className="h-4 w-4" />}
      accent="rose"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-sm border border-rose-200 bg-rose-50/60 p-3 text-[11px] font-bold leading-relaxed text-rose-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>هذه العملية لا يمكن التراجع عنها يدوياً. سيتم إنشاء نسخة احتياطية كاملة تلقائياً قبل الحذف لإمكانية الاستعادة لاحقاً.</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ حساب البيانات...
          </div>
        ) : (
          <div className="space-y-4 max-h-[42vh] overflow-y-auto pe-1">
            {GROUPS.map((g) => {
              const rows = byGroup(g.id);
              if (rows.length === 0) return null;
              const allOn = rows.every((c) => selected.has(c.id));
              return (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-[11px] font-black uppercase tracking-widest ${g.id === "master" ? "text-rose-600" : "text-slate-700"}`}>
                        {g.title}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">{g.hint}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className="shrink-0 rounded-sm border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-500 transition-all hover:bg-slate-50 active:scale-95"
                    >
                      {allOn ? "إلغاء تحديد الكل" : "تحديد الكل"}
                    </button>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">{rows.map(renderRow)}</div>
                </div>
              );
            })}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1.5 rounded-sm border border-amber-200 bg-amber-50/60 p-3">
            {warnings.map((w) => (
              <div key={w.id} className="flex items-start gap-2 text-[11px] font-bold leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  حذف «{w.label}» مع الإبقاء على «{w.deps.join("، ")}» سيترك سجلات تشير إلى بيانات محذوفة. يُفضّل حذفها معاً.
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50/50 p-3 text-[11px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          نسخة أمان تلقائية قبل الحذف — خطوة إجبارية لا يمكن تخطيها.
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

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-black text-slate-500">
            {selected.size > 0 ? `سيتم حذف ${fmt(totalRows)} سجل من ${selected.size} فئة` : "لم يتم اختيار شيء"}
          </span>
          <div className="flex gap-2">
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
                  await onConfirm([...selected], password);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="flex h-9 items-center gap-2 rounded-sm bg-rose-600 px-6 text-2sm font-black uppercase tracking-widest text-white shadow-md transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              حذف المحدد الآن
            </motion.button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
