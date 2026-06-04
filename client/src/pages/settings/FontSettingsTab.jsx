import { useState, useEffect, useRef } from "react";
import { Type, Hash, Edit3, ChevronDown } from "lucide-react";

const FONT_OPTIONS = [
  { value: "Noto Sans Arabic", label: "Noto Sans Arabic", desc: "خط عصري واضح — موصى به" },
  { value: "Tajawal", label: "Tajawal", desc: "خط هندسي حديث" },
  { value: "Cairo", label: "Cairo", desc: "كوفي معاصر بمسافات واسعة" },
  { value: "Almarai", label: "Almarai", desc: "خط نظيف وقابل للقراءة" },
  { value: "IBM Plex Sans Arabic", label: "IBM Plex Sans Arabic", desc: "سانس عصري — ممتاز للواجهات" },
  { value: "Readex Pro", label: "Readex Pro", desc: "متغير الطباعة — حداثة" },
  { value: "El Messiri", label: "El Messiri", desc: "خط عربي أنيق معاصر" },
  { value: "Alexandria", label: "Alexandria", desc: "هندسي حديث بوضوح عالٍ" },
  { value: "Lemonada", label: "Lemonada", desc: "مُدور دافئ — مناسب للعناوين" },
  { value: "Lateef", label: "Lateef", desc: "نسخ تقليدي فاخر" },
  { value: "Vazirmatn", label: "Vazirmatn", desc: "سانس نحيف بواجهات نظيفة" },
  { value: "Mada", label: "Mada", desc: "خفيف ومناسب للواجهات المزدحمة" },
  { value: "Changa", label: "Changa", desc: "عرضي جريء للعناوين" },
  { value: "Scheherazade New", label: "Scheherazade New", desc: "نسخ كلاسيكي أنيق" },
  { value: "Amiri", label: "Amiri", desc: "خط عربي تقليدي فاخر" },
  { value: "Markazi Text", label: "Markazi Text", desc: "كوفي معدني للعناوين" },
  { value: "Mirza", label: "Mirza", desc: "خط كوفي متوسط للجسم" },
  { value: "Rakkas", label: "Rakkas", desc: "خط زخرفي جريء للعناوين" },
  { value: "Lalezar", label: "Lalezar", desc: "خط كوفي ثخين للافتات" },
];

const NUMBER_FONT_OPTIONS = [
  { value: "Outfit", label: "Outfit", desc: "حديث للأرقام — موصى به" },
  { value: "Inter", label: "Inter", desc: "خط سانس متعدد الاستخدامات" },
  ...FONT_OPTIONS,
];

const SIZE_OPTIONS = [
  { value: "small", label: "صغير", desc: "13px" },
  { value: "normal", label: "عادي", desc: "15px" },
  { value: "medium", label: "متوسط", desc: "16px" },
  { value: "large", label: "كبير", desc: "18px" },
  { value: "xlarge", label: "كبير جداً", desc: "20px" },
  { value: "huge", label: "ضخم", desc: "22px" },
  { value: "giant", label: "عملاق", desc: "24px" },
];

const SCALE_OPTIONS = [
  { value: "tiny", label: "مصغر", desc: "0.5×" },
  { value: "small", label: "صغير", desc: "0.75×" },
  { value: "normal", label: "عادي", desc: "1×" },
  { value: "large", label: "كبير", desc: "1.125×" },
  { value: "xlarge", label: "كبير جداً", desc: "1.25×" },
  { value: "huge", label: "ضخم", desc: "1.5×" },
  { value: "giant", label: "عملاق", desc: "2×" },
];

const SIZE_MAP = { small: 13, normal: 15, medium: 16, large: 18, xlarge: 20, huge: 22, giant: 24 };
const SCALE_VALUE_MAP = { tiny: 0.5, small: 0.75, normal: 1, large: 1.125, xlarge: 1.25, huge: 1.5, giant: 2 };

