import React, { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2, FileText, Upload, Loader2, CheckCircle2,
  Palette, HardDrive, X, ImageDown, Sun, Moon,
} from "lucide-react";
import api from "../../services/api";
import { COLOR_THEMES, THEME_ORDER, DEFAULT_THEME } from "../../constants/colorThemes";
import { applyColorTheme } from "../../utils/applyColorTheme";
import { resolveImageUrl } from "../../utils/resolveImageUrl";
import toast from "react-hot-toast";

const THEMES = THEME_ORDER.filter((k) => k !== "custom");

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
  const colors = [
    vars["--primary"],
    vars["--bg-surface"],
    vars["--bg-base"],
    vars["--text-primary"],
  ];
  return (
    <div className="flex gap-0.5 overflow-hidden rounded-sm" dir="ltr">
      {colors.map((c, i) => (
        <span key={i} className="h-3.5 flex-1" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

export default function BusinessSetupWizard({ onDone }) {
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

  const handleChange = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleLogo = useCallback(async (rawFile) => {
    if (!rawFile) return;
    if (!rawFile.type.startsWith("image/")) {
      toast.error("الرجاء اختيار صورة فقط"); return;
    }
    if (rawFile.size > 10 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جدًا (الحد الأقصى 10 ميغابايت)"); return;
    }
    setUploading(true);
    try {
      const file = rawFile.size > 500 * 1024 ? await compressImage(rawFile) : rawFile;
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });
      const url = res.data?.url;
      if (url) {
        setPreviewError(false);
        setLogoUrl(url);
        setLogoPreview(resolveImageUrl(url));
        toast.success("تم رفع الشعار بنجاح");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "فشل رفع الشعار";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  const removeLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
  };

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
      setDone(true);
      window.setTimeout(() => onDone?.(), 1000);
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
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
          <h2 className="text-2xl font-black text-slate-900">تم حفظ الإعدادات</h2>
          <p className="text-sm text-slate-400">جاري فتح النظام...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[var(--bg-base)] text-slate-800 font-sans" dir="rtl">
      <div className="flex min-h-full items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[720px] bg-white rounded-[2rem] border border-slate-200/70 shadow-[0_20px_60px_-10px_rgba(15,23,42,0.10)] p-6 md:p-10"
        >
          {/* ─── Header ─── */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl text-emerald-600">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">إعداد النظام</h1>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mt-0.5">
                  أكمل الإعدادات الأساسية لبدء استخدام النظام. يمكنك العودة لاحقاً من صفحة الإعدادات.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              تخطي →
            </button>
          </div>

          <div className="space-y-7">

            {/* ═══ Business Info ═══ */}
            <section>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-700">بيانات الشركة</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم الشركة" value={form.company_name} onChange={(v) => handleChange("company_name", v)} placeholder="شركة إلهيجازي للتجزئة" />
                <Field label="اسم الفرع" value={form.branch_name} onChange={(v) => handleChange("branch_name", v)} placeholder="الفرع الرئيسي" />
                <Field label="الهاتف" value={form.phone} onChange={(v) => handleChange("phone", v)} placeholder="+201234567890" dir="ltr" />
                <Field label="العنوان" value={form.address} onChange={(v) => handleChange("address", v)} placeholder="١٢ شارع الثورة — القاهرة" />
              </div>
            </section>

            {/* ═══ Official Documents ═══ */}
            <section>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <FileText className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-700">المستندات الرسمية</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="السجل التجاري" value={form.commercial_register} onChange={(v) => handleChange("commercial_register", v)} placeholder="رقم السجل التجاري" />
                <Field label="الرقم الضريبي" value={form.vat_number} onChange={(v) => handleChange("vat_number", v)} placeholder="رقم التسجيل الضريبي" />
              </div>
            </section>

            {/* ═══ Currency & Tax ═══ */}
            <section>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <span className="flex h-4 w-4 items-center justify-center text-emerald-600 text-sm font-black">$</span>
                <h3 className="text-sm font-black text-slate-700">العملة والضريبة</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="رمز العملة" value={form.currency_symbol} onChange={(v) => handleChange("currency_symbol", v)} placeholder="ر.س أو ج.م" />
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                    تفعيل الضريبة
                  </label>
                  <div className="flex h-12 items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50/80 px-4">
                    <button
                      type="button"
                      onClick={() => handleChange("tax_enabled", !form.tax_enabled)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${form.tax_enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.tax_enabled ? "translate-x-5" : ""}`} />
                    </button>
                    <span className="text-sm font-bold text-slate-700">
                      {form.tax_enabled ? "مفعّلة" : "غير مفعّلة"}
                    </span>
                  </div>
                </div>
                {form.tax_enabled && (
                  <Field
                    label="نسبة الضريبة (%)"
                    value={form.tax_rate}
                    onChange={(v) => handleChange("tax_rate", v === "" ? 0 : Number(v))}
                    placeholder="15"
                    type="number"
                    dir="ltr"
                  />
                )}
              </div>
            </section>

            {/* ═══ Logo ═══ */}
            <section>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <span className="flex h-4 w-4 items-center justify-center text-emerald-600">
                  <Upload className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-sm font-black text-slate-700">الشعار <span className="text-slate-400 font-normal text-xs">(اختياري)</span></h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-all ${
                    uploading
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-500">اضغط لرفع الشعار</span>
                      <span className="text-[10px] text-slate-400 font-bold">PNG, JPG &bull; ضغط تلقائي</span>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files[0])} />
                <div className="relative flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                  {logoPreview && !previewError ? (
                    <>
                      <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain" onError={() => setPreviewError(true)} />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : logoPreview && previewError ? (
                    <div className="text-center">
                      <ImageDown className="h-5 w-5 text-rose-400 mx-auto mb-1" />
                      <span className="text-[10px] font-bold text-rose-500">تعذر تحميل الصورة</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-300">معاينة الشعار</span>
                  )}
                </div>
              </div>
            </section>

            {/* ═══ Theme ═══ */}
            <section>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <Palette className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-700">المظهر <span className="text-slate-400 font-normal text-xs">(اختياري)</span></h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
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
                        isSelected
                          ? "border-emerald-500 shadow-sm"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                      style={{ backgroundColor: isSelected ? "var(--accent-soft)" : undefined }}
                    >
                      {isSelected && (
                        <span className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </span>
                      )}
                      <MiniSwatchRow themeKey={key} />
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black text-slate-700 leading-tight truncate">{t.name}</span>
                        {isDark ? (
                          <Moon className="h-3 w-3 shrink-0 text-indigo-400" />
                        ) : (
                          <Sun className="h-3 w-3 shrink-0 text-amber-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ═══ Backup ═══ */}
            <section>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                <HardDrive className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-700">النسخ الاحتياطي <span className="text-slate-400 font-normal text-xs">(اختياري)</span></h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleChange("auto_backup_enabled", !form.auto_backup_enabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${form.auto_backup_enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.auto_backup_enabled ? "translate-x-5" : ""}`} />
                  </button>
                  <span className="text-sm font-bold text-slate-700">تفعيل النسخ الاحتياطي التلقائي</span>
                </div>
                {form.auto_backup_enabled && (
                  <div className="grid gap-4 sm:grid-cols-2 pr-14">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">الفترة (ساعات)</label>
                      <select
                        value={form.auto_backup_interval_hours}
                        onChange={(e) => handleChange("auto_backup_interval_hours", Number(e.target.value))}
                        className="h-12 rounded-xl border-2 border-slate-200 bg-slate-50/80 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
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
                      <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">مسار الحفظ</label>
                      <div className="flex gap-2">
                        <input
                          value={form.auto_backup_path}
                          onChange={(e) => handleChange("auto_backup_path", e.target.value)}
                          placeholder="الافتراضي: backups/"
                          className="h-12 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50/80 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                        />
                        {window.electronAPI && (
                          <button
                            type="button"
                            onClick={handleFolderPick}
                            className="h-12 shrink-0 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            تصفّح
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* ─── Footer ─── */}
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-black text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              تخطي
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-[var(--primary)] px-8 py-3 text-sm font-black text-white hover:bg-[var(--primary-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <span>💾</span>
                  حفظ ومتابعة
                </>
              )}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", dir = "rtl" }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50/80 px-4 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:bg-white transition-colors placeholder:text-slate-300 placeholder:font-normal"
      />
    </div>
  );
}
