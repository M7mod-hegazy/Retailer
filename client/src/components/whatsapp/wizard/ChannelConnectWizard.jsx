import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";

export default function ChannelConnectWizard({ onClose, icon: Icon, title, subtitle, accent = "var(--primary)", steps, forceIndex }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof forceIndex === "number" && forceIndex > index && forceIndex < steps.length) {
      setIndex(forceIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceIndex]);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const canGoNext = step.canGoNext !== false;

  function goNext() {
    if (isLast) { onClose?.(); return; }
    if (!canGoNext) return;
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goPrev() {
    if (isFirst) return;
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay p-4" onMouseDown={onClose}>
      <div className="relative w-full max-w-lg rounded-3xl bg-bg-surface shadow-modal overflow-hidden animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="إغلاق"
          className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-base transition-colors">
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
            <div key={s.key} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === index ? 24 : 6, background: i === index ? accent : "var(--border-normal)" }} />
          ))}
        </div>

        <div className="p-6 min-h-[320px] flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {step.illustration}
            <p className="text-sm font-bold text-text-secondary text-center leading-relaxed max-w-sm">{step.caption}</p>
            {step.content && <div className="w-full mt-1">{step.content}</div>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <button onClick={goPrev} disabled={isFirst}
            className="flex items-center gap-1.5 text-sm font-bold text-text-muted hover:text-text-primary disabled:opacity-0 transition-colors">
            <ChevronRight className="h-4 w-4" /> السابق
          </button>
          <button onClick={goNext} disabled={!canGoNext}
            className="flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-black text-white shadow transition-all active:scale-95 disabled:opacity-40"
            style={{ background: accent }}>
            {isLast ? (<><Check className="h-4 w-4" /> تم</>) : (<>{step.nextLabel || "التالي"} <ChevronLeft className="h-4 w-4" /></>)}
          </button>
        </div>
      </div>
    </div>
  );
}
