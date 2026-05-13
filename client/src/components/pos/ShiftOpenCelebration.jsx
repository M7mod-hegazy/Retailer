/**
 * ShiftOpenCelebration.jsx — Grand shift-open animation
 * Spec Part C: Animated SVG clock + text burst, auto-dismisses after 2.4s
 */
import React, { useEffect } from 'react';

/**
 * @param {object}   props
 * @param {string}   props.shiftNumber   - e.g. "SHIFT-001"
 * @param {string}   props.cashier       - Cashier name
 * @param {Function} [props.onDismiss]   - Called after auto-dismiss
 */
export function ShiftOpenCelebration({ shiftNumber, cashier, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss?.(), 2400);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="animate-fade-in"
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5,150,105,0.06)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {/* Animated clock */}
        <div style={{ width: 128, height: 128, margin: '0 auto 24px', position: 'relative' }}>
          <svg viewBox="0 0 100 100" width="128" height="128">
            {/* Outer ring (faint) */}
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(5,150,105,0.2)" strokeWidth="2" />
            {/* Animated ring draw */}
            <circle
              cx="50" cy="50" r="42"
              fill="none" stroke="#059669" strokeWidth="2"
              strokeDasharray="264" strokeDashoffset="264"
              style={{ animation: 'drawCircle 800ms ease-out forwards' }}
            />
            {/* Hour hand */}
            <line
              x1="50" y1="50" x2="50" y2="28"
              stroke="#059669" strokeWidth="3" strokeLinecap="round"
              style={{
                transformOrigin: '50px 50px',
                animation: 'spinHour 1200ms ease-out forwards',
              }}
            />
            {/* Minute hand */}
            <line
              x1="50" y1="50" x2="50" y2="20"
              stroke="#34D399" strokeWidth="2" strokeLinecap="round"
              style={{
                transformOrigin: '50px 50px',
                animation: 'spinMinute 1200ms ease-out forwards',
              }}
            />
            {/* Center dot */}
            <circle cx="50" cy="50" r="3" fill="#059669" />
          </svg>
        </div>

        {/* Text burst */}
        <p
          className="animate-slide-up"
          style={{
            color: 'var(--primary)',
            fontWeight: 700,
            fontSize: '22px',
            animationDelay: '800ms',
            animationFillMode: 'both',
          }}
        >
          وردية مفتوحة ✓
        </p>
        <p
          className="animate-slide-up"
          style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            marginTop: '6px',
            animationDelay: '950ms',
            animationFillMode: 'both',
          }}
        >
          {shiftNumber} | {cashier}
        </p>
      </div>
    </div>
  );
}