function FontDropdown({ options, value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm transition-all hover:border-slate-300"
      >
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          <span className="text-[15px] font-bold text-slate-800 leading-tight truncate max-w-full" style={{ fontFamily: value }}>
            {selected.label}
          </span>
          <span className="text-[13px] text-slate-600 leading-relaxed truncate max-w-full" style={{ fontFamily: value }}>
            مرحباً بكم في النظام العربي — ٠١٢٣
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-sm border border-slate-200 bg-white shadow-lg max-h-80 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-right transition-all hover:bg-slate-50 ${
                value === opt.value ? "bg-emerald-50 border-r-2 border-emerald-500" : ""
              }`}
            >
              <span className="text-[15px] font-bold text-slate-800 leading-tight" style={{ fontFamily: opt.value }}>
                {opt.label}
              </span>
              <span className="text-[13px] text-slate-500 leading-relaxed" style={{ fontFamily: opt.value }}>
                مرحباً بكم في النظام العربي — ٠١٢٣
              </span>
              <span className="text-[11px] font-bold text-slate-400 leading-tight">{opt.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FontSettingsTab({ settings, onChange }) {
  const currentFamily = settings.font_family || "Noto Sans Arabic";
  const currentSize = settings.font_size || "normal";
  const currentNumberFamily = settings.number_font_family || "Outfit";
  const currentNumberScale = settings.number_font_scale || "normal";
  const currentNumeralStyle = settings.numeral_style || "western";
  const previewPx = SIZE_MAP[currentSize] || 15;
  const previewScale = SCALE_VALUE_MAP[currentNumberScale] ?? 1;

  const arabicDigits = Intl.NumberFormat("ar-SA", { useGrouping: false }).format(1234567890);
  const westernDigits = "0123456789";

  return (
    <div className="space-y-8">
      {/* ═══ BODY + NUMBER SIDE BY SIDE ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-12">

        {/* BODY SECTION */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Type className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              خط النص العام
            </h3>
          </div>
          <p className="text-2sm font-bold text-slate-400 mb-4">الخط الأساسي لجميع نصوص النظام</p>

          <div className="mb-5">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              نوع الخط
            </h4>
            <FontDropdown
              options={FONT_OPTIONS}
              value={currentFamily}
              onChange={(val) => onChange("font_family", val)}
              label="اختر الخط"
            />
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              حجم النص العام
            </h4>
            <div className="flex rounded-sm border border-slate-200 overflow-hidden w-fit flex-wrap">
              {SIZE_OPTIONS.map((opt) => {
                const active = currentSize === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange("font_size", opt.value)}
                    className={`px-5 py-3 text-[13px] font-black transition-all ${
                      active
                        ? "bg-slate-800 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                    <span className="block text-[11px] font-bold opacity-60 mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* NUMBER SECTION */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Hash className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
              إعدادات الأرقام
            </h3>
          </div>
          <p className="text-2sm font-bold text-slate-400 mb-4">تحكم مستقل في خط الأرقام وحجمها ونمط الأرقام</p>

          <div className="mb-5">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              خط الأرقام (مستقل عن خط النص)
            </h4>
            <FontDropdown
              options={NUMBER_FONT_OPTIONS}
              value={currentNumberFamily}
              onChange={(val) => onChange("number_font_family", val)}
              label="اختر خط الأرقام"
            />
          </div>

          <div className="mb-5">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              حجم الأرقام (بالنسبة للنص العام)
            </h4>
            <div className="flex rounded-sm border border-slate-200 overflow-hidden w-fit flex-wrap">
              {SCALE_OPTIONS.map((opt) => {
                const active = currentNumberScale === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange("number_font_scale", opt.value)}
                    className={`px-4 py-3 text-[13px] font-black transition-all ${
                      active
                        ? "bg-slate-800 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                    <span className="block text-[11px] font-bold opacity-60 mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              نمط الأرقام
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChange("numeral_style", "western")}
                className={`relative flex flex-col items-center gap-2 rounded-sm border p-5 text-center transition-all ${
                  currentNumeralStyle === "western"
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {currentNumeralStyle === "western" && (
                  <span className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </span>
                )}
                <span className="text-xl font-black text-slate-800" style={{ fontFamily: currentNumberFamily }}>
                  0123456789
                </span>
                <span className="text-sm font-bold text-slate-800">أرقام غربية</span>
                <span className="text-[11px] font-bold text-slate-400 leading-tight">
                  للأكواد والفواتير الرقمية — التنسيق الدولي
                </span>
              </button>
              <button
                type="button"
                onClick={() => onChange("numeral_style", "arabic")}
                className={`relative flex flex-col items-center gap-2 rounded-sm border p-5 text-center transition-all ${
                  currentNumeralStyle === "arabic"
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {currentNumeralStyle === "arabic" && (
                  <span className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </span>
                )}
                <span className="text-xl font-black text-slate-800" style={{ fontFamily: currentNumberFamily }}>
                  {arabicDigits}
                </span>
                <span className="text-sm font-bold text-slate-800">أرقام عربية</span>
                <span className="text-[11px] font-bold text-slate-400 leading-tight">
                  الأرقام العربية التقليدية — للفواتير الرسمية والمستندات
                </span>
              </button>
            </div>
          </div>
        </section>

      </div>

      <div className="border-t border-slate-100" />

      {/* ═══ LIVE PREVIEW ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Edit3 className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
            معاينة حية
          </h3>
          <span className="rounded-sm bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700 tracking-wider">
            معاينة
          </span>
        </div>

        <div
          className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm space-y-5"
          style={{
            fontFamily: currentFamily,
            fontSize: `${previewPx}px`,
            lineHeight: "1.8",
            direction: "rtl",
          }}
        >
          {/* Body text preview */}
          <div>
            <p style={{ fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>
              مرحباً بكم في نظام الهجازي لإدارة نقاط البيع
            </p>
            <p style={{ fontWeight: 500, color: "#475569", fontSize: "0.9375em" }}>
              هذا النص يستخدم لعرض شكل الخط الجديد قبل تطبيقه على النظام.
              يوضح المزيج بين النص العربي والأرقام في السياقات المختلفة. الخط الحالي: {currentFamily} بحجم {previewPx}px.
            </p>
          </div>

          {/* KPI mock */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              background: "#f8fafc",
            }}
          >
            <div style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600, marginBottom: "0.5rem" }}>
              ملخص اليوم
            </div>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>المبيعات</div>
                <div
                  style={{
                    fontFamily: currentNumberFamily,
                    fontSize: `${1.75 * previewScale}em`,
                    fontWeight: 800,
                    color: "#0f172a",
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {currentNumeralStyle === "arabic"
                    ? new Intl.NumberFormat("ar-SA").format(1257800)
                    : "1,257,800"}
                  {" "}
                  <span style={{ fontSize: `${0.6 * previewScale}em`, fontWeight: 600, color: "#64748b" }}>
                    ر.س
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>الفاتورة الحالية</div>
                <div
                  style={{
                    fontFamily: currentNumberFamily,
                    fontSize: `${1.25 * previewScale}em`,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  INV-{currentNumeralStyle === "arabic" ? new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(24058) : "24058"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>الكمية</div>
                <div
                  style={{
                    fontFamily: currentNumberFamily,
                    fontSize: `${1.25 * previewScale}em`,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {currentNumeralStyle === "arabic"
                    ? new Intl.NumberFormat("ar-SA").format(42)
                    : "42"}
                  {" "}
                  <span style={{ fontSize: `${0.7 * previewScale}em`, fontWeight: 600, color: "#64748b" }}>
                    قطعة
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Price lines */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.9375em" }}>
            <div>
              <span style={{ fontWeight: 600, color: "#475569" }}>سعر الوحدة: </span>
              <span
                style={{
                  fontFamily: currentNumberFamily,
                  fontSize: `${1 * previewScale}em`,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {currentNumeralStyle === "arabic"
                  ? new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(35.5)
                  : "35.50"}
                {" "}
                <span style={{ fontSize: `${0.8 * previewScale}em`, fontWeight: 600, color: "#64748b" }}>ر.س</span>
              </span>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: "#475569" }}>الإجمالي: </span>
              <span
                style={{
                  fontFamily: currentNumberFamily,
                  fontSize: `${1 * previewScale}em`,
                  fontWeight: 700,
                  color: "#065f46",
                }}
              >
                {currentNumeralStyle === "arabic"
                  ? new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1250)
                  : "1,250.00"}
                {" "}
                <span style={{ fontSize: `${0.8 * previewScale}em`, fontWeight: 600, color: "#64748b" }}>ر.س</span>
              </span>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: "#475569" }}>الخصم: </span>
              <span
                style={{
                  fontFamily: currentNumberFamily,
                  fontSize: `${1 * previewScale}em`,
                  fontWeight: 700,
                  color: "#dc2626",
                }}
              >
                {currentNumeralStyle === "arabic"
                  ? new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(-15)
                  : "-15.00"}
                {" "}
                <span style={{ fontSize: `${0.8 * previewScale}em`, fontWeight: 600, color: "#64748b" }}>%</span>
              </span>
            </div>
          </div>

          {/* Arabic vs Western digits comparison */}
          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              paddingTop: "0.75rem",
              fontSize: "0.8125em",
            }}
          >
            <span style={{ fontWeight: 600, color: "#64748b" }}>الأرقام: </span>
            <span
              style={{
                fontFamily: currentNumberFamily,
                fontSize: `${1 * previewScale}em`,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {currentNumeralStyle === "arabic"
                ? `${westernDigits} ← ${arabicDigits}`
                : `${arabicDigits} ← ${westernDigits}`}
            </span>
          </div>
        </div>

        <p className="mt-2 text-[11px] font-bold text-slate-400">
          * التغييرات تنعكس على المعاينة فقط. للحفظ اضغط "حفظ الإعدادات" بالأعلى.
        </p>
      </section>
    </div>
  );
}
