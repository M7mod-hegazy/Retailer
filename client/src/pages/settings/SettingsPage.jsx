import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, Settings2, Globe, Loader2, RefreshCw, XCircle, Monitor, Info, Lock, ChevronDown, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "../../services/api";
import { classifyConnectionError, buildSupportReport, copyToClipboard } from "../../services/connection";
import { HelpSettingsTab } from "./HelpSettingsTab";
import { AppIdentityTab } from "./AppIdentityTab";
import BackupSettingsTab from "./BackupSettingsTab";
import MaintenanceTab from "./MaintenanceTab";
import { usePageTour } from "../../hooks/usePageTour";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PrintingSettingsPanel from "./PrintingSettingsPanel";
import PermissionGate from "../../components/ui/PermissionGate";
import AppearancePanel from "./AppearancePanel";
import { applyFontSettings } from "../../utils/fontSettings";
import { applyColorTheme } from "../../utils/applyColorTheme";
import PerformanceSettings from "../../components/ui/PerformanceSettings";
import { useUiStore } from "../../stores/uiStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { useAuthStore } from "../../stores/authStore";
import FeaturesTab from "./FeaturesTab";
import ShortcutsTab from "./ShortcutsTab";
import { getMeta, getHint, getPlaceholder, getDefault, findMissingCritical, fieldKeyToTab } from "../../utils/fieldMeta";
import CriticalSettingsWarning from "../../components/ui/CriticalSettingsWarning";

const tabs = [
  { id: "identity", label: "هوية التطبيق", hint: "اسم الشركة والشعار وبيانات الفرع" },
  { id: "general", label: "عام", hint: "اللغة وواجهة نقطة البيع وسجل النشاط" },
  { id: "financial", label: "المالية والضرائب", hint: "العملة والضريبة وحدود الخصم وهوامش الربح" },
  { id: "printing", label: "الطباعة", hint: "مقاسات الإيصال ومعاينة القوالب" },
  { id: "appearance", label: "المظهر", hint: "الخطوط والألوان ونمط الأرقام — نظام ألوان متكامل للواجهة" },
  { id: "performance", label: "الرسوميات والأداء", hint: "إعدادات الرسوميات والأداء لأنظمة التشغيل البطيئة" },
  { id: "features", label: "الميزات", hint: "تفعيل أو تعطيل وحدات متخصصة حسب نوع متجرك" },
  { id: "shortcuts", label: "اختصارات لوحة المفاتيح", hint: "تخصيص اختصارات لوحة المفاتيح لكل شاشة" },
  { id: "maintenance", label: "النسخ الاحتياطي والبيانات", hint: "إنشاء واستعادة وتصدير النسخ وتفريغ قاعدة البيانات" },
  { id: "help", label: "المساعدة", hint: "الدليل السريع ومراجع الدعم" },
];

