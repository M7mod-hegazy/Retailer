/**
 * PageTour.jsx — Smart Help Tour Component
 * Spec Part B.3 + B.4: Positioned popup with collision detection,
 * RTL-aware start/end placement, directional arrow, glow/spotlight highlights
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useHelpStore } from '../../stores/helpStore';
import { helpContent }  from '../../help/helpContent';
import { useTranslation } from 'react-i18next';

const SPOTLIGHT_PAD = 8;
const POPUP_W       = 320;
const POPUP_H_EST   = 240;
const GAP           = 12;
const EDGE_PAD      = 16;

/** Returns resolved placement after collision checks */
function resolveplacement(rect, preferred, isRTL) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Normalise logical directions to physical
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
  return 'bottom'; // last resort
}

/** Build fixed CSS position for popup */
function buildPopupStyle(rect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  const clampX = (x) => Math.max(EDGE_PAD, Math.min(x, vw - POPUP_W - EDGE_PAD));
  const clampY = (y) => Math.max(EDGE_PAD, Math.min(y, vh - POPUP_H_EST - EDGE_PAD));

  const base = { position: 'fixed', width: POPUP_W, zIndex: 9999 };

  switch (placement) {
    case 'bottom':
      return { ...base, top: rect.bottom + GAP, left: clampX(cx - POPUP_W / 2) };
    case 'top':
      return { ...base, bottom: vh - rect.top + GAP, left: clampX(cx - POPUP_W / 2) };
    case 'right':
      return { ...base, left: rect.right + GAP, top: clampY(cy - POPUP_H_EST / 2) };
    case 'left':
      return { ...base, right: vw - rect.left + GAP, top: clampY(cy - POPUP_H_EST / 2) };
    default:
      return { ...base, top: rect.bottom + GAP, left: clampX(cx - POPUP_W / 2) };
  }
}

/** Arrow direction map: popup side that points at the target */
const ARROW_CSS = {
  // popup is below → arrow points up (from popup top)
  bottom: 'before:absolute before:content-[\'\'] before:-top-[8px] before:left-1/2 before:-translate-x-1/2 before:border-[8px] before:border-transparent before:border-b-[color:var(--bg-elevated)]',
  // popup is above → arrow points down
  top:    'before:absolute before:content-[\'\'] before:-bottom-[8px] before:left-1/2 before:-translate-x-1/2 before:border-[8px] before:border-transparent before:border-t-[color:var(--bg-elevated)]',
  // popup is to the right → arrow points left
  right:  'before:absolute before:content-[\'\'] before:top-1/2 before:-translate-y-1/2 before:-left-[8px] before:border-[8px] before:border-transparent before:border-r-[color:var(--bg-elevated)]',
  // popup is to the left → arrow points right
  left:   'before:absolute before:content-[\'\'] before:top-1/2 before:-translate-y-1/2 before:-right-[8px] before:border-[8px] before:border-transparent before:border-l-[color:var(--bg-elevated)]',
};

export function PageTour() {
  const { i18n } = useTranslation();
  const lang  = i18n.language === 'ar' ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const {
    isTourVisible,
    activeTourPageKey,
    activeTourStepIndex,
    nextTourStep,
    prevTourStep,
    completeTour,
    disableAllTours,
  } = useHelpStore();

  const [popupStyle,     setPopupStyle]     = useState({});
  const [spotlightStyle, setSpotlightStyle] = useState({});
  const [resolvedDir,    setResolvedDir]    = useState('bottom');
  const popupRef = useRef(null);

  const pageConfig   = helpContent[activeTourPageKey];
  const steps        = pageConfig?.steps ?? [];
  const currentStep  = steps[activeTourStepIndex];
  const isLast       = activeTourStepIndex === steps.length - 1;
  const highlightType = currentStep?.highlight_type ?? 'spotlight';

  const recalculate = useCallback(() => {
    if (!isTourVisible || !currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();

    // Spotlight box
    setSpotlightStyle({
      top:    rect.top    - SPOTLIGHT_PAD,
      left:   rect.left   - SPOTLIGHT_PAD,
      width:  rect.width  + SPOTLIGHT_PAD * 2,
      height: rect.height + SPOTLIGHT_PAD * 2,
    });

    const dir = resolveplacement(rect, currentStep.placement ?? 'bottom', isRTL);
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

  if (!isTourVisible || !pageConfig || !currentStep) return null;

  /* Spotlight visual */
  const spotlightBoxShadow =
    highlightType === 'glow'
      ? '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px var(--primary), 0 0 24px var(--primary)'
      : '0 0 0 9999px rgba(0,0,0,0.6)';

  const spotlightBorder =
    highlightType === 'glow'      ? '2px solid var(--primary)'
    : highlightType === 'underline' ? '0 0 0 0'
    : '2px solid rgba(255,255,255,0.6)';

  return (
    <>
      {/* Full-screen dim (click to close) */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{ background: 'transparent' }}
        onClick={completeTour}
      />

      {/* Spotlight cutout */}
      <div
        className="fixed z-[9991] rounded-lg pointer-events-none transition-all duration-300 ease-out"
        style={{
          ...spotlightStyle,
          boxShadow: spotlightBoxShadow,
          border: spotlightBorder,
        }}
      />

      {/* Tour popup card */}
      <div
        ref={popupRef}
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`
          relative z-[9999] rounded-2xl p-5 text-text-primary
          border border-border-normal
          ${ARROW_CSS[resolvedDir] ?? ''}
        `}
        style={{
          ...popupStyle,
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modalEnter 250ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Step counter + close */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {activeTourStepIndex + 1} / {steps.length}
          </span>
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
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: i === activeTourStepIndex ? '16px' : '6px',
                background: i === activeTourStepIndex ? 'var(--primary)' : 'var(--border-strong)',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
          {currentStep[`title_${lang}`]}
        </h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
          {currentStep[`body_${lang}`]}
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
            {lang === 'ar' ? 'لا تعرض مجدداً' : "Don't show again"}
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
                {lang === 'ar' ? '← السابق' : '← Back'}
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
              {isLast
                ? (lang === 'ar' ? 'انتهى ✓' : 'Done ✓')
                : (lang === 'ar' ? 'التالي →' : 'Next →')
              }
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
