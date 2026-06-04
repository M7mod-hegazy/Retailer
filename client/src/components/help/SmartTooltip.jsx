import React, { useRef, useState, useEffect } from 'react';
import { useHelpStore } from '../../stores/helpStore';
import helpContent from '../../help/helpContent';

export function SmartTooltip({ pageKey, tooltipKey, className = '' }) {
  const isRTL = document.documentElement.dir === 'rtl';

  const { tooltipsDisabledGlobally, activeTooltipKey, openTooltip, closeTooltip } = useHelpStore();
  const iconRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({});

  const globalKey = `${pageKey}__${tooltipKey}`;
  const isOpen = activeTooltipKey === globalKey;
  const text = helpContent[pageKey]?.tooltips?.[tooltipKey]?.ar;

  useEffect(() => {
    if (!isOpen || !iconRef.current) return;

    const rect = iconRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const TIP_W = 280;

    let left = isRTL ? rect.left - TIP_W + rect.width : rect.left;
    left = Math.max(8, Math.min(left, vw - TIP_W - 8));

    setTooltipStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      width: TIP_W,
      zIndex: 9950,
    });
  }, [isOpen, isRTL]);

  if (tooltipsDisabledGlobally || !text) return null;

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        ref={iconRef}
        type="button"
        onClick={() => isOpen ? closeTooltip() : openTooltip(globalKey)}
        onMouseLeave={() => closeTooltip()}
        className="mx-1 flex h-4 w-4 items-center justify-center rounded-full bg-info/15 text-[11px] font-bold leading-none text-info-DEFAULT transition hover:bg-info/25"
        title="مساعدة"
      >
        ?
      </button>

      {isOpen && (
        <div
          dir="rtl"
          className="glass-elevated rounded-[16px] px-3 py-2 text-xs leading-relaxed text-text-primary shadow-elevated"
          style={tooltipStyle}
          onClick={closeTooltip}
        >
          {text}
        </div>
      )}
    </span>
  );
}
