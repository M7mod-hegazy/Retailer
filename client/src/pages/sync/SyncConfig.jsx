import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Save, Link2, Loader2, CheckCircle2, XCircle, ArrowLeftRight,
  Globe, Key, Building2, Copy, ExternalLink, HelpCircle,
  ChevronLeft, ChevronRight, Shield, Info, Smartphone, Monitor,
  ArrowRight, Lightbulb, Lock, Headphones, Store, Server,
  RefreshCw, AlertTriangle, Clock, ShoppingBag, Wifi,
  Unlink, Settings2, ExternalLink as ExternalLinkIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { usePermission } from "../../hooks/usePermission";
import { getSyncConfig, saveSyncConfig, verifySyncConnection, getWebhookStatus, updateWebhookConfig, registerWebhook, testWebhook } from "../../services/syncService";
import { useSyncStore } from "../../stores/syncStore";
import { usePageTour } from '../../hooks/usePageTour';

const SUPPORT_URL = import.meta.env.VITE_SUPPORT_URL || "";
const STORE_PROMO_URL = import.meta.env.VITE_STORE_PROMO_URL || "";

const TEST_CHECKS = [
  { key: "domain", icon: Globe, labelKey: "domain" },
  { key: "server", icon: Server, labelKey: "server" },
  { key: "auth", icon: Shield, labelKey: "auth" },
  { key: "data", icon: Clock, labelKey: "data" },
];

function validateUrl(val) {
  if (!val) return "idle";
  try { const u = new URL(val.trim()); return (u.protocol === "http:" || u.protocol === "https:") ? "valid" : "invalid"; }
  catch { return "invalid"; }
}

function Skeleton() {
  return (
    <div className="max-w-lg mx-auto px-6 py-12 space-y-6">
      <div className="animate-pulse h-8 w-56 rounded-lg mx-auto bg-gray-200" />
      <div className="animate-pulse h-4 w-80 rounded-lg mx-auto bg-gray-200" />
      <div className="animate-pulse h-48 w-full rounded-2xl bg-gray-200" />
    </div>
  );
}

