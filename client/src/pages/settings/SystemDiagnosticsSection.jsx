import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  Copy,
  Loader,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";

function Row({ ok, label, detail }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {ok ? (
          <CheckCircle className="h-4 w-4 shrink-0 text-[var(--success)]" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--danger)]" />
        )}
        <span className="text-sm font-bold text-[var(--text-primary)] truncate">{label}</span>
      </div>
      {detail != null && (
        <span className="text-xs font-mono text-[var(--text-muted)] truncate max-w-[55%] text-left" dir="ltr">
          {detail}
        </span>
      )}
    </div>
  );
}

// Live system health + the last startup self-diagnostic, plus the one-click tools
// to investigate/fix a "connection error". Lives in the backup/data tab so the
// owner can monitor everything in one place. Works in the packaged app (IPC);
// in the browser it shows server health only.
export default function SystemDiagnosticsSection() {
  const hasElectron = typeof window !== "undefined" && !!window.electronAPI?.invoke;
  const [serverOk, setServerOk] = useState(null);
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await api.get("/api/health", { timeout: 6000 });
      setServerOk(true);
    } catch {
      setServerOk(false);
    }
    if (hasElectron) {
      try {
        const data = await window.electronAPI.invoke("diag:get-report");
        setDiag(data);
      } catch (_e) {
        /* ignore */
      }
    }
    setLoading(false);
  }, [hasElectron]);

  useEffect(() => {
    load();
  }, [load]);

  const runDiagnostics = async () => {
    if (!hasElectron) return;
    setRunning(true);
    try {
      await window.electronAPI.invoke("diag:run-and-fix");
      await load();
      toast.success("اكتمل التشخيص");
    } catch (_e) {
      toast.error("تعذّر تشغيل التشخيص");
    } finally {
      setRunning(false);
    }
  };

  const openLogs = async () => {
    if (!hasElectron) return;
    try {
      await window.electronAPI.invoke("diag:open-logs");
    } catch (_e) {
      toast.error("تعذّر فتح مجلد السجلات");
    }
  };

  const copyReport = async () => {
    try {
      const text = JSON.stringify(diag?.report ?? diag ?? {}, null, 2);
      await navigator.clipboard.writeText(text);
      toast.success("تم نسخ التقرير");
    } catch (_e) {
      toast.error("تعذّر النسخ");
    }
  };

  const report = diag?.report;
  const p = report?.probes;

  // Build pass/fail rows from the structured probe data.
  const rows = [];
  if (p) {
    if (p.database?.nativeModule) {
      rows.push({
        ok: !!p.database.nativeModule.loaded,
        label: "مكوّن قاعدة البيانات",
        detail: p.database.nativeModule.version || p.database.nativeModule.error || "",
      });
    }
    if (p.writable?.dbDir) {
      rows.push({
        ok: !!p.writable.dbDir.writable,
        label: "صلاحية الكتابة (مجلد البيانات)",
        detail: p.writable.dbDir.error || p.writable.dbDir.dir || "",
      });
    }
    if (p.database) {
      rows.push({
        ok: p.database.integrity === "ok" || (p.database.exists && p.database.open?.ok),
        label: "سلامة قاعدة البيانات",
        detail: p.database.integrity || p.database.open?.error || (p.database.exists ? "" : "غير موجودة"),
      });
    }
    if (p.ports) {
      rows.push({
        ok: Array.isArray(p.ports.free) && p.ports.free.length > 0,
        label: "توفّر المنافذ",
        detail: p.ports.free?.length ? `حر: ${p.ports.free.join(", ")}` : `الكل مشغول (${p.ports.range})`,
      });
    }
    if (p.loopback?.tested) {
      rows.push({
        ok: !!p.loopback.anyOk,
        label: "الاتصال المحلي (127.0.0.1)",
        detail: p.loopback.anyOk ? "متاح" : "محجوب — تحقق من برنامج الحماية",
      });
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--primary)]" />
          <h3 className="text-base font-black text-[var(--text-primary)]">حالة السيستم والتشخيص</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black ${
              serverOk
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--danger-bg)] text-[var(--danger)]"
            }`}
          >
            {serverOk ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {serverOk ? "الخادم يعمل" : "الخادم متوقف"}
          </span>
          {diag?.port && (
            <span className="text-xs font-mono text-[var(--text-muted)]" dir="ltr">
              :{diag.port}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-50"
        >
          {loading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          تحديث
        </button>
        {hasElectron && (
          <>
            <button
              onClick={runDiagnostics}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {running ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              تشغيل التشخيص الآن
            </button>
            <button
              onClick={openLogs}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              فتح مجلد السجلات
            </button>
            <button
              onClick={copyReport}
              disabled={!diag}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              نسخ التقرير
            </button>
          </>
        )}
      </div>

      {/* Probe rows */}
      {rows.length > 0 ? (
        <div className="rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] px-4">
          {rows.map((r, i) => (
            <Row key={i} ok={r.ok} label={r.label} detail={r.detail} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">
          {hasElectron
            ? "لا يوجد تقرير تشخيص بعد. اضغط «تشغيل التشخيص الآن» لإنشاء تقرير."
            : "تفاصيل التشخيص متاحة في نسخة سطح المكتب فقط."}
        </p>
      )}

      {report?.cause && report.cause !== "ok" && (
        <div className="rounded-xl bg-[var(--warning-bg)] border border-[var(--warning-border)] p-3 text-xs font-bold text-[var(--warning)]">
          آخر سبب مكتشف: {report.cause}
        </div>
      )}

      {/* Recent error history */}
      {hasElectron && diag?.logTail && (
        <div>
          <button
            onClick={() => setShowLog((s) => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            {showLog ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            سجل الأخطاء الأخير
          </button>
          {showLog && (
            <pre
              dir="ltr"
              className="mt-2 text-[11px] leading-[1.6] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-72 overflow-y-auto rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3"
            >
              {diag.logTail}
            </pre>
          )}
        </div>
      )}

      {/* Auto-solve scope note */}
      <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
        البرنامج بيحل الأعطال المؤقتة لوحده (زي إن السيرفر يقع أو بورت يتغير). ومشاكل الداتابيز بتتحل بضغطة زرار من فوق. 
        أما لو فيه مشكلة في الويندوز نفسه (زي الصلاحيات أو الأنتي فيرس قافل الاتصال) فبيقولك إيه المشكلة بالظبط عشان تحلها إنت، لإن دي حاجات برة تحكم البرنامج.
      </p>
    </section>
  );
}
