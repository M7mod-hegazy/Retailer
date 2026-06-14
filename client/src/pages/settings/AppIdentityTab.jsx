import React, { useState, useRef, useCallback } from 'react';
import { Upload, RotateCcw, Eye, Loader2, Building2, FileText, MapPin, Plus, X, Info, Sidebar, ImageDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getMeta, getHint, getPlaceholder } from '../../utils/fieldMeta';

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const size = file.size;
    let quality, maxDim;
    if (size <= 500 * 1024) {
      resolve(file);
      return;
    } else if (size > 5 * 1024 * 1024) {
      quality = 0.4; maxDim = 400;
    } else if (size > 2 * 1024 * 1024) {
      quality = 0.6; maxDim = 600;
    } else {
      quality = 0.8; maxDim = 800;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * maxDim / width);
          width = maxDim;
        } else {
          width = Math.round(width * maxDim / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        resolve(new File([blob], file.name, { type: file.type }));
      }, file.type, quality);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
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

function DenseInput({ label, required, metaKey, lang = 'ar', ...props }) {
  const hint = metaKey ? getHint(metaKey, lang) : null;
  const placeholder = metaKey ? getPlaceholder(metaKey, lang) : null;
  const meta = metaKey ? getMeta(metaKey) : null;
  const isCriticalEmpty = meta?.critical && (
    props.value === undefined || props.value === null || props.value === "" ||
    (meta.defaultValue !== undefined && meta.defaultValue !== null && meta.defaultValue !== "" && props.value === meta.defaultValue)
  );
  return (
    <label className="block space-y-1 focus-within:text-slate-900 text-slate-500 transition-colors">
      <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest">
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
    </label>
  );
}

