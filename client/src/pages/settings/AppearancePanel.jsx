import { useEffect, useRef } from "react";
import { Edit3, Monitor, Type } from "lucide-react";
import FontSettingsTab from "./FontSettingsTab";
import ColorThemeTab from "./ColorThemeTab";
import { applyColorTheme } from "../../utils/applyColorTheme";
import { SCALE_MAP as SIZE_MAP, NUMBER_SCALE_MAP as SCALE_VALUE_MAP } from "../../utils/fontSettings";

export default function AppearancePanel({ settings, onChange }) {
  const prevTheme = useRef(settings.color_theme);

  useEffect(() => {
    applyColorTheme(settings);
    prevTheme.current = settings.color_theme;
  }, [settings.color_theme, settings.custom_theme_vars]);

  return (
    <div className="space-y-10">
      {/* Tab header */}
      <div
        className="flex items-center justify-between gap-4 rounded-xl px-5 py-4"
        style={{
          border: "1px solid var(--border-normal)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <div>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>تحكم في مظهر النظام</p>
          <p className="text-[12px] font-bold mt-0.5" style={{ color: "var(--text-muted)" }}>
            اختر الخط ونظام الألوان الذي يناسب نشاطك التجاري
          </p>
        </div>
        <div className="flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--primary)" }} title="الخطوط" />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--text-accent)" }} title="الألوان" />
        </div>
      </div>

      {/* Font Settings (no preview — it's in the unified section below) */}
      <div className="pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
            إعدادات الخط
          </h3>
        </div>
      </div>
      <FontSettingsTab settings={settings} onChange={onChange} noPreview />

      <div style={{ borderTop: "1px solid var(--border-normal)" }} />

      {/* Color Theme */}
      <ColorThemeTab settings={settings} onChange={onChange} />

      <div style={{ borderTop: "1px solid var(--border-normal)" }} />

      {/* ═══ UNIFIED LIVE PREVIEW ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Monitor className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
            معاينة حية
          </h3>
          <span
            className="rounded-sm px-2 py-0.5 text-[11px] font-black tracking-wider"
            style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}
          >
            خط + ألوان
          </span>
        </div>
        <p className="text-[12px] font-bold mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          يعكس الخط ونظام الألوان المختار — جميع العناصر تتغير تلقائياً عند اختيار نمط جديد.
        </p>

        <UnifiedPreview settings={settings} />
      </section>
    </div>
  );
}

function UnifiedPreview({ settings }) {
  const currentFamily = settings.font_family || "Noto Sans Arabic";
  const currentSize = settings.font_size || "normal";
  const currentNumberFamily = settings.number_font_family || "Outfit";
  const currentNumberScale = settings.number_font_scale || "normal";
  const currentNumeralStyle = settings.numeral_style || "western";
  const previewPx = SIZE_MAP[currentSize] || 15;
  const previewScale = SCALE_VALUE_MAP[currentNumberScale] ?? 1;

  const fmtNum = (n, opts = {}) => {
    if (currentNumeralStyle === "arabic") {
      return new Intl.NumberFormat("ar-SA", opts).format(n);
    }
    return new Intl.NumberFormat("en-US", opts).format(n);
  };

  return (
    <div
      className="rounded-xl p-6 space-y-6"
      style={{
        fontFamily: currentFamily,
        fontSize: `${previewPx}px`,
        lineHeight: "1.8",
        direction: "rtl",
        border: "1px solid var(--border-normal)",
        backgroundColor: "var(--bg-surface)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Section label */}
      <PreviewSectionLabel title="نصوص تجريبية" />

      {/* Body text */}
      <div>
        <p className="text-[1em] font-bold" style={{ color: "var(--text-primary)", marginBottom: "0.25rem" }}>
          مرحباً بكم في نظام الهجازي لإدارة نقاط البيع
        </p>
        <p className="text-[0.9375em] font-medium" style={{ color: "var(--text-secondary)" }}>
          هذا النص يستخدم لعرض شكل الخط الجديد والألوان قبل تطبيقها على النظام.
          يوضح المزيج بين النص العربي والأرقام في السياقات المختلفة.
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title="أزرار" />

      {/* Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg px-5 py-2.5 text-[13px] font-black text-white shadow-sm transition-all hover:shadow-md active:scale-95"
          style={{ backgroundColor: "var(--primary)" }}
        >
          زر أساسي
        </button>
        <button
          type="button"
          className="rounded-lg px-5 py-2.5 text-[13px] font-black shadow-sm transition-all active:scale-95"
          style={{
            border: "1px solid var(--border-normal)",
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
        >
          زر عادي
        </button>
        <button
          type="button"
          className="rounded-lg px-5 py-2.5 text-[13px] font-black shadow-sm transition-all active:scale-95"
          style={{
            border: "1px solid var(--danger-border)",
            backgroundColor: "var(--danger-bg)",
            color: "var(--danger)",
          }}
        >
          زر حذف
        </button>
        <button
          type="button"
          className="rounded-lg px-5 py-2.5 text-[13px] font-black transition-all active:scale-95"
          style={{ color: "var(--text-muted)" }}
        >
          زر شفاف
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title="بطاقات KPI" />

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card rounded-xl border p-4 shadow-sm" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            المبيعات
          </p>
          <p
            className="mt-1 text-[1.75em] font-black leading-none tracking-tight"
            style={{ fontFamily: currentNumberFamily, fontSize: `${1.75 * previewScale}em`, color: "var(--text-primary)" }}
          >
            {fmtNum(1257800)}
            <span className="mr-1 text-[0.6em] font-semibold" style={{ color: "var(--text-muted)" }}>ر.س</span>
          </p>
          <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--success-text)" }}>
            <span>↑</span> {fmtNum(12.5)}%
          </p>
        </div>
        <div className="kpi-card rounded-xl border p-4 shadow-sm" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            الطلبات
          </p>
          <p
            className="mt-1 font-black leading-none tracking-tight"
            style={{ fontFamily: currentNumberFamily, fontSize: `${1.75 * previewScale}em`, color: "var(--text-primary)" }}
          >
            {fmtNum(342)}
          </p>
          <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
            آخر ساعة: {fmtNum(12)}
          </p>
        </div>
        <div className="kpi-card rounded-xl border p-4 shadow-sm" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            العملاء
          </p>
          <p
            className="mt-1 font-black leading-none tracking-tight"
            style={{ fontFamily: currentNumberFamily, fontSize: `${1.75 * previewScale}em`, color: "var(--text-primary)" }}
          >
            {fmtNum(89)}
          </p>
          <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--warning-text)" }}>
            {fmtNum(3)} جدد اليوم
          </p>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title="مدخل نص" />

      {/* Input */}
      <div>
        <div className="input-wrapper relative">
          <label className="mb-1 block text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            اسم الصنف
          </label>
          <input
            type="text"
            readOnly
            value="هاتف آيفون 16 برو"
            className="input w-full rounded-lg border px-3.5 py-2.5 text-[14px] font-bold shadow-sm outline-none transition-all"
            style={{ borderColor: "var(--border-normal)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--border-accent)";
              e.target.style.boxShadow = "var(--shadow-focus)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-normal)";
              e.target.style.boxShadow = "none";
            }}
          />
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title="الشارات (Badges)" />

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
          مدفوع
        </span>
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-text)" }}>
          معلق
        </span>
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger)" }}>
          ملغي
        </span>
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--info-bg)", color: "var(--info-text)" }}>
          جديد
        </span>
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--primary-50)", color: "var(--primary)" }}>
          نشط
        </span>
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
          غير نشط
        </span>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title=" حالة (Status Pills)" />

      {/* Status pills */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--success-light)", color: "var(--success-text)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--success-text)" }} />
          متصل
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--warning-light)", color: "var(--warning-text)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--warning-text)" }} />
          قيد الانتظار
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--danger)" }} />
          منقطع
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-black" style={{ backgroundColor: "var(--primary-50)", color: "var(--primary)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ color: "var(--primary)" }}>
            ●
          </span>
          نشط
        </span>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title="جدول" />

      {/* Table mock */}
      <div className="rounded-lg" style={{ border: "1px solid var(--border-subtle)" }}>
        <table className="table w-full text-right text-[13px]">
          <thead>
            <tr style={{ backgroundColor: "var(--bg-overlay)" }}>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>الصنف</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>الكمية</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>السعر</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <td className="px-4 py-3 font-bold" style={{ color: "var(--text-primary)" }}>هاتف آيفون 16 برو</td>
              <td className="px-4 py-3 font-bold" style={{ fontFamily: currentNumberFamily, color: "var(--text-primary)" }}>{fmtNum(2)}</td>
              <td className="px-4 py-3 font-bold" style={{ fontFamily: currentNumberFamily, color: "var(--text-primary)" }}>{fmtNum(45000, { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 font-bold" style={{ fontFamily: currentNumberFamily, color: "var(--text-primary)" }}>{fmtNum(90000, { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <td className="px-4 py-3 font-bold" style={{ color: "var(--text-primary)" }}>سماعة لاسلكية</td>
              <td className="px-4 py-3 font-bold" style={{ fontFamily: currentNumberFamily, color: "var(--text-primary)" }}>{fmtNum(3)}</td>
              <td className="px-4 py-3 font-bold" style={{ fontFamily: currentNumberFamily, color: "var(--text-primary)" }}>{fmtNum(1200, { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 font-bold" style={{ fontFamily: currentNumberFamily, color: "var(--text-primary)" }}>{fmtNum(3600, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title="قائمة جانبية (شريط التنقل)" />

      {/* Sidebar nav mock */}
      <div className="flex flex-col gap-1 rounded-lg p-3" style={{ backgroundColor: "var(--bg-sidebar)" }}>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-bold" style={{ backgroundColor: "var(--primary-50)", color: "var(--primary)" }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
          نقطة البيع
        </div>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-bold" style={{ color: "var(--text-secondary)" }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--text-muted)" }} />
          المشتريات
        </div>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-bold" style={{ color: "var(--text-secondary)" }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--text-muted)" }} />
          المخزون
        </div>
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-bold" style={{ color: "var(--text-secondary)" }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--text-muted)" }} />
          التقارير
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
      <PreviewSectionLabel title="أسعار ومبالغ" />

      {/* Price lines */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375em]">
        <div>
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>سعر الوحدة: </span>
          <span className="font-bold" style={{ fontFamily: currentNumberFamily, fontSize: `${1 * previewScale}em`, color: "var(--text-primary)" }}>
            {fmtNum(35.5, { minimumFractionDigits: 2 })}{" "}
            <span className="font-semibold" style={{ fontSize: `${0.8 * previewScale}em`, color: "var(--text-muted)" }}>ر.س</span>
          </span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>الإجمالي: </span>
          <span className="font-bold" style={{ fontFamily: currentNumberFamily, fontSize: `${1 * previewScale}em`, color: "var(--success-text)" }}>
            {fmtNum(1250, { minimumFractionDigits: 2 })}{" "}
            <span className="font-semibold" style={{ fontSize: `${0.8 * previewScale}em`, color: "var(--text-muted)" }}>ر.س</span>
          </span>
        </div>
        <div>
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>الخصم: </span>
          <span className="font-bold" style={{ fontFamily: currentNumberFamily, fontSize: `${1 * previewScale}em`, color: "var(--danger)" }}>
            -{fmtNum(15, { minimumFractionDigits: 2 })}{" "}
            <span className="font-semibold" style={{ fontSize: `${0.8 * previewScale}em`, color: "var(--text-muted)" }}>%</span>
          </span>
        </div>
      </div>

      {/* Digits comparison */}
      <div className="pt-2 text-[0.8125em]" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>الأرقام: </span>
        <span className="font-bold" style={{ fontFamily: currentNumberFamily, fontSize: `${1 * previewScale}em`, color: "var(--text-primary)" }}>
          {currentNumeralStyle === "arabic"
            ? "0123456789 ← ٠١٢٣٤٥٦٧٨٩"
            : "٠١٢٣٤٥٦٧٨٩ ← 0123456789"}
        </span>
      </div>
    </div>
  );
}

function PreviewSectionLabel({ title }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
      — {title}
    </p>
  );
}
