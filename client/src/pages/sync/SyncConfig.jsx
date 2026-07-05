import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Save, Link2, Loader2, CheckCircle2, XCircle, ArrowLeftRight,
  Globe, Key, Building2, Copy, ExternalLink, HelpCircle,
  ChevronLeft, ChevronRight, Shield, Info, Smartphone, Monitor,
  ArrowRight, CheckSquare, BookOpen, Lightbulb, Wifi,
  Lock, Headphones, Store, Server, Database, RefreshCw,
  AlertTriangle, Clock, ShoppingBag, Package, Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { getSyncConfig, saveSyncConfig, getSyncStatus, getWebhookStatus, testWebhook, verifySyncConnection, updateWebhookConfig, registerWebhook } from "../../services/syncService";
import { useSyncStore } from "../../stores/syncStore";

const STEPS = [
  { id: "welcome", icon: Lightbulb },
  { id: "prerequisites", icon: BookOpen },
  { id: "connect", icon: Link2 },
  { id: "test", icon: CheckCircle2 },
];

const TEST_CHECKS = [
  { key: "domain", icon: Globe },
  { key: "server", icon: Server },
  { key: "auth", icon: Shield },
  { key: "data", icon: Database },
];

function validateStoreId(val) {
  if (!val) return "idle";
  if (val.startsWith("store_") && val.length >= 8) return "valid";
  return "invalid";
}

function validateApiKey(val) {
  if (!val) return "idle";
  if (val.length >= 16) return "valid";
  return "invalid";
}

function ConfigSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <div className="animate-pulse h-8 w-64 rounded-lg mx-auto bg-gray-200" />
      <div className="animate-pulse h-4 w-96 rounded-lg mx-auto bg-gray-200" />
      <div className="animate-pulse h-64 w-full rounded-2xl bg-gray-200" />
    </div>
  );
}

function StepIndicator({ current, steps }) {
  const { t } = useTranslation();
  const labels = [
    t("sync.config.wizard.steps.welcome"),
    t("sync.config.wizard.steps.requirements"),
    t("sync.config.wizard.steps.connect"),
    t("sync.config.wizard.steps.test"),
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === current;
        const isDone = i < current;
        const isPending = i > current;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-500 ${
                  isDone
                    ? "bg-primary text-white"
                    : isActive
                    ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30"
                    : "bg-gray-100 text-text-muted"
                }`}
              >
                {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                <span className={`absolute -top-2 -right-2 rtl:right-auto rtl:-left-2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${
                  isDone || isActive
                    ? "bg-white text-primary border border-primary"
                    : "bg-white text-text-muted border border-gray-300"
                }`}>
                  {i + 1}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold mt-1.5 whitespace-nowrap transition-colors duration-300 ${
                  isActive || isDone ? "text-primary" : "text-text-muted"
                }`}
              >
                {labels[i]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 md:w-16 h-0.5 mx-1.5 md:mx-2 rounded-full transition-colors duration-500 ${
                isDone || (!isDone && !isPending && current === i)
                  ? isDone ? "bg-primary" : "bg-gray-300"
                  : isActive || isPending
                  ? isActive ? "bg-primary/30" : "bg-gray-200"
                  : "bg-gray-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SyncDiagram() {
  const { t } = useTranslation();
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const t1 = setInterval(() => setPulse((p) => !p), 2000);
    return () => clearInterval(t1);
  }, []);
  return (
    <div className="relative flex items-center justify-center gap-6 md:gap-10 py-4">
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-primary-50 flex items-center justify-center ring-2 ring-primary/20 transition-all duration-700"
          style={{ animation: pulse ? "none" : "none", transform: pulse ? "translateY(-2px)" : "translateY(0)" }}>
          <Smartphone className="h-8 w-8 md:h-10 md:w-10 text-primary" />
        </div>
        <span className="text-[11px] font-bold text-text-primary">{t("sync.config.wizard.welcome.diagram.pos")}</span>
        <span className="text-[10px] text-text-muted -mt-1">POS</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <div className={`h-0.5 w-8 md:w-12 rounded-full transition-all duration-700 ${pulse ? "bg-primary h-1" : "bg-border-normal"}`} />
          <ArrowRight className={`h-4 w-4 text-primary transition-all duration-500 rtl:rotate-180 ${pulse ? "opacity-100 translate-x-0" : "opacity-40"}`} />
          <div className="flex flex-col items-center mx-1">
            <div className={`h-5 w-5 rounded-full border-2 transition-all duration-500 ${pulse ? "border-primary bg-primary/10 scale-110" : "border-gray-300"}`}>
              <ArrowLeftRight className={`h-3 w-3 text-primary mx-auto mt-0.5 transition-opacity duration-500 ${pulse ? "opacity-100" : "opacity-0"}`} />
            </div>
          </div>
          <ArrowRight className={`h-4 w-4 text-primary transition-all duration-500 rtl:rotate-180 ${!pulse ? "opacity-100 translate-x-0" : "opacity-40"}`} />
          <div className={`h-0.5 w-8 md:w-12 rounded-full transition-all duration-700 ${!pulse ? "bg-primary h-1" : "bg-border-normal"}`} />
        </div>
        <span className="text-[9px] font-bold text-text-muted mt-2">{t("sync.config.wizard.welcome.diagram.desc")}</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-info-bg flex items-center justify-center ring-2 ring-info-text/20 transition-all duration-700"
          style={{ transform: !pulse ? "translateY(-2px)" : "translateY(0)" }}>
          <Globe className="h-8 w-8 md:h-10 md:w-10 text-info-text" />
        </div>
        <span className="text-[11px] font-bold text-text-primary">{t("sync.config.wizard.welcome.diagram.ecom")}</span>
        <span className="text-[10px] text-text-muted -mt-1">E-com</span>
      </div>
    </div>
  );
}

