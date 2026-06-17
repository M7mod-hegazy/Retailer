import { Calendar, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

// ── Pure schedule generator ───────────────────────────────────────────────
// Splits `remaining` into `count` installments. The remainder of the rounding
// lands on the LAST installment so the rows always sum back to `remaining`.
// The first installment uses `startDate`; each next one adds the frequency interval.
function addInterval(startDate, frequency, customDays, i) {
  const [y, m, d] = String(startDate).split("-").map(Number);
  const base = new Date(y, m - 1, d);
  if (frequency === "weekly") base.setDate(base.getDate() + 7 * i);
  else if (frequency === "biweekly") base.setDate(base.getDate() + 14 * i);
  else if (frequency === "custom_days") base.setDate(base.getDate() + Math.max(1, Number(customDays) || 1) * i);
  else base.setMonth(base.getMonth() + i); // monthly (default)
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function generateInstallments(remaining, count, frequency, customDays, startDate) {
  const n = Math.max(1, Math.floor(Number(count) || 0));
  const total = Math.max(0, Number(remaining) || 0);
  if (!startDate || total <= 0) return [];
  const per = Math.floor((total / n) * 100) / 100; // floor to 2dp
  const rows = [];
  for (let i = 0; i < n; i++) {
    const amount = i === n - 1
      ? Math.round((total - per * (n - 1)) * 100) / 100
      : per;
    rows.push({ installment_no: i + 1, due_date: addInterval(startDate, frequency, customDays, i), amount });
  }
  return rows;
}

// ── Presentational planner ────────────────────────────────────────────────
const FIELD = {
  borderColor: "var(--border-normal)",
  backgroundColor: "var(--bg-surface)",
  color: "var(--text-primary)",
};
const fieldCls = "rounded-lg border px-2.5 py-1.5 text-2sm font-bold outline-none focus:ring-2 transition-all";

export default function InstallmentPlanner({
  remaining,
  downPayment, setDownPayment,
  count, setCount,
  frequency, setFrequency,
  customDays, setCustomDays,
  startDate, setStartDate,
  rows, onRowChange,
  allocated, balanced,
  customer, formatMoney,
  compact = false,
}) {
  const { t } = useTranslation();
  const fmt = formatMoney || ((v) => Number(v || 0).toLocaleString("en-US"));
  const base = Math.max(0, Number(remaining || 0));
  const toAllocate = Math.round((base - Number(allocated || 0)) * 100) / 100;

  // One honest status, not an alarming red box for an empty cart.
  let status;
  if (!customer?.id) status = { tone: "muted", icon: Info, text: t("installments.needCustomer", "اختر عميلاً لإعداد الأقساط") };
  else if (base <= 0) status = { tone: "muted", icon: Info, text: t("installments.noAmount", "لا يوجد مبلغ للتقسيط") };
  else if (balanced) status = { tone: "success", icon: CheckCircle2, text: `${t("installments.balanced", "الأقساط مكتملة")} (${rows.length})` };
  else if (toAllocate > 0) status = { tone: "warning", icon: AlertTriangle, text: `${t("installments.toAllocate", "متبقٍ للتوزيع")}: ${fmt(toAllocate)}` };
  else status = { tone: "danger", icon: AlertTriangle, text: `${t("installments.overAllocated", "تجاوزت المبلغ بمقدار")}: ${fmt(Math.abs(toAllocate))}` };

  const toneStyle = {
    muted:   { color: "var(--text-muted)",    backgroundColor: "var(--bg-input)",      borderColor: "var(--border-subtle)" },
    success: { color: "var(--success-text)",  backgroundColor: "var(--success-bg)",    borderColor: "var(--success-border)" },
    warning: { color: "var(--warning-text)",  backgroundColor: "var(--warning-bg)",    borderColor: "var(--warning-border)" },
    danger:  { color: "var(--danger-text)",   backgroundColor: "var(--danger-bg)",     borderColor: "var(--danger-border)" },
  }[status.tone];
  const StatusIcon = status.icon;
  const showPlan = customer?.id && base > 0;

  return (
    <div className={`mt-4 flex flex-col gap-3 rounded-xl border ${compact ? "p-3" : "p-4"}`}
      style={{ backgroundColor: "var(--accent-soft)", borderColor: "var(--border-subtle)" }}>

      {/* Title + what is being split */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-2sm font-black flex items-center gap-1.5" style={{ color: "var(--text-accent)" }}>
          <Calendar className="w-4 h-4" /> {t("installments.planSetup", "إعداد الأقساط")}
        </span>
        {base > 0 && (
          <span className="text-[11px] font-black rounded-lg px-2.5 py-1" dir="ltr"
            style={{ color: "var(--text-accent)", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            {t("installments.splitting", "تقسيط")}: {fmt(base)}
          </span>
        )}
      </div>

      {/* Down payment */}
      <label className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--text-secondary)" }}>{t("installments.downPayment", "دفعة مقدم")}</span>
        <input type="number" min="0" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0"
          dir="ltr" className={fieldCls + " w-32 text-left"} style={FIELD} />
      </label>

      {showPlan && (
        <>
          <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />

          {/* Plan controls */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--text-secondary)" }}>{t("installments.count", "عدد الأقساط")}</span>
                <input type="number" min="1" max="60" value={count} onChange={(e) => setCount(e.target.value)}
                  dir="ltr" className={fieldCls + " w-16 text-center"} style={FIELD} />
              </label>
              <label className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--text-secondary)" }}>{t("installments.frequency", "التكرار")}</span>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={fieldCls + " flex-1 min-w-0"} style={FIELD}>
                  <option value="monthly">{t("installments.freqMonthly", "شهري")}</option>
                  <option value="weekly">{t("installments.freqWeekly", "أسبوعي")}</option>
                  <option value="biweekly">{t("installments.freqBiweekly", "كل أسبوعين")}</option>
                  <option value="custom_days">{t("installments.freqCustom", "أيام مخصصة")}</option>
                </select>
              </label>
            </div>

            {frequency === "custom_days" && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--text-secondary)" }}>{t("installments.everyDays", "كل (أيام)")}</span>
                <input type="number" min="1" value={customDays} onChange={(e) => setCustomDays(e.target.value)}
                  dir="ltr" className={fieldCls + " w-20 text-center"} style={FIELD} />
              </label>
            )}

            <label className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--text-secondary)" }}>{t("installments.firstDueDate", "تاريخ أول قسط")}</span>
              <input type="date" dir="ltr" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className={fieldCls + " w-40"} style={FIELD} />
            </label>
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="grid grid-cols-[2rem_1fr_auto] gap-2 px-2.5 py-1.5 text-[10px] font-black"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                <span className="text-center">#</span>
                <span>{t("installments.date", "التاريخ")}</span>
                <span className="text-left">{t("installments.amount", "المبلغ")}</span>
              </div>
              <div className={`flex flex-col ${compact ? "max-h-36" : "max-h-44"} overflow-y-auto`}>
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[2rem_1fr_auto] gap-2 items-center px-2.5 py-1 border-t"
                    style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-[11px] font-black text-center" style={{ color: "var(--text-accent)" }}>{i + 1}</span>
                    <input type="date" dir="ltr" value={r.due_date} onChange={(e) => onRowChange(i, "due_date", e.target.value)}
                      className={fieldCls + " w-full !py-1"} style={FIELD} />
                    <input type="number" min="0" value={r.amount} onChange={(e) => onRowChange(i, "amount", e.target.value)}
                      dir="ltr" className={fieldCls + " w-24 text-left font-black !py-1"} style={FIELD} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Single honest status line */}
      <div className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black border" style={toneStyle}>
        <StatusIcon className="w-3.5 h-3.5 shrink-0" />
        {status.text}
      </div>
    </div>
  );
}