function Tab({ active, hasDirty, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-6 py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-all min-w-[120px] ${
        active
          ? "border-slate-800 text-slate-900 bg-slate-50/50"
          : "border-transparent text-slate-400 hover:text-slate-800 hover:bg-slate-50/30"
      }`}
    >
      {children}
      {hasDirty && (
        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-amber-500 shadow-sm" />
      )}
    </button>
  );
}

function FieldGroup({ title, hint, children }) {
  return (
    <section className="space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</h3>
        {hint && <p className="mt-1 text-[11px] font-bold text-slate-400">{hint}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span className="group relative cursor-help shrink-0">
      <Info className="h-3 w-3 text-slate-300 hover:text-slate-500 transition-colors" />
      <div className="absolute bottom-full right-0 mb-2 z-20 hidden w-56 rounded-lg bg-slate-800 p-3 text-[11px] font-bold text-white shadow-xl leading-relaxed group-hover:block">
        {text}
        <div className="absolute top-full right-3 -mt-1 h-2 w-2 rotate-45 bg-slate-800" />
      </div>
    </span>
  );
}

function DefaultBadge({ value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
      <span className="text-slate-400">الافتراضي:</span> {value}
    </span>
  );
}

function DenseInput({ label, required, metaKey, ...props }) {
  const meta = metaKey ? getMeta(metaKey) : null;
  const hint = metaKey ? getHint(metaKey) : null;
  const placeholder = metaKey ? getPlaceholder(metaKey) : null;
  const isCriticalEmpty = meta?.critical && (
    props.value === undefined || props.value === null || props.value === "" ||
    (meta.defaultValue !== undefined && meta.defaultValue !== null && meta.defaultValue !== "" && props.value === meta.defaultValue)
  );
  return (
    <label className="block space-y-1.5 focus-within:text-slate-900 text-slate-500 transition-colors group">
      <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {hint && <InfoTip text={hint} />}
        {isCriticalEmpty && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700 border border-amber-300">
            مطلوب
          </span>
        )}
      </span>
      <input
        {...props}
        data-field-key={metaKey}
        placeholder={props.placeholder || placeholder}
        className={`w-full rounded-sm border py-2.5 px-3 text-sm font-bold outline-none shadow-sm transition-all placeholder:text-slate-300 placeholder:font-normal ${
          isCriticalEmpty
            ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600"
            : "border-slate-200 bg-white text-slate-800 focus:border-slate-800"
        }`}
      />
      {meta && (
        <span className="block text-[10px] font-bold text-slate-400 mt-0.5 opacity-0 group-focus-within:opacity-100 transition-opacity">
          <span className="text-slate-300">الافتراضي:</span> {meta.defaultValue ?? "—"}
        </span>
      )}
    </label>
  );
}

function DenseSelect({ label, options, metaKey, ...props }) {
  const hint = metaKey ? getHint(metaKey) : null;
  const meta = metaKey ? getMeta(metaKey) : null;
  const isCriticalEmpty = meta?.critical && (
    props.value === undefined || props.value === null || props.value === "" || props.value === "none" ||
    (meta.defaultValue !== undefined && meta.defaultValue !== null && meta.defaultValue !== "" && props.value === meta.defaultValue)
  );
  return (
    <label className="block space-y-1.5 focus-within:text-slate-900 text-slate-500 transition-colors group">
      <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest">
        {label}
        {hint && <InfoTip text={hint} />}
        {isCriticalEmpty && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700 border border-amber-300">
            مطلوب
          </span>
        )}
      </span>
      <select
        {...props}
        data-field-key={metaKey}
        className={`w-full rounded-sm border py-2.5 px-3 text-sm font-bold outline-none shadow-sm transition-all ${
          isCriticalEmpty
            ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600"
            : "border-slate-200 bg-white text-slate-800 focus:border-slate-800"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {meta && (
        <span className="block text-[10px] font-bold text-slate-400 mt-0.5 opacity-0 group-focus-within:opacity-100 transition-opacity">
          <span className="text-slate-300">الافتراضي:</span> {
            (meta.options ? meta.options.find(o => o.value === meta.defaultValue)?.label?.ar || meta.defaultValue : meta.defaultValue) ?? "—"
          }
        </span>
      )}
    </label>
  );
}

const EXCLUDE_KEYS = new Set(["id", "created_at", "updated_at"]);
const v = (s, key) => s[key] ?? getDefault(key);

function normalizeSettings(data) {
  const mapped = {};
  Object.entries(data).forEach(([key, val]) => {
    if (EXCLUDE_KEYS.has(key)) return;
    let parsed = val;
    if (parsed === "true") parsed = true;
    else if (parsed === "false") parsed = false;
    else if (typeof parsed === "string" && !isNaN(Number(parsed)) && parsed !== "") parsed = Number(parsed);
    if (typeof parsed === "number" && (key.startsWith("show_") || key.startsWith("logo_on_") || key === "auto_backup_enabled")) {
      parsed = parsed === 1;
    }
    mapped[key] = parsed;
  });
  return mapped;
}

function isDirty(original, current) {
  if (original === current) return false;
  for (const key of Object.keys(current)) {
    if (EXCLUDE_KEYS.has(key)) continue;
    if (String(original[key] ?? "") !== String(current[key] ?? "")) return true;
  }
  return false;
}

function AppearancePreviewBar({ settings }) {
  const [open, setOpen] = useState(true);
  const currentFamily = settings.font_family || "Noto Sans Arabic";
  const currentWeight = settings.font_weight || 700;
  const currentNumFamily = settings.number_font_family || "Outfit";
  const currentNumWeight = settings.number_font_weight || 700;
  const currentScale = settings.number_font_scale || "normal";
  const scaleMap = { tiny: 0.5, small: 0.75, normal: 1, large: 1.125, xlarge: 1.25, huge: 1.5, giant: 2 };
  const scale = scaleMap[currentScale] ?? 1;
  const numeralStyle = settings.numeral_style || "western";
  const digits = numeralStyle === "arabic"
    ? new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(1234567890)
    : "0123456789";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 shadow-lg"
      style={{ borderTop: "1px solid var(--border-normal)", backgroundColor: "var(--bg-surface)" }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-2 text-right"
        style={{ color: "var(--text-primary)" }}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded" style={{ backgroundColor: "var(--bg-overlay)" }}>
          <Monitor className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
        </span>
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
          معاينة حية
        </span>
        <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
          {currentFamily} · {currentWeight}
        </span>
        <ChevronDown className={`mr-auto h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} style={{ color: "var(--text-muted)" }} />
      </button>

      {open && (
        <div className="flex items-center gap-6 border-t px-4 py-3 flex-wrap" style={{ borderColor: "var(--border-subtle)" }}>
          <div>
            <span className="mb-0.5 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>النص</span>
            <span style={{ fontFamily: currentFamily, fontWeight: currentWeight, fontSize: "18px", color: "var(--text-primary)" }}>
              عرض تجريبي
            </span>
          </div>
          <div>
            <span className="mb-0.5 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>الأرقام</span>
            <span style={{ fontFamily: currentNumFamily, fontWeight: currentNumWeight, fontSize: `${20 * scale}px`, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
              {digits}
            </span>
          </div>
          <div>
            <span className="mb-0.5 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>أزرار</span>
            <div className="flex gap-2">
              <button className="rounded px-3 py-1.5 text-[11px] font-black text-white" style={{ backgroundColor: "var(--primary)" }}>
                أساسي
              </button>
              <button className="rounded px-3 py-1.5 text-[11px] font-black" style={{ border: "1px solid var(--border-normal)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                عادي
              </button>
              <button className="rounded px-3 py-1.5 text-[11px] font-black" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  usePageTour("settings");
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "identity");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const fetchErrorRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [isRTL, setIsRTL] = useState(document.documentElement.dir === "rtl");
  const [printPreview, setPrintPreview] = useState(false);
  const [focusField, setFocusField] = useState(searchParams.get("field") || null);
  const posAutoRail = useUiStore((s) => s.posAutoRail);
  const setPosAutoRail = useUiStore((s) => s.setPosAutoRail);
  const authUser = useAuthStore((s) => s.user);
  // The "Features" tab toggles store-type modules — restricted to the dev account.
  const isDev = authUser?.role === "dev" || String(authUser?.username || "").toLowerCase() === "m7mod";
  const visibleTabs = isDev ? tabs : tabs.filter((t) => t.id !== "features");
  const originalRef = useRef({});
  const autoSaveTimer = useRef(null);
  const settingsRef   = useRef({});
  const pendingTabRef = useRef(null);
  const focusAttemptRef = useRef(0);

  const dir = i18n.dir();

  useEffect(() => {
    setIsRTL(document.documentElement.dir === "rtl");
  }, [i18n.language]);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Non-dev users can't open the Features tab even via ?tab=features URL
  useEffect(() => {
    if (!isDev && activeTab === "features") setActiveTab("identity");
  }, [isDev, activeTab]);

  // Auto-switch tab + scroll to target field from URL param
  useEffect(() => {
    if (!focusField || loading) return;
    const targetTab = fieldKeyToTab(focusField);
    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  }, [focusField, loading, activeTab]);

  useEffect(() => {
    if (!focusField || loading) return;
    const targetTab = fieldKeyToTab(focusField);
    if (targetTab !== activeTab) return;

    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-field-key="${focusField}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-amber-400", "rounded-sm");
        el.closest("label")?.classList.add("critical-field-highlight");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-amber-400", "rounded-sm");
          el.closest("label")?.classList.remove("critical-field-highlight");
        }, 3000);
        setFocusField(null);
      } else {
        focusAttemptRef.current += 1;
        if (focusAttemptRef.current < 5) {
          setTimeout(() => setFocusField(focusField), 300);
        } else {
          setFocusField(null);
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [focusField, loading, activeTab]);

  const dirty = isDirty(originalRef.current, settings);

  useEffect(() => {
    if (dirty) {
      const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [dirty]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    // The local server blips for a second or two during startup/restart, and a heavy
    // synchronous DB op can make it momentarily unreachable. Don't punish the user with a
    // hard error screen for that — retry a few times with backoff first, and only surface
    // the error UI once it is genuinely, persistently unreachable.
    const delays = [600, 1200, 2400];
    let lastErr = null;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        const response = await api.get("/api/settings");
        const data = response.data?.data;
        let mapped = {};
        if (data && typeof data === "object" && !Array.isArray(data)) {
          mapped = normalizeSettings(data);
        } else if (Array.isArray(data)) {
          data.forEach((item) => {
            let val = item.setting_value;
            if (val === "true") val = true;
            if (val === "false") val = false;
            if (!isNaN(val) && val !== "" && typeof val === "string") val = Number(val);
            mapped[item.setting_key] = val;
          });
        }
        setSettings(mapped);
        originalRef.current = JSON.parse(JSON.stringify(mapped));
        settingsRef.current = mapped;
        fetchErrorRef.current = null;
        setLoading(false);
        return;
      } catch (err) {
        lastErr = err;
        // A 4xx (e.g. 401/403) is a real, non-transient answer from the server — retrying
        // won't help, so stop early. Only retry transient transport failures.
        const status = err?.response?.status;
        const transient =
          classifyConnectionError(err) !== "http" || (status >= 500 && status < 600);
        if (!transient || attempt === delays.length) break;
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
    console.error("Failed to load settings:", lastErr);
    fetchErrorRef.current = lastErr;
    setFetchError(true);
    setLoading(false);
    toast.error(isRTL ? "تعذر تحميل الإعدادات" : "Failed to load settings");
  }, [isRTL]);

  const copySettingsError = useCallback(async () => {
    const err = fetchErrorRef.current;
    const report = await buildSupportReport(err || { message: "no captured request error" }, {
      context: "Settings /api/settings",
    });
    const ok = await copyToClipboard(report);
    toast[ok ? "success" : "error"](
      ok ? "تم نسخ تفاصيل الخطأ" : "تعذّر النسخ — انسخ يدوياً",
    );
  }, []);

  const handleChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    settingsRef.current = updated;
    // For feature flags: sync the global store immediately so Sidebar, ItemForm, etc. react right away
    if (key.startsWith("feature_")) {
      useAppSettingsStore.getState().applySettings({ [key]: value });
    }
    if (activeTab === "printing") {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => silentSave(settingsRef.current), 1200);
    }
  };

  const silentSave = async (snap) => {
    try {
      const payload = Object.entries(snap).map(([k, v]) => ({ setting_key: k, setting_value: String(v) }));
      await api.post("/api/settings/bulk", { settings: payload });
      // Sync the global settings store so all hooks (useFeatureEnabled, etc.) see the new values immediately
      useAppSettingsStore.getState().applySettings(snap);
      originalRef.current = JSON.parse(JSON.stringify(snap));
    } catch (err) {
      console.error("Silent save failed:", err);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = Object.entries(settings).map(([k, v]) => ({
        setting_key: k,
        setting_value: String(v),
      }));
      await api.post("/api/settings/bulk", { settings: payload });
      originalRef.current = JSON.parse(JSON.stringify(settings));
      toast.success(isRTL ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
      applyFontSettings(settings);
      applyColorTheme(settings);
      useAppSettingsStore.getState().applySettings(settings);
    } catch {
      toast.error(isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    const original = JSON.parse(JSON.stringify(originalRef.current));
    setSettings(original);
    settingsRef.current = original;
    applyColorTheme(original);
    toast(isRTL ? "تم تجاهل التغييرات" : "Changes discarded", { icon: "↩️" });
  };

  const handleTabClick = (tabId) => {
    if (tabId === activeTab) return;
    if (dirty) {
      const confirmMsg = isRTL
        ? "لديك تغييرات غير محفوظة. هل تريد تجاهلها والانتقال؟"
        : "You have unsaved changes. Discard them and switch tabs?";
      if (!window.confirm(confirmMsg)) return;
      handleDiscard();
    }
    setActiveTab(tabId);
  };

  if (loading)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          <span className="text-sm font-bold">{isRTL ? "جاري تحميل الإعدادات..." : "Loading settings..."}</span>
        </div>
      </div>
    );

  if (fetchError)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <XCircle className="h-10 w-10 text-rose-400" />
          <span className="text-sm font-bold text-slate-500">
            {isRTL ? "فشل تحميل الإعدادات" : "Failed to load settings"}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSettings}
              className="flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-sm font-black text-white shadow-md transition-all hover:bg-primary-600 active:scale-95"
            >
              <RefreshCw className="h-4 w-4" />
              {isRTL ? "إعادة المحاولة" : "Retry"}
            </button>
            <button
              onClick={copySettingsError}
              className="flex items-center gap-2 rounded-sm border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-100 active:scale-95"
              title={isRTL ? "نسخ تفاصيل الخطأ" : "Copy error details"}
            >
              <Copy className="h-4 w-4" />
              {isRTL ? "نسخ تفاصيل الخطأ" : "Copy error details"}
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className={`standard-page-container font-sans flex flex-col gap-6 pb-20 ${isRTL ? "text-right" : "text-left"}`}>
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400">
             <Settings2 className="h-4 w-4" />
             <span className="text-[11px] font-black uppercase tracking-widest">إعدادات النظام</span>
          </div>
          <h1 className="text-[24px] font-black text-slate-900">{isRTL ? "تهيئة وتخصيص الفرع" : "System Configuration"}</h1>
          <p className="text-sm font-bold text-slate-400">التحكم المركزي في الهوية والطباعة واللغة والنسخ الاحتياطي</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              onClick={handleDiscard}
              className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-rose-600 active:scale-95"
            >
              <XCircle className="h-4 w-4" />
              {isRTL ? "تجاهل التغييرات" : "Discard"}
            </button>
          )}
          <PermissionGate page="settings" action="edit_general">
            <button
              data-help="save-button"
              onClick={handleSubmit}
              disabled={saving || !dirty}
              className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:bg-primary-600 active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ الإعدادات" : "Save Settings")}
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-col rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden flex-1">
         
         {/* Tabs Strip */}
         <div data-help="settings-tabs" className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50 pt-2 px-4 scrollbar-hide">
            {visibleTabs.map((tab) => (
              <Tab
                key={tab.id}
                active={activeTab === tab.id}
                hasDirty={dirty}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.label}
              </Tab>
            ))}
         </div>

          {/* Content Area */}
           <div className="p-6 md:p-8 pb-16 overflow-y-auto w-full">
            {/* Critical settings warning — visible on every tab for live feedback */}
            <div className={activeTab !== "identity" ? "mb-6" : ""}>
              <CriticalSettingsWarning
                settings={settings}
                onNavigate={(key) => {
                  const tab = fieldKeyToTab(key);
                  handleTabClick(tab);
                  setTimeout(() => {
                    const el = document.querySelector(`[data-field-key="${key}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("ring-2", "ring-amber-400", "rounded-sm");
                      el.closest("label")?.classList.add("critical-field-highlight");
                      setTimeout(() => {
                        el.classList.remove("ring-2", "ring-amber-400", "rounded-sm");
                        el.closest("label")?.classList.remove("critical-field-highlight");
                      }, 3000);
                    }
                  }, 500);
                }}
                lang={isRTL ? "ar" : "en"}
              />
            </div>

            {activeTab === "identity" && (
              <AppIdentityTab settings={settings} onChange={handleChange} onSave={handleSubmit} lang={isRTL ? "ar" : "en"} />
            )}

            {activeTab === "general" && (
              <div className="space-y-8">
                {/* Interface & Display */}
                <section>
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary text-white">
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">الواجهة والعرض</h3>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        لغة العرض الافتراضية وشكل نقطة البيع الافتراضي للمستخدمين الجدد
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
                     <DenseSelect metaKey="language" label="تغيير اللغة الافتراضية" value={settings.language ?? getDefault("language")} onChange={(e) => handleChange("language", e.target.value)} options={[
                        {value: "ar", label: "العربية (RTL)"}, {value: "en", label: "English (LTR)"}
                     ]} />
                  </div>

                  <div className="mt-4 flex items-start gap-3 rounded-sm border border-orange-200 bg-orange-50 p-4 text-orange-600">
                    <Globe className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-2sm font-black uppercase tracking-widest text-orange-800">تلميح بخصوص الأنظمة</div>
                      <div className="text-[11px] leading-relaxed font-bold opacity-90 mt-1 text-orange-700">
                        التغيير هنا يتطلب إعادة تحميل وقد يتم فرضه على بقية الموظفين. استخدم الجلوبات في القائمة العلوية لتغيير واجهتك المحلية فقط.
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">عرض نقطة البيع الافتراضي</h4>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden w-fit">
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = { ...settings, default_pos_view: "detailed" };
                          handleChange("default_pos_view", "detailed");
                          try {
                            await silentSave(updated);
                            originalRef.current = JSON.parse(JSON.stringify(updated));
                            toast.success("تم حفظ عرض الشبكة كافتراضي");
                          } catch {
                            toast.error("فشل الحفظ - تحقق من الاتصال");
                          }
                        }}
                        className={`px-4 py-2 text-2sm font-black transition-all ${v(settings, "default_pos_view") === "detailed" ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        شبكة / تفصيلي
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = { ...settings, default_pos_view: "list" };
                          handleChange("default_pos_view", "list");
                          try {
                            await silentSave(updated);
                            originalRef.current = JSON.parse(JSON.stringify(updated));
                            toast.success("تم حفظ عرض القائمة كافتراضي");
                          } catch {
                            toast.error("فشل الحفظ - تحقق من الاتصال");
                          }
                        }}
                        className={`px-4 py-2 text-2sm font-black transition-all ${settings.default_pos_view === "list" ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        قائمة
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] font-bold text-slate-400">يحدد العرض الذي يظهر للمستخدم عند فتح شاشة البيع لأول مرة</p>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">تصغير القائمة الجانبية في نقطة البيع</h4>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={posAutoRail}
                      onClick={() => setPosAutoRail(!posAutoRail)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${posAutoRail ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${posAutoRail ? "-translate-x-6" : "-translate-x-1"}`} />
                    </button>
                    <p className="mt-2 text-[11px] font-bold text-slate-400">عند التفعيل، تُطوى القائمة الجانبية تلقائياً إلى شريط أيقونات داخل شاشة البيع لإتاحة مساحة أكبر (يمكن توسيعها يدوياً وقت الحاجة). إعداد خاص بهذا الجهاز.</p>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">الصوت في نقطة البيع</h4>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(v(settings, "pos_voice_enabled"))}
                      onClick={() => handleChange("pos_voice_enabled", v(settings, "pos_voice_enabled") ? 0 : 1)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${v(settings, "pos_voice_enabled") ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${v(settings, "pos_voice_enabled") ? "-translate-x-6" : "-translate-x-1"}`} />
                    </button>
                    <p className="mt-2 text-[11px] font-bold text-slate-400">عند التفعيل، يُصدر النظام صوت تنبيه (بييب) عند إضافة صنف إلى الفاتورة أو مسح باركود. يُفضّل إيقافه في البيئات الهادئة.</p>
                  </div>
                </section>

                {/* Smart Lock */}
                <section>
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-violet-600 text-white">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">قفل الشاشة الذكي</h3>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        قفل الشاشة تلقائياً بعد فترة من عدم النشاط لحماية الجلسة
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">تفعيل القفل الذكي</h4>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(v(settings, "smart_lock_enabled"))}
                      onClick={() => handleChange("smart_lock_enabled", v(settings, "smart_lock_enabled") ? 0 : 1)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${v(settings, "smart_lock_enabled") ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${v(settings, "smart_lock_enabled") ? "-translate-x-6" : "-translate-x-1"}`} />
                    </button>
                    <p className="mt-2 text-[11px] font-bold text-slate-400">عند التفعيل، يُقفل النظام تلقائياً بعد فترة من عدم استخدام لوحة المفاتيح أو الفأرة أو اللمس</p>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 max-w-lg mt-6">
                    <DenseInput
                      label="مدة عدم النشاط (دقائق)"
                      metaKey="smart_lock_timeout_minutes"
                      type="number"
                      min={1}
                      max={999}
                      value={v(settings, "smart_lock_timeout_minutes")}
                      onChange={(e) => handleChange("smart_lock_timeout_minutes", Number(e.target.value))}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-400 leading-relaxed max-w-lg">
                    عدد الدقائق التي يمكن أن يبقى فيها النظام دون استخدام قبل أن يُقفل تلقائياً. القيمة الافتراضية: 15 دقيقة
                  </p>
                </section>

                {/* Alerts */}
                <section>
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-amber-600 text-white">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">تنبيهات الفواتير المعلقة</h3>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        مدة بقاء الفاتورة في حالة معلقة قبل تغيير لون التنبيه في شاشة المبيعات
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 max-w-lg">
                    <DenseInput
                      label="تنبيه أصفر بعد (ساعات)"
                      metaKey="held_yellow_hours"
                      type="number"
                      min={1}
                      max={72}
                      value={v(settings, "held_yellow_hours")}
                      onChange={(e) => handleChange("held_yellow_hours", Number(e.target.value))}
                    />
                    <DenseInput
                      label="تنبيه أحمر بعد (ساعات)"
                      metaKey="held_red_hours"
                      type="number"
                      min={1}
                      max={168}
                      value={v(settings, "held_red_hours")}
                      onChange={(e) => handleChange("held_red_hours", Number(e.target.value))}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-400 leading-relaxed max-w-lg">
                    بعد المدة المحددة يتحول لون الفاتورة المعلقة إلى الأصفر ثم الأحمر لتنبيه المشرف بضرورة متابعتها
                  </p>
                </section>

                {/* Audit Log */}
                <section>
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-white">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">سجل النشاط</h3>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        التحكم في مدة الاحتفاظ بسجلات حركة المستخدمين في النظام للأرشفة والتدقيق
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4 max-w-sm">
                    <DenseSelect
                      label="مدة حفظ سجل النشاط"
                      metaKey="audit_log_retention_days"
                      value={v(settings, "audit_log_retention_days")}
                      onChange={(e) => handleChange("audit_log_retention_days", Number(e.target.value))}
                      options={[
                        { value: 15, label: "15 يوم" },
                        { value: 30, label: "30 يوم" },
                        { value: 60, label: "60 يوم" },
                        { value: 90, label: "90 يوم" },
                        { value: 180, label: "180 يوم" },
                        { value: 365, label: "365 يوم" },
                      ]}
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === "financial" && (
              <div className="space-y-8">
                {/* Currency & Tax */}
                <section>
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-white">
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">العملة والضرائب</h3>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        إعدادات العملة وطريقة تطبيق الضريبة على الفواتير والمشتريات
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <DenseInput label="رمز العملة" metaKey="currency_symbol" value={v(settings, "currency_symbol")} onChange={(e) => handleChange("currency_symbol", e.target.value)} />
                    <DenseSelect label="كسور العملة" metaKey="decimal_places" value={v(settings, "decimal_places")} onChange={(e) => handleChange("decimal_places", Number(e.target.value))} options={[
                      {value: 0, label: "0"}, {value: 2, label: "2"}, {value: 3, label: "3"}
                    ]} />
                    <DenseSelect
                      label="تفعيل الضريبة"
                      metaKey="tax_enabled"
                      value={Number(v(settings, "tax_enabled"))}
                      onChange={(e) => handleChange("tax_enabled", Number(e.target.value))}
                      options={[{ value: 1, label: "مفعّل" }, { value: 0, label: "غير مفعّل" }]}
                    />
                    {Number(v(settings, "tax_enabled")) === 1 && (
                      <>
                        <DenseSelect label="نوع الضريبة الافتراضي" metaKey="tax_type" value={v(settings, "tax_type")} onChange={(e) => handleChange("tax_type", e.target.value)} options={[
                          {value: "none", label: "بدون ضريبة"}, {value: "inclusive", label: "شاملة الضريبة"}, {value: "exclusive", label: "غير شاملة الضريبة"}
                        ]} />
                        <DenseInput label="نسبة الضريبة (%)" metaKey="tax_rate" type="number" step="0.01" value={v(settings, "tax_rate")} onChange={(e) => handleChange("tax_rate", e.target.value)} />
                      </>
                    )}
                  </div>
                </section>

                {/* Discount Limits */}
                <section>
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-rose-600 text-white">
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">حدود الخصم</h3>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        تحديد الحد الأقصى للخصم المسموح به على الفواتير لحماية هامش الربح
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <DenseSelect
                      label="حد الخصم الأقصى"
                      metaKey="discount_cap_enabled"
                      value={Number(v(settings, "discount_cap_enabled"))}
                      onChange={(e) => handleChange("discount_cap_enabled", Number(e.target.value))}
                      options={[{ value: 1, label: "مفعّل" }, { value: 0, label: "بدون حد (غير مفعّل)" }]}
                    />
                    <DenseInput
                      label="الحد الأقصى للخصم (%)"
                      metaKey="max_discount_percent"
                      type="number" step="1" min="0" max="100"
                      value={v(settings, "max_discount_percent")}
                      disabled={Number(v(settings, "discount_cap_enabled")) === 0}
                      onChange={(e) => handleChange("max_discount_percent", Number(e.target.value))}
                    />
                  </div>
                </section>

                {/* Profit Margins */}
                <section>
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-indigo-600 text-white">
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">هوامش الربح والتسعير</h3>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                        إعدادات حساب التكلفة وحدود الهامش لتحليل الربحية
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <DenseSelect
                      label="طريقة حساب التكلفة"
                      metaKey="margin_alert_cost_method"
                      value={v(settings, "margin_alert_cost_method")}
                      onChange={(e) => handleChange("margin_alert_cost_method", e.target.value)}
                      options={[
                        {value: "wacc",          label: "المتوسط المرجح (WACC)"},
                        {value: "last_purchase", label: "آخر سعر شراء"},
                        {value: "standard",      label: "تكلفة معيارية"},
                        {value: "fifo",          label: "الوارد أولاً (FIFO)"},
                        {value: "lifo",          label: "الوارد أخيراً (LIFO)"},
                      ]}
                    />
                    <DenseInput
                      label="الحد الأدنى للهامش (%)"
                      metaKey="min_margin_percent"
                      type="number" step="0.1" min="0" max="100"
                      value={v(settings, "min_margin_percent")}
                      onChange={(e) => handleChange("min_margin_percent", Number(e.target.value))}
                    />
                    <DenseInput
                      label="هامش الربح المستهدف (%)"
                      metaKey="target_margin_percent"
                      type="number" step="0.1" min="0" max="100"
                      value={v(settings, "target_margin_percent")}
                      onChange={(e) => handleChange("target_margin_percent", Number(e.target.value))}
                    />
                  </div>
                  <div className="mt-4 flex items-start gap-3 rounded-sm border border-blue-100 bg-blue-50/60 p-3 text-blue-700 text-[11px] font-bold leading-relaxed">
                    <span className="shrink-0 mt-0.5">ℹ</span>
                    <span>
                      طريقة حساب التكلفة تُستخدم في تحليل الربح عند إنشاء فواتير الشراء وفي تقارير هامش الربح.
                      FIFO وLIFO محسوبان لحظة إنشاء التقرير فقط وليس في الوقت الفعلي.
                    </span>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "printing" && (
              <div data-help="print-section">
                <PrintingSettingsPanel settings={settings} onChange={handleChange} />
              </div>
            )}

            {activeTab === "appearance" && (
              <AppearancePanel settings={settings} onChange={handleChange} />
            )}

            {activeTab === "performance" && (
              <PerformanceSettings />
            )}

            {activeTab === "features" && isDev && (
              <FeaturesTab settings={settings} onChange={handleChange} onSilentSave={silentSave} />
            )}

            {activeTab === "shortcuts" && (
              <ShortcutsTab />
            )}

            {activeTab === "maintenance" && (
              <MaintenanceTab settings={settings} onChange={handleChange} />
            )}

            {activeTab === "help" && (
              <HelpSettingsTab />
            )}
         </div>
      </div>

      {activeTab === "appearance" && <AppearancePreviewBar settings={settings} />}

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        docType="pos_receipt"
        invoice={{ invoice_no: "PREVIEW-001", created_at: new Date().toISOString(), lines: [] }}
        settings={settings}
        operationLabel="معاينة إعدادات الطباعة"
      />
    </div>
  );
}
