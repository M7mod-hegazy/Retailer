import React from "react";
import { Minus, Plus, Trash2, ShoppingBag, MapPin } from "lucide-react";
import { usePosStore } from "../../stores/posStore";

export default function InvoiceLines() {
  const lines = usePosStore((state) => state.lines);
  const updateLine = usePosStore((state) => state.updateLine);
  const removeLine = usePosStore((state) => state.removeLine);

  if (lines.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <ShoppingBag size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <p style={{ fontSize: '14px', fontWeight: 500 }}>الفاتورة فارغة</p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>أضف أصنافاً من الشبكة أو امسح الباركود</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lines.map((line) => (
        <div key={line.item_id} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-normal)',
          borderRadius: '12px', padding: '12px',
          boxShadow: 'var(--shadow-card)', transition: 'border-color 150ms ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-normal)'}
        >
          {/* Top row: Name & Delete */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {line.item_name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Inter, monospace', marginTop: '2px' }}>
                كود: {line.barcode || line.code || line.item_id}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeLine(line.item_id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--danger-text)', padding: '4px',
                borderRadius: '6px', background: 'var(--danger-bg)'
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Bottom row: Warehouse, Qty, Price */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            
            {/* Warehouse Selector */}
            <div style={{ flex: '1 1 auto', minWidth: '120px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <MapPin size={12} /> المخزن
              </label>
              <select
                style={{
                  width: '100%', padding: '6px 8px', fontSize: '12px',
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                  borderRadius: '6px', color: 'var(--text-primary)', outline: 'none'
                }}
                defaultValue="main"
              >
                <option value="main">المخزن الرئيسي</option>
                <option value="branch1">فرع 1</option>
                <option value="branch2">فرع 2</option>
              </select>
            </div>

            {/* Stepper */}
            <div style={{ flex: '0 0 auto' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textAlign: 'center' }}>
                الكمية
              </label>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => updateLine(line.item_id, { quantity: Math.max(1, line.quantity - 1) })}
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <Minus size={14} />
                </button>
                <div style={{ width: '36px', textAlign: 'center', fontSize: '13px', fontWeight: 700, fontFamily: 'Inter, monospace', color: 'var(--text-primary)' }}>
                  {line.quantity}
                </div>
                <button
                  type="button"
                  onClick={() => updateLine(line.item_id, { quantity: line.quantity + 1 })}
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Price Edit */}
            <div style={{ flex: '0 0 auto' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                سعر الوحدة
              </label>
              <input
                type="number"
                min="0"
                value={line.unit_price}
                onChange={(event) => updateLine(line.item_id, { unit_price: Number(event.target.value || 0) })}
                style={{
                  width: '75px', padding: '6px 8px',
                  background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                  borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 600,
                  fontFamily: 'Inter, monospace', color: 'var(--text-primary)', outline: 'none'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = 'var(--shadow-focus)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-strong)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Row Total */}
            <div style={{ flex: '0 0 auto', textAlign: 'end', minWidth: '70px', alignSelf: 'flex-end', paddingBottom: '4px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>الإجمالي</div>
              <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'Inter, monospace', color: 'var(--primary)' }}>
                {(line.quantity * line.unit_price).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
              </div>
            </div>

          </div>
        </div>
      ))}
    </div>
  );
}
