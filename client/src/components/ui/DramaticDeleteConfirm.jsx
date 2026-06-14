/**
 * DramaticDeleteConfirm.jsx — High-stakes delete confirmation
 * Spec Part C: Dark backdrop, pulsing danger icon, type "حذف" to unlock
 */
import React, { useState } from 'react';

/**
 * @param {object}   props
 * @param {string}   props.itemName   - Name of thing being deleted
 * @param {Function} props.onConfirm  - Called when confirmed
 * @param {Function} props.onCancel   - Called when cancelled
 * @param {'ar'|'en'} [props.lang]    - Language
 */
export function DramaticDeleteConfirm({ itemName, onConfirm, onCancel, lang = 'ar' }) {
  const [typed, setTyped]   = useState('');
  const [shaking, setShaking] = useState(false);

  const KEYWORD = lang === 'ar' ? 'حذف' : 'DELETE';
  const canConfirm = typed === KEYWORD;

  const handleConfirmClick = () => {
    if (canConfirm) {
      onConfirm?.();
    } else {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="animate-modal-enter"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '400px',
          width: '100%',
          margin: '16px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-modal)',
          animation: shaking
            ? 'shake 400ms ease-out, modalEnter 300ms cubic-bezier(0.34,1.56,0.64,1)'
            : 'modalEnter 300ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Pulsing danger icon */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'var(--danger-bg)',
            animation: 'pulse-ring 1.5s ease-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%',
            background: 'var(--danger-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '32px' }}>⚠️</span>
          </div>
        </div>

        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          {lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
        </h2>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          {lang === 'ar' ? 'سيتم حذف: ' : 'You are deleting: '}
          <strong>{itemName}</strong>
        </p>

        <p style={{ fontSize: '12px', color: 'var(--danger-text)', marginBottom: '24px' }}>
          {lang === 'ar' ? 'هذا الإجراء لا يمكن التراجع عنه' : 'This action cannot be undone.'}
        </p>

        {/* Type to confirm */}
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {lang === 'ar'
            ? <>اكتب "<strong style={{ color: 'var(--danger-text)' }}>{KEYWORD}</strong>" للتأكيد:</>
            : <>Type "<strong style={{ color: 'var(--danger-text)' }}>{KEYWORD}</strong>" to confirm:</>
          }
        </p>

        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={KEYWORD}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          style={{
            width: '100%',
            textAlign: 'center',
            border: `2px solid ${canConfirm ? 'var(--danger-text)' : 'var(--danger-border)'}`,
            borderRadius: '10px',
            padding: '12px',
            fontSize: '16px',
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 200ms ease',
            marginBottom: '24px',
          }}
          onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px var(--danger-light)'; }}
          onBlur={(e)  => { e.target.style.boxShadow = 'none'; }}
          autoFocus
        />

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid var(--border-normal)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: '14px', cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            onClick={handleConfirmClick}
            disabled={!canConfirm}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              background: canConfirm
                ? 'linear-gradient(135deg, var(--danger), color-mix(in srgb, var(--danger) 80%, #000))'
                : 'var(--danger-bg)',
              color: canConfirm ? '#fff' : 'var(--danger-text)',
              border: 'none',
              fontSize: '14px', fontWeight: 700,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              opacity: canConfirm ? 1 : 0.6,
              boxShadow: canConfirm ? 'var(--shadow-glow-red)' : 'none',
              transition: 'all 300ms ease',
              transform: canConfirm ? '' : 'none',
            }}
            onMouseEnter={(e) => { if (canConfirm) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
          >
            {lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
