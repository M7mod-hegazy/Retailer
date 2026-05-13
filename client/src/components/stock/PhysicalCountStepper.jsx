/**
 * PhysicalCountStepper.jsx — 4-Step guided physical inventory count
 * Spec Part J.5: Step 1 Freeze → Step 2 Count → Step 3 Variances → Step 4 Post
 * Visual step indicator, freeze warning, count entry table, variance highlight
 */
import React, { useState, useMemo } from 'react';
import { CheckCircle, AlertTriangle, Lock, Play, FileText, Send } from 'lucide-react';

const STEPS = [
  { id: 1, icon: Lock,        label_ar: 'تجميد المخزون',    desc_ar: 'منع أي حركة أثناء الجرد' },
  { id: 2, icon: FileText,    label_ar: 'إدخال الكميات',    desc_ar: 'أدخل الكميات المعدودة فعلياً' },
  { id: 3, icon: AlertTriangle, label_ar: 'مراجعة الفروق', desc_ar: 'تأكيد الفروق قبل الترحيل' },
  { id: 4, icon: Send,        label_ar: 'ترحيل وإغلاق',    desc_ar: 'تطبيق التسويات وفتح المخزون' },
];

/* ── Step 1: Freeze warning ───────────────────────── */
function StepFreeze({ onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div style={{ textAlign: 'center', maxWidth: 440, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔒</div>
      <h3 style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>
        تجميد المخزون
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
        سيتم تعطيل المبيعات والمشتريات مؤقتاً أثناء الجرد
        لضمان دقة عملية الحصر. اختر التوقيت المناسب (خارج أوقات العمل يُفضَّل).
      </p>

      {/* Warning boxes */}
      <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '10px', padding: '12px', marginBottom: '20px', textAlign: 'start' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#92400E' }}>⚠️ سيتأثر بهذا الإجراء:</p>
        <ul style={{ marginTop: '6px', paddingInlineStart: '16px', fontSize: '12px', color: '#92400E', lineHeight: 1.8 }}>
          <li>نقطة البيع — ستُعرض رسالة "المخزون في الجرد"</li>
          <li>فواتير الشراء — لن تُحدِّث المخزون حتى الإغلاق</li>
          <li>تحويل المخزون — معلّق حتى نهاية الجرد</li>
        </ul>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '20px' }}>
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }} />
        أفهم ذلك، وأوافق على البدء
      </label>

      <button
        onClick={onConfirm}
        disabled={!confirmed}
        style={{
          padding: '12px 28px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
          background: confirmed ? 'linear-gradient(135deg, var(--primary), var(--primary-600))' : 'var(--border-normal)',
          color: confirmed ? '#fff' : 'var(--text-muted)',
          border: 'none', cursor: confirmed ? 'pointer' : 'not-allowed',
          boxShadow: confirmed ? 'var(--shadow-glow)' : 'none',
          transition: 'all 200ms ease',
        }}
      >
        تجميد المخزون والبدء 🔒
      </button>
    </div>
  );
}

/* ── Step 2: Count entry table ────────────────────── */
const SAMPLE_ITEMS = [
  { id: 1, code: 'IT-001', name: 'عصير برتقال 1L', unit: 'علبة', system: 48 },
  { id: 2, code: 'IT-002', name: 'مياه معدنية 600ml', unit: 'زجاجة', system: 120 },
  { id: 3, code: 'IT-003', name: 'قهوة سريعة 200g', unit: 'عبوة', system: 15 },
  { id: 4, code: 'IT-004', name: 'شاي أسود 100 ظرف', unit: 'علبة', system: 8 },
];

function StepCount({ items, counts, onCountChange }) {
  return (
    <div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        أدخل الكمية التي عددتها فعلياً لكل صنف. اتركها فارغة إذا لم تُحصَّ بعد.
      </p>

      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-overlay)' }}>
              {['الكود', 'الصنف', 'الوحدة', 'رصيد النظام', 'الكمية الفعلية'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                <td style={{ padding: '10px 12px', fontFamily: 'Inter, monospace', color: 'var(--text-muted)', fontSize: '11px' }}>{item.code}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{item.unit}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'Inter, monospace', color: 'var(--text-primary)' }}>{item.system}</td>
                <td style={{ padding: '8px 12px' }}>
                  <input
                    type="number"
                    min={0}
                    value={counts[item.id] ?? ''}
                    onChange={e => onCountChange(item.id, e.target.value)}
                    placeholder="—"
                    style={{
                      width: '80px', padding: '6px 8px',
                      border: '1px solid var(--border-normal)',
                      borderRadius: '6px', textAlign: 'center', fontSize: '13px',
                      fontFamily: 'Inter, monospace',
                      background: 'var(--bg-surface)', color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; }}
                    onBlur={(e)  => { e.target.style.borderColor = 'var(--border-normal)'; }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Step 3: Variance review ──────────────────────── */
function StepVariances({ items, counts, onApprove }) {
  const rows = useMemo(() => items.map(item => {
    const counted = parseFloat(counts[item.id] ?? item.system);
    const diff = counted - item.system;
    return { ...item, counted, diff };
  }), [items, counts]);

  const hasVariances = rows.some(r => r.diff !== 0);

  return (
    <div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        مراجعة الفروق قبل الترحيل. الفروق الحمراء تحتاج اعتماداً.
      </p>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-overlay)' }}>
              {['الصنف', 'رصيد النظام', 'المعدود فعلاً', 'الفرق', 'الحالة'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'start', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const diffColor = r.diff < 0 ? 'var(--danger-text)' : r.diff > 0 ? '#2563EB' : 'var(--success-text)';
              const statusBg  = r.diff === 0 ? 'var(--success-bg)' : 'var(--danger-bg)';
              const statusText = r.diff === 0 ? 'مطابق ✓' : `فرق ${r.diff > 0 ? '+' : ''}${r.diff}`;
              return (
                <tr key={r.id} style={{ borderTop: idx > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.name}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'Inter, monospace' }}>{r.system}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'Inter, monospace' }}>{r.counted}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'Inter, monospace', fontWeight: 700, color: diffColor }}>
                    {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: statusBg, color: r.diff === 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {statusText}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!hasVariances && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '10px', padding: '12px', textAlign: 'center', marginBottom: '12px', fontSize: '13px', color: 'var(--success-text)' }}>
          ✓ المخزون مطابق تماماً — لا توجد فروق
        </div>
      )}

      <button
        onClick={onApprove}
        style={{
          padding: '11px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: 'var(--shadow-glow)',
        }}
      >
        اعتماد الفروق والمتابعة ←
      </button>
    </div>
  );
}

