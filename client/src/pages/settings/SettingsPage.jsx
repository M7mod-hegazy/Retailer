import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, Settings2, Globe, Loader2, RefreshCw, XCircle, Monitor, Info, Lock, ChevronDown, Copy, Building2, SlidersHorizontal, Wallet, Printer, Palette, Gauge, Puzzle, Keyboard, DatabaseBackup, LifeBuoy, Coins, Percent, TrendingUp, AlertTriangle, History } from "lucide-react";
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
import { COUNTRIES } from "../../utils/countryCodes";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import CriticalSettingsWarning from "../../components/ui/CriticalSettingsWarning";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";
import { SettingsUnsavedModal } from "../../components/ui/SettingsUnsavedModal";
import { useShortcutStore } from "../../shortcuts/shortcutStore";

const tabs = [
  { id: "identity", label: "بيانات المحل", hint: "اسم محلك، اللوجو، عنونك، والتفاصيل اللي بتظهر للزباين", icon: Building2 },
  { id: "general", label: "إعدادات عامة", hint: "شكل الكاشير، لغة البرنامج، وسجل الحركات", icon: SlidersHorizontal },
  { id: "financial", label: "الفلوس والضرائب", hint: "العملة، الضريبة، حدود الخصم، ونسبة المكسب", icon: Wallet },
  { id: "printing", label: "الطباعة والفواتير", hint: "مقاس ورق الطباعة وتصميم الفواتير", icon: Printer },
  { id: "appearance", label: "شكل البرنامج", hint: "ألوان البرنامج، الخطوط، وشكل الأرقام", icon: Palette },
  { id: "performance", label: "الأداء والسرعة", hint: "لو جهازك تقيل، تقدر تخفف الرسوميات من هنا عشان البرنامج يبقى طلقة", icon: Gauge },
  { id: "features", label: "ميزات إضافية", hint: "شغّل أو اقفل ميزات معينة على حسب شغل محلك (مطعم، صيانة، واتساب، إلخ)", icon: Puzzle },
  { id: "shortcuts", label: "اختصارات الكيبورد", hint: "ظبط زراير الكيبورد عشان تنجز وتسرّع شغلك على الكاشير", icon: Keyboard },
  { id: "maintenance", label: "النسخ الاحتياطي (الباك أب)", hint: "احفظ بياناتك في أمان، استرجعها، أو صفّر الداتا لو هتبدأ من جديد", icon: DatabaseBackup },
  { id: "help", label: "المساعدة والدعم", hint: "لو وقفت معاك حاجة، الشروحات هنا وكمان طرق التواصل معانا", icon: LifeBuoy },
];

