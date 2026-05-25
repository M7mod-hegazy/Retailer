import React, { useEffect, useState, useRef, useCallback } from "react";
import { Save, Settings2, Globe, Loader2, RefreshCw, XCircle, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "../../services/api";
import { HelpSettingsTab } from "./HelpSettingsTab";
import { AppIdentityTab } from "./AppIdentityTab";
import BackupSettingsTab from "./BackupSettingsTab";
import { usePageTour } from "../../hooks/usePageTour";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import PrintingSettingsPanel from "./PrintingSettingsPanel";
import PermissionGate from "../../components/ui/PermissionGate";

const tabs = [
  { id: "identity", label: "هوية التطبيق", hint: "الاسم والشعار وبيانات الفرع" },
  { id: "general", label: "عام", hint: "البيانات الأساسية ووسائل التواصل" },
  { id: "financial", label: "المالية والضرائب", hint: "العملة والضريبة وأرقام الفواتير" },
  { id: "printing", label: "الطباعة", hint: "مقاسات الإيصال ومعاينة القوالب" },
  { id: "system", label: "النظام", hint: "اللغة والنسخ الاحتياطي" },
  { id: "help", label: "المساعدة", hint: "الدليل السريع ومراجع الدعم" },
];

function Tab({ active, hasDirty, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-6 py-4 text-[13px] font-black uppercase tracking-widest border-b-2 transition-all min-w-[120px] ${
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
        <h3 className="text-[14px] font-black uppercase tracking-widest text-slate-800">{title}</h3>
        {hint && <p className="mt-1 text-[11px] font-bold text-slate-400">{hint}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function DenseInput({ label, required, ...props }) {
  return (
    <label className="block space-y-1.5 focus-within:text-slate-900 text-slate-500 transition-colors">
      <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        {...props}
        className="w-full rounded-sm border border-slate-200 bg-white py-2.5 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all"
      />
    </label>
  );
}

function DenseSelect({ label, options, ...props }) {
  return (
    <label className="block space-y-1.5 focus-within:text-slate-900 text-slate-500 transition-colors">
      <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest">{label}</span>
      <select
        {...props}
        className="w-full rounded-sm border border-slate-200 bg-white py-2.5 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

const EXCLUDE_KEYS = new Set(["id", "created_at", "updated_at"]);

function normalizeSettings(data) {
  const mapped = {};
  Object.entries(data).forEach(([key, val]) => {
    if (EXCLUDE_KEYS.has(key)) return;
    let parsed = val;
    if (parsed === "true") parsed = true;
    else if (parsed === "false") parsed = false;
    else if (typeof parsed === "string" && !isNaN(Number(parsed)) && parsed !== "") parsed = Number(parsed);
    // Convert known boolean columns from DB (stored as INTEGER 0/1) to proper booleans
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

export default function SettingsPage() {
  usePageTour("settings");
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("identity");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRTL, setIsRTL] = useState(document.documentElement.dir === "rtl");
  const [printPreview, setPrintPreview] = useState(false);
  const originalRef = useRef({});
  const autoSaveTimer = useRef(null);
  const settingsRef   = useRef({});
  const pendingTabRef = useRef(null);

  const dir = i18n.dir();

  useEffect(() => {
    setIsRTL(document.documentElement.dir === "rtl");
  }, [i18n.language]);

  useEffect(() => {
    fetchSettings();
  }, []);

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
    } catch (err) {
      console.error("Failed to load settings:", err);
      setFetchError(true);
      toast.error(isRTL ? "تعذر تحميل الإعدادات" : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  const handleChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    settingsRef.current = updated;
    if (activeTab === "printing") {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => silentSave(settingsRef.current), 1200);
    }
  };

  const silentSave = async (snap) => {
    try {
      const payload = Object.entries(snap).map(([k, v]) => ({ setting_key: k, setting_value: String(v) }));
      await api.post("/api/settings/bulk", { settings: payload });
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
      if (window.electronAPI?.invoke) {
        window.electronAPI.invoke("app:set-icon", { logo_url: settings.logo_url || "" }).catch(() => {});
      }
    } catch {
      toast.error(isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSettings(JSON.parse(JSON.stringify(originalRef.current)));
    settingsRef.current = originalRef.current;
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
          <span className="text-[13px] font-bold">{isRTL ? "جاري تحميل الإعدادات..." : "Loading settings..."}</span>
        </div>
      </div>
    );

  if (fetchError)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <XCircle className="h-10 w-10 text-rose-400" />
          <span className="text-[14px] font-bold text-slate-500">
            {isRTL ? "فشل تحميل الإعدادات" : "Failed to load settings"}
          </span>
          <button
            onClick={fetchSettings}
            className="flex items-center gap-2 rounded-sm bg-slate-900 px-5 py-2.5 text-[13px] font-black text-white shadow-md transition-all hover:bg-slate-800 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            {isRTL ? "إعادة المحاولة" : "Retry"}
          </button>
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
          <p className="text-[13px] font-bold text-slate-400">التحكم المركزي في الهوية والطباعة واللغة والنسخ الاحتياطي</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              onClick={handleDiscard}
              className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-black text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-rose-600 active:scale-95"
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
              className="flex items-center gap-2 rounded-sm bg-slate-900 px-6 py-2.5 text-[14px] font-black text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
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
            {tabs.map((tab) => (
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
         <div className="p-6 md:p-8 overflow-y-auto w-full">
            {activeTab === "identity" && (
              <FieldGroup title="هوية التطبيق" hint="الاسم التجاري، الشعار، وبيانات الظهور داخل النظام والفواتير">
                <AppIdentityTab settings={settings} onChange={handleChange} onSave={handleSubmit} lang={isRTL ? "ar" : "en"} />
              </FieldGroup>
            )}

            {activeTab === "general" && (
              <div data-help="company-section">
              <FieldGroup title="البيانات العامة" hint="المعلومات الأساسية التي تظهر في الفواتير والتقارير">
                <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <DenseInput label="اسم الشركة (عربي)" value={settings.company_name || ""} onChange={(e) => handleChange("company_name", e.target.value)} required />
                  <DenseInput label="اسم الشركة (إنجليزي)" value={settings.company_name_en || ""} onChange={(e) => handleChange("company_name_en", e.target.value)} />
                  <DenseInput label="اسم الفرع" value={settings.branch_name || ""} onChange={(e) => handleChange("branch_name", e.target.value)} required />
                  <DenseInput label="كود الفرع" value={settings.branch_code || ""} onChange={(e) => handleChange("branch_code", e.target.value)} />
                  <DenseInput label="السجل التجاري" value={settings.commercial_register || ""} onChange={(e) => handleChange("commercial_register", e.target.value)} />
                  <DenseInput label="الرقم الضريبي" value={settings.vat_number || ""} onChange={(e) => handleChange("vat_number", e.target.value)} />
                </div>

                <div className="mt-6 space-y-4">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">فروع المتجر — عنوان وهاتف</label>
                  {(() => {
                    const primAddr = settings.address || "";
                    const primPhone = settings.phone || "";
                    const addrs = (() => { try { return JSON.parse(settings.additional_addresses || "[]"); } catch { return []; } })();
                    const phones = (() => { try { return JSON.parse(settings.additional_phones || "[]"); } catch { return []; } })();
                    const pairs = [{ address: primAddr, phone: primPhone }];
                    for (let i = 0; i < Math.max(addrs.length, phones.length); i++) {
                      pairs.push({ address: addrs[i] || "", phone: phones[i] || "" });
                    }
                    return pairs.map((pair, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <textarea
                            value={pair.address}
                            onChange={(e) => {
                              if (i === 0) {
                                handleChange("address", e.target.value);
                              } else {
                                const updated = [...addrs];
                                updated[i - 1] = e.target.value;
                                handleChange("additional_addresses", JSON.stringify(updated));
                              }
                            }}
                            placeholder={`عنوان الفرع ${i + 1}`}
                            rows={2}
                            className="w-full rounded-sm border border-slate-200 bg-white py-2.5 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all resize-none"
                          />
                        </div>
                        <div className="flex-1 flex gap-2 items-center">
                          <input
                            type="text"
                            value={pair.phone}
                            onChange={(e) => {
                              if (i === 0) {
                                handleChange("phone", e.target.value);
                              } else {
                                const updated = [...phones];
                                updated[i - 1] = e.target.value;
                                handleChange("additional_phones", JSON.stringify(updated));
                              }
                            }}
                            placeholder={`هاتف الفرع ${i + 1}`}
                            className="w-full rounded-sm border border-slate-200 bg-white py-2.5 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all"
                          />
                        </div>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const aUpdated = addrs.filter((_, idx) => idx !== i - 1);
                              const pUpdated = phones.filter((_, idx) => idx !== i - 1);
                              handleChange("additional_addresses", JSON.stringify(aUpdated));
                              handleChange("additional_phones", JSON.stringify(pUpdated));
                            }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors mt-0.5"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ));
                  })()}
                  <button
                    type="button"
                    onClick={() => {
                      const addrs = (() => { try { return JSON.parse(settings.additional_addresses || "[]"); } catch { return []; } })();
                      const phones = (() => { try { return JSON.parse(settings.additional_phones || "[]"); } catch { return []; } })();
                      handleChange("additional_addresses", JSON.stringify([...addrs, ""]));
                      handleChange("additional_phones", JSON.stringify([...phones, ""]));
                    }}
                    className="flex items-center gap-2 text-[12px] font-black text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> إضافة فرع
                  </button>
                </div>
              </FieldGroup>
            </div>
            )}

            {activeTab === "financial" && (
              <div className="space-y-10">
                <FieldGroup title="المالية والضرائب" hint="تحكم في العملة، الضريبة، وبادئات أرقام المستندات">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <DenseInput label="رمز العملة" value={settings.currency_symbol || ""} onChange={(e) => handleChange("currency_symbol", e.target.value)} />
                    <DenseSelect label="كسور العملة" value={settings.decimal_places ?? 2} onChange={(e) => handleChange("decimal_places", Number(e.target.value))} options={[
                      {value: 0, label: "0"}, {value: 2, label: "2"}, {value: 3, label: "3"}
                    ]} />
                    <DenseSelect label="نوع الضريبة الافتراضي" value={settings.tax_type || "none"} onChange={(e) => handleChange("tax_type", e.target.value)} options={[
                      {value: "none", label: "بدون ضريبة"}, {value: "inclusive", label: "شاملة الضريبة"}, {value: "exclusive", label: "غير شاملة الضريبة"}
                    ]} />
                    <DenseInput label="نسبة الضريبة (%)" type="number" step="0.01" value={settings.tax_rate || 0} onChange={(e) => handleChange("tax_rate", e.target.value)} />
                  </div>
                </FieldGroup>

                <FieldGroup title="هوامش الربح والتسعير" hint="إعدادات حساب التكلفة وحدود الهامش">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <DenseSelect
                      label="طريقة حساب التكلفة"
                      value={settings.margin_alert_cost_method || "wacc"}
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
                      type="number" step="0.1" min="0" max="100"
                      value={settings.min_margin_percent ?? 15}
                      onChange={(e) => handleChange("min_margin_percent", Number(e.target.value))}
                    />
                    <DenseInput
                      label="هامش الربح المستهدف (%)"
                      type="number" step="0.1" min="0" max="100"
                      value={settings.target_margin_percent ?? 25}
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
                </FieldGroup>
              </div>
            )}

            {activeTab === "printing" && (
              <div data-help="print-section">
                <PrintingSettingsPanel settings={settings} onChange={handleChange} />
              </div>
            )}

            {activeTab === "system" && (
              <div className="space-y-10">
                <FieldGroup title="الواجهة" hint="التحكم في اللغات والمظهر">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
                     <DenseSelect label="تغيير اللغة الافتراضية" value={settings.language || "ar"} onChange={(e) => handleChange("language", e.target.value)} options={[
                        {value: "ar", label: "العربية (RTL)"}, {value: "en", label: "English (LTR)"}
                     ]} />
                  </div>
                  <div className="mt-4 flex items-start gap-3 rounded-sm border border-orange-200 bg-orange-50 p-4 text-orange-600">
                    <Globe className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[12px] font-black uppercase tracking-widest text-orange-800">تلميح بخصوص الأنظمة</div>
                      <div className="text-[11px] leading-relaxed font-bold opacity-90 mt-1 text-orange-700">
                        التغيير هنا يتطلب إعادة تحميل وقد يتم فرضه على بقية الموظفين. استخدم الجلوبات في القائمة العلوية لتغيير واجهتك المحلية فقط.
                      </div>
                    </div>
                  </div>
                </FieldGroup>

                <FieldGroup title="نقطة البيع" hint="إعدادات واجهة نقطة البيع">
                  <div className="mb-4 flex items-center gap-4">
                    <label className="text-[13px] font-bold text-slate-700">عرض نقطة البيع الافتراضي:</label>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = { ...settings, default_pos_view: "detailed" };
                          setSettings(updated);
                          settingsRef.current = updated;
                          try {
                            await silentSave(updated);
                            originalRef.current = JSON.parse(JSON.stringify(updated));
                            toast.success("تم حفظ عرض الشبكة كافتراضي");
                          } catch {
                            toast.error("فشل الحفظ - تحقق من الاتصال");
                          }
                        }}
                        className={`px-4 py-2 text-[12px] font-black transition-all ${(settings.default_pos_view || "detailed") === "detailed" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        شبكة / تفصيلي
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = { ...settings, default_pos_view: "list" };
                          setSettings(updated);
                          settingsRef.current = updated;
                          try {
                            await silentSave(updated);
                            originalRef.current = JSON.parse(JSON.stringify(updated));
                            toast.success("تم حفظ عرض القائمة كافتراضي");
                          } catch {
                            toast.error("فشل الحفظ - تحقق من الاتصال");
                          }
                        }}
                        className={`px-4 py-2 text-[12px] font-black transition-all ${settings.default_pos_view === "list" ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        قائمة
                      </button>
                    </div>
                  </div>
                </FieldGroup>

                <FieldGroup title="تنبيهات الفواتير المعلقة" hint="تحديد المدة التي تتغير بعدها ألوان التنبيه للفواتير المعلقة">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                    <DenseInput
                      label="تنبيه أصفر بعد (ساعات)"
                      type="number"
                      min={1}
                      max={72}
                      value={settings.held_yellow_hours ?? 2}
                      onChange={(e) => handleChange("held_yellow_hours", Number(e.target.value))}
                    />
                    <DenseInput
                      label="تنبيه أحمر بعد (ساعات)"
                      type="number"
                      min={1}
                      max={168}
                      value={settings.held_red_hours ?? 8}
                      onChange={(e) => handleChange("held_red_hours", Number(e.target.value))}
                    />
                  </div>
                </FieldGroup>

                <FieldGroup title="سجل النشاط" hint="التحكم في مدة الاحتفاظ بسجلات النشاط">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-4">
                    <DenseSelect
                      label="مدة حفظ سجل النشاط"
                      value={settings.audit_log_retention_days ?? 30}
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
                </FieldGroup>

                <FieldGroup title="النسخ الاحتياطي" hint="استيراد وتصدير قاعدة البيانات">
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-sm px-4 py-3 mb-6 font-bold text-[13px] text-slate-700">
                     <input type="checkbox" checked={Boolean(settings.auto_backup_enabled)} onChange={(e) => handleChange("auto_backup_enabled", e.target.checked)} className="h-4 w-4 rounded-sm accent-slate-900 border-slate-300" />
                     <span>تفعيل نظام النسخ الاحتياطي التلقائي برمجياً</span>
                  </div>
                  {settings.auto_backup_enabled && (
                    <div className="mb-6 max-w-sm">
                      <DenseInput label="مسار الحفظ التلقائي" value={settings.auto_backup_path || ""} onChange={(e) => handleChange("auto_backup_path", e.target.value)} placeholder="C:\Backups" />
                    </div>
                  )}
                  <BackupSettingsTab />
                </FieldGroup>
              </div>
            )}

            {activeTab === "help" && (
              <FieldGroup title="أدوات المساعدة" hint="إدارة الإرشادات والتلميحات للموظفين">
                <HelpSettingsTab />
              </FieldGroup>
            )}
         </div>
      </div>

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        invoice={{ invoice_no: "PREVIEW-001", created_at: new Date().toISOString(), lines: [] }}
        settings={settings}
        operationLabel="معاينة إعدادات الطباعة"
      />
    </div>
  );
}
