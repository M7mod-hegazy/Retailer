/**
 * PrintActionPanel.jsx — Per-invoice print mini-modal
 * Spec Part D.4: slides up, template selector, copies, preview toggle
 */
import React, { useState } from 'react';
import { Printer, Eye, X } from 'lucide-react';

const TEMPLATES = [
  { value: '80mm', label: '80mm حراري' },
  { value: '58mm', label: '58mm حراري' },
  { value: 'A5',   label: 'A5' },
  { value: 'A4',   label: 'A4 رسمي' },
];

/**
 * @param {object}    props
 * @param {boolean}   props.open          - Controlled open state
 * @param {Function}  props.onClose       - Called to close
 * @param {string}    props.invoiceNumber - Display invoice number
 * @param {Function}  props.onPrint       - Called with (template, copies)
 * @param {Function}  [props.onPreview]   - Called with (template) to open preview
 * @param {'ar'|'en'} [props.lang]
 */
export function PrintActionPanel({
  open, onClose, invoiceNumber,
  onPrint, onPreview, lang = 'ar',
}) {
  const [template, setTemplate] = useState('80mm');
  const [copies,   setCopies]   = useState(1);
  const [direct,   setDirect]   = useState(true);

  if (!open) return null;

  const handlePrint = () => {
    onPrint?.(template, copies);
    onClose?.();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
        }}
        className="animate-fade-in"
      />

      {/* Panel */}
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed',
          bottom: 0,
          insetInline: 0,
          zIndex: 9001,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-normal)',
          borderRadius: '20px 20px 0 0',
          boxShadow: 'var(--shadow-modal)',
          padding: '24px',
          maxWidth: '480px',
          margin: '0 auto',
          animation: 'sheetUp 350ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 38, height: 38, borderRadius: '10px', background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Printer size={18} />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                {lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {invoiceNumber}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Template selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            {lang === 'ar' ? 'القالب' : 'Template'}
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {TEMPLATES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTemplate(t.value)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                  border: `1px solid ${template === t.value ? 'var(--primary)' : 'var(--border-normal)'}`,
                  background: template === t.value ? 'var(--primary-50)' : 'transparent',
                  color: template === t.value ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 150ms ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Copies */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            {lang === 'ar' ? 'عدد النسخ' : 'Copies'}
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3].map((n) => (
              <button key={n} onClick={() => setCopies(n)}
                style={{
                  width: 40, height: 36, borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  border: `1px solid ${copies === n ? 'var(--primary)' : 'var(--border-normal)'}`,
                  background: copies === n ? 'var(--primary-50)' : 'transparent',
                  color: copies === n ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 150ms ease',
                }}
              >{n}</button>
            ))}
            <button onClick={() => setCopies((c) => c + 1)}
              style={{
                width: 40, height: 36, borderRadius: '8px', fontSize: '18px',
                border: '1px solid var(--border-normal)', background: 'transparent',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >+</button>
          </div>
        </div>

        {/* Direct / preview toggle */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {[
            { key: true,  label: lang === 'ar' ? 'طباعة فورية' : 'Direct Print' },
            { key: false, label: lang === 'ar' ? 'معاينة أولاً' : 'Preview First' },
          ].map(({ key, label }) => (
            <label key={String(key)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="radio" checked={direct === key} onChange={() => setDirect(key)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: '11px', borderRadius: '10px',
              border: '1px solid var(--border-normal)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            onClick={() => direct ? handlePrint() : onPreview?.(template)}
            style={{
              flex: 2, padding: '11px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
              color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: 'var(--shadow-glow)', transition: 'transform 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
          >
            {direct ? <Printer size={15} /> : <Eye size={15} />}
            {direct
              ? (lang === 'ar' ? 'طباعة' : 'Print')
              : (lang === 'ar' ? 'معاينة' : 'Preview')
            }
          </button>
        </div>

        {/* Post-print confirmation hint */}
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
          {lang === 'ar' ? 'بعد الطباعة: هل تمت بنجاح؟ اضغط إعادة الطباعة إذا لزم.' : 'After printing: Re-print if needed.'}
        </p>
      </div>
    </>
  );
}
