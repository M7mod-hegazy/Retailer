import React, { useState } from "react";
import { ChevronLeft, ChevronRight, X, Check, ArrowLeft } from "lucide-react";

// Generalized page guide — same visual language as the WhatsApp/Telegram
// ChannelConnectWizard, but fully data-driven so any page can describe itself
// from a plain object in `client/src/help/pageGuides.jsx`.
//
// step shape: {
//   key,                                  // unique
//   caption,                              // main sentence under the illustration
//   icons: [{ icon: LucideIcon, label }], // optional icon-flow illustration (rendered RTL with arrows)
//   points: ["...", "..."],               // optional numbered mini-steps
//   note,                                 // optional muted footnote
// }

export function GuideIconFlow({ items = [], accent = "var(--primary)" }) {
  if (!items.length) return null;
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-bg-base px-4 py-3 flex-wrap">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ArrowLeft className="h-4 w-4 shrink-0 text-text-muted animate-pulse" />}
            <div className="flex flex-col items-center gap-1">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-card"
                style={{ background: it.muted ? "var(--border-normal)" : accent }}
              >
                {Icon && <Icon className="h-5 w-5" />}
              </div>
              {it.label && (
                <span className="text-[10px] font-black text-text-secondary text-center max-w-[72px] leading-tight">
                  {it.label}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function GuidePoints({ items = [], accent = "var(--primary)" }) {
  if (!items.length) return null;
  return (
    <ol className="space-y-2 w-full">
      {items.map((point, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 rounded-xl border border-border bg-bg-surface p-2.5 animate-[fadeIn_0.4s_ease-out_both]"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
            style={{ background: accent }}
          >
            {i + 1}
          </span>
          <span className="text-[11px] font-bold text-text-secondary leading-relaxed pt-0.5">{point}</span>
        </li>
      ))}
    </ol>
  );
}

export default function IllustratedGuide({ guide, onClose }) {
  const [index, setIndex] = useState(0);
  if (!guide) return null;

  const { title, subtitle, icon: Icon, accent = "var(--primary)", steps = [] } = guide;
  const step = steps[index] || {};
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  function goNext() {
    if (isLast) { onClose?.(); return; }
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goPrev() {
    if (!isFirst) setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay p-4" onMouseDown={onClose}>
      <div
        className="relative w-full max-w-lg rounded-3xl bg-bg-surface shadow-modal overflow-hidden animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-base transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 px-6 pt-6">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-card" style={{ background: accent }}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-black text-text-primary truncate">{title}</h2>
            {subtitle && <p className="text-[11px] font-bold text-text-muted truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex justify-center gap-1.5 pt-4">
          {steps.map((s, i) => (
            <div
              key={s.key || i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === index ? 24 : 6, background: i === index ? accent : "var(--border-normal)" }}
            />
          ))}
        </div>

        <div className="p-6 min-h-[300px] max-h-[62vh] overflow-y-auto flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <GuideIconFlow items={step.icons} accent={accent} />
            {step.caption && (
              <p className="text-sm font-bold text-text-secondary text-center leading-relaxed max-w-sm">{step.caption}</p>
            )}
            <GuidePoints items={step.points} accent={accent} />
            {step.note && (
              <p className="text-[11px] font-bold text-text-muted text-center leading-relaxed max-w-sm">{step.note}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="flex items-center gap-1.5 text-sm font-bold text-text-muted hover:text-text-primary disabled:opacity-0 transition-colors"
          >
            <ChevronRight className="h-4 w-4" /> السابق
          </button>
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-black text-white shadow transition-all active:scale-95"
            style={{ background: accent }}
          >
            {isLast ? (<><Check className="h-4 w-4" /> فهمت</>) : (<>التالي <ChevronLeft className="h-4 w-4" /></>)}
          </button>
        </div>
      </div>
    </div>
  );
}