function Tab({ active, icon: Icon, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-[13px] font-black transition-all motion-safe:hover:-translate-y-px ${
        active
          ? "bg-primary text-white shadow-lg shadow-emerald-500/20"
          : "text-text-secondary hover:bg-bg-surface hover:text-text-primary hover:shadow-sm"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-text-muted group-hover:text-text-secondary"}`} />
      {children}
    </button>
  );
}

function FieldGroup({ title, hint, children }) {
  return (
    <section className="space-y-4">
      <div className="border-b border-border-subtle pb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">{title}</h3>
        {hint && <p className="mt-1 text-[11px] font-bold text-text-muted">{hint}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex-1">
        <h4 className="text-[13px] font-black text-text-primary">{label}</h4>
        {hint && <p className="mt-1 text-[11px] font-bold text-text-muted leading-relaxed">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-border-strong"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-bg-surface shadow transition-transform ${checked ? "-translate-x-6" : "-translate-x-1"}`} />
      </button>
    </div>
  );
}

function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span className="group relative cursor-help shrink-0">
      <Info className="h-3 w-3 text-text-muted hover:text-text-secondary transition-colors" />
      <div className="absolute bottom-full right-0 mb-2 z-20 hidden w-56 rounded-lg bg-slate-900 p-3 text-[11px] font-bold text-white shadow-xl leading-relaxed group-hover:block">
        {text}
        <div className="absolute top-full right-3 -mt-1 h-2 w-2 rotate-45 bg-slate-900" />
      </div>
    </span>
  );
}

function DefaultBadge({ value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-bg-overlay px-2 py-0.5 text-[10px] font-bold text-text-secondary border border-border-normal">
      <span className="text-text-muted">الافتراضي:</span> {value}
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
    <label className="block space-y-1.5 focus-within:text-text-primary text-text-secondary transition-colors group">
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
        className={`w-full rounded-md border py-2.5 px-3 text-sm font-bold outline-none shadow-sm transition-all placeholder:text-text-muted placeholder:font-normal ${
          isCriticalEmpty
            ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-400/20"
            : "border-border-normal bg-bg-input text-text-primary hover:border-border-strong focus:border-primary focus:bg-bg-surface focus:ring-2 focus:ring-primary/20"
        }`}
      />
      {meta && (
        <span className="block text-[10px] font-bold text-text-muted mt-0.5 opacity-0 group-focus-within:opacity-100 transition-opacity">
          <span className="text-text-muted">الافتراضي:</span> {meta.defaultValue ?? "—"}
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
    <label className="block space-y-1.5 focus-within:text-text-primary text-text-secondary transition-colors group">
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
        className={`w-full rounded-md border py-2.5 px-3 text-sm font-bold outline-none shadow-sm transition-all ${
          isCriticalEmpty
            ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600 focus:ring-2 focus:ring-amber-400/20"
            : "border-border-normal bg-bg-input text-text-primary hover:border-border-strong focus:border-primary focus:bg-bg-surface focus:ring-2 focus:ring-primary/20"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {meta && (
        <span className="block text-[10px] font-bold text-text-muted mt-0.5 opacity-0 group-focus-within:opacity-100 transition-opacity">
          <span className="text-text-muted">الافتراضي:</span> {
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

function countChanges(original, current) {
  let count = 0;
  const allKeys = new Set([...Object.keys(original), ...Object.keys(current)]);
  for (const key of allKeys) {
    if (EXCLUDE_KEYS.has(key)) continue;
    if (String(original[key] ?? "") !== String(current[key] ?? "")) count++;
  }
  return count;
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
      className="fixed bottom-0 left-0 right-0 z-40 shadow-lg"
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
  const isDev = authUser?.role === "dev" || String(authUser?.username || "").toLowerCase() === "m7mod";
  const visibleTabs = isDev ? tabs : tabs.filter((t) => t.id !== "features");
  const originalRef = useRef({});
  const settingsRef   = useRef({});
  const pendingTabRef = useRef(null);
  const focusAttemptRef = useRef(0);
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const dir = i18n.dir();

  useEffect(() => {
    setIsRTL(document.documentElement.dir === "rtl");
  }, [i18n.language]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!loading) {
      const snap = useShortcutStore.getState().snapshot();
      shortcutSnapshotRef.current = snap;
    }
  }, [loading]);

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

  const changeCount = countChanges(originalRef.current, settings);
  const dirty = changeCount > 0;
  const { blocker } = useUnsavedChangesGuard(dirty);
  const activeTabMeta = visibleTabs.find((t) => t.id === activeTab) || visibleTabs[0];
  const [blockerSaving, setBlockerSaving] = useState(false);
  const shortcutSnapshotRef = useRef(null);

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
      await useShortcutStore.getState().persist();
      shortcutSnapshotRef.current = useShortcutStore.getState().snapshot();
      originalRef.current = JSON.parse(JSON.stringify(settings));
      toast.success(isRTL ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully");
      applyFontSettings(settings);
      applyColorTheme(settings);
      useAppSettingsStore.getState().applySettings(settings);
      return true;
    } catch {
      toast.error(isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    const original = JSON.parse(JSON.stringify(originalRef.current));
    setSettings(original);
    settingsRef.current = original;
    applyColorTheme(original);
    if (shortcutSnapshotRef.current) {
      useShortcutStore.getState().restoreSnapshot(shortcutSnapshotRef.current);
    }
    toast(isRTL ? "تم تجاهل التغييرات" : "Changes discarded", { icon: "↩️" });
  };

  const handleTabClick = async (tabId) => {
    if (tabId === activeTab) return;
    if (dirty) {
      const confirmMsg = isRTL
        ? "لديك تغييرات غير محفوظة. هل تريد تجاهلها والانتقال؟"
        : "You have unsaved changes. Discard them and switch tabs?";
      const ok = await confirm({ title: isRTL ? "تجاهل التغييرات" : "Discard Changes", message: confirmMsg });
      if (!ok) return;
      handleDiscard();
    }
    setActiveTab(tabId);
  };

  const handleBlockerSave = async () => {
    setBlockerSaving(true);
    const ok = await handleSubmit();
    setBlockerSaving(false);
    if (ok) blocker.proceed?.();
  };

  const handleBlockerDiscard = () => {
    handleDiscard();
    blocker.proceed?.();
  };

  if (loading)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
          <span className="text-sm font-bold">{isRTL ? "جاري تحميل الإعدادات..." : "Loading settings..."}</span>
        </div>
      </div>
    );

  if (fetchError)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-text-muted">
          <XCircle className="h-10 w-10 text-rose-400" />
          <span className="text-sm font-bold text-text-secondary">
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
              className="flex items-center gap-2 rounded-sm border border-border-strong px-4 py-2.5 text-sm font-bold text-text-secondary transition-all hover:bg-bg-overlay active:scale-95"
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-primary text-white shadow-lg shadow-emerald-500/20 ring-1 ring-inset ring-white/15">
            <Settings2 className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-text-muted">
              <span className="text-[11px] font-black uppercase tracking-widest">إعدادات النظام</span>
              <span className="text-[11px] font-bold text-text-muted">/</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary">{activeTabMeta?.label}</span>
              {settings.branch_name && (
                <>
                  <span className="text-[11px] font-bold text-text-muted">·</span>
                  <span className="inline-flex items-center rounded-full border border-border-normal bg-bg-overlay px-2 py-0.5 text-[10px] font-black normal-case tracking-normal text-text-secondary">
                    {settings.branch_name}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-[24px] font-black text-text-primary leading-tight">{isRTL ? "تهيئة وتخصيص الفرع" : "System Configuration"}</h1>
            <span className="block h-[3px] w-8 rounded-full bg-primary" />
            <p className="text-sm font-bold text-text-muted">{activeTabMeta?.hint}</p>
          </div>
        </div>
      </div>

      {/* Tab Dock */}
      <div data-help="settings-tabs" className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border-normal bg-bg-overlay/60 p-1.5 scrollbar-hide">
        {visibleTabs.map((tab) => (
          <Tab
            key={tab.id}
            active={activeTab === tab.id}
            icon={tab.icon}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </Tab>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="flex flex-col rounded-sm border border-border-normal bg-bg-surface shadow-sm overflow-hidden flex-1">

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
              <div className="space-y-6">
                {/* Interface & Display */}
                <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
                  <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">اللغة وشكل العرض</h3>
                      <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                        لغة البرنامج وشكل شاشة الكاشير اللي بيفتح عليها للناس الجديدة
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
                     <DenseSelect metaKey="language" label="لغة البرنامج الافتراضية" value={settings.language ?? getDefault("language")} onChange={(e) => handleChange("language", e.target.value)} options={[
                        {value: "ar", label: "عربي (RTL)"}, {value: "en", label: "إنجليزي (LTR)"}
                     ]} />
                     <div className="space-y-1.5">
                       <label className="block text-[11px] font-black uppercase tracking-widest text-text-secondary">
                         الدولة الافتراضية للواتساب
                       </label>
                       <select
                         value={settings.whatsapp_default_country || "EG"}
                         onChange={(e) => handleChange("whatsapp_default_country", e.target.value)}
                         className="w-full rounded-md border border-border-normal bg-bg-input py-2.5 px-3 text-sm font-bold outline-none shadow-sm transition-all hover:border-border-strong focus:border-primary focus:bg-bg-surface focus:ring-2 focus:ring-primary/20"
                       >
                         {COUNTRIES.map((c) => (
                           <option key={c.code} value={c.code}>
                             {c.flag} {c.name} (+{c.dial})
                           </option>
                         ))}
                       </select>
                       <span className="block text-[10px] font-bold text-text-muted mt-0.5">
                         الكود اللي بيتحط لوحده لما تفتح شاشة الواتساب عشان تبعت رسالة
                       </span>
                     </div>
                  </div>

                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-600">
                    <Globe className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-2sm font-black uppercase tracking-widest text-orange-800">خلي بالك</div>
                      <div className="text-[11px] leading-relaxed font-bold opacity-90 mt-1 text-orange-700">
                        أي تغيير هنا بيسمّع مع كل الموظفين وبيحتاج ريفريش. لو عايز تغير لغتك إنت بس، استخدم الأيقونة اللي فوق في الشريط.
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-text-secondary mb-3">شكل شاشة الكاشير (POS) الافتراضي</h4>
                    <div className="flex rounded-lg border border-border-normal bg-bg-surface overflow-hidden w-fit">
                      <button
                        type="button"
                        onClick={() => handleChange("default_pos_view", "detailed")}
                        className={`px-4 py-2 text-2sm font-black transition-all ${v(settings, "default_pos_view") === "detailed" ? "bg-primary text-white" : "bg-bg-surface text-text-secondary hover:bg-bg-overlay"}`}
                      >
                        مربعات (شبكة)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange("default_pos_view", "list")}
                        className={`px-4 py-2 text-2sm font-black transition-all ${settings.default_pos_view === "list" ? "bg-primary text-white" : "bg-bg-surface text-text-secondary hover:bg-bg-overlay"}`}
                      >
                        سطور (قائمة)
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] font-bold text-text-muted">الشكل اللي بيشوفه الكاشير أول ما يفتح الشاشة</p>
                  </div>

                  <div className="mt-6 divide-y divide-border-normal/70 rounded-lg border border-border-normal bg-bg-surface px-4">
                    <ToggleRow
                      label="ضم القائمة الجانبية في الكاشير"
                      hint="لو شغلتها، القائمة الجانبية هتتقفل وتبقى أيقونات بس عشان تفضّي مساحة لشاشة الكاشير (دي بتشتغل على الجهاز ده بس)."
                      checked={posAutoRail}
                      onChange={() => setPosAutoRail(!posAutoRail)}
                    />
                    <ToggleRow
                      label="أصوات شاشة الكاشير"
                      hint="شغّل دي لو عايز تسمع صوت (تيت) لما تضرب صنف بالباركود أو تضيف حاجة للفاتورة."
                      checked={Boolean(v(settings, "pos_voice_enabled"))}
                      onChange={() => handleChange("pos_voice_enabled", v(settings, "pos_voice_enabled") ? 0 : 1)}
                    />
                  </div>
                </section>

                {/* Smart Lock */}
                <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
                  <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">القفل الذكي (حماية الجهاز)</h3>
                      <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                        لو محدش لمس الجهاز، الشاشة تتقفل لوحدها عشان تحمي شغلك.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border-normal bg-bg-surface px-4">
                    <ToggleRow
                      label="شغّل القفل الذكي"
                      hint="لو فعلتها، البرنامج هيقفل لوحده بعد وقت معين لو محدش شغال عليه."
                      checked={Boolean(v(settings, "smart_lock_enabled"))}
                      onChange={() => handleChange("smart_lock_enabled", v(settings, "smart_lock_enabled") ? 0 : 1)}
                    />
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
                  <p className="mt-2 text-[11px] font-bold text-text-muted leading-relaxed max-w-lg">
                    الجهاز يقفل بعد كام دقيقة لو محدش بيعمل حاجة عليه؟ (الافتراضي 15 دقيقة)
                  </p>
                </section>

                {/* Alerts */}
                <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
                  <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">تنبيهات الفواتير المعلقة</h3>
                      <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                        لو كاشير علق فاتورة ونسيها، البرنامج هيغير لونها بعد وقت معين عشان يفكرك بيها.
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

                  {/* Visual timeline — turns the two raw numbers into a scaled zone map */}
                  {(() => {
                    const yellowAt = Math.max(1, Number(v(settings, "held_yellow_hours")) || 1);
                    const redAt = Math.max(yellowAt + 1, Number(v(settings, "held_red_hours")) || yellowAt + 1);
                    const scale = redAt * 1.2;
                    const yellowPct = (yellowAt / scale) * 100;
                    const redPct = (redAt / scale) * 100;
                    return (
                      <div className="mt-5 max-w-lg">
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border-normal">
                          <div className="h-full bg-emerald-400" style={{ width: `${yellowPct}%` }} />
                          <div className="h-full bg-amber-400" style={{ width: `${redPct - yellowPct}%` }} />
                          <div className="h-full bg-rose-400" style={{ width: `${100 - redPct}%` }} />
                        </div>
                        <div className="relative mt-1.5 h-4 text-[10px] font-black text-text-muted">
                          <span className="absolute right-0">0 س</span>
                          <span className="absolute -translate-x-1/2" style={{ [isRTL ? "right" : "left"]: `${yellowPct}%` }}>{yellowAt} س</span>
                          <span className="absolute -translate-x-1/2" style={{ [isRTL ? "right" : "left"]: `${redPct}%` }}>{redAt} س</span>
                        </div>
                      </div>
                    );
                  })()}

                  <p className="mt-4 text-[11px] font-bold text-text-muted leading-relaxed max-w-lg">
                    اللون هيقلب أصفر بعد كام ساعة؟ وبعدين أحمر لو طولت أكتر.. عشان المشرف ياخد باله.
                  </p>
                </section>

                {/* Audit Log */}
                <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
                  <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                      <History className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">سجل حركات الموظفين</h3>
                      <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                        هنحتفظ بسجل الموظفين (مين عمل إيه وإمتى) لمدة كام يوم قبل ما نمسحه؟
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
              <div className="space-y-6">
                {/* Currency & Tax */}
                <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
                  <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                      <Coins className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">إعدادات الضريبة والعملة</h3>
                      <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                        رمز العملة بتاعتك، وهل بتطبق ضريبة ولا لأ؟
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <DenseInput label="رمز العملة" metaKey="currency_symbol" value={v(settings, "currency_symbol")} onChange={(e) => handleChange("currency_symbol", e.target.value)} />
                    <DenseSelect label="كسور العملة" metaKey="decimal_places" value={v(settings, "decimal_places")} onChange={(e) => handleChange("decimal_places", Number(e.target.value))} options={[
                      {value: 0, label: "0"}, {value: 2, label: "2"}, {value: 3, label: "3"}
                    ]} />
                    <DenseSelect
                      label="حساب الضريبة"
                      metaKey="tax_enabled"
                      value={Number(v(settings, "tax_enabled"))}
                      onChange={(e) => handleChange("tax_enabled", Number(e.target.value))}
                      options={[{ value: 1, label: "شغّالة" }, { value: 0, label: "مقفولة" }]}
                    />
                    {Number(v(settings, "tax_enabled")) === 1 && (
                      <>
                        <DenseSelect label="نظام الضريبة الافتراضي" metaKey="tax_type" value={v(settings, "tax_type")} onChange={(e) => handleChange("tax_type", e.target.value)} options={[
                          {value: "none", label: "بدون ضريبة"}, {value: "inclusive", label: "السعر شامل الضريبة"}, {value: "exclusive", label: "الضريبة بتنضاف ع السعر"}
                        ]} />
                        <DenseInput label="نسبة الضريبة (%)" metaKey="tax_rate" type="number" step="0.01" value={v(settings, "tax_rate")} onChange={(e) => handleChange("tax_rate", e.target.value)} />
                      </>
                    )}
                  </div>

                  {/* Live preview — turns the abstract symbol/decimals/tax fields into a real formatted line */}
                  {(() => {
                    const decimals = Number(v(settings, "decimal_places")) || 0;
                    const symbol = v(settings, "currency_symbol") || "ر.س";
                    const taxOn = Number(v(settings, "tax_enabled")) === 1;
                    const taxType = v(settings, "tax_type");
                    const rate = Number(v(settings, "tax_rate")) || 0;
                    const fmt = (n) => n.toFixed(decimals);
                    const base = 1000;
                    let taxAmount = 0, total = base;
                    if (taxOn && taxType === "exclusive") { taxAmount = (base * rate) / 100; total = base + taxAmount; }
                    else if (taxOn && taxType === "inclusive") { taxAmount = base - base / (1 + rate / 100); total = base; }
                    return (
                      <div className="mt-5 max-w-sm rounded-lg border border-dashed border-border-strong bg-bg-surface p-4">
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-muted">معاينة حية — صنف بسعر {fmt(base)} {symbol}</div>
                        <div className="space-y-1.5 text-[13px] font-bold text-text-secondary">
                          <div className="flex justify-between"><span>سعر الصنف</span><span>{fmt(taxOn && taxType === "inclusive" ? base - taxAmount : base)} {symbol}</span></div>
                          {taxOn && taxType !== "none" && (
                            <div className="flex justify-between text-amber-600"><span>ضريبة ({fmt(rate)}%{taxType === "inclusive" ? " شاملة" : ""})</span><span>{fmt(taxAmount)} {symbol}</span></div>
                          )}
                          <div className="flex justify-between border-t border-border-subtle pt-1.5 text-text-primary">
                            <span>الإجمالي</span><span>{fmt(total)} {symbol}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </section>

                {/* Discount Limits */}
                <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
                  <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm">
                      <Percent className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">الخصومات المسموحة</h3>
                      <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                        عشان تحمي أرباحك، تقدر تحدد أقصى نسبة خصم الكاشير يقدر يعملها للزبون.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <DenseSelect
                      label="وضع ليميت للخصم؟"
                      metaKey="discount_cap_enabled"
                      value={Number(v(settings, "discount_cap_enabled"))}
                      onChange={(e) => handleChange("discount_cap_enabled", Number(e.target.value))}
                      options={[{ value: 1, label: "أيوة حط حد أقصى" }, { value: 0, label: "لأ سيبها مفتوحة" }]}
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

                  {Number(v(settings, "discount_cap_enabled")) === 1 && (() => {
                    const cap = Math.min(100, Math.max(0, Number(v(settings, "max_discount_percent")) || 0));
                    return (
                      <div className="mt-5 max-w-lg">
                        <div className="relative h-2.5 w-full rounded-full bg-border-normal">
                          <div className="h-full rounded-full bg-rose-400" style={{ width: `${cap}%` }} />
                          <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-black text-rose-600" style={{ [isRTL ? "right" : "left"]: `${cap}%` }}>{cap}%</span>
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] font-black text-text-muted">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    );
                  })()}
                </section>

                {/* Profit Margins */}
                <section className="rounded-lg border border-border-normal bg-bg-overlay/30 p-5 md:p-6">
                  <div className="flex items-center gap-2.5 border-b border-border-normal/70 pb-3 mb-5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">التسعير ونسب المكسب</h3>
                      <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                        النظام بيحسب تكلفة الأصناف إزاي؟ وإيه هو هامش الربح اللي بتستهدفه؟
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
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-blue-700 text-[11px] font-bold leading-relaxed">
                    <span className="shrink-0 mt-0.5">ℹ</span>
                    <span>
                      النظام بيستخدم طريقة التكلفة دي عشان يعرف مكسبك الفعلي في تقارير الأرباح. 
                      للعلم: طريقة (FIFO) و (LIFO) بتتحسب وقت ما تطلع التقرير بس.
                    </span>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "printing" && (
              <div data-help="print-section">
                <PrintingSettingsPanel settings={settings} onChange={handleChange} onDirty={() => handleChange("_print_ui_dirty", Date.now())} />
              </div>
            )}

            {activeTab === "appearance" && (
              <AppearancePanel settings={settings} onChange={handleChange} />
            )}

            {activeTab === "performance" && (
              <PerformanceSettings />
            )}

            {activeTab === "features" && isDev && (
              <FeaturesTab settings={settings} onChange={handleChange} />
            )}

            {activeTab === "shortcuts" && (
              <ShortcutsTab onChange={handleChange} />
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
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
      <SettingsUnsavedModal
        open={blocker.state === "blocked"}
        onSave={handleBlockerSave}
        onDiscard={handleBlockerDiscard}
        onCancel={() => blocker.reset?.()}
        saving={blockerSaving}
        lang={isRTL ? "ar" : "en"}
      />

      {/* Sticky bottom save bar — only visible when there are unsaved changes */}
      {dirty && (
        <div
          className="fixed left-0 right-0 z-50 border-t border-border-normal bg-bg-surface shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-all duration-300"
          style={{ bottom: activeTab === "appearance" ? "64px" : "0px" }}
        >
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              <span className="text-[12px] font-black text-amber-700">
                {isRTL ? `تغييرات غير محفوظة (${changeCount})` : `Unsaved changes (${changeCount})`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDiscard}
                className="flex items-center gap-2 rounded-sm border border-border-normal bg-bg-surface px-4 py-2 text-sm font-black text-text-secondary shadow-sm transition-all hover:bg-bg-overlay hover:text-rose-600 active:scale-95"
              >
                <XCircle className="h-4 w-4" />
                {isRTL ? "تجاهل" : "Discard"}
              </button>
              <PermissionGate page="settings" action="edit_general">
                <button
                  data-help="save-button"
                  onClick={handleSubmit}
                  disabled={saving}
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
        </div>
      )}
    </div>
  );
}
