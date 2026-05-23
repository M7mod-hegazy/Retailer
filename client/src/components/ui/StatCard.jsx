/**
 * StatCard.jsx - Clean KPI Card
 * Modern design with left accent bar and clean typography
 */
import React, { useEffect, useRef, useState } from 'react';

function useCountUp(target, duration = 600) {
  const [current, setCurrent] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === 0 || target == null) {
      setCurrent(0);
      return;
    }
    const numTarget = parseFloat(target) || 0;
    const start = performance.now();
    startRef.current = start;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(numTarget * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

export function StatCard({
  label,
  value,
  formatted,
  meta,
  trendDir,
  icon: Icon,
  accentColor,
  index = 0,
}) {
  const [animated, setAnimated] = useState(false);
  const numValue = parseFloat(value) || 0;
  const countedValue = useCountUp(animated ? numValue : 0, 600);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60 + index * 80);
    return () => clearTimeout(t);
  }, [index]);

  const displayValue = formatted ?? (
    numValue % 1 === 0
      ? Math.round(countedValue).toLocaleString('en-US')
      : countedValue.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
  );

  return (
    <div
      className="kpi-card"
      style={{
        opacity: animated ? 1 : 0,
        transform: animated ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 300ms ease, transform 300ms ease, box-shadow 120ms ease, border-color 120ms ease`,
        transitionDelay: `${60 + index * 80}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="kpi-card__label">{label}</p>
          <p className="kpi-card__value number">{displayValue}</p>
          {meta && (
            <p className="kpi-card__meta">{meta}</p>
          )}
        </div>
        {Icon && (
          <div className="kpi-card__icon">
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;