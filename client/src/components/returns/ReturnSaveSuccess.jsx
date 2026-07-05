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

function RefundBadge({ label, amount, variant }) {
  const styles = {
    cash: { bg: '#f0fdf4', border: '#86efac', text: '#166534', dot: '#10b981' },
    credit: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', dot: '#f59e0b' },
    account: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', dot: '#f59e0b' },
    bank: { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8', dot: '#3b82f6' },
  };
  const s = styles[variant] || styles.cash;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 10, padding: '5px 12px',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      <span style={{ color: s.text, fontWeight: 800, fontSize: 12 }}>{label}</span>
      {amount > 0 && (
        <span style={{ color: s.text, opacity: 0.75, fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>
          {fmt(amount)} ج.م
        </span>
      )}
    </div>
  );
}

export function ReturnSaveSuccess({
  docNo, total, discount = 0, increase = 0,
  refundMethod, cashAmount, creditAmount,
  payments = [],
  entityName, entityNewBalance,
  type = 'sales_return',
  onDismiss,
}) {
  const [particles] = useState(() => buildParticles());

  useEffect(() => {
    const t = setTimeout(() => onDismiss?.(), 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const hasEntity = Boolean(entityName);
  const hasBalance = entityNewBalance !== null && entityNewBalance !== undefined;
  const isSales = type === 'sales_return';
  const entityLabel = isSales ? 'العميل' : 'المورد';

  const refundBadges = [];
  if (refundMethod === 'cash_back' || (type === 'purchase_return' && refundMethod === 'cash')) {
    refundBadges.push({ label: isSales ? 'نقداً' : 'نقداً', amount: total, variant: 'cash' });
  } else if (refundMethod === 'store_credit') {
    refundBadges.push({ label: 'رصيد حساب', amount: total, variant: 'credit' });
  } else if (refundMethod === 'account') {
    refundBadges.push({ label: 'حساب المورد', amount: total, variant: 'account' });
  } else if (refundMethod === 'split') {
    refundBadges.push({ label: isSales ? 'نقداً' : 'نقداً', amount: cashAmount, variant: 'cash' });
    if (isSales) {
      refundBadges.push({ label: 'رصيد حساب', amount: creditAmount, variant: 'credit' });
    } else {
      refundBadges.push({ label: 'حساب المورد', amount: creditAmount, variant: 'account' });
    }
  } else if (refundMethod === 'multi') {
    payments.forEach(p => {
      if (p.method === 'cash') {
        refundBadges.push({ label: 'نقداً', amount: p.amount, variant: 'cash' });
      } else if (p.method === 'credit') {
        refundBadges.push({ label: isSales ? 'رصيد حساب' : 'حساب المورد', amount: p.amount, variant: isSales ? 'credit' : 'account' });
      } else {
        refundBadges.push({ label: p.method_name || p.method || 'أخرى', amount: p.amount, variant: 'bank' });
      }
    });
  }

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
              fill="none" stroke="#e8faf4" strokeWidth="33"
              style={{ animation: 'fillCircleBg 300ms ease-out forwards' }}
            />
            <circle cx="38" cy="38" r="33"
              fill="none" stroke="#10B981" strokeWidth="3"
              strokeDasharray="207" strokeDashoffset="207"
              style={{ animation: 'drawCircle 550ms ease-out forwards' }}
            />
            <path d="M23 38 L33 50 L53 28"
              fill="none" stroke="#10B981" strokeWidth="4"
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
          تم حفظ المرتجع بنجاح!
        </p>

        {/* Document number */}
        <div style={{
          marginTop: 6,
          background: 'var(--bg-input)', borderRadius: 8,
          padding: '3px 10px',
          fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)',
          letterSpacing: '0.5px',
        }}>
          {docNo}
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: 1, background: 'var(--bg-input)', margin: '16px 0 14px' }} />

        {/* Entity row */}
        {hasEntity && (
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
                {entityName[0]}
              </div>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-accent)' }}>{entityName}</span>
            </div>
            {hasBalance && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--info-text)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {entityLabel === 'العميل' ? 'رصيد العميل' : 'رصيد المورد'}
                </span>
                <span style={{
                  fontFamily: 'monospace', fontWeight: 900, fontSize: 12,
                  color: entityNewBalance > 0 ? 'var(--warning-text)' : 'var(--text-accent)',
                }}>
                  {fmt(entityNewBalance)} ج.م
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
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
            {isSales ? 'المبلغ المُعاد للعميل' : 'المبلغ المُعاد للمورد'}
          </div>
          <div style={{
            fontFamily: 'monospace', fontWeight: 900, fontSize: 28,
            color: 'var(--text-primary)', letterSpacing: '-1px',
            textShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
            {fmt(total)}
          </div>
          {(Number(discount) > 0 || Number(increase) > 0) && (
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: 'var(--text-secondary)' }}>
              {Number(discount) > 0 && <span style={{ color: 'var(--danger)' }}>خصم −{fmt(discount)} </span>}
              {Number(increase) > 0 && <span style={{ color: 'var(--text-accent)' }}>زيادة +{fmt(increase)}</span>}
            </div>
          )}
        </div>

        {/* Refund method badges */}
        {refundBadges.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
            marginTop: 10,
            animation: 'slideUp 300ms ease-out 340ms backwards',
          }}>
            {refundBadges.map((b, i) => <RefundBadge key={i} {...b} />)}
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
