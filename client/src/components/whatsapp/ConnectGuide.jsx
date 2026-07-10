import React from "react";
import { useTranslation } from "react-i18next";
import { Smartphone, Monitor, QrCode, ArrowLeftRight } from "lucide-react";

// Shared, theme-aware, RTL step-by-step connect guide for the WhatsApp and
// Telegram channels. Coded illustrations (no bundled binaries) so it stays
// offline-safe, translatable, and consistent with the app theme.
//
// Steps are read from i18n pipe-separated keys:
//   whatsapp.steps / telegram.steps
export default function ConnectGuide({ channel = "whatsapp" }) {
  const { t } = useTranslation();
  const steps = t(`${channel}.steps`).split("|").filter(Boolean);
  const accent = channel === "telegram" ? "text-primary" : "text-success-text";
  const accentBg = channel === "telegram" ? "bg-primary" : "bg-success-text";

  return (
    <div className="space-y-4">
      {/* Phone ⇄ desktop cue: scan from the phone while the POS stays on screen */}
      <div className="flex items-center justify-center gap-3 rounded-xl bg-bg-base py-3">
        <div className="flex flex-col items-center gap-1">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${accentBg}`}>
            <Smartphone className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-black text-text-secondary">{t("guide.phoneLabel")}</span>
        </div>
        <div className="flex flex-col items-center">
          <QrCode className={`h-5 w-5 ${accent}`} />
          <ArrowLeftRight className="h-4 w-4 text-text-muted animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-surface border border-border-normal text-text-secondary">
            <Monitor className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-black text-text-secondary">{t("guide.desktopLabel")}</span>
        </div>
      </div>
      <p className="text-[11px] font-bold text-text-muted text-center">{t("guide.phoneCue")}</p>

      {/* Numbered steps with a staggered fade-in */}
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 rounded-xl border border-border-normal bg-bg-surface p-3 animate-[fadeIn_0.4s_ease-out_both]"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${accentBg}`}>
              {i + 1}
            </span>
            <span className="text-[11px] font-bold text-text-secondary leading-relaxed pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
