import React, { useEffect, useState } from 'react';

const COLORS = ['#10B981', '#34D399', '#059669', '#6EE7B7', '#F59E0B', '#3B82F6', '#A78BFA'];

function buildParticles(count = 28) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.cos((i / count) * Math.PI * 2) * (70 + Math.random() * 50),
    y: Math.sin((i / count) * Math.PI * 2) * (70 + Math.random() * 50),
    color: COLORS[i % COLORS.length],
    size: 4 + Math.random() * 5,
    delay: Math.random() * 300,
  }));
}

function fmt(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function PaymentBadge({ p }) {
  const isCredit = p.method === 'credit' || p.method_name?.includes('آجل');
  const isBank   = p.method === 'bank_transfer' || p.method_name?.includes('بنك');
  const style = isCredit
    ? { bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning-text)', dot: 'var(--warning)' }
    : isBank
      ? { bg: 'var(--info-bg)', border: 'var(--info-border)', text: 'var(--info-text)', dot: 'var(--info)' }
      : { bg: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: 'color-mix(in srgb, var(--primary) 25%, transparent)', text: 'var(--primary-700)', dot: 'var(--primary)' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: style.bg, border: `1px solid ${style.border}`,
      borderRadius: 10, padding: '5px 12px',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
      <span style={{ color: style.text, fontWeight: 800, fontSize: 12 }}>{p.method_name}</span>
      {p.amount > 0 && (
        <span style={{ color: style.text, opacity: 0.75, fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>
          {fmt(p.amount)} ج.م
        </span>
      )}
    </div>
  );
}

export function InvoiceSaveSuccess({
  invoiceNumber, total, payments,
  customerName, customerNewBalance,
  discount, increase,
  onDismiss,
}) {
  const [particles] = useState(() => buildParticles());

  useEffect(() => {
    const t = setTimeout(() => onDismiss?.(), 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const hasExtras    = discount > 0 || increase > 0;
  const hasCustomer  = Boolean(customerName);
  const hasBalance   = customerNewBalance !== null && customerNewBalance !== undefined;
  const hasPayments  = payments && payments.length > 0;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(8px)',
        borderRadius: 12,
        cursor: 'pointer',
        animation: 'fadeInOverlay 250ms ease-out forwards',
      }}
    >
      {/* Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 20,
          padding: '28px 24px 20px',
          width: 'min(340px, 92%)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          animation: 'cardPop 350ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Checkmark + confetti */}
        <div style={{ position: 'relative', width: 76, height: 76, marginBottom: 12 }}>
          <svg viewBox="0 0 76 76" width="76" height="76">
            <circle cx="38" cy="38" r="33"
              fill="none" stroke="color-mix(in srgb, var(--primary) 12%, transparent)" strokeWidth="33"
              style={{ animation: 'fillCircleBg 300ms ease-out forwards' }}
            />
            <circle cx="38" cy="38" r="33"
              fill="none" stroke="var(--primary)" strokeWidth="3"
              strokeDasharray="207" strokeDashoffset="207"
              style={{ animation: 'drawCircle 550ms ease-out forwards' }}
            />
            <path d="M23 38 L33 50 L53 28"
              fill="none" stroke="var(--primary)" strokeWidth="4"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="48" strokeDashoffset="48"
              style={{ animation: 'drawCheck 380ms ease-out 480ms forwards' }}
            />
          </svg>
          {particles.map(p => (
            <div key={p.id} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: p.size, height: p.size,
              marginTop: -p.size / 2, marginLeft: -p.size / 2,
              background: p.color, borderRadius: 2,
              animation: `confettiBurst 950ms ease-out ${p.delay}ms forwards`,
              '--tx': `${p.x}px`, '--ty': `${p.y}px`,
            }} />
          ))}
        </div>

        {/* Title */}
        <p style={{ color: 'var(--text-accent)', fontWeight: 900, fontSize: 17, margin: 0, letterSpacing: '-0.3px' }}>
          تم الحفظ بنجاح!
        </p>

        {/* Invoice number */}
        <div style={{
          marginTop: 6,
          background: 'var(--bg-input)', borderRadius: 8,
          padding: '3px 10px',
          fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)',
          letterSpacing: '0.5px',
        }}>
          {invoiceNumber}
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: 1, background: 'var(--bg-input)', margin: '16px 0 14px' }} />

        {/* Customer row */}
        {hasCustomer && (
          <div style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--info-bg)', border: '1px solid var(--border-normal)',
            borderRadius: 12, padding: '8px 12px',
            marginBottom: 10,
            animation: 'slideUp 300ms ease-out 150ms backwards',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg,var(--info-text),color-mix(in srgb, var(--info-text) 80%, white))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 900, fontSize: 12, flexShrink: 0,
              }}>
                {customerName[0]}
              </div>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--info-text)' }}>{customerName}</span>
            </div>
            {hasBalance && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--info-text)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  رصيد العميل
                </span>
                <span style={{
                  fontFamily: 'monospace', fontWeight: 900, fontSize: 12,
                  color: customerNewBalance > 0 ? 'var(--warning-text)' : 'var(--text-accent)',
                }}>
                  {fmt(customerNewBalance)} ج.م
                </span>
              </div>
            )}
          </div>
        )}

        {/* Total */}
        <div style={{
          width: '100%', textAlign: 'center',
          animation: 'slideUp 300ms ease-out 200ms backwards',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>الإجمالي</div>
          <div style={{
            fontFamily: 'monospace', fontWeight: 900, fontSize: 28,
            color: 'var(--text-primary)', letterSpacing: '-1px',
            textShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
            {total}
          </div>
        </div>

        {/* Discount / Increase row */}
        {hasExtras && (
          <div style={{
            display: 'flex', gap: 8, marginTop: 10,
            animation: 'slideUp 300ms ease-out 280ms backwards',
          }}>
            {discount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                borderRadius: 10, padding: '5px 10px',
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--danger-text)' }}>خصم</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--danger-text)' }}>
                  {fmt(discount)} ج.م
                </span>
              </div>
            )}
            {increase > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
                borderRadius: 10, padding: '5px 10px',
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--warning-text)' }}>رسوم</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--warning-text)' }}>
                  {fmt(increase)} ج.م
                </span>
              </div>
            )}
          </div>
        )}

        {/* Payments row */}
        {hasPayments && (
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
            marginTop: 10,
            animation: 'slideUp 300ms ease-out 340ms backwards',
          }}>
            {payments.map((p, i) => <PaymentBadge key={i} p={p} />)}
          </div>
        )}

        {/* Tap hint */}
        <p style={{
          marginTop: 16, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
          animation: 'slideUp 300ms ease-out 450ms backwards',
        }}>
          اضغط للاستمرار
        </p>
      </div>
    </div>
  );
}
