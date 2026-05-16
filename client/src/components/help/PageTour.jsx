import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useHelpStore } from '../../stores/helpStore';
import helpContent from '../../help/helpContent';

const SPOTLIGHT_PAD = 8;
const POPUP_W       = 320;
const POPUP_H_EST   = 240;
const GAP           = 12;
const EDGE_PAD      = 16;

function resolvePlacement(rect, preferred, isRTL) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let px = preferred;
  if (preferred === 'start') px = isRTL ? 'right' : 'left';
  if (preferred === 'end')   px = isRTL ? 'left'  : 'right';

  const space = {
    bottom: vh - rect.bottom - GAP,
    top:    rect.top - GAP,
    right:  vw - rect.right - GAP,
    left:   rect.left - GAP,
  };

  const fallbacks = {
    bottom: ['bottom', 'top', 'right', 'left'],
    top:    ['top', 'bottom', 'right', 'left'],
    right:  ['right', 'left', 'bottom', 'top'],
    left:   ['left', 'right', 'bottom', 'top'],
  };

  const minSpace = (dir) =>
    (dir === 'bottom' || dir === 'top') ? POPUP_H_EST + 20 : POPUP_W + 20;

  for (const candidate of (fallbacks[px] ?? fallbacks.bottom)) {
    if (space[candidate] >= minSpace(candidate)) return candidate;
  }
  return 'bottom';
}

function buildPopupStyle(rect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  const clampX = (x) => Math.max(EDGE_PAD, Math.min(x, vw - POPUP_W - EDGE_PAD));
  const clampY = (y) => Math.max(EDGE_PAD, Math.min(y, vh - POPUP_H_EST - EDGE_PAD));

  const base = { position: 'fixed', width: POPUP_W, zIndex: 9999 };

  switch (placement) {
    case 'bottom': return { ...base, top: rect.bottom + GAP, left: clampX(cx - POPUP_W / 2) };
    case 'top':    return { ...base, bottom: vh - rect.top + GAP, left: clampX(cx - POPUP_W / 2) };
    case 'right':  return { ...base, left: rect.right + GAP, top: clampY(cy - POPUP_H_EST / 2) };
    case 'left':   return { ...base, right: vw - rect.left + GAP, top: clampY(cy - POPUP_H_EST / 2) };
    default:       return { ...base, top: rect.bottom + GAP, left: clampX(cx - POPUP_W / 2) };
  }
}

function buildCenteredStyle() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    position: 'fixed',
    width: POPUP_W,
    zIndex: 9999,
    top: vh / 2 - POPUP_H_EST / 2,
    left: vw / 2 - POPUP_W / 2,
  };
}

const ARROW_CSS = {
  bottom: 'before:absolute before:content-[\'\'] before:-top-[8px] before:left-1/2 before:-translate-x-1/2 before:border-[8px] before:border-transparent before:border-b-[color:var(--bg-elevated)]',
  top:    'before:absolute before:content-[\'\'] before:-bottom-[8px] before:left-1/2 before:-translate-x-1/2 before:border-[8px] before:border-transparent before:border-t-[color:var(--bg-elevated)]',
  right:  'before:absolute before:content-[\'\'] before:top-1/2 before:-translate-y-1/2 before:-left-[8px] before:border-[8px] before:border-transparent before:border-r-[color:var(--bg-elevated)]',
  left:   'before:absolute before:content-[\'\'] before:top-1/2 before:-translate-y-1/2 before:-right-[8px] before:border-[8px] before:border-transparent before:border-l-[color:var(--bg-elevated)]',
};

