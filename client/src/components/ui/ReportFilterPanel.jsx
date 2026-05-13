/**
 * ReportFilterPanel.jsx — Universal collapsible filter panel
 * Spec Part J.3: collapsed by default on re-open, shows active filter count,
 * animated expand, quick period chips, date range inputs
 */
import React, { useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { DateRangeInput } from '../ui/DateInput';

/** Count how many filter values are non-empty/non-default */
function countActive(filters) {
  return Object.values(filters).filter(v =>
    v !== '' && v !== null && v !== undefined && v !== false
  ).length;
}

/**
 * Generic filter field renderer
 * @param {object} field - { key, label, type: 'text'|'select'|'number', options }
 */
function FilterField({ field, value, onChange, lang }) {
  const inputStyle = {
    width: '100%', padding: '8px 10px',
    border: '1px solid var(--border-normal)',
    borderRadius: '8px',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border-color 150ms ease',
  };

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 500,
    color: 'var(--text-secondary)', marginBottom: '4px',
  };

  if (field.type === 'select') {
    return (
      <div>
        <label style={labelStyle}>{lang === 'ar' ? field.label_ar : field.label_en}</label>
        <select value={value || ''} onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border-normal)'; }}
        >
          <option value="">{lang === 'ar' ? 'الكل' : 'All'}</option>
          {field.options?.map(o => (
            <option key={o.value} value={o.value}>{lang === 'ar' ? o.label_ar : o.label_en}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label style={labelStyle}>{lang === 'ar' ? field.label_ar : field.label_en}</label>
      <input
        type={field.type ?? 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={lang === 'ar' ? field.placeholder_ar : field.placeholder_en}
        style={inputStyle}
        onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; }}
        onBlur={(e)  => { e.target.style.borderColor = 'var(--border-normal)'; }}
      />
    </div>
  );
}

/**
 * @param {object}   props
 * @param {object[]} props.config          - Field definitions [{key, label_ar, label_en, type, options}]
 * @param {object}   props.filters         - Current filter values
 * @param {Function} props.onChange        - (key, value) => void
 * @param {Function} props.onApply         - Called when "تطبيق" clicked
 * @param {Function} props.onReset         - Called when "إعادة تعيين" clicked
 * @param {'ar'|'en'} [props.lang]
 * @param {boolean}  [props.defaultOpen]   - Initial open state
 */
export function ReportFilterPanel({
  config = [],
  filters = {},
  onChange,
  onApply,
  onReset,
  lang = 'ar',
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const activeCount = countActive(filters);

  const handleFromChange = useCallback((v) => onChange?.('from', v), [onChange]);
  const handleToChange   = useCallback((v) => onChange?.('to',   v), [onChange]);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      marginBottom: '16px',
      overflow: 'hidden',
    }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '14px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'start',
        }}
      >
        <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lang === 'ar' ? 'الفلاتر' : 'Filters'}
          {!open && activeCount > 0 && (
            <span style={{
              padding: '1px 7px', borderRadius: '999px',
              background: 'var(--primary-50)', color: 'var(--primary)',
              fontSize: '11px', fontWeight: 600,
            }}>
              {activeCount} {lang === 'ar' ? 'نشط' : 'active'}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 250ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Animated body */}
      <div style={{
        maxHeight: open ? '600px' : '0px',
        opacity: open ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 300ms ease, opacity 250ms ease',
      }}>
        <div style={{ padding: '0 16px 16px' }}>
          {/* Date range — always shown */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {lang === 'ar' ? 'الفترة الزمنية' : 'Date Range'}
            </label>
            <DateRangeInput
              from={filters.from}
              to={filters.to}
              onFromChange={handleFromChange}
              onToChange={handleToChange}
              lang={lang}
            />
          </div>

          {/* Dynamic fields */}
          {config.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '10px',
              marginBottom: '12px',
            }}>
              {config.map(field => (
                <FilterField
                  key={field.key}
                  field={field}
                  value={filters[field.key]}
                  onChange={(v) => onChange?.(field.key, v)}
                  lang={lang}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={onApply}
              style={{
                padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
                color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: 'var(--shadow-glow)', transition: 'transform 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
            >
              {lang === 'ar' ? 'تطبيق الفلاتر' : 'Apply Filters'}
            </button>
            <button
              onClick={onReset}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                border: '1px solid var(--border-normal)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