export function AppIdentityTab({ settings = {}, onChange, lang = 'ar' }) {
  const [logoPreview, setLogoPreview] = useState(settings.logo_url || null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = useCallback(async (rawFile) => {
    if (!rawFile || !rawFile.type.startsWith('image/')) {
      toast.error(lang === 'ar' ? 'الرجاء اختيار صورة فقط' : 'Please select an image');
      return;
    }
    setUploading(true);
    try {
      const file = rawFile.size > 500 * 1024 ? await compressImage(rawFile) : rawFile;
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.url;
      if (url) {
        setLogoPreview(url);
        onChange?.('logo_url', url);
        toast.success(lang === 'ar' ? 'تم رفع الشعار بنجاح' : 'Logo uploaded successfully');
      }
    } catch {
      toast.error(lang === 'ar' ? 'فشل رفع الشعار' : 'Logo upload failed');
    } finally {
      setUploading(false);
    }
    if (fileRef.current) fileRef.current.value = '';
  }, [onChange, lang]);

  const addrs = (() => { try { return JSON.parse(settings.additional_addresses || "[]"); } catch { return []; } })();
  const phones = (() => { try { return JSON.parse(settings.additional_phones || "[]"); } catch { return []; } })();

  return (
    <div className="space-y-8">

      {/* ═══ BRANDING ═══ */}
      <section>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-white">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              {lang === 'ar' ? 'العلامة التجارية' : 'Branding'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              {lang === 'ar' ? 'الشعار واسم التطبيق اللذان يظهران في الشريط العلوي وشاشة الدخول' : 'Logo and app name displayed in the top bar and login screen'}
            </p>
          </div>
        </div>

        {/* Upload & Preview */}
        <div className="grid gap-6 md:grid-cols-[1fr_200px] mb-6">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500">
              {lang === 'ar' ? 'شعار التطبيق' : 'App Logo'}
            </label>
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className={`group relative flex h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed transition-all ${
                uploading
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/50'
              }`}
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm group-hover:scale-105 transition-transform">
                    <Upload className="h-4 w-4 text-slate-500 group-hover:text-slate-800" />
                  </div>
                  <div className="text-center">
                    <p className="text-2sm font-bold text-slate-600">
                      {lang === 'ar' ? 'اضغط هنا لرفع الشعار' : 'Click to Upload Logo'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      PNG, JPG, SVG &bull; ضغط تلقائي ذكي
                    </p>
                  </div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          </div>

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

        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'اسم التطبيق (رئيسي)' : 'App Name'}
            metaKey="app_name"
            value={settings.app_name || ''}
            onChange={(e) => onChange?.('app_name', e.target.value)}
          />
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'الاسم الفرعي (يظهر تحته)' : 'Sub-title'}
            metaKey="app_subtitle"
            value={settings.app_subtitle || ''}
            onChange={(e) => onChange?.('app_subtitle', e.target.value)}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={settings.logo_on_sidebar !== false && settings.logo_on_sidebar !== 0}
            onClick={() => onChange?.('logo_on_sidebar', settings.logo_on_sidebar === false || settings.logo_on_sidebar === 0 ? 1 : 0)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.logo_on_sidebar !== false && settings.logo_on_sidebar !== 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.logo_on_sidebar !== false && settings.logo_on_sidebar !== 0 ? '-translate-x-6' : '-translate-x-1'}`} />
          </button>
          <span className="text-2sm font-bold text-slate-600">
            {lang === 'ar' ? 'إظهار الشعار في القائمة الجانبية' : 'Show logo in sidebar'}
          </span>
        </div>
      </section>

      {/* ═══ BRANCH INFO ═══ */}
      <section>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary text-white">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              {lang === 'ar' ? 'بيانات الفرع' : 'Branch Info'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              {lang === 'ar' ? 'تظهر هذه البيانات في رأس الفواتير والتقارير الرسمية' : 'Displayed in the header of invoices and official reports'}
            </p>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'اسم الشركة (عربي)' : 'Company Name (Arabic)'}
            metaKey="company_name"
            required
            value={settings.company_name || ''}
            onChange={(e) => onChange('company_name', e.target.value)}
          />
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'اسم الشركة (إنجليزي)' : 'Company Name (English)'}
            metaKey="company_name_en"
            value={settings.company_name_en || ''}
            onChange={(e) => onChange('company_name_en', e.target.value)}
          />
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'اسم الفرع' : 'Branch Name'}
            metaKey="branch_name"
            required
            value={settings.branch_name || ''}
            onChange={(e) => onChange('branch_name', e.target.value)}
          />
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'كود الفرع' : 'Branch Code'}
            metaKey="branch_code"
            value={settings.branch_code || ''}
            onChange={(e) => onChange('branch_code', e.target.value)}
          />
        </div>
      </section>

      {/* ═══ OFFICIAL DOCUMENTS ═══ */}
      <section>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-amber-600 text-white">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              {lang === 'ar' ? 'المستندات الرسمية' : 'Official Documents'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              {lang === 'ar' ? 'أرقام السجل التجاري والضريبي للامتثال — تظهر في أسفل الفواتير' : 'CR and VAT numbers for compliance — shown at the bottom of invoices'}
            </p>
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'السجل التجاري' : 'Commercial Register'}
            metaKey="commercial_register"
            value={settings.commercial_register || ''}
            onChange={(e) => onChange('commercial_register', e.target.value)}
          />
          <DenseInput lang={lang}
            label={lang === 'ar' ? 'الرقم الضريبي' : 'VAT Number'}
            metaKey="vat_number"
            value={settings.vat_number || ''}
            onChange={(e) => onChange('vat_number', e.target.value)}
          />
        </div>
      </section>

      {/* ═══ ADDRESSES & PHONES ═══ */}
      <section>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-white">
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              {lang === 'ar' ? 'العناوين والهواتف' : 'Addresses & Phones'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              {lang === 'ar' ? 'عنوان الفرع الرئيسي وفروعه الإضافية للتواصل — تظهر في الفواتير' : 'Main branch address and additional branches for contact — shown on invoices'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(() => {
            const primAddr = settings.address || "";
            const primPhone = settings.phone || "";
            const isAddrCritical = !primAddr;
            const isPhoneCritical = !primPhone;
            const pairs = [{ address: primAddr, phone: primPhone }];
            for (let i = 0; i < Math.max(addrs.length, phones.length); i++) {
              pairs.push({ address: addrs[i] || "", phone: phones[i] || "" });
            }
            return pairs.map((pair, i) => {
              const isAddrEmpty = i === 0 && isAddrCritical;
              const isPhoneEmpty = i === 0 && isPhoneCritical;
              return (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1">
                  {i === 0 && (
                    <span className="flex items-center gap-1.5 mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                      {lang === 'ar' ? 'العنوان الرئيسي' : 'Main Address'}
                      {isAddrCritical && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700 border border-amber-300">
                          مطلوب
                        </span>
                      )}
                    </span>
                  )}
                  <textarea
                    value={pair.address}
                    data-field-key={i === 0 ? "address" : undefined}
                    onChange={(e) => {
                      if (i === 0) {
                        onChange("address", e.target.value);
                      } else {
                        const updated = [...addrs];
                        updated[i - 1] = e.target.value;
                        onChange("additional_addresses", JSON.stringify(updated));
                      }
                    }}
                    placeholder={`${lang === 'ar' ? 'عنوان الفرع' : 'Branch Address'} ${i + 1}`}
                    rows={2}
                    className={`w-full rounded-sm border py-2.5 px-3 text-sm font-bold outline-none shadow-sm transition-all resize-none ${
                      isAddrEmpty
                        ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600"
                        : "border-slate-200 bg-white text-slate-800 focus:border-slate-800"
                    }`}
                  />
                </div>
                <div className="flex-1 flex gap-2 items-center">
                  <div className="w-full">
                    {i === 0 && (
                      <span className="flex items-center gap-1.5 mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        {lang === 'ar' ? 'الهاتف الرئيسي' : 'Main Phone'}
                        {isPhoneCritical && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700 border border-amber-300">
                            مطلوب
                          </span>
                        )}
                      </span>
                    )}
                    <input
                      type="text"
                      value={pair.phone}
                      data-field-key={i === 0 ? "phone" : undefined}
                      onChange={(e) => {
                        if (i === 0) {
                          onChange("phone", e.target.value);
                        } else {
                          const updated = [...phones];
                          updated[i - 1] = e.target.value;
                          onChange("additional_phones", JSON.stringify(updated));
                        }
                      }}
                      placeholder={`${lang === 'ar' ? 'هاتف الفرع' : 'Branch Phone'} ${i + 1}`}
                      className={`w-full rounded-sm border py-2.5 px-3 text-sm font-bold outline-none shadow-sm transition-all ${
                        isPhoneEmpty
                          ? "border-amber-400 bg-amber-50 text-amber-900 focus:border-amber-600"
                          : "border-slate-200 bg-white text-slate-800 focus:border-slate-800"
                      }`}
                    />
                  </div>
                </div>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const aUpdated = addrs.filter((_, idx) => idx !== i - 1);
                      const pUpdated = phones.filter((_, idx) => idx !== i - 1);
                      onChange("additional_addresses", JSON.stringify(aUpdated));
                      onChange("additional_phones", JSON.stringify(pUpdated));
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors mt-0.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )});
          })()}
          <button
            type="button"
            onClick={() => {
              onChange("additional_addresses", JSON.stringify([...addrs, ""]));
              onChange("additional_phones", JSON.stringify([...phones, ""]));
            }}
            className="flex items-center gap-2 text-2sm font-black text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> {lang === 'ar' ? 'إضافة فرع' : 'Add Branch'}
          </button>
        </div>
      </section>

    </div>
  );
}
