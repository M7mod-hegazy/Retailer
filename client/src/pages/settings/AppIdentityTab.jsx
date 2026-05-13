import React, { useState, useRef, useCallback } from 'react';
import { Upload, RotateCcw, Eye } from 'lucide-react';

export function AppIdentityTab({ settings = {}, onChange, lang = 'ar' }) {
  const [logoPreview, setLogoPreview] = useState(settings.logo_url || null);
  const fileRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setLogoPreview(url);
      onChange?.('logo_url', url);
    };
    reader.readAsDataURL(file);
  }, [onChange]);

  return (
    <div className="space-y-8">
      {/* Inputs */}
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <label className="block space-y-1.5 focus-within:text-slate-900 text-slate-500 transition-colors">
          <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest">
            {lang === 'ar' ? 'اسم التطبيق (رئيسي)' : 'App Name'}
          </span>
          <input
            type="text"
            value={settings.app_name || ''}
            onChange={(e) => onChange?.('app_name', e.target.value)}
            placeholder={lang === 'ar' ? 'إلهيجازي للتجزئة' : 'ElHegazi Retailer'}
            className="w-full rounded-sm border border-slate-200 bg-white py-2.5 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all"
          />
        </label>
        <label className="block space-y-1.5 focus-within:text-slate-900 text-slate-500 transition-colors">
          <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest">
            {lang === 'ar' ? 'الاسم الفرعي (يظهر تحته)' : 'Sub-title'}
          </span>
          <input
            type="text"
            value={settings.app_subtitle || ''}
            onChange={(e) => onChange?.('app_subtitle', e.target.value)}
            placeholder={lang === 'ar' ? 'نظام إدارة المبيعات' : 'Sales Management'}
            className="w-full rounded-sm border border-slate-200 bg-white py-2.5 px-3 text-[13px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all"
          />
        </label>
      </div>

      {/* Upload & Preview */}
      <div className="grid gap-6 md:grid-cols-[1fr_200px]">
        {/* Upload Zone */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">
            {lang === 'ar' ? 'شعار التطبيق' : 'App Logo'}
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:border-slate-400 hover:bg-slate-100/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm group-hover:scale-105 transition-transform">
              <Upload className="h-4 w-4 text-slate-500 group-hover:text-slate-800" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-bold text-slate-600">
                {lang === 'ar' ? 'اضغط هنا لرفع الشعار' : 'Click to Upload Logo'}
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                PNG, JPG, SVG • MAX 2MB
              </p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        {/* Live Preview Card */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">
            {lang === 'ar' ? 'معاينة حية' : 'Live Preview'}
          </label>
          <div className="relative flex h-[120px] w-full items-center justify-center rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[11px] font-bold text-slate-400">
                {lang === 'ar' ? 'لا يوجد شعار' : 'No Logo Preview'}
              </span>
            )}
            
            {logoPreview && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLogoPreview(null); onChange?.('logo_url', null); }}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-600 hover:scale-110 transition-all"
                title={lang === 'ar' ? 'حذف الشعار' : 'Remove Logo'}
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visibility Settings */}
      <div className="space-y-3">
        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">
          {lang === 'ar' ? 'أماكن عرض الشعار' : 'Visibility Settings'}
        </label>
        <div className="flex flex-wrap items-center gap-4">
          {[
            { key: 'logo_on_sidebar',   label_ar: 'شريط التنقل',   label_en: 'Sidebar' },
            { key: 'logo_on_invoices',  label_ar: 'الطباعة (فواتير/إيصالات)', label_en: 'Printing (Invoices)' },
            { key: 'logo_on_reports',   label_ar: 'التقارير',      label_en: 'Reports' },
          ].map(({ key, label_ar, label_en }) => (
            <label key={key} className="flex cursor-pointer select-none items-center gap-2.5 rounded-sm border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors hover:bg-slate-100">
              <input
                type="checkbox"
                checked={settings[key] !== false}
                onChange={(e) => onChange?.(key, e.target.checked)}
                className="h-4 w-4 rounded-sm border-slate-300 accent-slate-900 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-[12px] font-bold text-slate-700">
                {lang === 'ar' ? label_ar : label_en}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
