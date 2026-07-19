import React, { useState, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, FileText, Upload, Loader2, CheckCircle2, Check, Lock,
  Palette, HardDrive, X, ImageDown, Sun, Moon, Printer, LayoutList,
  ArrowLeft, ArrowRight, Sparkles,
} from "lucide-react";
import api from "../../services/api";
import { COLOR_THEMES, THEME_ORDER, DEFAULT_THEME } from "../../constants/colorThemes";
import { applyColorTheme } from "../../utils/applyColorTheme";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import toast from "react-hot-toast";
import LayoutRenderer from "../../components/print/LayoutRenderer";
import { presetsForSize } from "../../components/print/presets/builtinPresets";
import { applyPreset } from "../../components/print/presets/presetEngine";
import { seedFamilyLayout, familyForSize, SHOW_KEY } from "../../components/print/layout/layoutModel";
import { SHEET_W, sampleById } from "../../components/print/studio/studioData";
import { BLOCK_REGISTRY } from "../../components/print/blocks/registry";

const THEMES = THEME_ORDER.filter((k) => k !== "custom");

/* Blocks the owner may toggle on the printed receipt, in display order. */
const TOGGLABLE_BLOCKS = [
  "logo", "company_name", "branch", "address", "tax_id",
  "doc_number", "doc_date", "customer", "cashier",
  "subtotal", "discount", "tax", "payments",
  "notes", "footer_text", "qr", "barcode",
];
/* Always printed — shown locked in the UI. vendor_branding (توقيع الحجازي) is
   the mandatory system footprint; items_table/grand_total are the receipt core. */
const LOCKED_BLOCKS = ["items_table", "grand_total", "vendor_branding"];

const PAPER_SIZES = [
  { id: "80mm", label: "حراري 80mm", hint: "الأكثر شيوعاً لطابعات الكاشير" },
  { id: "58mm", label: "حراري 58mm", hint: "بكرة ضيقة موفرة" },
  { id: "A4", label: "A4 ورقة كاملة", hint: "فواتير رسمية بطابعة عادية" },
];

async function compressImage(file) {
  const size = file.size;
  if (size <= 500 * 1024) return file;
  let quality, maxDim;
  if (size > 5 * 1024 * 1024) { quality = 0.4; maxDim = 400; }
  else if (size > 2 * 1024 * 1024) { quality = 0.6; maxDim = 600; }
  else { quality = 0.8; maxDim = 800; }
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Image load failed"));
      i.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
      else { width = Math.round((width * maxDim) / height); height = maxDim; }
    }
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, quality));
    if (!blob || blob.size === 0) throw new Error("Compressed image is empty");
    return new File([blob], file.name, { type: file.type });
  } catch (err) {
    console.warn("Image compression failed, using original:", err);
    return file;
  }
}

