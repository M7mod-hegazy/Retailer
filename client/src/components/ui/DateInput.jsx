/**
 * DateInput.jsx — Enhanced date input with quick-date picker
 * Spec Part G: Every date field has a ⚡ button for rapid test/workflow dates
 * Compatible with both native <input type="date"> and any controlled value
 */
import React, { useState, useRef, useEffect } from 'react';

/* ── Utility date helpers ─────────────────────────── */
const fmt = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD

const today       = () => fmt(new Date());
const yesterday   = () => { const d = new Date(); d.setDate(d.getDate() - 1); return fmt(d); };
const daysAgo     = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const startOfMonth = () => { const d = new Date(); d.setDate(1); return fmt(d); };
const endOfMonth   = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); return fmt(d); };
const startOfYear  = () => { const d = new Date(); d.setMonth(0, 1); return fmt(d); };

export const QUICK_DATES = [
  { label_ar: 'اليوم',         label_en: 'Today',         value: () => today() },
  { label_ar: 'أمس',           label_en: 'Yesterday',     value: () => yesterday() },
  { label_ar: 'بداية الشهر',  label_en: 'Start of month', value: () => startOfMonth() },
  { label_ar: 'نهاية الشهر',  label_en: 'End of month',   value: () => endOfMonth() },
  { label_ar: 'بداية السنة',  label_en: 'Start of year',  value: () => startOfYear() },
  { label_ar: 'قبل 7 أيام',   label_en: '7 days ago',     value: () => daysAgo(7) },
  { label_ar: 'قبل 30 يوم',   label_en: '30 days ago',    value: () => daysAgo(30) },
  { label_ar: 'قبل 90 يوم',   label_en: '90 days ago',    value: () => daysAgo(90) },
  { label_ar: 'قبل سنة',      label_en: '1 year ago',     value: () => daysAgo(365) },
];

/**
 * @param {object}   props
 * @param {string}   [props.value]      - Controlled value (YYYY-MM-DD)
 * @param {Function} [props.onChange]   - Called with new YYYY-MM-DD string
 * @param {string}   [props.label]      - Field label (optional)
 * @param {'ar'|'en'} [props.lang]      - Language for quick-date labels
 * @param {boolean}  [props.showQuick]  - Force show quick-date button (default: auto)
 * @param {string}   [props.className]  - Extra class for wrapper
 * @param {object}   [props.inputProps] - Extra props passed to <input>
 */
export function DateInput({
  value,
  onChange,
  label,
  lang = 'ar',
  showQuick = true,
  className = '',
  inputProps = {},
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleQuickSelect = (dateFn) => {
    onChange?.(dateFn());
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`} style={{ display: 'inline-flex', alignItems: 'stretch', gap: '4px' }}>
      {/* Label */}
      {label && (
        <label
          className="block text-xs font-medium mb-1"
          style={{ color: 'var(--text-secondary)', width: '100%' }}
        >
          {label}
        </label>
      )}

      <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch', width: '100%' }}>
        {/* Native date input */}
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          className="input flex-1"
          style={{ minWidth: 0 }}
          {...inputProps}
        />

        {/* Quick-date trigger */}
        {showQuick && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title={lang === 'ar' ? 'تواريخ سريعة' : 'Quick dates'}
            style={{
              width: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-normal)',
              background: open ? 'var(--primary-50)' : 'var(--bg-surface)',
              color: open ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!open) {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!open) {
                e.currentTarget.style.borderColor = 'var(--border-normal)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            ⚡
          </button>
        )}
      </div>

      {/* Quick dates dropdown */}
      {open && (
        <div
          className="animate-slide-down"
          style={{
            position: 'absolute',
            top: '100%',
            insetInlineStart: 0,
            marginTop: '4px',
            zIndex: 200,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-normal)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-elevated)',
            minWidth: '180px',
            overflow: 'hidden',
          }}
        >
          {QUICK_DATES.map((d) => {
            const dateVal = d.value();
            return (
              <button
                key={d.label_ar}
                type="button"
                onClick={() => handleQuickSelect(d.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'start',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  transition: 'background 100ms ease',
                  gap: '12px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-overlay)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <span>{lang === 'ar' ? d.label_ar : d.label_en}</span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {dateVal}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Date Range variant (for report filters) ───────── */
export const QUICK_PERIODS = [
  { label_ar: 'هذا الشهر',    label_en: 'This month',     from: () => startOfMonth(), to: () => today() },
  { label_ar: 'الشهر الماضي', label_en: 'Last month',
    from: () => { const d = new Date(); d.setMonth(d.getMonth() - 1, 1); return fmt(d); },
    to: () => { const d = new Date(); d.setDate(0); return fmt(d); },
  },
  { label_ar: 'هذه السنة',    label_en: 'This year',      from: () => startOfYear(), to: () => today() },
  { label_ar: 'آخر 7 أيام',  label_en: 'Last 7 days',    from: () => daysAgo(7),   to: () => today() },
  { label_ar: 'آخر 30 يوم',  label_en: 'Last 30 days',   from: () => daysAgo(30),  to: () => today() },
  { label_ar: 'آخر 90 يوم',  label_en: 'Last 90 days',   from: () => daysAgo(90),  to: () => today() },
  { label_ar: 'آخر سنة',     label_en: 'Last year',       from: () => daysAgo(365), to: () => today() },
];

/**
 * DateRangeInput — two DateInputs with quick-period shortcuts
 */
export function DateRangeInput({ from, to, onFromChange, onToChange, lang = 'ar' }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <DateInput value={from} onChange={onFromChange} lang={lang} />
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>—</span>
        <DateInput value={to}   onChange={onToChange}   lang={lang} />
      </div>

      {/* Quick period chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
        {QUICK_PERIODS.map((p) => {
          const isActive = from === p.from() && to === p.to();
          return (
            <button
              key={p.label_ar}
              type="button"
              onClick={() => { onFromChange?.(p.from()); onToChange?.(p.to()); }}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                borderRadius: '6px',
                border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-normal)'}`,
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--border-normal)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              {lang === 'ar' ? p.label_ar : p.label_en}
            </button>
          );
        })}
      </div>
    </div>
  );
}
