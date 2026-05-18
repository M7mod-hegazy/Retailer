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
export function InvoiceSaveSuccess({ invoiceNumber, total, payments, onDismiss }) {
  const [particles] = useState(() => buildParticles());

  useEffect(() => {
    const t = setTimeout(() => onDismiss?.(), 2500);
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

      <p className="text-emerald-600 font-black text-[18px] mt-4">
        تم الحفظ بنجاح!
      </p>
      <p className="text-slate-500 font-bold text-[13px] mt-1 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
        {invoiceNumber}
      </p>
      <p className="text-emerald-700 font-black text-[24px] mt-1.5 font-mono drop-shadow-sm">
        {total}
      </p>
      
      {payments && payments.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center mt-3 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
          {payments.map((p, i) => {
            const isCash = p.method === 'cash' || p.method_name?.includes('نقد');
            const colorClass = isCash ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                             : "bg-indigo-50 text-indigo-700 border-indigo-200";
            return (
              <div key={i} className={`px-3 py-1.5 rounded-lg border text-[12px] font-black flex items-center gap-1.5 shadow-sm ${colorClass}`}>
                <span>{p.method_name}</span>
                {p.amount && (
                  <span className="font-mono opacity-80 pl-1 border-l border-current">
                    {Number(p.amount).toLocaleString('ar-EG', {minimumFractionDigits: 2})} ج.م
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