function BrowserMockup({ children, labelTop }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
                <span className="w-2.5 h-2.5 rounded-full bg-danger-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-warning-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-success-border" />
                <div className="flex-1 mx-3">
                  <div className="bg-gray-50 rounded-md px-2 py-1 text-[10px] text-text-muted font-mono text-center truncate max-w-full" dir="ltr">
                    admin.mystore.com/settings/sync
                  </div>
                </div>
              </div>
      {labelTop && (
        <div className="px-3 py-1.5 border-b border-gray-200">
          <span className="text-[10px] font-bold text-text-primary">{labelTop}</span>
        </div>
      )}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
}

function InlineSvgArrow({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 20" fill="none">
      <line x1="2" y1="10" x2="34" y2="10" stroke="currentColor" strokeWidth="2" strokeDasharray="4,2" />
      <polygon points="34,4 40,10 34,16" fill="currentColor" />
    </svg>
  );
}

function StoreIdMockup() {
  const { t } = useTranslation();
  return (
    <BrowserMockup labelTop={t("sync.config.wizard.requirements.storeId.hint")}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <Shield className="h-3 w-3" />
            <span>Live</span>
          </div>
          <div className="h-4 border-l border-gray-200" />
          <div className="flex-1" />
          <div className="text-[9px] bg-primary-50 text-primary px-2 py-0.5 rounded font-bold">{t("sync.config.wizard.requirements.storeId.active")}</div>
        </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-3 gap-0 text-[10px] font-bold text-text-muted border-b border-gray-200">
              <div className="px-2.5 py-1.5">{t("sync.config.wizard.requirements.storeId.colStore")}</div>
              <div className="px-2.5 py-1.5 border-x border-gray-200">{t("sync.config.wizard.requirements.storeId.colId")}</div>
              <div className="px-2.5 py-1.5 text-center">{t("sync.config.wizard.requirements.storeId.colStatus")}</div>
            </div>
            <div className="grid grid-cols-3 gap-0 text-[11px] text-text-primary font-mono">
              <div className="px-2.5 py-2">{t("sync.config.wizard.requirements.storeName")}</div>
              <div className="px-2.5 py-2 border-x border-gray-200 bg-warning-bg/40 text-warning-text font-bold relative">
              store_abc12345
              <div className="absolute -top-1 -left-1 rtl:left-auto rtl:-right-1">
                <div className="relative">
                  <InlineSvgArrow className="h-4 w-6 text-danger-text rtl:rotate-180" />
                  <span className="absolute -top-3 left-5 rtl:left-auto rtl:-right-5 rtl:text-left text-[8px] text-danger-text font-bold whitespace-nowrap" dir="ltr">
                    ← {t("sync.config.wizard.requirements.storeId.arrowLabel")}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-2.5 py-2 text-center">
              <span className="text-success-text text-[9px] bg-success-bg px-1.5 py-0.5 rounded font-bold">● {t("sync.config.wizard.requirements.storeId.connected")}</span>
            </div>
          </div>
        </div>
      </div>
    </BrowserMockup>
  );
}