/* ── Step 4: Post & close ─────────────────────────── */
function StepPost({ onPost }) {
  const [posting, setPosting] = useState(false);
  const [done,    setDone]    = useState(false);

  const handlePost = async () => {
    setPosting(true);
    await new Promise(r => setTimeout(r, 1200));
    setPosting(false);
    setDone(true);
    onPost?.();
  };

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ fontSize: '56px', marginBottom: '12px', animation: 'bounceIcon 0.6s ease-out' }}>✅</div>
        <h3 style={{ fontWeight: 700, fontSize: '18px', color: 'var(--success-text)', marginBottom: '6px' }}>تم إغلاق الجرد بنجاح!</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>تم ترحيل التسويات وفتح المخزون للعمليات.</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📤</div>
      <h3 style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text-primary)', marginBottom: '8px' }}>ترحيل التسويات</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px', maxWidth: '360px', margin: '0 auto 24px' }}>
        سيتم تسجيل تسويات المخزون وفتح نقطة البيع مجدداً.
        هذا الإجراء لا يمكن التراجع عنه.
      </p>
      <button
        onClick={handlePost}
        disabled={posting}
        style={{
          padding: '12px 32px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-600))',
          color: '#fff', border: 'none', cursor: posting ? 'wait' : 'pointer',
          opacity: posting ? 0.7 : 1, boxShadow: 'var(--shadow-glow)',
        }}
      >
        {posting ? 'جاري الترحيل...' : 'ترحيل وإغلاق الجرد ✓'}
      </button>
    </div>
  );
}

/* ── Main Stepper ──────────────────────────────────── */
export function PhysicalCountStepper() {
  const [currentStep, setCurrentStep] = useState(1);
  const [counts, setCounts] = useState({});
  const items = SAMPLE_ITEMS;

  const goNext = () => setCurrentStep(s => Math.min(s + 1, 4));

  const stepIcon = (step) => {
    const Icon = step.icon;
    const done = currentStep > step.id;
    const active = currentStep === step.id;

    return (
      <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${done ? 'var(--primary)' : active ? 'var(--primary)' : 'var(--border-normal)'}`,
          background: done ? 'var(--primary)' : active ? 'var(--primary-50)' : 'transparent',
          color: done ? '#fff' : active ? 'var(--primary)' : 'var(--text-muted)',
          transition: 'all 300ms ease',
        }}>
          {done ? <CheckCircle size={18} /> : <Icon size={18} />}
        </div>
        <div style={{ fontSize: '10px', marginTop: '5px', fontWeight: active || done ? 600 : 400, color: active ? 'var(--primary)' : done ? 'var(--primary)' : 'var(--text-muted)', textAlign: 'center' }}>
          {step.label_ar}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Progress indicator */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '32px', position: 'relative' }}>
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            {stepIcon(step)}
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: '2px', marginTop: '20px', alignSelf: 'flex-start',
                background: currentStep > step.id ? 'var(--primary)' : 'var(--border-normal)',
                transition: 'background 400ms ease',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>
            الخطوة {currentStep}: {STEPS[currentStep - 1].label_ar}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {STEPS[currentStep - 1].desc_ar}
          </p>
        </div>

        <div className="animate-fade-in" key={currentStep}>
          {currentStep === 1 && <StepFreeze onConfirm={goNext} />}
          {currentStep === 2 && (
            <div>
              <StepCount items={items} counts={counts} onCountChange={(id, v) => setCounts(c => ({ ...c, [id]: v }))} />
              <button onClick={goNext} style={{ marginTop: '16px', padding: '10px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', background: 'linear-gradient(135deg, var(--primary), var(--primary-600))', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-glow)' }}>
                انتهيت من العد — مراجعة الفروق ←
              </button>
            </div>
          )}
          {currentStep === 3 && <StepVariances items={items} counts={counts} onApprove={goNext} />}
          {currentStep === 4 && <StepPost onPost={() => {}} />}
        </div>
      </div>
    </div>
  );
}
