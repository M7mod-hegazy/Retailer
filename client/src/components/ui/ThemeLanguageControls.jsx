import React from "react";
import { Globe2 } from "lucide-react";
import { useTranslation } from "react-i18next";

function OptionButton({ active, icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-[20px] border px-4 py-4 text-start transition ${
        active
          ? "glass-active shadow-[0_16px_28px_rgba(15,138,95,0.1)]"
          : "bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-normal)] hover:bg-[var(--bg-overlay)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-bold text-text-primary">{title}</span>
          <span className="block text-xs text-text-secondary">{subtitle}</span>
        </span>
      </div>
      <span
        className={`h-3 w-3 rounded-full transition ${active ? "bg-primary shadow-[0_0_0_4px_rgba(15,138,95,0.12)]" : "bg-border-normal"}`}
      />
    </button>
  );
}

export default function ThemeLanguageControls({ compact = false }) {
  const { i18n } = useTranslation();

  const setLanguage = async (lang) => {
    await i18n.changeLanguage(lang);
    window.localStorage.setItem("retailer-language", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  };

  return (
    <div className={`grid gap-4 ${compact ? "md:grid-cols-2" : "xl:grid-cols-1"}`}>
      <section className="workspace-card workspace-card--inset">
        <div className="workspace-card__header">
          <div>
            <div className="workspace-card__title flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" />
              <span>اللغة واتجاه الواجهة</span>
            </div>
            <div className="workspace-card__hint">تم اعتماد مظهر ثابت موحد للنظام. يمكنك تغيير اللغة فقط من هنا.</div>
          </div>
        </div>
        <div className="workspace-card__body grid gap-3">
          <OptionButton
            active={i18n.language === "ar"}
            icon={Globe2}
            title="العربية"
            subtitle="واجهة RTL مهيأة للعمل اليومي"
            onClick={() => setLanguage("ar")}
          />
          <OptionButton
            active={i18n.language === "en"}
            icon={Globe2}
            title="English"
            subtitle="LTR layout for bilingual teams"
            onClick={() => setLanguage("en")}
          />
        </div>
      </section>
    </div>
  );
}
