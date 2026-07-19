import { useState } from "react";
import { Palette, CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { COLOR_THEMES, THEME_ORDER, DEFAULT_THEME } from "../../constants/colorThemes";
import { applyColorTheme } from "../../utils/applyColorTheme";
import CustomThemeEditor from "./CustomThemeEditor";

function SwatchRow({ vars }) {
  const swatches = [
    vars["--primary"],
    vars["--primary-100"],
    vars["--primary-600"],
    vars["--success-bg"],
    vars["--warning-bg"],
    vars["--danger-bg"],
    vars["--info-bg"],
  ];
  return (
    <div className="flex gap-1" dir="ltr">
      {swatches.map((color, i) => (
        <span
          key={i}
          className="h-5 w-5 rounded-sm border border-border-normal/20 shadow-sm"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function PresetCard({ themeKey, preset, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-right transition-all ${
        isSelected
          ? "shadow-md ring-4"
          : "hover:shadow-sm active:scale-[0.98]"
      }`}
      style={{
        borderColor: isSelected ? "var(--primary)" : "var(--border-normal)",
        backgroundColor: isSelected ? "var(--accent-soft)" : "var(--bg-surface)",
        boxShadow: isSelected ? "var(--shadow-card)" : undefined,
        "--tw-ring-color": isSelected ? "var(--primary)" : undefined,
      }}
    >
      {isSelected && (
        <span
          className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
          style={{ backgroundColor: "var(--primary)", color: "#ffffff" }}
        >
          <CheckCircle2 className="h-4 w-4" />
        </span>
      )}

      <SwatchRow vars={preset.vars} />

      <div className="w-full space-y-1">
        <h4
          className="text-sm font-black leading-tight"
          style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {preset.name}
        </h4>
        <p
          className="text-[11px] font-bold leading-relaxed"
          style={{ color: isSelected ? "var(--text-secondary)" : "var(--text-muted)" }}
        >
          {preset.desc}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {preset.recommendedFor.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black"
            style={{
              backgroundColor: isSelected ? "var(--primary-100)" : "var(--bg-overlay)",
              color: isSelected ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

export default function ColorThemeTab({ settings, onChange }) {
  const currentTheme = settings.color_theme || DEFAULT_THEME;
  const [showCustomEditor, setShowCustomEditor] = useState(currentTheme === "custom");

  const handleSelectTheme = (key) => {
    onChange("color_theme", key);
    applyColorTheme({ ...settings, color_theme: key });
    if (key === "custom") {
      setShowCustomEditor(true);
    } else {
      setShowCustomEditor(false);
    }
  };

  const handleResetDefault = () => {
    const resetSettings = { ...settings, color_theme: DEFAULT_THEME, custom_theme_vars: undefined };
    onChange("color_theme", DEFAULT_THEME);
    onChange("custom_theme_vars", undefined);
    applyColorTheme(resetSettings);
    setShowCustomEditor(false);
  };

  const handleToggleCustomEditor = () => {
    if (!showCustomEditor) {
      handleSelectTheme("custom");
    } else {
      setShowCustomEditor(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
            نظام الألوان
          </h3>
          <span
            className="rounded-sm px-2 py-0.5 text-[11px] font-black tracking-wider"
            style={{ backgroundColor: "var(--bg-overlay)", color: "var(--text-muted)" }}
          >
            10 خيارات
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleCustomEditor}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-black shadow-sm transition-all active:scale-95"
            style={{
              backgroundColor: showCustomEditor ? "var(--primary)" : "var(--bg-overlay)",
              color: showCustomEditor ? "#ffffff" : "var(--text-secondary)",
              border: showCustomEditor ? "none" : "1px solid var(--border-subtle)",
            }}
          >
            <Sparkles className="h-3 w-3" />
            تخصيص
          </button>
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-black shadow-sm transition-all active:scale-95"
            style={{
              backgroundColor: "var(--bg-overlay)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <RotateCcw className="h-3 w-3" />
            إعادة افتراضي
          </button>
        </div>
      </div>
      <p className="text-[13px] font-bold leading-relaxed" style={{ color: "var(--text-muted)" }}>
        اختر نظام ألوان متكامل للواجهة — يتغير لون الأزرار، البطاقات، الأشرطة، الجداول، والتنبيهات تلقائياً.
        الألوان النصية مضبوطة لتناسب كل نمط.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {THEME_ORDER.filter((k) => k !== "custom").map((key) => (
          <PresetCard
            key={key}
            themeKey={key}
            preset={COLOR_THEMES[key]}
            isSelected={currentTheme === key}
            onSelect={() => handleSelectTheme(key)}
          />
        ))}
      </div>

      {showCustomEditor && (
        <div className="pt-4">
          <CustomThemeEditor settings={settings} onChange={onChange} />
        </div>
      )}
    </section>
  );
}