function TestRow({ icon: Icon, label, status }) {
  const icons = {
    pending: <div className="w-4 h-4 rounded-full border-2 border-border-subtle" />,
    loading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    success: <CheckCircle2 className="h-4 w-4 text-success-text" />,
    error: <XCircle className="h-4 w-4 text-danger-text" />,
  };
  const bg = { pending: "bg-bg-base", loading: "bg-primary-50", success: "bg-success-bg", error: "bg-danger-bg" };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${bg[status]}`}>
      <div className="w-8 h-8 rounded-lg bg-bg-surface flex items-center justify-center flex-shrink-0">
        <Icon className={`h-4 w-4 ${status === "error" ? "text-danger-text" : status === "success" ? "text-success-text" : "text-text-muted"}`} />
      </div>
      <span className={`text-xs font-bold flex-1 ${status === "error" ? "text-danger-text" : status === "success" ? "text-success-text" : "text-text-secondary"}`}>{label}</span>
      {icons[status]}
    </div>
  );
}

function GuideHint({ icon: Icon, label, children, open: defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-[10px] text-text-link hover:underline font-bold">
        <HelpCircle className="h-3 w-3" />{label}
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-xl bg-bg-base border border-border-subtle text-xs text-text-secondary space-y-2 animate-slide-down">{children}</div>
      )}
    </div>
  );
}

const labelClass = "text-xs font-black text-text-primary";
const inputClass = "w-full px-4 py-2.5 bg-bg-input border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition";
const borderOk = "border-success-border";
const borderErr = "border-danger-border";
const borderDef = "border-border-strong";

export default function SyncConfig({ store: propStore = null, onSave: propOnSave = null }) {
  usePageTour('sync_config');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canConfigure = usePermission("sync", "configure");
  const { config, setConfig } = useSyncStore();

  const [step, setStep] = useState(0);
  const [hasWebsite, setHasWebsite] = useState(null);
  const [form, setForm] = useState({ ecom_url: "", store_id: "", api_key: "", store_name: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testSteps, setTestSteps] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(30);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (propStore) {
      setForm({ ecom_url: propStore.ecom_url || "", store_id: propStore.store_id || "", api_key: "", store_name: propStore.store_name || "" });
      setLoaded(true);
      return;
    }
    getSyncConfig().then((res) => {
      if (res.configured && res.config) {
        setConfig(res.config);
        setForm({ ecom_url: res.config.ecom_url || "", store_id: res.config.store_id || "", api_key: "", store_name: res.config.store_name || "" });
        setAutoSync(res.config.auto_sync_enabled || false);
        setSyncInterval(res.config.sync_interval_minutes || 30);
        setHasWebsite(true);
        setStep(2);
      }
      setLoaded(true);
    });
  }, [setConfig, propStore]);

  const urlVal = validateUrl(form.ecom_url);
  const storeIdOk = form.store_id.trim().length >= 8;
  const apiKeyOk = form.api_key.trim().length >= 8;
  const canTest = urlVal === "valid" && storeIdOk && apiKeyOk;

  const runTest = useCallback(async () => {
    setTesting(true); setTestResult(null);
    setTestSteps(TEST_CHECKS.map((c) => ({ ...c, status: "loading" })));
    try {
      const res = await verifySyncConnection({ ecom_url: form.ecom_url, store_id: form.store_id, api_key: form.api_key });
      if (res?.steps) {
        setTestSteps(TEST_CHECKS.map((c) => { const s = res.steps.find(x => x.key === c.key); return s ? { ...c, status: s.status, message: s.message } : { ...c, status: "error" }; }));
        const allOk = res.steps.every(s => s.status === "success");
        setTestResult(allOk ? { ok: true, connected: true } : { ok: true, connected: false });
        if (allOk) toast.success("تم الاتصال بنجاح"); else toast.error("فشل الاتصال");
      } else { setTestSteps(TEST_CHECKS.map((c) => ({ ...c, status: "error" }))); toast.error("فشل الاتصال"); }
    } catch { setTestSteps(TEST_CHECKS.map((c) => ({ ...c, status: "error" }))); toast.error("فشل الاتصال"); }
    finally { setTesting(false); }
  }, [form.ecom_url, form.store_id, form.api_key]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await saveSyncConfig({ ...form, auto_sync_enabled: autoSync, sync_interval_minutes: syncInterval });
      if (res.ok) {
        toast.success(t("sync.config.saved"));
        setConfig({ ...form, api_key: `${form.api_key.slice(0, 8)}...${form.api_key.slice(-4)}` });
        if (propOnSave) propOnSave(form);
        setEditing(false);
      }
    } catch { toast.error("فشل الحفظ"); }
    finally { setSaving(false); }
  }, [form, autoSync, syncInterval, setConfig, propOnSave, t]);

  if (!loaded) return <Skeleton />;

  /* ─── Connected state: full-width dashboard ─── */
  if (config && step === 2 && !editing) {
    return (
      <div className="pb-16 animate-fade-in">
        {/* Slim header */}
        <div className="bg-gradient-to-l from-primary via-primary-600 to-primary/90 text-white">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-bg-surface/15 backdrop-blur-sm rounded-full text-xs font-bold mb-3">
                  <Link2 className="h-3.5 w-3.5" />ربط المتجر الإلكتروني
                </div>
                <h1 className="text-2xl font-black tracking-tight">المزامنة مع متجرك الإلكتروني</h1>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => navigate("/sync")} className="inline-flex items-center gap-2 px-5 py-2.5 bg-bg-surface text-primary rounded-xl text-sm font-black hover:opacity-90 transition active:scale-95 shadow-lg">
                  <ArrowLeftRight className="h-4 w-4" />الذهاب للمزامنة
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 -mt-4">
          {/* Connected banner */}
          <div className="bg-success-bg border border-success-border rounded-2xl p-5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-8 w-8 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-text opacity-60" />
                <span className="relative inline-flex rounded-full h-8 w-8 bg-success-text items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </span>
              </span>
              <div>
                <h2 className="text-base font-black text-success-text">المتجر متصل</h2>
                <p className="text-xs text-success-text/70">بيانات المتجر الإلكتروني متزامنة ونشطة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => runTest()} disabled={testing} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface/80 rounded-lg text-xs font-bold text-success-text hover:bg-bg-surface transition border border-success-border/50">
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                اختبار
              </button>
              {canConfigure && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface/80 rounded-lg text-xs font-bold text-text-primary hover:bg-bg-surface transition border border-border-subtle/50">
                <Settings2 className="h-3.5 w-3.5" />تعديل
              </button>}
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Connection details */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
              <h3 className="text-sm font-black text-text-primary mb-4 flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />بيانات الاتصال</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
                  <span className="text-xs text-text-muted">الرابط</span>
                  <span dir="ltr" className="text-xs font-mono font-bold text-text-primary truncate max-w-[250px]">{config.ecom_url}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
                  <span className="text-xs text-text-muted">Store ID</span>
                  <span className="text-xs font-mono font-bold text-text-primary">{config.store_id}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
                  <span className="text-xs text-text-muted">API Key</span>
                  <span className="text-xs font-mono font-bold text-text-primary" dir="ltr">{config.api_key ? `${config.api_key.slice(0, 8)}...${config.api_key.slice(-4)}` : "••••••••"}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-text-muted">اسم المتجر</span>
                  <span className="text-xs font-bold text-text-primary">{config.store_name || "—"}</span>
                </div>
              </div>
            </div>

            {/* Auto-sync */}
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
              <h3 className="text-sm font-black text-text-primary mb-4 flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" />المزامنة التلقائية</h3>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-text-primary">تفعيل المزامنة التلقائية</span>
                <button onClick={() => canConfigure && setAutoSync(!autoSync)} disabled={!canConfigure} className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${autoSync ? "bg-primary" : "bg-gray-200"} ${canConfigure ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-bg-surface rounded-full shadow-sm transition-transform duration-200 ${autoSync ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {autoSync && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">مزامنة كل</span>
                  <select value={syncInterval} onChange={(e) => canConfigure && setSyncInterval(Number(e.target.value))} disabled={!canConfigure} className="bg-bg-input border border-border-subtle rounded-lg px-2 py-1.5 text-xs font-bold text-text-primary">
                    <option value={5}>5 د</option><option value={10}>10 د</option><option value={15}>15 د</option><option value={30}>30 د</option><option value={60}>60 د</option><option value={120}>120 د</option>
                  </select>
                </div>
              )}
              <div className="mt-4">
                {canConfigure && <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 transition active:scale-95">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  حفظ الإعدادات
                </button>}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5">
            <h3 className="text-sm font-black text-text-primary mb-3 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-warning-text" />إجراءات سريعة</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => navigate("/sync")} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition active:scale-95">
                <ArrowLeftRight className="h-4 w-4" />الذهاب إلى المزامنة
              </button>
              <button onClick={() => navigate("/sync")} className="inline-flex items-center gap-2 px-5 py-2.5 border border-border-strong rounded-xl text-sm font-bold text-text-secondary hover:bg-bg-base transition">
                <Clock className="h-4 w-4" />عرض سجل المزامنة
              </button>
            </div>
          </div>

          {/* Test results inline */}
          {testSteps.length > 0 && (
            <div className="mt-4 space-y-1.5 animate-slide-up">
              {testSteps.map(s => <TestRow key={s.key} icon={s.icon} label={t(`sync.config.wizard.connect.check.${s.labelKey}`)} status={s.status} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── Not connected: wizard + detailed instructions ─── */
  return (
    <div className="min-h-screen bg-bg-page pb-16">
      <div className="bg-gradient-to-b from-primary via-primary-600 to-primary/90 text-white">
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-14 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-bg-surface/15 backdrop-blur-sm rounded-full text-xs font-bold mb-4">
            <Link2 className="h-3.5 w-3.5" />ربط المتجر الإلكتروني
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">المزامنة مع متجرك الإلكتروني</h1>
          <p className="text-white/70 text-sm max-w-xl mx-auto">
            اربط نظام نقاط البيع بمتجرك الإلكتروني لمزامنة المنتجات، الأسعار، والمخزون تلقائياً
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-6">
        {/* Step 0: Do you have a website? */}
        {step === 0 && (
          <div className="animate-slide-up space-y-4">
            <div className="bg-bg-surface rounded-2xl shadow-card border border-border-subtle p-6 md:p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-black text-text-primary mb-2">هل لديك متجر إلكتروني؟</h2>
              <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">المزامنة تربط برنامج نقاط البيع هذا بمتجرك على الإنترنت. يجب أن يكون لديك متجر إلكتروني فعّال أولاً.</p>

              {hasWebsite === null && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button onClick={() => { setHasWebsite(true); setStep(1); }} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 transition active:scale-95 shadow-lg shadow-primary/25">
                    <CheckCircle2 className="h-4 w-4" />نعم، لدي متجر
                  </button>
                  {STORE_PROMO_URL ? (
                    <a href={STORE_PROMO_URL} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-border-strong rounded-2xl text-sm font-black text-text-secondary hover:bg-bg-base transition active:scale-95">
                      <ShoppingBag className="h-4 w-4" />لا، أحتاج إنشاء متجر
                    </a>
                  ) : (
                    <div className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-border-subtle bg-bg-base text-xs text-text-muted text-center">لا متجر؟ تواصل مع فريق الدعم</div>
                  )}
                </div>
              )}

              {hasWebsite === true && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-success-bg border border-success-border text-sm text-success-text font-bold justify-center">
                  <CheckCircle2 className="h-5 w-5" />تم التأكيد — تابع إدخال بيانات المتجر
                </div>
              )}
            </div>

            <div className="bg-bg-surface rounded-2xl shadow-card border border-border-subtle p-4">
              <div className="flex items-center gap-3 text-xs text-text-muted justify-center flex-wrap">
                <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> اتصال مشفّر</span>
                <span className="w-px h-3 bg-border-subtle" />
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> بياناتك آمنة</span>
                {SUPPORT_URL && (
                  <><span className="w-px h-3 bg-border-subtle" /><button onClick={() => window.open(SUPPORT_URL, "_blank")} className="flex items-center gap-1 hover:text-text-link transition"><Headphones className="h-3 w-3" /> دعم فني</button></>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Connection form */}
        {step === 1 && (
          <div className="animate-slide-up">
            <div className="bg-bg-surface rounded-2xl shadow-card border border-border-subtle overflow-hidden">
              <div className="bg-gradient-to-l from-primary/5 via-info-bg/30 to-primary/5 p-4 md:p-5 border-b border-border-subtle">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-info-bg flex items-center justify-center shrink-0"><Globe className="h-5 w-5 text-info-text" /></div>
                  <div>
                    <h3 className="text-sm font-black text-text-primary">هذه المعلومات من متجرك الإلكتروني</h3>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      البيانات أدناه موجودة في <span className="font-bold">لوحة تحكم متجرك</span> — اذهب إلى موقع متجرك على الإنترنت،
                      سجّل الدخول، وانسخ البيانات من صفحة <span className="font-mono bg-gray-200 px-1 rounded text-[11px]">الإعدادات ← المزامنة</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                {/* Store URL */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <label className={labelClass}>رابط متجرك الإلكتروني</label>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-info-bg text-info-text border border-info-border/40 whitespace-nowrap">من المتجر →</span>
                  </div>
                  <input type="url" dir="ltr" className={`${inputClass} ${urlVal === "valid" ? borderOk : urlVal === "invalid" ? borderErr : borderDef}`}
                    placeholder="https://yourstore.com" value={form.ecom_url} onChange={(e) => setForm(f => ({ ...f, ecom_url: e.target.value }))} />
                  <GuideHint icon={Globe} label="أين أجد رابط المتجر؟">
                    <p>هذا هو الرابط الذي يزوره عملاؤك لتصفّح متجرك. مثال: <span dir="ltr" className="font-mono bg-gray-200 px-1 rounded">https://my-store.com</span></p>
                    <p className="text-[11px] text-warning-text font-bold mt-1">يجب أن يكون المتجر منشوراً على الإنترنت (ليس تحت التطوير).</p>
                  </GuideHint>
                </div>

                {/* Store ID */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <label className={labelClass}>رقم المتجر (Store ID)</label>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-info-bg text-info-text border border-info-border/40 whitespace-nowrap">من المتجر →</span>
                  </div>
                  <input type="text" dir="ltr" className={`${inputClass} ${storeIdOk ? borderOk : form.store_id ? borderErr : borderDef}`}
                    placeholder="انسخ رقم المتجر من لوحة التحكم" value={form.store_id} onChange={(e) => setForm(f => ({ ...f, store_id: e.target.value }))} />
                  <GuideHint icon={Building2} label="أين أجد رقم المتجر في لوحة التحكم؟">
                    <ol className="list-decimal list-inside space-y-1 pr-4 text-[11px]">
                      <li>سجّل الدخول إلى <span className="font-bold">لوحة تحكم متجرك</span> على الإنترنت</li>
                      <li>اذهب إلى <span className="font-mono bg-gray-200 px-1 rounded">الإعدادات ← المزامنة (Sync)</span></li>
                      <li>ستجد <span className="font-bold">"Store ID"</span> — انسخه والصقه هنا</li>
                    </ol>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning-text font-bold bg-warning-bg/30 rounded-lg p-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />لا يوجد Store ID في نقاط البيع — هذا الرقم يصدر من متجرك الإلكتروني فقط
                    </div>
                  </GuideHint>
                </div>

                {/* API Key */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Key className="h-4 w-4 text-danger-text shrink-0" />
                    <label className={labelClass}>مفتاح API (API Key)</label>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-info-bg text-info-text border border-info-border/40 whitespace-nowrap">من المتجر →</span>
                  </div>
                  <div className="relative">
                    <input type="password" dir="ltr" className={`${inputClass} ltr:pl-10 rtl:pr-10 ${apiKeyOk ? borderOk : form.api_key ? borderErr : borderDef}`}
                      placeholder="انسخ مفتاح API من لوحة التحكم" value={form.api_key} onChange={(e) => setForm(f => ({ ...f, api_key: e.target.value }))} />
                    <button type="button" onClick={() => { if (form.api_key) { navigator.clipboard.writeText(form.api_key); toast.success("تم النسخ"); } }} className="absolute left-2 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-2 text-text-muted hover:text-primary transition p-1">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-danger-text font-bold"><AlertTriangle className="h-3 w-3" />هذا المفتاح خاص بمتجرك — لا تشاركه مع أي أحد</div>
                  <GuideHint icon={Key} label="أين أجد مفتاح API في موقع المتجر؟">
                    <div className="flex items-center gap-1.5 text-[11px] text-info-text font-bold bg-info-bg/30 rounded-lg p-2 mb-2">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />هذا المفتاح يصدر من متجرك الإلكتروني — غير موجود في نظام نقاط البيع
                    </div>
                    <ol className="list-decimal list-inside space-y-1 pr-4 text-[11px]">
                      <li>اذهب إلى <span className="font-bold">لوحة تحكم متجرك</span> على الإنترنت</li>
                      <li>الإعدادات ← المزامنة (Sync Settings)</li>
                      <li>اضغط "إنشاء مفتاح API جديد" وانسخه فوراً</li>
                    </ol>
                  </GuideHint>
                </div>

                {/* Store Name (optional) */}
                <div>
                  <label className={`${labelClass} mb-1.5 block flex items-center gap-1.5`}>
                    <Store className="h-3.5 w-3.5 text-text-muted" />اسم المتجر (اختياري)
                  </label>
                  <input type="text" className={`${inputClass} ${borderDef}`}
                    placeholder="اسم متجرك" value={form.store_name} onChange={(e) => setForm(f => ({ ...f, store_name: e.target.value }))} />
                </div>
              </div>

              {/* Test + Save section */}
              <div className="px-5 md:px-6 pb-5 space-y-3">
                <button onClick={runTest} disabled={testing || !canTest || !canConfigure} className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {testing ? "جاري اختبار الاتصال…" : "اختبار الاتصال"}
                </button>
                {!canTest && !testing && (
                  <p className="text-[11px] text-text-muted text-center font-bold">املأ جميع الحقول المطلوبة أعلاه لاختبار الاتصال</p>
                )}

                {testSteps.length > 0 && (
                  <div className="space-y-1.5 animate-slide-up">
                    {testSteps.map(s => <TestRow key={s.key} icon={s.icon} label={t(`sync.config.wizard.connect.check.${s.labelKey}`)} status={s.status} />)}
                  </div>
                )}

                {testResult && testResult.connected && (
                  <div className="p-5 rounded-xl bg-success-bg border border-success-border animate-slide-up space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-5 w-5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-text opacity-75" /><span className="relative inline-flex rounded-full h-5 w-5 bg-success-text" /></span>
                      <span className="text-sm font-black text-success-text">تم الاتصال بنجاح</span>
                    </div>
                    <div className="bg-bg-surface/60 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold text-text-primary">مزامنة تلقائية</span>
                        </div>
                        <button onClick={() => canConfigure && setAutoSync(!autoSync)} disabled={!canConfigure} className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${autoSync ? "bg-primary" : "bg-gray-200"} ${canConfigure ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-bg-surface rounded-full shadow-sm transition-transform duration-200 ${autoSync ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </div>
                      {autoSync && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] text-text-muted">كل</span>
                          <select value={syncInterval} onChange={(e) => canConfigure && setSyncInterval(Number(e.target.value))} disabled={!canConfigure} className="bg-bg-surface border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-text-primary">
                            <option value={5}>5 د</option><option value={10}>10 د</option><option value={15}>15 د</option><option value={30}>30 د</option><option value={60}>60 د</option><option value={120}>120 د</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canConfigure && <button onClick={handleSave} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition active:scale-95">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ الإعدادات
                      </button>}
                      <button onClick={() => navigate("/sync")} className="inline-flex items-center gap-2 px-4 py-2.5 border border-border-strong rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-base transition">
                        <ArrowLeftRight className="h-4 w-4" /> الذهاب للمزامنة
                      </button>
                    </div>
                  </div>
                )}

                {testResult && !testResult.connected && (
                  <div className="p-4 rounded-xl bg-danger-bg border border-danger-border animate-slide-up">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-danger-text" />
                      <span className="text-xs font-bold text-danger-text">فشل الاتصال</span>
                    </div>
                    <ul className="space-y-1 mb-3">
                      <li className="flex items-center gap-1.5 text-[11px] text-danger-text/80"><div className="w-1 h-1 rounded-full bg-danger-text/40" />تأكد من صحة رابط المتجر</li>
                      <li className="flex items-center gap-1.5 text-[11px] text-danger-text/80"><div className="w-1 h-1 rounded-full bg-danger-text/40" />تأكد من صحة رقم المتجر</li>
                      <li className="flex items-center gap-1.5 text-[11px] text-danger-text/80"><div className="w-1 h-1 rounded-full bg-danger-text/40" />تأكد من صحة مفتاح API</li>
                      <li className="flex items-center gap-1.5 text-[11px] text-danger-text/80"><div className="w-1 h-1 rounded-full bg-danger-text/40" />المتجر يجب أن يكون متصلاً بالإنترنت</li>
                    </ul>
                    <div className="flex items-center gap-2">
                      <button onClick={runTest} className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger-text text-white rounded-xl text-xs font-bold hover:opacity-90 transition"><RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة</button>
                      {SUPPORT_URL && <button onClick={() => window.open(SUPPORT_URL, "_blank")} className="inline-flex items-center gap-1.5 px-4 py-2 border border-danger-border rounded-xl text-xs font-bold text-danger-text hover:bg-danger-bg transition"><Headphones className="h-3.5 w-3.5" /> دعم فني</button>}
                    </div>
                  </div>
                )}

                <button onClick={() => { setStep(0); setHasWebsite(null); }} className="inline-flex items-center gap-1.5 px-4 py-2 border border-border-strong rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-base transition">
                  <ChevronLeft className="h-4 w-4" /> رجوع
                </button>
              </div>
            </div>

            <div className="bg-bg-surface rounded-2xl shadow-card border border-border-subtle p-4 mt-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-info-text mt-0.5 flex-shrink-0" />
                <div className="text-xs text-text-secondary leading-relaxed">
                  <span className="font-bold text-text-primary">ماذا بعد الربط؟</span><br />
                  بعد الربط، ستتمكن من سحب المنتجات من متجرك الإلكتروني إلى نقاط البيع، ومزامنة المخزون والأسعار تلقائياً عند بيع أي صنف.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
