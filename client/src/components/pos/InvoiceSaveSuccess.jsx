/**
 * InvoiceSaveSuccess.jsx — Full invoice save celebration overlay
 * Spec Part C: SVG checkmark draw + confetti burst
 * Auto-dismisses after 1.5s. Mounts inside the POS panel.
 */
import React, { useEffect, useState } from 'react';

const COLORS = ['#10B981', '#34D399', '#059669', '#6EE7B7', '#F59E0B'];

function buildParticles(count = 22) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.cos((i / count) * Math.PI * 2) * (60 + Math.random() * 40),
    y: Math.sin((i / count) * Math.PI * 2) * (60 + Math.random() * 40),
    color: COLORS[i % COLORS.length],
    size: 4 + Math.random() * 6,
    delay: Math.random() * 250,
  }));
}

/**
 * @param {object}   props
 * @param {string}   props.invoiceNumber  - e.g. "INV-000142"
 * @param {string}   props.total          - Formatted currency string
 * @param {Function} [props.onDismiss]    - Called after auto-dismiss or click
 */
export function InvoiceSaveSuccess({ invoiceNumber, total, onDismiss }) {
  const [particles] = useState(() => buildParticles());

  useEffect(() => {
    const t = setTimeout(() => onDismiss?.(), 1800);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      className="animate-fade-in"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(6px)',
        borderRadius: '12px',
        zIndex: 50,
        cursor: 'pointer',
      }}
    >
      {/* SVG checkmark + confetti */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          {/* Circle draw */}
          <circle
            cx="40" cy="40" r="36"
            fill="none" stroke="#10B981" strokeWidth="3"
            strokeDasharray="226" strokeDashoffset="226"
            style={{ animation: 'drawCircle 600ms ease-out forwards' }}
          />
          {/* Check draw */}
          <path
            d="M24 40 L35 52 L56 30"
            fill="none" stroke="#10B981" strokeWidth="4"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="50" strokeDashoffset="50"
            style={{ animation: 'drawCheck 400ms ease-out 500ms forwards' }}
          />
        </svg>

        {/* Confetti particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width:  p.size,
              height: p.size,
              marginTop:  -p.size / 2,
              marginLeft: -p.size / 2,
              backgroundColor: p.color,
              borderRadius: 2,
              animation: `confettiBurst 900ms ease-out ${p.delay}ms forwards`,
              '--tx': `${p.x}px`,
              '--ty': `${p.y}px`,
            }}
          />
        ))}
      </div>

      <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '18px', marginTop: '16px' }}>
        تم الحفظ بنجاح!
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
        {invoiceNumber}
      </p>
      <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '22px', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>
        {total}
      </p>
    </div>
  );
}
