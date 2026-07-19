import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Palette, Type, Layers, Grid3X3, CheckCircle, AlertTriangle, Info, XCircle, Moon, Sun } from "lucide-react";
import { DEFAULT_THEME_VARS } from "../../constants/colorThemes";
import { applyColorTheme } from "../../utils/applyColorTheme";

const VAR_GROUPS = [
  {
    id: "primary",
    icon: Palette,
    label: "الأساسي",
    labelEn: "Primary",
    vars: [
      { key: "--primary-50", type: "color", label: "Primary 50", labelAr: "أساسي 50" },
      { key: "--primary-100", type: "color", label: "Primary 100", labelAr: "أساسي 100" },
      { key: "--primary-200", type: "color", label: "Primary 200", labelAr: "أساسي 200" },
      { key: "--primary", type: "color", label: "Primary", labelAr: "أساسي" },
      { key: "--primary-600", type: "color", label: "Primary 600", labelAr: "أساسي 600" },
      { key: "--primary-700", type: "color", label: "Primary 700", labelAr: "أساسي 700" },
      { key: "--primary-glow", type: "text", label: "Primary Glow", labelAr: "توهج أساسي" },
      { key: "--accent-soft", type: "text", label: "Accent Soft", labelAr: "خلفية مميزة ناعمة" },
      { key: "--text-accent", type: "color", label: "Text Accent", labelAr: "نص مميز" },
      { key: "--border-accent", type: "text", label: "Border Accent", labelAr: "حدود مميزة" },
    ],
  },
  {
    id: "text",
    icon: Type,
    label: "النصوص",
    labelEn: "Text",
    vars: [
      { key: "--text-primary", type: "color", label: "Text Primary", labelAr: "نص أساسي" },
      { key: "--text-secondary", type: "color", label: "Text Secondary", labelAr: "نص ثانوي" },
      { key: "--text-muted", type: "color", label: "Text Muted", labelAr: "نص باهت" },
    ],
  },
  {
    id: "backgrounds",
    icon: Layers,
    label: "الخلفيات",
    labelEn: "Backgrounds",
    vars: [
      { key: "--bg-base", type: "color", label: "Base", labelAr: "قاعدة" },
      { key: "--bg-surface", type: "color", label: "Surface", labelAr: "سطح" },
      { key: "--bg-elevated", type: "color", label: "Elevated", labelAr: "مرتفع" },
      { key: "--bg-overlay", type: "color", label: "Overlay", labelAr: "طبقة" },
      { key: "--bg-sidebar", type: "color", label: "Sidebar", labelAr: "شريط جانبي" },
      { key: "--bg-topbar", type: "text", label: "Topbar", labelAr: "شريط علوي" },
      { key: "--bg-input", type: "color", label: "Input", labelAr: "مدخل" },
      { key: "--bg-input-hover", type: "color", label: "Input Hover", labelAr: "مدخل عند التمرير" },
    ],
  },
  {
    id: "borders",
    icon: Grid3X3,
    label: "الحدود",
    labelEn: "Borders",
    vars: [
      { key: "--border-subtle", type: "color", label: "Subtle", labelAr: "ناعم" },
      { key: "--border-normal", type: "color", label: "Normal", labelAr: "عادي" },
      { key: "--border-strong", type: "color", label: "Strong", labelAr: "قوي" },
    ],
  },
  {
    id: "success",
    icon: CheckCircle,
    label: "نجاح",
    labelEn: "Success",
    vars: [
      { key: "--success-bg", type: "color", label: "Background", labelAr: "خلفية" },
      { key: "--success-text", type: "color", label: "Text", labelAr: "نص" },
      { key: "--success-border", type: "color", label: "Border", labelAr: "حدود" },
      { key: "--success-light", type: "text", label: "Light", labelAr: "ضوء" },
    ],
  },
  {
    id: "danger",
    icon: XCircle,
    label: "خطأ",
    labelEn: "Danger",
    vars: [
      { key: "--danger", type: "color", label: "Main", labelAr: "رئيسي" },
      { key: "--danger-bg", type: "color", label: "Background", labelAr: "خلفية" },
      { key: "--danger-text", type: "color", label: "Text", labelAr: "نص" },
      { key: "--danger-border", type: "color", label: "Border", labelAr: "حدود" },
      { key: "--danger-light", type: "text", label: "Light", labelAr: "ضوء" },
    ],
  },
  {
    id: "warning",
    icon: AlertTriangle,
    label: "تحذير",
    labelEn: "Warning",
    vars: [
      { key: "--warning-bg", type: "color", label: "Background", labelAr: "خلفية" },
      { key: "--warning-text", type: "color", label: "Text", labelAr: "نص" },
      { key: "--warning-border", type: "color", label: "Border", labelAr: "حدود" },
      { key: "--warning-light", type: "text", label: "Light", labelAr: "ضوء" },
    ],
  },
  {
    id: "info",
    icon: Info,
    label: "معلومات",
    labelEn: "Info",
    vars: [
      { key: "--info-bg", type: "color", label: "Background", labelAr: "خلفية" },
      { key: "--info-text", type: "color", label: "Text", labelAr: "نص" },
      { key: "--info-border", type: "color", label: "Border", labelAr: "حدود" },
      { key: "--info-light", type: "text", label: "Light", labelAr: "ضوء" },
    ],
  },
  {
    id: "shadows",
    icon: Moon,
    label: "الظلال",
    labelEn: "Shadows",
    isComplex: true,
    vars: [
      { key: "--shadow-card", type: "text", label: "Card", labelAr: "بطاقة" },
      { key: "--shadow-elevated", type: "text", label: "Elevated", labelAr: "مرتفع" },
      { key: "--shadow-modal", type: "text", label: "Modal", labelAr: "نافذة" },
      { key: "--shadow-glow-green", type: "text", label: "Glow Green", labelAr: "توهج أخضر" },
      { key: "--shadow-glow-red", type: "text", label: "Glow Red", labelAr: "توهج أحمر" },
      { key: "--shadow-glow-amber", type: "text", label: "Glow Amber", labelAr: "توهج كهرماني" },
    ],
  },
];

