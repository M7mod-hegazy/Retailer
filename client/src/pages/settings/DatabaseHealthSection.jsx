import { useState } from "react";
import { Database, CheckCircle, AlertTriangle, RefreshCw, Wrench, Loader } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

const FIX_ACTIONS = [
  {
    key: "vacuum",
    label: "ضغط قاعدة البيانات",
    desc: "بينضف المساحة الفاضية ويصغر حجم الداتا (بياخد ثواني)",
    dangerous: false,
  },
  {
    key: "wal-checkpoint",
    label: "حفظ السجلات",
    desc: "بيدمج التعديلات المؤقتة في الملف الرئيسي عشان مفيش حاجة تضيع",
    dangerous: false,
  },
  {
    key: "reindex",
    label: "تظبيط الفهارس",
    desc: "بيرتب ملفات البحث من تاني — مفيد جداً لو البرنامج حاسه تقيل أو بطيء",
    dangerous: false,
  },
];

function StatusBadge({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black ${
        ok
          ? "bg-[var(--success-bg)] text-[var(--success)]"
          : "bg-[var(--danger-bg)] text-[var(--danger)]"
      }`}
    >
      {ok ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export default function DatabaseHealthSection() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/maintenance/db-health");
      setHealth(data);
    } catch (err) {
      toast.error("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const runFix = async (fixType) => {
    setFixing(fixType);
    try {
      const { data } = await api.post("/api/maintenance/db-fix", { fixType });
      toast.success(data.message);
      await runCheck();
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل تنفيذ الإصلاح");
    } finally {
      setFixing(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10">
            <Database className="h-5 w-5 text-[var(--primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)]">فحص الداتابيز (قاعدة البيانات)</h3>
            <p className="text-xs text-[var(--text-muted)]">بنكشف على الداتا ونظبطها لو فيها مشكلة</p>
          </div>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-base)] px-4 py-2 text-xs font-black text-[var(--text-primary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {health ? "إعادة الفحص" : "بدء الفحص"}
        </button>
      </div>

      {/* Results */}
      {health && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="سلامة البيانات">
              <StatusBadge ok={health.integrity === "ok"} label={health.integrity === "ok" ? "سليمة" : "يوجد أخطاء"} />
            </Stat>
            <Stat label="حجم الملف">
              <span className="text-sm font-black text-[var(--text-primary)]">
                {health.dbSizeKb >= 1024
                  ? `${(health.dbSizeKb / 1024).toFixed(1)} MB`
                  : `${health.dbSizeKb} KB`}
              </span>
            </Stat>
            <Stat label="عدد الجداول">
              <span className="text-sm font-black text-[var(--text-primary)]">{health.tableCount}</span>
            </Stat>
            <Stat label="التحديثات المطبّقة">
              <span className="text-sm font-black text-[var(--text-primary)]">
                {health.totalMigrations - health.pendingMigrations} / {health.totalMigrations}
              </span>
            </Stat>
            <Stat label="وضع السجل">
              <span className="text-sm font-black text-[var(--text-primary)] uppercase">{health.journalMode}</span>
            </Stat>
            <Stat label="تجزؤ الملف">
              <StatusBadge
                ok={health.fragmentationPct < 15}
                label={`${health.fragmentationPct}%`}
              />
            </Stat>
          </div>

          {/* Integrity errors */}
          {health.integrityErrors?.length > 0 && (
            <div className="rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)]/30 p-4">
              <p className="text-xs font-black text-[var(--danger)] mb-2">أخطاء سلامة البيانات:</p>
              <ul className="space-y-1" dir="ltr">
                {health.integrityErrors.map((e, i) => (
                  <li key={i} className="text-xs font-mono text-[var(--danger)]">{e}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                في حالة وجود أخطاء، يُنصح باستعادة نسخة احتياطية سليمة من أعلى الصفحة.
              </p>
            </div>
          )}

          {/* Fix actions */}
          <div>
            <p className="text-xs font-black text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> أدوات الإصلاح
            </p>
            <div className="space-y-2">
              {FIX_ACTIONS.map((action) => (
                <div
                  key={action.key}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-normal)] bg-[var(--bg-base)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-black text-[var(--text-primary)]">{action.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{action.desc}</p>
                  </div>
                  <button
                    onClick={() => runFix(action.key)}
                    disabled={!!fixing}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/10 px-3 py-1.5 text-xs font-black text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50"
                  >
                    {fixing === action.key ? (
                      <Loader className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wrench className="h-3 w-3" />
                    )}
                    تنفيذ
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!health && !loading && (
        <p className="text-center text-xs text-[var(--text-muted)] py-4">
          اضغط "بدء الفحص" لتشخيص حالة قاعدة البيانات
        </p>
      )}
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div className="rounded-xl bg-[var(--bg-base)] border border-[var(--border-normal)] p-3">
      <p className="text-[11px] text-[var(--text-muted)] mb-1">{label}</p>
      {children}
    </div>
  );
}