function ApiKeyMockup() {
  const { t } = useTranslation();
  return (
    <BrowserMockup labelTop={t("sync.config.wizard.requirements.apiKey.hint")}>
      <div className="space-y-2 relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-text-primary">{t("sync.config.wizard.requirements.apiKey.sectionTitle")}</span>
          <span className="text-[9px] bg-primary-50 text-primary px-2 py-0.5 rounded font-bold">{t("sync.config.wizard.requirements.apiKey.generateBtn")}</span>
        </div>
        <div className="bg-gray-50 rounded-lg border-2 border-danger-border p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-danger-text" />
              <div>
                <div className="text-[10px] text-text-muted">{t("sync.config.wizard.requirements.apiKey.label")}</div>
                <div className="text-[13px] font-mono text-text-primary tracking-widest font-bold" dir="ltr">
                  sk_live_••••••••••••••••
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-text-muted">
              <Copy className="h-3 w-3" />
              <span>{t("sync.config.wizard.requirements.apiKey.copy")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-danger-text font-bold">
          <AlertTriangle className="h-3 w-3" />
          <span>{t("sync.config.wizard.requirements.apiKey.warning")}</span>
        </div>
        <div className="absolute -left-1 bottom-10 rtl:left-auto rtl:-right-1 rtl:scale-x-[-1]">
          <InlineSvgArrow className="h-4 w-6 text-danger-text" />
        </div>
      </div>
    </BrowserMockup>
  );
}

function CheckItem({ icon: Icon, title, desc, mockup, checked, onCheck, onVerify, verifying }) {
  const { t } = useTranslation();
  return (
    <div className={`bg-white rounded-xl border transition-all duration-300 ${
      checked ? "border-success-border bg-success-bg/10" : "border-gray-200 hover:border-primary/30 hover:shadow-sm"
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onCheck}
            className={`w-7 h-7 mt-0.5 rounded-xl border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer ${
              checked
                ? "bg-success-text border-success-text text-white"
                : "border-gray-300 hover:border-primary hover:bg-primary-50"
            }`}
          >
            {checked && <CheckCircle2 className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                checked ? "bg-success-bg" : "bg-primary-50"
              }`}>
                <Icon className={`h-4 w-4 ${checked ? "text-success-text" : "text-primary"}`} />
              </div>
              <div>
                <h3 className="text-sm font-black text-text-primary">{title}</h3>
                <p className="text-xs text-text-secondary">{desc}</p>
              </div>
            </div>
            {mockup}
          </div>
        </div>
      </div>
      {!checked && (
        <div className="px-4 pb-4 pr-14 rtl:pr-4 rtl:pl-14">
          <button
            onClick={onVerify}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-[11px] font-bold text-text-secondary hover:bg-gray-100 hover:border-primary transition-all duration-200 disabled:opacity-50"
          >
            {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("sync.config.wizard.requirements.button.verify")}
          </button>
        </div>
      )}
    </div>
  );
}

function TestStepRow({ icon: Icon, label, status }) {
  const statusIcon = {
    pending: <div className="w-4 h-4 rounded-full border-2 border-gray-300" />,
    loading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
    success: <CheckCircle2 className="h-4 w-4 text-success-text" />,
    error: <XCircle className="h-4 w-4 text-danger-text" />,
  };
  const statusBg = {
    pending: "bg-gray-50",
    loading: "bg-primary-50",
    success: "bg-success-bg",
    error: "bg-danger-bg",
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 ${statusBg[status]}`}>
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
        <Icon className={`h-4 w-4 ${
          status === "error" ? "text-danger-text" :
          status === "success" ? "text-success-text" :
          "text-text-muted"
        }`} />
      </div>
      <span className={`text-xs font-bold flex-1 ${
        status === "error" ? "text-danger-text" :
        status === "success" ? "text-success-text" :
        "text-text-secondary"
      }`}>
        {label}
      </span>
      {statusIcon[status]}
    </div>
  );
}

function TrustBar() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-4 md:gap-6 text-[10px] text-text-muted">
      <span className="flex items-center gap-1">
        <Lock className="h-3 w-3" />
        {t("sync.config.wizard.welcome.trust.encrypted")}
      </span>
      <span className="w-px h-3 bg-border-subtle" />
      <span className="flex items-center gap-1">
        <Shield className="h-3 w-3" />
        {t("sync.config.wizard.welcome.trust.secure")}
      </span>
      <span className="w-px h-3 bg-border-subtle" />
      <span className="flex items-center gap-1">
        <Headphones className="h-3 w-3" />
        {t("sync.config.wizard.welcome.trust.support")}
      </span>
    </div>
  );
}

function ValidationBadge({ status, validMsg, invalidMsg }) {
  if (status === "idle") return null;
  const isValid = status === "valid";
  return (
    <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${
      isValid ? "text-success-text" : "text-danger-text"
    }`}>
      {isValid ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      <span>{isValid ? validMsg : invalidMsg}</span>
    </div>
  );
}

export default function SyncConfig({ store: propStore = null, onSave: propOnSave = null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config, setConfig, setStatus } = useSyncStore();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    ecom_url: "",
    store_id: "",
    api_key: "",
    store_name: "",
    auto_sync_enabled: false,
    sync_interval_minutes: 30,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [checks, setChecks] = useState({ storeId: false, apiKey: false, internet: false });
  const [verifying, setVerifying] = useState({});
  const [testSteps, setTestSteps] = useState([]);

  useEffect(() => {
    if (propStore) {
      setForm({
        ecom_url: propStore.ecom_url || "",
        store_id: propStore.store_id || "",
        api_key: "",
        store_name: propStore.store_name || "",
      });
      setLoaded(true);
      return;
    }
    getSyncConfig().then((res) => {
      if (res.configured && res.config) {
        setConfig(res.config);
        setForm({
          ecom_url: res.config.ecom_url || "",
          store_id: res.config.store_id || "",
          api_key: "",
          store_name: res.config.store_name || "",
        });
      }
      setLoaded(true);
    });
  }, [setConfig, propStore]);

  const storeIdVal = validateStoreId(form.store_id);
  const apiKeyVal = validateApiKey(form.api_key);

  const updateField = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = useCallback(async () => {
    if (!form.ecom_url || !form.store_id || !form.api_key) {
      toast.error(t("sync.config.fillRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await saveSyncConfig(form);
      if (res.ok) {
        toast.success(t("sync.config.saved"));
        setConfig({
          ...form,
          api_key: `${form.api_key.slice(0, 8)}...${form.api_key.slice(-4)}`,
        });
        if (propOnSave) {
          propOnSave(form);
        }
      }
    } catch {
      toast.error(t("sync.config.saveError"));
    } finally {
      setSaving(false);
    }
  }, [form, setConfig, propOnSave, t]);

  const runTestSequence = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setTestSteps(TEST_CHECKS.map((c) => ({ ...c, status: "loading" })));

    try {
      const res = await verifySyncConnection();
      if (res?.steps) {
        setTestSteps(TEST_CHECKS.map((c) => {
          const step = res.steps.find(s => s.key === c.key);
          return step ? { ...c, status: step.status, message: step.message } : { ...c, status: "error" };
        }));
        const allOk = res.steps.every(s => s.status === "success");
        setTestResult(allOk ? { ok: true, connected: true } : { ok: true, connected: false });
        if (allOk) {
          toast.success(t("sync.config.connected"));
        } else {
          toast.error(t("sync.config.connectionFailed"));
        }
      } else {
        setTestSteps(TEST_CHECKS.map((c) => ({ ...c, status: "error" })));
        toast.error(t("sync.config.connectionFailed"));
      }
    } catch {
      setTestSteps(TEST_CHECKS.map((c) => ({ ...c, status: "error" })));
      toast.error(t("sync.config.connectionFailed"));
    } finally {
      setTesting(false);
    }
  }, [t]);

  const nextStep = useCallback(() => {
    if (step === 2) {
      if (!form.ecom_url || !form.store_id || !form.api_key) {
        toast.error(t("sync.config.fillRequired"));
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [step, form, t]);

  const handleVerify = (key) => {
    setVerifying((v) => ({ ...v, [key]: true }));
    setTimeout(() => {
      setChecks((c) => ({ ...c, [key]: true }));
      setVerifying((v) => ({ ...v, [key]: false }));
    }, 800);
  };

  if (!loaded) return <ConfigSkeleton />;

  const canFinish = form.ecom_url && form.store_id && form.api_key;
  const allChecksDone = checks.storeId && checks.apiKey && checks.internet;
  const isConfigured = !!config;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary via-primary-600 to-primary/90 text-white overflow-hidden">
        <div className="relative max-w-4xl mx-auto px-6 py-10 md:py-14 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-xs font-bold mb-5 animate-fade-in">
            <Link2 className="h-3.5 w-3.5" />
            {isConfigured ? t("sync.config.editSubtitle") : t("sync.config.connectionSubtitle")}
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3 animate-slide-up">
            {t("sync.config.wizard.title")}
          </h1>
          <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto animate-fade-in" style={{ animationDelay: "150ms" }}>
            {t("sync.config.wizard.subtitle")}
          </p>
          <div className="mt-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
            <TrustBar />
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-3xl mx-auto px-6 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-6 py-5">
          <StepIndicator current={step} steps={STEPS} />
        </div>
      </div>

      {/* Step Content */}
      <div className="px-6 mt-6">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-center">
              <SyncDiagram />

              <h2 className="text-lg font-black text-text-primary mb-3">
                {t("sync.config.wizard.welcome.title")}
              </h2>
              <p className="text-sm text-text-secondary max-w-lg mx-auto leading-relaxed mb-6">
                {t("sync.config.wizard.welcome.description")}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-right">
                {[
                  {
                    label: t("sync.config.wizard.welcome.fromPos"),
                    items: [
                      t("sync.config.wizard.welcome.fromPosItem1"),
                      t("sync.config.wizard.welcome.fromPosItem2"),
                      t("sync.config.wizard.welcome.fromPosItem3"),
                    ],
                  },
                  {
                    label: t("sync.config.wizard.welcome.fromEcom"),
                    items: [
                      t("sync.config.wizard.welcome.fromEcomItem1"),
                      t("sync.config.wizard.welcome.fromEcomItem2"),
                      t("sync.config.wizard.welcome.fromEcomItem3"),
                    ],
                  },
                ].map((col) => (
                  <div key={col.label} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-xs font-black text-text-primary mb-2">{col.label}</p>
                    <ul className="space-y-1.5">
                      {col.items.map((item) => (
                        <li key={item} className="text-xs text-text-secondary flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg shadow-primary/25"
              >
                {t("sync.config.wizard.welcome.cta")}
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Prerequisites */}
        {step === 1 && (
          <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-warning-bg flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-warning-text" />
                </div>
                <div>
                  <h2 className="text-base font-black text-text-primary">{t("sync.config.wizard.requirements.title")}</h2>
                  <p className="text-xs text-text-muted mt-0.5">{t("sync.config.wizard.requirements.subtitle")}</p>
                </div>
              </div>

              {/* Instruction: Tell user to click each checkbox */}
              <div className="mb-5 flex items-center gap-2.5 bg-primary-50 border border-primary/20 rounded-xl px-4 py-3">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-black">👆</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary">
                    {t("sync.config.wizard.requirements.instruction")}
                  </p>
                  <p className="text-[10px] text-primary/70 mt-0.5">
                    {t("sync.config.wizard.requirements.instructionDesc")}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-primary bg-white/60 px-2.5 py-1 rounded-lg flex-shrink-0">
                  <span>{Object.values(checks).filter(Boolean).length}</span>
                  <span>/</span>
                  <span>3</span>
                </div>
              </div>

              <div className="space-y-4">
                <CheckItem
                  icon={Building2}
                  title={t("sync.config.wizard.requirements.storeId.title")}
                  desc={t("sync.config.wizard.requirements.storeId.desc")}
                  mockup={<StoreIdMockup />}
                  checked={checks.storeId}
                  onCheck={() => setChecks((c) => ({ ...c, storeId: !c.storeId }))}
                  onVerify={() => handleVerify("storeId")}
                  verifying={verifying.storeId}
                />

                <CheckItem
                  icon={Key}
                  title={t("sync.config.wizard.requirements.apiKey.title")}
                  desc={t("sync.config.wizard.requirements.apiKey.desc")}
                  mockup={<ApiKeyMockup />}
                  checked={checks.apiKey}
                  onCheck={() => setChecks((c) => ({ ...c, apiKey: !c.apiKey }))}
                  onVerify={() => handleVerify("apiKey")}
                  verifying={verifying.apiKey}
                />

                <CheckItem
                  icon={Wifi}
                  title={t("sync.config.wizard.requirements.internet.title")}
                  desc={t("sync.config.wizard.requirements.internet.desc")}
                  mockup={
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-success-text bg-success-bg rounded-lg px-3 py-2 border border-success-border">
                      <Wifi className="h-4 w-4" />
                      <span className="font-bold">{t("sync.config.wizard.requirements.internet.connected")}</span>
                    </div>
                  }
                  checked={checks.internet}
                  onCheck={() => setChecks((c) => ({ ...c, internet: !c.internet }))}
                  onVerify={() => handleVerify("internet")}
                  verifying={verifying.internet}
                />
              </div>

              {allChecksDone && (
                <div className="mt-4 flex items-center gap-2 text-xs text-success-text bg-success-bg border border-success-border rounded-xl px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span className="font-bold">{t("sync.config.wizard.requirements.allSet")}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-1.5 px-5 py-3 border border-gray-200 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 transition"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
                {t("sync.config.wizard.requirements.button.back")}
              </button>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={nextStep}
                  disabled={!allChecksDone}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
                >
                  {t("sync.config.wizard.requirements.button.next")}
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {!allChecksDone && (
                  <span className="text-[10px] text-text-muted font-bold">
                    {t("sync.config.wizard.requirements.nextHint")}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Connection Form */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto space-y-5 animate-slide-up">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-black text-text-primary">{t("sync.config.wizard.connect.title")}</h2>
                  <p className="text-xs text-text-muted mt-0.5">{t("sync.config.wizard.connect.subtitle")}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Store ID */}
                <div className={`bg-white rounded-xl p-4 border transition-all duration-200 ${
                  storeIdVal === "valid" ? "border-success-border" :
                  storeIdVal === "invalid" ? "border-danger-border" :
                  "border-gray-200 hover:border-primary/30 hover:shadow-sm"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      storeIdVal === "valid" ? "bg-success-bg" :
                      storeIdVal === "invalid" ? "bg-danger-bg" :
                      "bg-primary-50"
                    }`}>
                      <Building2 className={`h-4 w-4 ${
                        storeIdVal === "valid" ? "text-success-text" :
                        storeIdVal === "invalid" ? "text-danger-text" :
                        "text-primary"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-black text-text-primary mb-1.5 block">
                        {t("sync.config.wizard.connect.storeId.label")}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        className={`w-full px-4 py-2.5 bg-gray-100 border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 ${
                          storeIdVal === "valid" ? "border-success-border" :
                          storeIdVal === "invalid" ? "border-danger-border" :
                          "border-gray-300"
                        }`}
                        placeholder={t("sync.config.wizard.connect.storeId.placeholder")}
                        value={form.store_id}
                        onChange={(e) => updateField("store_id")(e.target.value)}
                      />
                      <ValidationBadge
                        status={storeIdVal}
                        validMsg={t("sync.config.wizard.connect.storeId.validFormat")}
                        invalidMsg={t("sync.config.wizard.connect.storeId.invalidFormat")}
                      />
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted">
                        <Lightbulb className="h-3 w-3" />
                        <span>{t("sync.config.wizard.connect.storeId.hint")}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* API Key */}
                <div className={`bg-white rounded-xl p-4 border transition-all duration-200 ${
                  apiKeyVal === "valid" ? "border-success-border" :
                  apiKeyVal === "invalid" ? "border-danger-border" :
                  "border-gray-200 hover:border-primary/30 hover:shadow-sm"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      apiKeyVal === "valid" ? "bg-success-bg" :
                      apiKeyVal === "invalid" ? "bg-danger-bg" :
                      "bg-danger-bg"
                    }`}>
                      <Key className={`h-4 w-4 ${
                        apiKeyVal === "valid" ? "text-success-text" :
                        apiKeyVal === "invalid" ? "text-danger-text" :
                        "text-danger-text"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-black text-text-primary mb-1.5 block">
                        {t("sync.config.wizard.connect.apiKey.label")}
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          dir="ltr"
                          className={`w-full px-4 py-2.5 bg-gray-100 border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 ltr:pl-10 rtl:pr-10 ${
                            apiKeyVal === "valid" ? "border-success-border" :
                            apiKeyVal === "invalid" ? "border-danger-border" :
                            "border-gray-300"
                          }`}
                          placeholder={t("sync.config.wizard.connect.apiKey.placeholder")}
                          value={form.api_key}
                          onChange={(e) => updateField("api_key")(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (form.api_key) {
                              navigator.clipboard.writeText(form.api_key);
                              toast.success(t("sync.config.wizard.connect.copied"));
                            }
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-2 text-text-muted hover:text-primary transition p-1"
                          title={t("sync.config.wizard.connect.copyPaste")}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <ValidationBadge
                        status={apiKeyVal}
                        validMsg={t("sync.config.wizard.connect.apiKey.validLength")}
                        invalidMsg={t("sync.config.wizard.connect.apiKey.invalidLength")}
                      />
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted">
                        <Lightbulb className="h-3 w-3" />
                        <span>{t("sync.config.wizard.connect.apiKey.hint")}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Store Name (optional) */}
                <div className="bg-white rounded-xl p-4 border border-gray-200 hover:border-primary/30 hover:shadow-sm transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-info-bg flex items-center justify-center flex-shrink-0">
                      <Store className="h-4 w-4 text-info-text" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-black text-text-primary mb-1.5 block">
                        {t("sync.config.wizard.connect.storeName.label")}
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder={t("sync.config.wizard.connect.storeName.placeholder")}
                        value={form.store_name}
                        onChange={(e) => updateField("store_name")(e.target.value)}
                      />
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted">
                        <Info className="h-3 w-3" />
                        <span>{t("sync.config.wizard.connect.storeName.hint")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Connection Button + Sequencer */}
              <div className="mt-6">
                <button
                  onClick={runTestSequence}
                  disabled={testing || !canFinish || storeIdVal !== "valid" || apiKeyVal !== "valid"}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  {testing ? t("sync.config.wizard.connect.button.testing") : t("sync.config.wizard.connect.button.test")}
                </button>
              </div>

              {testSteps.length > 0 && (
                <div className="mt-4 space-y-1.5 animate-slide-up">
                  {testSteps.map((s) => (
                    <TestStepRow
                      key={s.key}
                      icon={s.icon}
                      label={t(`sync.config.wizard.connect.check.${s.key}`)}
                      status={s.status}
                    />
                  ))}
                </div>
              )}

              {testResult && !testResult.connected && (
                <div className="mt-4 bg-danger-bg border border-danger-border rounded-xl p-4 animate-slide-up">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-danger-text" />
                    <span className="text-xs font-bold text-danger-text">{t("sync.config.wizard.test.failure.title")}</span>
                  </div>
                  <p className="text-xs text-danger-text/80 mb-2">{testResult.error || t("sync.config.wizard.test.failure.desc")}</p>
                  <div className="space-y-1">
                    {[t("sync.config.wizard.test.failure.fix.url"), t("sync.config.wizard.test.failure.fix.key"), t("sync.config.wizard.test.failure.fix.store"), t("sync.config.wizard.test.failure.fix.internet")].map((fix) => (
                      <div key={fix} className="flex items-center gap-1.5 text-[11px] text-danger-text/70">
                        <div className="w-1 h-1 rounded-full bg-danger-text/40" />
                        {fix}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={runTestSequence}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger-text text-white rounded-xl text-xs font-bold hover:opacity-90 transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t("sync.config.wizard.test.failure.retry")}
                    </button>
                    <button
                      onClick={() => window.open("https://support.example.com", "_blank")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-danger-border rounded-xl text-xs font-bold text-danger-text hover:bg-danger-bg transition"
                    >
                      <Headphones className="h-3.5 w-3.5" />
                      {t("sync.config.wizard.test.failure.support")}
                    </button>
                  </div>
                </div>
              )}

              {testResult && testResult.connected && (
                <div className="mt-4 bg-success-bg border border-success-border rounded-xl p-4 animate-slide-up">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-text opacity-75" />
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-success-text" />
                    </span>
                    <span className="text-sm font-black text-success-text">{t("sync.config.wizard.test.success.title")}</span>
                  </div>
                  {testResult.ecomStatus && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-white/60 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-black text-success-text">{testResult.ecomStatus.totalProducts ?? "-"}</div>
                        <div className="text-[10px] text-success-text/70 font-bold">{t("sync.config.wizard.test.success.products")}</div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-black text-success-text">{testResult.ecomStatus.storeName || form.store_name || "-"}</div>
                        <div className="text-[10px] text-success-text/70 font-bold">{t("sync.config.wizard.test.success.storeName")}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 text-center">
                <TrustBar />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-5 py-3 border border-gray-200 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 transition"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
                {t("sync.config.wizard.connect.button.back")}
              </button>
              <button
                onClick={nextStep}
                disabled={!canFinish}
                className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition"
              >
                {t("sync.config.wizard.connect.button.next")}
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Test & Finish */}
        {step === 3 && (
          <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-center">
              {testResult && testResult.connected ? (
                <>
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl bg-success-text opacity-25" />
                    <div className="relative w-20 h-20 rounded-2xl bg-success-bg flex items-center justify-center">
                      <CheckCircle2 className="h-12 w-12 text-success-text" />
                    </div>
                  </div>
                  <h2 className="text-lg font-black text-text-primary mb-1">{t("sync.config.wizard.test.success.title")}</h2>
                  <p className="text-sm text-text-secondary mb-5">{t("sync.config.wizard.test.success.desc")}</p>

                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-5 text-right">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{t("sync.config.wizard.test.success.storeName")}</span>
                        <span className="text-text-primary font-bold">{form.store_name || t("sync.config.wizard.connect.storeName.placeholder")}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{t("sync.config.wizard.test.success.storeId")}</span>
                        <code className="text-text-primary font-mono text-[11px]" dir="ltr">{form.store_id}</code>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{t("sync.config.wizard.test.success.connectedAt")}</span>
                        <span className="text-text-primary font-bold">{new Date().toLocaleTimeString("ar-SA")}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted">{t("sync.config.wizard.test.success.url")}</span>
                        <code className="text-text-primary font-mono text-[11px]" dir="ltr">{form.ecom_url}</code>
                      </div>
                    </div>
                  </div>

                  {/* Scheduling */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-5 text-right">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-text-primary">{t("sync.scheduling.title")}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => setForm(f => ({ ...f, auto_sync_enabled: !f.auto_sync_enabled }))}
                        className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                          form.auto_sync_enabled ? "bg-primary" : "bg-gray-200"
                        } cursor-pointer hover:opacity-80`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                          form.auto_sync_enabled ? "translate-x-5" : "translate-x-0"
                        }`} />
                      </button>
                      <span className="text-xs text-text-secondary">{t("sync.scheduling.enable")}</span>
                    </div>
                    {form.auto_sync_enabled && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-muted">{t("sync.scheduling.interval")}</span>
                        <select
                          value={form.sync_interval_minutes || 30}
                          onChange={(e) => setForm(f => ({ ...f, sync_interval_minutes: Number(e.target.value) }))}
                          className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-text-primary"
                        >
                          <option value={5}>5 {t("sync.scheduling.minutes")}</option>
                          <option value={10}>10 {t("sync.scheduling.minutes")}</option>
                          <option value={15}>15 {t("sync.scheduling.minutes")}</option>
                          <option value={30}>30 {t("sync.scheduling.minutes")}</option>
                          <option value={60}>60 {t("sync.scheduling.minutes")}</option>
                          <option value={120}>120 {t("sync.scheduling.minutes")}</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 disabled:opacity-50 transition-all duration-200 active:scale-95"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t("sync.config.wizard.test.success.save")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-danger-bg flex items-center justify-center mx-auto mb-4">
                    <XCircle className="h-10 w-10 text-danger-text" />
                  </div>
                  <h2 className="text-lg font-black text-text-primary mb-1">{t("sync.config.wizard.test.failure.title")}</h2>
                  <p className="text-sm text-text-secondary mb-5">{t("sync.config.wizard.test.failure.desc")}</p>

                  <div className="bg-danger-bg border border-danger-border rounded-xl p-4 mb-5 text-right">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-danger-text" />
                      <span className="text-xs font-bold text-danger-text">{t("sync.config.wizard.test.failure.help")}</span>
                    </div>
                    <ul className="space-y-2">
                      {[
                        t("sync.config.wizard.test.failure.fix.url"),
                        t("sync.config.wizard.test.failure.fix.internet"),
                        t("sync.config.wizard.test.failure.fix.key"),
                        t("sync.config.wizard.test.failure.fix.store"),
                      ].map((fix) => (
                        <li key={fix} className="flex items-center gap-2 text-xs text-danger-text/80">
                          <div className="w-1.5 h-1.5 rounded-full bg-danger-text/40 flex-shrink-0" />
                          {fix}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:opacity-90 transition active:scale-95"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t("sync.config.wizard.test.failure.retry")}
                    </button>
                    <button
                      onClick={() => window.open("https://support.example.com", "_blank")}
                      className="inline-flex items-center gap-2 px-6 py-3 border-2 border-danger-border text-danger-text rounded-2xl text-sm font-bold hover:bg-danger-bg transition active:scale-95"
                    >
                      <Headphones className="h-4 w-4" />
                      {t("sync.config.wizard.test.failure.support")}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-5 py-3 border border-gray-200 rounded-xl text-xs font-bold text-text-secondary hover:bg-gray-100 transition"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-0 ltr:rotate-180" />
                {t("sync.config.wizard.connect.button.back")}
              </button>
              <button
                onClick={() => {
                  if (testResult && testResult.connected) {
                    navigate("/sync");
                  } else {
                    setStep(2);
                  }
                }}
                className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:opacity-90 active:scale-95 transition"
              >
                {t("sync.config.wizard.test.button.sync")}
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="max-w-3xl mx-auto mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-5 animate-fade-in">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info-text mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-black text-text-primary mb-1">{t("sync.config.wizard.info.title")}</h4>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {t("sync.config.wizard.info.desc")}
              </p>
            </div>
          </div>
        </div>

        {/* Webhook Settings — shown when configured */}
        {isConfigured && (
          <div className="max-w-3xl mx-auto">
            <WebhookSettingsSection />
          </div>
        )}
      </div>
    </div>
  );
}

function WebhookSettingsSection() {
  const { t } = useTranslation();
  const [whStatus, setWhStatus] = useState(null);
  const [whLoading, setWhLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [whToggling, setWhToggling] = useState(null);
  const [registrating, setRegistrating] = useState(false);

  useEffect(() => {
    getWebhookStatus()
      .then((res) => setWhStatus(res))
      .catch(() => {})
      .finally(() => setWhLoading(false));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testWebhook();
      if (res.ok) {
        toast.success(t("sync.webhook.testSuccess"));
        const updated = await getWebhookStatus();
        setWhStatus(updated);
      }
    } catch {
      toast.error(t("sync.webhook.testFailed"));
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (field, value) => {
    setWhToggling(field);
    try {
      const payload = field === 'autoReceive' ? { autoReceiveOrders: value } : { autoUpdateStock: value };
      await updateWebhookConfig(payload);
      setWhStatus(prev => ({ ...prev, [field === 'autoReceive' ? 'autoReceiveOrders' : 'autoUpdateStock']: value }));
      toast.success(t("sync.webhook.toggleSuccess"));
    } catch {
      toast.error(t("sync.webhook.toggleFailed"));
    } finally {
      setWhToggling(null);
    }
  };

  const handleCopy = () => {
    if (whStatus?.webhookUrl) {
      navigator.clipboard.writeText(whStatus.webhookUrl);
      setCopied(true);
      toast.success(t("sync.webhook.copied"));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (whLoading) {
    return (
      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-fade-in">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded-lg bg-gray-200" />
          <div className="h-20 w-full rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-info-bg flex items-center justify-center">
              <Wifi className="h-4 w-4 text-info-text" />
            </div>
            <div>
              <h3 className="text-sm font-black text-text-primary">{t("sync.webhook.config.title")}</h3>
              <p className="text-[11px] text-text-muted mt-0.5">{t("sync.webhook.config.subtitle")}</p>
            </div>
          </div>
          {whStatus && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              whStatus.lastDelivery?.status === "success"
                ? "bg-success-bg text-success-text"
                : "bg-warning-bg text-warning-text"
            }`}>
              <span className={`relative flex h-2 w-2 ${whStatus.lastDelivery?.status === "success" ? "" : ""}`}>
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  whStatus.lastDelivery?.status === "success" ? "animate-ping bg-success-text" : "bg-warning-text"
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  whStatus.lastDelivery?.status === "success" ? "bg-success-text" : "bg-warning-text"
                }`} />
              </span>
              {whStatus.lastDelivery?.status === "success"
                ? t("sync.webhook.status.active")
                : t("sync.webhook.status.inactive")}
            </span>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Webhook URL */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <label className="text-xs font-black text-text-primary mb-2 block">{t("sync.webhook.config.webhookUrl")}</label>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 text-[11px] font-mono text-text-secondary bg-gray-100 rounded-lg px-3 py-2 border border-gray-300 truncate">
                {whStatus?.webhookUrl || "—"}
              </code>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg border border-gray-300 text-text-muted hover:text-primary hover:border-primary transition-all"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-success-text" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Webhook Secret */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <label className="text-xs font-black text-text-primary mb-2 block">{t("sync.webhook.config.secret")}</label>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 text-[11px] font-mono text-text-secondary bg-gray-100 rounded-lg px-3 py-2 border border-gray-300 truncate">
                {whStatus?.webhookSecret || "—"}
              </code>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-text-primary">{t("sync.webhook.config.autoReceive")}</p>
                </div>
                <button
                  onClick={() => handleToggle('autoReceive', !whStatus?.autoReceiveOrders)}
                  disabled={whToggling === 'autoReceive'}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    whStatus?.autoReceiveOrders ? "bg-primary" : "bg-gray-200"
                  } ${whToggling === 'autoReceive' ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-80'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    whStatus?.autoReceiveOrders ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-warning-text flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-text-primary">{t("sync.webhook.config.autoStock")}</p>
                </div>
                <button
                  onClick={() => handleToggle('autoStock', !whStatus?.autoUpdateStock)}
                  disabled={whToggling === 'autoStock'}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    whStatus?.autoUpdateStock ? "bg-primary" : "bg-gray-200"
                  } ${whToggling === 'autoStock' ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-80'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    whStatus?.autoUpdateStock ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Last delivery */}
          {whStatus?.lastDelivery && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-text-primary">{t("sync.webhook.lastDelivery")}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  whStatus.lastDelivery.status === "success"
                    ? "bg-success-bg text-success-text"
                    : whStatus.lastDelivery.status === "failed"
                    ? "bg-danger-bg text-danger-text"
                    : "bg-warning-bg text-warning-text"
                }`}>
                  {whStatus.lastDelivery.status}
                </span>
              </div>
              <p className="text-xs text-text-muted font-mono" dir="ltr">
                {whStatus.lastDelivery.created_at}
              </p>
            </div>
          )}

          {/* Register with E-com */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={async () => {
                setRegistrating(true);
                try {
                  const res = await registerWebhook();
                  if (res.ok) {
                    toast.success(t("sync.webhook.registerSuccess"));
                    const updated = await getWebhookStatus();
                    setWhStatus(updated);
                  } else {
                    toast.error(res.error || t("sync.webhook.registerFailed"));
                  }
                } catch {
                  toast.error(t("sync.webhook.registerFailed"));
                } finally {
                  setRegistrating(false);
                }
              }}
              disabled={registrating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-50 border border-gray-200 text-text-primary rounded-xl text-sm font-bold hover:bg-gray-100 disabled:opacity-50 transition-all active:scale-95"
            >
              {registrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {t("sync.webhook.registerButton")}
            </button>
            <span className="text-xs text-text-muted">{t("sync.webhook.registerHint")}</span>
          </div>

          {/* Test button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {t("sync.webhook.testButton")}
            </button>
            <span className="text-xs text-text-muted">{t("sync.webhook.testHint")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