function isHexColor(str) {
  return /^#[0-9a-fA-F]{3,8}$/.test(str.trim());
}

function ColorInput({ varDef, value, onChange }) {
  const [isHex, setIsHex] = useState(isHexColor(value));

  useEffect(() => {
    setIsHex(isHexColor(value));
  }, [value]);

  const handleColorChange = (e) => {
    onChange(e.target.value);
  };

  const handleTextChange = (e) => {
    onChange(e.target.value);
    setIsHex(isHexColor(e.target.value));
  };

  return (
    <div className="flex items-center gap-2">
      {isHex && (
        <input
          type="color"
          value={value}
          onChange={handleColorChange}
          className="h-9 w-9 cursor-pointer rounded border border-border-normal p-0.5"
        />
      )}
      {!isHex && (
        <span
          className="h-9 w-9 shrink-0 rounded border border-border-normal"
          style={{ backgroundColor: value }}
        />
      )}
      <input
        type="text"
        value={value}
        onChange={handleTextChange}
        className="flex-1 rounded-md border border-border-normal bg-bg-input px-2.5 py-1.5 text-[12px] font-bold text-text-primary outline-none hover:border-border-strong focus:bg-bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono shadow-sm"
        dir="ltr"
      />
    </div>
  );
}

function VarGroup({ group, vars, onVarChange }) {
  const Icon = group.icon;
  return (
    <div className="rounded-lg border border-border-normal bg-bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-border-subtle pb-2">
        <Icon className="h-4 w-4 text-text-secondary" />
        <span className="text-[12px] font-black uppercase tracking-widest text-text-primary">
          {group.label}
        </span>
        {group.id !== "shadows" && (
          <span className="text-[10px] font-bold text-text-muted">— {group.labelEn}</span>
        )}
      </div>
      <div className="space-y-2.5">
        {group.vars.map((varDef) => (
          <div key={varDef.key} className="flex items-center gap-3">
            <label className="w-28 shrink-0 text-[11px] font-bold text-text-secondary">
              {varDef.labelAr}
            </label>
            <div className="flex-1">
              <ColorInput
                varDef={varDef}
                value={vars[varDef.key] || ""}
                onChange={(newVal) => onVarChange(varDef.key, newVal)}
              />
            </div>
            <code className="hidden w-36 text-[10px] text-text-muted font-mono truncate lg:block" dir="ltr">
              {varDef.key}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomThemeEditor({ settings, onChange }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  const initialVars = () => {
    if (settings.custom_theme_vars) {
      try {
        return { ...DEFAULT_THEME_VARS, ...JSON.parse(settings.custom_theme_vars) };
      } catch {
        return { ...DEFAULT_THEME_VARS };
      }
    }
    return { ...DEFAULT_THEME_VARS };
  };

  const [vars, setVars] = useState(initialVars);

  useEffect(() => {
    setVars(initialVars());
  }, [settings.custom_theme_vars]);

  const handleVarChange = useCallback((key, value) => {
    setVars((prev) => {
      const next = { ...prev, [key]: value };
      const json = JSON.stringify(next);
      onChange("custom_theme_vars", json);
      applyColorTheme({
        ...settings,
        color_theme: "custom",
        custom_theme_vars: json,
      });
      return next;
    });
  }, [onChange, settings]);

  const handleReset = useCallback(() => {
    const json = JSON.stringify(DEFAULT_THEME_VARS);
    setVars({ ...DEFAULT_THEME_VARS });
    onChange("custom_theme_vars", json);
    onChange("color_theme", "custom");
    applyColorTheme({
      ...settings,
      color_theme: "custom",
      custom_theme_vars: json,
    });
  }, [onChange, settings]);

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-600" />
          <div>
            <p className="text-[13px] font-black text-amber-800">
              {isRTL ? "نظام ألوان مخصص" : "Custom Theme"}
            </p>
            <p className="text-[11px] font-bold text-amber-600">
              {isRTL
                ? "عدّل كل لون حسب رغبتك — التغييرات تظهر فوراً"
                : "Tweak every color to your liking — changes apply instantly"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded bg-bg-surface px-3 py-1.5 text-[11px] font-black text-text-secondary shadow-sm border border-border-normal transition-all hover:bg-bg-overlay active:scale-95"
        >
          <RotateCcw className="h-3 w-3" />
          {isRTL ? "إعادة ضبط" : "Reset"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {VAR_GROUPS.map((group) => (
          <VarGroup
            key={group.id}
            group={group}
            vars={vars}
            onVarChange={handleVarChange}
          />
        ))}
      </div>
    </div>
  );
}