// ─── Topic Picker ─────────────────────────────────────────────────────────────
function TopicPicker({ pageKey, onSelect, onClose }) {
  const pageConfig = helpContent[pageKey];
  if (!pageConfig) return null;
  const steps = pageConfig.steps ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Picker card */}
      <div
        dir="rtl"
        className="fixed z-[9999] rounded-2xl overflow-hidden"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 360,
          maxHeight: '80vh',
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modalEnter 250ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-normal)' }}
        >
          <div>
            <p className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>
              اختر موضوع المساعدة
            </p>
            <h3 className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {pageConfig.title_ar}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        </div>

        {/* Step list */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 130px)' }}>
          {steps.map((step, i) => (
            <button
              key={step.id}
              onClick={() => onSelect(i)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-right transition-all border-b"
              style={{ borderColor: 'var(--border-subtle)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                {i + 1}
              </span>
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                {step.title_ar}
              </span>
            </button>
          ))}
        </div>

        {/* Full tour button */}
        <div className="p-4" style={{ borderTop: '1px solid var(--border-normal)' }}>
          <button
            onClick={() => onSelect(0)}
            className="w-full h-10 rounded-xl text-xs font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
              boxShadow: 'var(--shadow-glow)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
          >
            ابدأ الجولة كاملةً من البداية
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main PageTour ─────────────────────────────────────────────────────────────
export function PageTour() {
  const isRTL = document.documentElement.dir === 'rtl';

  const {
    isTourVisible,
    isPickerVisible,
    activeTourPageKey,
    activeTourStepIndex,
    nextTourStep,
    prevTourStep,
    completeTour,
    disableAllTours,
    startTourAtStep,
    closePicker,
  } = useHelpStore();

  const [popupStyle,     setPopupStyle]     = useState({});
  const [spotlightStyle, setSpotlightStyle] = useState(null);
  const [resolvedDir,    setResolvedDir]    = useState('bottom');
  const [isCentered,     setIsCentered]     = useState(false);
  const popupRef = useRef(null);

  const pageConfig  = helpContent[activeTourPageKey];
  const steps       = pageConfig?.steps ?? [];
  const currentStep = steps[activeTourStepIndex];
  const isLast      = activeTourStepIndex === steps.length - 1;
  const highlightType = currentStep?.highlight_type ?? 'spotlight';

  const recalculate = useCallback(() => {
    if (!isTourVisible || !currentStep) return;

    const el = currentStep.target
      ? document.querySelector(`[data-help="${currentStep.target}"]`)
      : null;

    if (!el) {
      setSpotlightStyle(null);
      setIsCentered(true);
      setPopupStyle(buildCenteredStyle());
      return;
    }

    setIsCentered(false);
    const rect = el.getBoundingClientRect();

    setSpotlightStyle({
      top:    rect.top    - SPOTLIGHT_PAD,
      left:   rect.left   - SPOTLIGHT_PAD,
      width:  rect.width  + SPOTLIGHT_PAD * 2,
      height: rect.height + SPOTLIGHT_PAD * 2,
    });

    const dir = resolvePlacement(rect, currentStep.placement ?? 'bottom', isRTL);
    setResolvedDir(dir);
    setPopupStyle(buildPopupStyle(rect, dir));

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [isTourVisible, currentStep, isRTL]);

  useEffect(() => {
    recalculate();
    window.addEventListener('resize', recalculate);
    window.addEventListener('scroll', recalculate, true);
    return () => {
      window.removeEventListener('resize', recalculate);
      window.removeEventListener('scroll', recalculate, true);
    };
  }, [recalculate]);

  // Show picker
  if (isPickerVisible && activeTourPageKey) {
    return (
      <TopicPicker
        pageKey={activeTourPageKey}
        onSelect={(stepIndex) => startTourAtStep(stepIndex)}
        onClose={closePicker}
      />
    );
  }

  if (!isTourVisible || !pageConfig || !currentStep) return null;

  const spotlightBoxShadow =
    highlightType === 'glow'
      ? '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px var(--primary), 0 0 24px var(--primary)'
      : '0 0 0 9999px rgba(0,0,0,0.6)';

  const spotlightBorder =
    highlightType === 'glow' ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.6)';

  return (
    <>
      {/* Full-screen dim */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{ background: isCentered ? 'rgba(0,0,0,0.5)' : 'transparent' }}
        onClick={completeTour}
      />

      {/* Spotlight cutout (only when target found) */}
      {spotlightStyle && (
        <div
          className="fixed z-[9991] rounded-lg pointer-events-none transition-all duration-300 ease-out"
          style={{
            ...spotlightStyle,
            boxShadow: spotlightBoxShadow,
            border: spotlightBorder,
          }}
        />
      )}

      {/* Tour popup card */}
      <div
        ref={popupRef}
        dir="rtl"
        className={`
          relative z-[9999] rounded-2xl p-5 text-text-primary
          border border-border-normal
          ${!isCentered ? (ARROW_CSS[resolvedDir] ?? '') : ''}
        `}
        style={{
          ...popupStyle,
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modalEnter 250ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Step counter + topic picker trigger + close */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              // Go back to picker to switch topic
              useHelpStore.setState({ isTourVisible: false, isPickerVisible: true, activeTourStepIndex: 0 });
            }}
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-overlay)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="تغيير الموضوع"
          >
            <span>{activeTourStepIndex + 1} / {steps.length}</span>
            <span style={{ fontSize: 9 }}>▾</span>
          </button>
          <button
            onClick={completeTour}
            className="w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-3">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => useHelpStore.setState({ activeTourStepIndex: i })}
              className="h-1.5 rounded-full transition-all duration-200 cursor-pointer"
              style={{
                width: i === activeTourStepIndex ? '16px' : '6px',
                background: i === activeTourStepIndex ? 'var(--primary)' : 'var(--border-strong)',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
          {currentStep.title_ar}
        </h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          {currentStep.body_ar}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={disableAllTours}
            className="text-xs underline transition-colors duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            لا تعرض مجدداً
          </button>

          <div className="flex gap-2">
            {activeTourStepIndex > 0 && (
              <button
                onClick={prevTourStep}
                className="px-3 py-1.5 text-xs rounded-lg border transition-all duration-150"
                style={{
                  border: '1px solid var(--border-normal)',
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                السابق →
              </button>
            )}
            <button
              onClick={() => nextTourStep(steps.length)}
              className="px-4 py-1.5 text-xs rounded-lg font-medium transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
                color: '#fff',
                boxShadow: 'var(--shadow-glow)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
            >
              {isLast ? 'انتهى ✓' : '← التالي'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