function MiniSwatchRow({ themeKey }) {
  const vars = COLOR_THEMES[themeKey]?.vars;
  if (!vars) return null;
  const colors = [vars["--primary"], vars["--bg-surface"], vars["--bg-base"], vars["--text-primary"]];
  return (
    <div className="flex gap-0.5 overflow-hidden rounded-sm" dir="ltr">
      {colors.map((c, i) => (
        <span key={i} className="h-3.5 flex-1" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

/* Scaled-to-fit live print thumbnail (same approach as the Studio gallery). */
function PrintThumb({ family, size, invoice, settings, layout, height = 280 }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const box = boxRef.current;
    if (!inner || !box) return;
    const measure = () => {
      const w = inner.offsetWidth;
      const h = inner.scrollHeight || inner.offsetHeight;
      if (!w || !h) return;
      setScale(Math.min((box.clientWidth - 8) / w, (box.clientHeight - 8) / h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [settings, layout, size]);
  return (
    <div ref={boxRef} style={{ position: "relative", height, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div ref={innerRef} style={{
        flexShrink: 0, width: SHEET_W[size], background: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
        transform: `scale(${scale || 0.12})`, transformOrigin: "top center",
        visibility: scale ? "visible" : "hidden",
      }}>
        <LayoutRenderer family={family} size={size} invoice={invoice} settings={settings} layout={layout} scope="_global" />
      </div>
    </div>
  );
}

/* Build the effective per-doc print settings from wizard choices (pure). */
function buildPrintSettings({ preset, paperSize, blockOn, businessPreviewFields }) {
  const family = familyForSize(paperSize);
  let s = { ...(businessPreviewFields || {}) };
  if (preset) {
    s = applyPreset(s, preset, "_global");
  } else {
    s.layout = { [family]: seedFamilyLayout(family, "_global", paperSize) };
  }
  const fam = { ...(s.layout?.[family] || seedFamilyLayout(family, "_global", paperSize)) };
  let order = [...(fam.order || [])];

  // Drop blocks the owner switched off (locked blocks are immune).
  order = order.filter((t) => LOCKED_BLOCKS.includes(t) || blockOn[t] !== false);
  // Add blocks the owner switched ON that the preset didn't include.
  TOGGLABLE_BLOCKS.forEach((t) => {
    if (blockOn[t] === true && !order.includes(t)) order.push(t);
  });
  // توقيع الحجازي is mandatory — always last.
  order = order.filter((t) => t !== "vendor_branding");
  order.push("vendor_branding");

  fam.order = order;
  s.layout = { ...(s.layout || {}), [family]: fam };

  // Keep the simple-panel show_* flags in sync with the choices.
  Object.entries(SHOW_KEY).forEach(([type, key]) => {
    if (blockOn[type] !== undefined) s[key] = Boolean(blockOn[type]);
  });
  if (family === "roll") s.receipt_width = paperSize;
  else s.paper_size = paperSize;
  return { settings: s, family };
}

const STEPS = [
  { id: "business", title: "بيانات المتجر", icon: Building2, desc: "الاسم والتواصل والشعار" },
  { id: "money", title: "العملة والضريبة", icon: FileText, desc: "رمز العملة وإعداد الضريبة" },
  { id: "print-style", title: "شكل الفاتورة", icon: Printer, desc: "اختر قالب الطباعة من معاينات حقيقية" },
  { id: "print-blocks", title: "محتويات الفاتورة", icon: LayoutList, desc: "ما الذي يظهر على الورقة المطبوعة؟" },
  { id: "theme", title: "مظهر النظام", icon: Palette, desc: "ألوان الواجهة" },
  { id: "backup", title: "النسخ الاحتياطي", icon: HardDrive, desc: "حماية بياناتك تلقائياً" },
];

export default function BusinessSetupWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const [form, setForm] = useState({
    company_name: "", branch_name: "", phone: "", address: "",
    commercial_register: "", vat_number: "",
    currency_symbol: "",
    tax_enabled: false, tax_rate: 0,
    color_theme: DEFAULT_THEME,
    auto_backup_enabled: false, auto_backup_interval_hours: 24, auto_backup_path: "",
  });
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  // Print choices
  const [paperSize, setPaperSize] = useState("80mm");
  const [presetId, setPresetId] = useState(null); // null = default design
  const [blockOn, setBlockOn] = useState({});     // type -> bool (undefined = follow preset)
  const [printTouched, setPrintTouched] = useState(false);
  const [showAllPresets, setShowAllPresets] = useState(false);

  const family = familyForSize(paperSize);
  const presets = useMemo(() => presetsForSize(paperSize), [paperSize]);
  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === presetId) || null,
    [presets, presetId],
  );
  const sampleInvoice = useMemo(() => sampleById("normal"), []);

  // Business fields injected into the live preview so the owner sees THEIR shop
  // on the receipt while still setting it up.
  const businessPreviewFields = useMemo(() => ({
    company_name: form.company_name || "اسم متجرك",
    branch_name: form.branch_name,
    phone: form.phone,
    address: form.address,
    tax_number: form.vat_number,
    logo_url: logoUrl || undefined,
    currency_symbol: form.currency_symbol || "ج",
  }), [form.company_name, form.branch_name, form.phone, form.address, form.vat_number, logoUrl, form.currency_symbol]);

  // Effective settings for the live preview of steps 3+4.
  const preview = useMemo(
    () => buildPrintSettings({ preset: selectedPreset, paperSize, blockOn, businessPreviewFields }),
    [selectedPreset, paperSize, blockOn, businessPreviewFields],
  );

  // Which blocks are currently ON (for the toggles step): explicit choice wins,
  // otherwise "is it in the preset/default order?".
  const baseOrder = useMemo(() => {
    if (selectedPreset?.layout?.order) return selectedPreset.layout.order;
    return seedFamilyLayout(family, "_global", paperSize).order;
  }, [selectedPreset, family, paperSize]);
  const isBlockOn = useCallback(
    (t) => (blockOn[t] !== undefined ? blockOn[t] : baseOrder.includes(t)),
    [blockOn, baseOrder],
  );

  const handleChange = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleLogo = useCallback(async (rawFile) => {
    if (!rawFile) return;
    if (!rawFile.type.startsWith("image/")) { toast.error("الرجاء اختيار صورة فقط"); return; }
    if (rawFile.size > 10 * 1024 * 1024) { toast.error("حجم الصورة كبير جدًا (الحد الأقصى 10 ميغابايت)"); return; }
    setUploading(true);
    try {
      const file = rawFile.size > 500 * 1024 ? await compressImage(rawFile) : rawFile;
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }, timeout: 30000,
      });
      const url = res.data?.url;
      if (url) {
        setPreviewError(false);
        setLogoUrl(url);
        setLogoPreview(resolveImageUrl(url));
        toast.success("تم رفع الشعار بنجاح");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "فشل رفع الشعار");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  const handleTheme = (key) => {
    handleChange("color_theme", key);
    applyColorTheme({ color_theme: key });
  };

  const handleFolderPick = async () => {
    try {
      const path = await window.electronAPI?.invoke("dialog:openFolder");
      if (path) handleChange("auto_backup_path", path);
    } catch { /* ignore */ }
  };

  const goTo = (i) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, i));
    setStep(clamped);
    setVisited((v) => new Set([...v, clamped]));
  };

  async function savePrintDesign() {
    const { settings, family: fam } = buildPrintSettings({
      preset: selectedPreset, paperSize, blockOn, businessPreviewFields: {},
    });
    try {
      // Merge under the existing _global layout so the other family survives.
      let existingLayout = {};
      try {
        const res = await api.get("/api/print-settings-per-doc/_global");
        existingLayout = res.data?.data?.layout || {};
      } catch { /* first run — nothing saved yet */ }
      await api.put("/api/print-settings-per-doc/_global", {
        ...settings,
        layout: { ...existingLayout, [fam]: settings.layout[fam] },
      });
    } catch (err) {
      // Print design failing must not block finishing setup.
      console.warn("save print design failed", err);
      toast.error("تعذر حفظ تصميم الطباعة — يمكنك ضبطه لاحقاً من الإعدادات");
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const settings = [
        { setting_key: "company_name", setting_value: form.company_name },
        { setting_key: "branch_name", setting_value: form.branch_name },
        { setting_key: "phone", setting_value: form.phone },
        { setting_key: "address", setting_value: form.address },
        { setting_key: "commercial_register", setting_value: form.commercial_register },
        { setting_key: "vat_number", setting_value: form.vat_number },
        { setting_key: "currency_symbol", setting_value: form.currency_symbol },
        { setting_key: "tax_enabled", setting_value: form.tax_enabled ? "1" : "0" },
        { setting_key: "tax_rate", setting_value: String(form.tax_rate) },
        { setting_key: "color_theme", setting_value: form.color_theme },
        { setting_key: "wizard_completed", setting_value: "1" },
      ];
      if (logoUrl) settings.push({ setting_key: "logo_url", setting_value: logoUrl });
      if (form.auto_backup_enabled) {
        settings.push({ setting_key: "auto_backup_enabled", setting_value: "1" });
        settings.push({ setting_key: "auto_backup_interval_hours", setting_value: String(form.auto_backup_interval_hours) });
        if (form.auto_backup_path) settings.push({ setting_key: "auto_backup_path", setting_value: form.auto_backup_path });
      } else {
        settings.push({ setting_key: "auto_backup_enabled", setting_value: "0" });
      }
      await api.post("/api/settings/bulk", { settings });
      if (printTouched) await savePrintDesign();
      setDone(true);
      window.setTimeout(() => onDone?.(), 1000);
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkipAll() {
    try {
      await api.post("/api/settings/bulk", {
        settings: [{ setting_key: "wizard_completed", setting_value: "1" }],
      });
      onDone?.();
    } catch {
      onDone?.();
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-base)]" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-11 w-11 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary,#0f172a)]">تم حفظ الإعدادات</h2>
          <p className="text-sm text-[var(--text-muted,#94a3b8)]">جاري فتح النظام...</p>
        </div>
      </div>
    );
  }

  const isLast = step === STEPS.length - 1;
  const visiblePresets = showAllPresets ? presets : presets.slice(0, 9);
  const showPrintPreviewPane = STEPS[step].id === "print-style" || STEPS[step].id === "print-blocks";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg-base)] text-text-primary font-sans" dir="rtl">
      <div className="flex h-full">

        {/* ═══ Steps sidebar ═══ */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-border-normal/70 bg-bg-surface/70 p-6 backdrop-blur md:flex">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-text-primary">إعداد النظام</h1>
              <p className="text-[11px] font-bold text-text-muted">خطوات سريعة — كلها اختيارية</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const seen = visited.has(i) && !active;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 text-right transition-colors ${
                    active ? "bg-emerald-50 border border-emerald-200" : "border border-transparent hover:bg-bg-overlay"
                  }`}
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${
                    active ? "bg-emerald-500 text-white" : seen ? "bg-emerald-100 text-emerald-600" : "bg-bg-overlay text-text-muted"
                  }`}>
                    {seen ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-black leading-tight ${active ? "text-emerald-700" : "text-text-secondary"}`}>{s.title}</span>
                    <span className="block truncate text-[10px] font-bold text-text-muted">{s.desc}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={handleSkipAll}
              className="w-full rounded-xl border border-border-normal px-4 py-2.5 text-xs font-black text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
            >
              تخطي الإعداد كاملاً ←
            </button>
          </div>
        </aside>

        {/* ═══ Content ═══ */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Mobile progress header */}
          <div className="flex items-center justify-between gap-3 border-b border-border-normal/70 bg-bg-surface/70 px-4 py-3 md:hidden">
            <span className="text-sm font-black text-text-primary">{STEPS[step].title}</span>
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-emerald-500" : "w-2 bg-border-normal"}`} />
              ))}
            </div>
            <button type="button" onClick={handleSkipAll} className="text-[11px] font-black text-text-muted">تخطي الكل</button>
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-y-auto p-5 md:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="mx-auto w-full max-w-2xl"
                >
                  <div className="mb-6 hidden md:block">
                    <h2 className="text-2xl font-black text-text-primary">{STEPS[step].title}</h2>
                    <p className="mt-1 text-sm font-medium text-text-secondary">{STEPS[step].desc}</p>
                  </div>

                  {/* ─── Step: business info ─── */}
                  {STEPS[step].id === "business" && (
                    <div className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="اسم الشركة" value={form.company_name} onChange={(v) => handleChange("company_name", v)} placeholder="شركة الحجازي للتجزئة" />
                        <Field label="اسم الفرع" value={form.branch_name} onChange={(v) => handleChange("branch_name", v)} placeholder="الفرع الرئيسي" />
                        <Field label="الهاتف" value={form.phone} onChange={(v) => handleChange("phone", v)} placeholder="+201234567890" dir="ltr" />
                        <Field label="العنوان" value={form.address} onChange={(v) => handleChange("address", v)} placeholder="١٢ شارع الثورة — القاهرة" />
                        <Field label="السجل التجاري" value={form.commercial_register} onChange={(v) => handleChange("commercial_register", v)} placeholder="رقم السجل التجاري" />
                        <Field label="الرقم الضريبي" value={form.vat_number} onChange={(v) => handleChange("vat_number", v)} placeholder="رقم التسجيل الضريبي" />
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-text-secondary">الشعار (اختياري) — يظهر على الفواتير المطبوعة</p>
                        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                          <div
                            onClick={() => !uploading && fileRef.current?.click()}
                            className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-all ${
                              uploading ? "border-emerald-300 bg-emerald-50" : "border-border-normal bg-bg-overlay hover:border-slate-400"
                            }`}
                          >
                            {uploading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                            ) : (
                              <>
                                <Upload className="h-5 w-5 text-text-muted" />
                                <span className="text-xs font-bold text-text-secondary">اضغط لرفع الشعار</span>
                                <span className="text-[10px] font-bold text-text-muted">PNG, JPG &bull; ضغط تلقائي</span>
                              </>
                            )}
                          </div>
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files[0])} />
                          <div className="relative flex h-24 items-center justify-center rounded-xl border border-border-normal bg-bg-surface p-2">
                            {logoPreview && !previewError ? (
                              <>
                                <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" onError={() => setPreviewError(true)} />
                                <button
                                  type="button"
                                  onClick={() => { setLogoUrl(null); setLogoPreview(null); }}
                                  className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </>
                            ) : logoPreview && previewError ? (
                              <div className="text-center">
                                <ImageDown className="mx-auto mb-1 h-5 w-5 text-rose-400" />
                                <span className="text-[10px] font-bold text-rose-500">تعذر تحميل الصورة</span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-text-muted">معاينة الشعار</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Step: currency & tax ─── */}
                  {STEPS[step].id === "money" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="رمز العملة" value={form.currency_symbol} onChange={(v) => handleChange("currency_symbol", v)} placeholder="ج.م أو ر.س" />
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">تفعيل الضريبة</label>
                        <div className="flex h-12 items-center gap-3 rounded-xl border-2 border-border-normal bg-bg-overlay/80 px-4">
                          <Toggle on={form.tax_enabled} onClick={() => handleChange("tax_enabled", !form.tax_enabled)} />
                          <span className="text-sm font-bold text-text-primary">{form.tax_enabled ? "مفعّلة" : "غير مفعّلة"}</span>
                        </div>
                      </div>
                      {form.tax_enabled && (
                        <Field label="نسبة الضريبة (%)" value={form.tax_rate} onChange={(v) => handleChange("tax_rate", v === "" ? 0 : Number(v))} placeholder="15" type="number" dir="ltr" />
                      )}
                    </div>
                  )}

                  {/* ─── Step: print preset ─── */}
                  {STEPS[step].id === "print-style" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-3 gap-2">
                        {PAPER_SIZES.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setPaperSize(p.id); setPresetId(null); setBlockOn({}); setPrintTouched(true); }}
                            className={`rounded-2xl border-2 p-3 text-right transition-all ${
                              paperSize === p.id ? "border-emerald-500 bg-emerald-50/60" : "border-border-normal bg-bg-surface hover:border-border-strong"
                            }`}
                          >
                            <span className="block text-[13px] font-black text-text-primary">{p.label}</span>
                            <span className="block text-[10px] font-bold text-text-muted">{p.hint}</span>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {visiblePresets.map((p) => {
                          const applied = applyPreset({}, p, "_global");
                          const { layout: presetLayout, ...presetFlat } = applied;
                          const psettings = {
                            ...businessPreviewFields, ...presetFlat,
                            receipt_width: family === "roll" ? paperSize : undefined,
                            paper_size: family === "page" ? paperSize : undefined,
                          };
                          const isSel = presetId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setPresetId(p.id); setBlockOn({}); setPrintTouched(true); }}
                              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-right transition-all ${
                                isSel ? "border-emerald-500 shadow-md" : "border-border-normal hover:border-border-strong"
                              }`}
                            >
                              <div className="relative bg-[#e4e4e7]" style={{ height: 190 }}>
                                <div className="pointer-events-none absolute inset-0">
                                  <PrintThumb family={family} size={paperSize} invoice={sampleInvoice} settings={psettings} layout={presetLayout} height={190} />
                                </div>
                                {isSel && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                                      <Check className="h-5 w-5" strokeWidth={3} />
                                    </span>
                                  </div>
                                )}
                              </div>
                              <span className="block truncate bg-bg-surface px-2.5 py-2 text-[11px] font-black text-text-primary">{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {presets.length > 9 && (
                        <button
                          type="button"
                          onClick={() => setShowAllPresets((v) => !v)}
                          className="w-full rounded-xl border border-border-normal py-2 text-xs font-black text-text-secondary hover:bg-bg-overlay"
                        >
                          {showAllPresets ? "عرض أقل" : `عرض كل القوالب (${presets.length})`}
                        </button>
                      )}
                      <p className="text-[11px] font-bold leading-relaxed text-text-muted">
                        💡 كل قالب قابل للتعديل الكامل لاحقاً من الإعدادات ← استوديو الطباعة.
                      </p>
                    </div>
                  )}

                  {/* ─── Step: print blocks ─── */}
                  {STEPS[step].id === "print-blocks" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border-normal bg-bg-surface p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-text-secondary">عناصر أساسية (تُطبع دائماً)</p>
                        <div className="flex flex-wrap gap-2">
                          {LOCKED_BLOCKS.map((t) => (
                            <span key={t} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                              <Lock className="h-3 w-3" />
                              {BLOCK_REGISTRY[t]?.label || t}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-[10px] font-bold text-text-muted">
                          «توقيع الحجازي» هو بصمة النظام في تذييل كل مستند ولا يمكن إيقافه.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border-normal bg-bg-surface p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-text-secondary">اختر ما يظهر على الفاتورة</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {TOGGLABLE_BLOCKS.map((t) => {
                            const on = isBlockOn(t);
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => { setBlockOn((prev) => ({ ...prev, [t]: !on })); setPrintTouched(true); }}
                                className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-right transition-all ${
                                  on ? "border-emerald-400 bg-emerald-50/70" : "border-border-normal bg-bg-overlay/60 hover:border-border-strong"
                                }`}
                              >
                                <span className={`truncate text-[11px] font-black ${on ? "text-emerald-800" : "text-text-muted"}`}>
                                  {BLOCK_REGISTRY[t]?.label || t}
                                </span>
                                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md ${on ? "bg-emerald-500 text-white" : "bg-border-normal text-transparent"}`}>
                                  <Check className="h-3 w-3" strokeWidth={3.5} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-[11px] font-bold leading-relaxed text-text-muted">
                        المعاينة الجانبية تتحدث فوراً مع كل تغيير — ما تراه هو ما سيُطبع.
                      </p>
                    </div>
                  )}

                  {/* ─── Step: theme ─── */}
                  {STEPS[step].id === "theme" && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {THEMES.map((key) => {
                        const t = COLOR_THEMES[key];
                        const isSelected = form.color_theme === key;
                        const isDark = t.mode === "dark";
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleTheme(key)}
                            className={`relative flex flex-col items-stretch gap-1.5 rounded-xl border-2 p-2 text-right transition-all ${
                              isSelected ? "border-emerald-500 shadow-sm" : "border-border-normal hover:border-border-strong"
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </span>
                            )}
                            <MiniSwatchRow themeKey={key} />
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate text-[10px] font-black leading-tight text-text-primary">{t.name}</span>
                              {isDark ? <Moon className="h-3 w-3 shrink-0 text-indigo-400" /> : <Sun className="h-3 w-3 shrink-0 text-amber-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ─── Step: backup ─── */}
                  {STEPS[step].id === "backup" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Toggle on={form.auto_backup_enabled} onClick={() => handleChange("auto_backup_enabled", !form.auto_backup_enabled)} />
                        <span className="text-sm font-bold text-text-primary">تفعيل النسخ الاحتياطي التلقائي</span>
                      </div>
                      {form.auto_backup_enabled && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">الفترة (ساعات)</label>
                            <select
                              value={form.auto_backup_interval_hours}
                              onChange={(e) => handleChange("auto_backup_interval_hours", Number(e.target.value))}
                              className="h-12 rounded-xl border-2 border-border-normal bg-bg-overlay/80 px-4 text-sm font-bold text-text-primary outline-none transition-colors focus:border-emerald-500 focus:bg-bg-surface"
                            >
                              <option value={1}>كل ساعة</option>
                              <option value={6}>كل ٦ ساعات</option>
                              <option value={12}>كل ١٢ ساعة</option>
                              <option value={24}>كل ٢٤ ساعة (يومياً)</option>
                              <option value={48}>كل ٤٨ ساعة</option>
                              <option value={72}>كل ٧٢ ساعة</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">مسار الحفظ</label>
                            <div className="flex gap-2">
                              <input
                                value={form.auto_backup_path}
                                onChange={(e) => handleChange("auto_backup_path", e.target.value)}
                                placeholder="الافتراضي: backups/"
                                className="h-12 flex-1 rounded-xl border-2 border-border-normal bg-bg-overlay/80 px-4 text-sm font-bold text-text-primary outline-none transition-colors focus:border-emerald-500 focus:bg-bg-surface"
                              />
                              {window.electronAPI && (
                                <button
                                  type="button"
                                  onClick={handleFolderPick}
                                  className="h-12 shrink-0 rounded-xl border-2 border-border-normal bg-bg-overlay px-3 text-xs font-bold text-text-secondary transition-colors hover:bg-bg-overlay"
                                >
                                  تصفّح
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Final summary */}
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <p className="mb-2 text-[12px] font-black text-emerald-800">🎯 جاهز للانطلاق</p>
                        <ul className="space-y-1 text-[11px] font-bold text-emerald-700/90">
                          <li>• المتجر: {form.company_name || "بدون اسم (يمكن إضافته لاحقاً)"}</li>
                          <li>• الورق: {PAPER_SIZES.find((p) => p.id === paperSize)?.label}{selectedPreset ? ` — قالب «${selectedPreset.name}»` : " — التصميم الافتراضي"}</li>
                          <li>• المظهر: {COLOR_THEMES[form.color_theme]?.name || form.color_theme}</li>
                          <li>• النسخ الاحتياطي: {form.auto_backup_enabled ? `كل ${form.auto_backup_interval_hours} ساعة` : "غير مفعّل"}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ═══ Live print preview pane (steps 3-4) ═══ */}
            {showPrintPreviewPane && (
              <div className="hidden w-[300px] shrink-0 flex-col border-r border-border-normal/70 bg-bg-overlay/70 p-4 lg:flex">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-text-secondary">
                  <Printer className="h-3.5 w-3.5" /> معاينة حية
                </p>
                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border-normal bg-[#e4e4e7]">
                  <PrintThumb
                    family={preview.family}
                    size={paperSize}
                    invoice={sampleInvoice}
                    settings={preview.settings}
                    layout={preview.settings.layout}
                    height={560}
                  />
                </div>
                <p className="mt-2 text-center text-[10px] font-bold text-text-muted">ما تراه هنا هو ما سيُطبع فعلياً</p>
              </div>
            )}
          </div>

          {/* ═══ Footer nav ═══ */}
          <div className="flex items-center justify-between gap-3 border-t border-border-normal/70 bg-bg-surface/80 px-5 py-4 backdrop-blur md:px-8">
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-black text-text-muted transition-colors hover:text-text-primary disabled:opacity-0"
            >
              <ArrowRight className="h-4 w-4" /> السابق
            </button>

            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  type="button"
                  onClick={() => goTo(step + 1)}
                  className="rounded-xl px-4 py-2.5 text-xs font-black text-text-muted transition-colors hover:text-text-secondary"
                >
                  تخطي هذه الخطوة
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-2xl bg-[var(--primary,#059669)] px-8 py-3 text-sm font-black text-white shadow-sm transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (<><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...</>) : (<>💾 حفظ وبدء الاستخدام</>)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goTo(step + 1)}
                  className="flex items-center gap-1.5 rounded-2xl bg-[var(--primary,#059669)] px-6 py-3 text-sm font-black text-white shadow-sm transition-colors hover:opacity-90"
                >
                  التالي <ArrowLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-border-strong"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-bg-surface shadow-sm transition-transform ${on ? "translate-x-5" : ""}`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", dir = "rtl" }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-black uppercase tracking-widest text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="h-12 w-full rounded-xl border-2 border-border-normal bg-bg-overlay/80 px-4 text-sm font-bold text-text-primary outline-none transition-colors placeholder:font-normal placeholder:text-text-muted focus:border-emerald-500 focus:bg-bg-surface"
      />
    </div>
  );
}
