/**
 * ReportExportBar.jsx — Unified export toolbar for every report
 * Spec Part E.4: PDF / Excel / Word / Print buttons with loading + ready states
 */
import React, { useState } from 'react';

/* ── Icons (inline SVG, no extra dependency) ──────── */
const PdfIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>;
const ExcelIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>;
const WordIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
const PrintIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const ClockIcon  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const SpinnerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
    <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75"/>
  </svg>
);

const EXPORT_CONFIGS = {
  pdf: {
    label_ar: 'PDF',   label_en: 'PDF',
    icon: <PdfIcon />,
    hoverBg: 'rgba(239,68,68,0.08)',   hoverColor: '#dc2626', hoverBorder: 'rgba(220,38,38,0.4)',
  },
  excel: {
    label_ar: 'Excel', label_en: 'Excel',
    icon: <ExcelIcon />,
    hoverBg: 'rgba(22,163,74,0.08)',   hoverColor: '#16a34a', hoverBorder: 'rgba(22,163,74,0.4)',
  },
  word: {
    label_ar: 'Word',  label_en: 'Word',
    icon: <WordIcon />,
    hoverBg: 'rgba(37,99,235,0.08)',   hoverColor: '#2563eb', hoverBorder: 'rgba(37,99,235,0.4)',
  },
  print: {
    label_ar: 'طباعة', label_en: 'Print',
    icon: <PrintIcon />,
    hoverBg: 'rgba(100,116,139,0.08)', hoverColor: '#475569', hoverBorder: 'rgba(100,116,139,0.4)',
  },
};

/**
 * ExportButton — individual format button with state machine
 */
function ExportButton({ format, lang = 'ar', onExport }) {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const cfg = EXPORT_CONFIGS[format];
  if (!cfg) return null;

  const handleClick = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      await onExport?.(format);
      setStatus('ready');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const label = lang === 'ar' ? cfg.label_ar : cfg.label_en;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    border: '1px solid var(--border-normal)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: status === 'loading' ? 'wait' : 'pointer',
    transition: 'all 200ms ease',
    position: 'relative',
    overflow: 'hidden',
  };

  const stateStyle =
    status === 'ready'
      ? { background: 'var(--success-bg)', color: 'var(--success-text)', borderColor: 'var(--success-border)' }
      : status === 'error'
      ? { background: 'var(--danger-bg)', color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }
      : status === 'loading'
      ? { opacity: 0.7 }
      : {};

  return (
    <button
      onClick={handleClick}
      style={{ ...baseStyle, ...stateStyle }}
      className={status === 'ready' ? 'export-ready' : ''}
      onMouseEnter={(e) => {
        if (status === 'idle') {
          e.currentTarget.style.background    = cfg.hoverBg;
          e.currentTarget.style.color         = cfg.hoverColor;
          e.currentTarget.style.borderColor   = cfg.hoverBorder;
          e.currentTarget.style.transform     = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (status === 'idle') {
          e.currentTarget.style.background    = 'transparent';
          e.currentTarget.style.color         = 'var(--text-secondary)';
          e.currentTarget.style.borderColor   = 'var(--border-normal)';
          e.currentTarget.style.transform     = '';
        }
      }}
    >
      {status === 'loading' ? <SpinnerIcon /> : cfg.icon}
      {status === 'loading'
        ? (lang === 'ar' ? 'جاري...' : 'Loading...')
        : status === 'ready'
        ? (lang === 'ar' ? 'تحميل ✓' : 'Ready ✓')
        : status === 'error'
        ? (lang === 'ar' ? 'خطأ ✕' : 'Error ✕')
        : label
      }
    </button>
  );
}

/**
 * ReportExportBar — the full export toolbar
 *
 * @param {object}   props
 * @param {string}   [props.lang]         - 'ar' | 'en'
 * @param {string[]} [props.formats]      - Which buttons to show
 * @param {boolean}  [props.showSchedule] - Show "Schedule report" button
 * @param {Function} [props.onExport]     - async (format) => void
 * @param {Function} [props.onSchedule]   - Called when schedule button clicked
 */
export function ReportExportBar({
  lang = 'ar',
  formats = ['pdf', 'excel', 'word', 'print'],
  showSchedule = true,
  onExport,
  onSchedule,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '10px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
      }}
    >
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginInlineEnd: '4px', flexShrink: 0 }}>
        {lang === 'ar' ? 'تصدير:' : 'Export:'}
      </span>

      {formats.map((fmt) => (
        <ExportButton key={fmt} format={fmt} lang={lang} onExport={onExport} />
      ))}

      {showSchedule && (
        <button
          onClick={onSchedule}
          style={{
            marginInlineStart: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'all 150ms ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-50)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
        >
          <ClockIcon />
          {lang === 'ar' ? 'جدولة التقرير' : 'Schedule Report'}
        </button>
      )}
    </div>
  );
}

// Inline spin keyframe for spinner (fallback if not in global CSS)
if (typeof document !== 'undefined') {
  const id = '__spin_kf__';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
  }
}
