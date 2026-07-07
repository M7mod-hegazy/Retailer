import React, { useState } from "react";
import { GripVertical, Eye, EyeOff, Trash2, Type, Minus, Square, QrCode, Link2, Unlink, Move, Variable, Grid2x2, Landmark, Sparkles } from "lucide-react";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { DEFAULT_ORDER } from "../families/defaultOrder";

const INSERTABLE = [
  { type: "custom_text", label: "نص مخصص", icon: Type },
  { type: "custom_field", label: "حقل مخصص", icon: Variable },
  { type: "divider", label: "فاصل", icon: Minus },
  { type: "spacer", label: "مسافة", icon: Square },
  { type: "qr", label: "QR إضافي", icon: QrCode },
  { type: "doc_grid", label: "شبكة بيانات", icon: Grid2x2 },
  { type: "bank_details", label: "حساب بنكي", icon: Landmark },
  { type: "pattern_divider", label: "فاصل زخرفي", icon: Sparkles },
];

function isBlockLogicalForScope(type, scope) {
  // If the block is in the default order for this scope, it is always logical
  const defOrder = DEFAULT_ORDER[scope] || DEFAULT_ORDER.page;
  if (defOrder.includes(type)) return true;

  const isReport = scope !== "_global" && !["pos_receipt", "sales_invoice", "purchase_order", "sales_return", "quotation", "branch_transfer", "purchase_return", "payment_receipt"].includes(scope);

  // Report-specific blocks must ONLY appear in their exact matching scope
  if (type.endsWith("_metrics") || type.endsWith("_summaries") || type === "report_table" || type === "ajal_party" || type === "payment_methods_by_method") {
    if (type.startsWith("bank_statement") && scope === "bank_statement") return true;
    if (type.startsWith("daily_treasury") && scope === "daily_treasury") return true;
    if (type.startsWith("ajal_statement") && scope === "ajal_statement") return true;
    if (type.startsWith("ajal_schedule") && scope === "ajal_schedule") return true;
    if (type.startsWith("ajal_full_statement") && scope === "ajal_full_statement") return true;
    if (type.startsWith("cheque_register") && scope === "cheque_register") return true;
    if (type.startsWith("payment_methods") && scope === "payment_methods_report") return true;
    if (type === "ajal_party" && ["ajal_statement", "ajal_schedule"].includes(scope)) return true;
    if (type === "report_table" && isReport) return true;
    return false;
  }

  // Invoice-specific blocks must NOT appear in report scopes
  const invoiceOnly = new Set([
    "customer", "cashier", "items_table", "subtotal", "discount", "increase", "tax", "grand_total", "payments", "qr", "barcode", "order_number"
  ]);
  
  if (isReport && invoiceOnly.has(type)) {
    return false;
  }

  return true;
}

// Left panel: ordered block tree + hidden-blocks tray + inserted elements +
// add-element palette. Every row is live: click selects on the canvas,
// drag reorders, the eye toggles real visibility.
export default function StudioBlockTree({ st }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const { fam, family, selected, hovered } = st;

  const isReport = st.scope !== "_global" && !["pos_receipt", "sales_invoice", "purchase_order", "sales_return", "quotation", "branch_transfer", "purchase_return", "payment_receipt"].includes(st.scope);
  const insertableList = INSERTABLE.filter(item => {
    if (isReport && ["qr", "doc_grid", "bank_details"].includes(item.type)) return false;
    return true;
  });

  const hiddenBlocks = Object.keys(BLOCK_REGISTRY).filter((t) => {
    const e = BLOCK_REGISTRY[t];
    return (
      e.families.includes(family) &&
      e.group !== "inserted" &&
      !fam.order.includes(t) &&
      isBlockLogicalForScope(t, st.scope)
    );
  });

  return (
    <div className="flex w-[230px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--border-normal)] bg-[var(--bg-surface)] p-3">
      {/* inheritance state (per-doc scopes only) */}
      {st.scope !== "_global" && (
        st.ownFamily ? (
          <button type="button" onClick={st.unlinkFamily}
            title="حذف التخصيص والعودة لوراثة التصميم العام"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-2 py-1.5 text-[10px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
            <Unlink size={12} /> تصميم مخصص — اضغط للعودة للعام
          </button>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-2 py-1.5 text-[10px] font-black text-[var(--primary)]"
            title="أي تعديل هنا ينشئ تصميماً خاصاً بهذا المستند تلقائياً">
            <Link2 size={12} /> يرث التصميم العام
          </div>
        )
      )}

      <div>
        <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          عناصر المستند — اسحب هنا للترتيب
        </div>
        <div className="mb-2 rounded-lg bg-[var(--accent-soft)] px-2 py-1.5 text-[9px] font-bold leading-relaxed text-[var(--primary)]">
          اسحب أي عنصر على الورقة مباشرة لتحريكه بحرية في أي مكان{family === "roll" ? "، أو Ctrl+سحب لإعادة الترتيب" : ""}.
        </div>
        <div className="space-y-0.5">
          {fam.order.map((type, idx) => {
            const entry = BLOCK_REGISTRY[type];
            if (!entry || !entry.families.includes(family)) return null;
            const vis = st.isVisible(type);
            const isSel = selected === type;
            const isHov = hovered === type;
            return (
              <div key={type} draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); if (dropIdx !== idx) setDropIdx(idx); }}
                onDragLeave={() => setDropIdx((v) => (v === idx ? null : v))}
                onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
                onDrop={() => { st.moveOrder(dragIdx, idx); setDragIdx(null); setDropIdx(null); }}
                onClick={() => st.setSelected(type)}
                onMouseEnter={() => st.setHovered(type)} onMouseLeave={() => st.setHovered(null)}
                className={`relative flex cursor-grab items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors active:cursor-grabbing ${
                  dragIdx === idx ? "opacity-40" : ""
                } ${
                  isSel ? "border-[var(--primary)] bg-[var(--accent-soft)]"
                  : isHov ? "border-[var(--border-accent)] bg-[var(--accent-soft)]"
                  : "border-transparent hover:bg-[var(--bg-input)]"
                } ${vis ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] opacity-60"}`}>
                {dropIdx === idx && dragIdx !== null && dragIdx !== idx && (
                  <span className={`absolute inset-x-0 h-0.5 rounded-full bg-[var(--primary)] ${dragIdx < idx ? "-bottom-0.5" : "-top-0.5"}`} />
                )}
                <GripVertical size={12} className="shrink-0 text-[var(--text-muted)]" />
                <span className="flex-1 truncate">{entry.label}</span>
                {(() => { const o = (fam.perBlock || {})[type] || {}; return (o.abs?.xMm != null || (o.rel && (o.rel.dxMm || o.rel.dyMm))); })() && (
                  <Move size={11} className="shrink-0 text-[var(--primary)]" title="تم تحريكه" />
                )}
                <button type="button" title={vis ? "إخفاء" : "إظهار"}
                  onClick={(e) => { e.stopPropagation(); st.toggleVisible(type); }}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  {vis ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {hiddenBlocks.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">عناصر متاحة — انقر للإضافة</div>
          <div className="flex flex-wrap gap-1.5">
            {hiddenBlocks.map((t) => (
              <button key={t} type="button"
                onClick={() => { st.setFamLayout((c) => ({ order: [...c.order, t] })); st.setSelected(t); }}
                className="flex items-center gap-1 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                + {BLOCK_REGISTRY[t]?.label || t}
              </button>
            ))}
          </div>
        </div>
      )}

      {(fam.inserted || []).length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">العناصر المضافة</div>
          <div className="space-y-0.5">
            {(fam.inserted || []).map((b) => (
              <div key={b.id} onClick={() => st.setSelected(b.id)}
                onMouseEnter={() => st.setHovered(b.id)} onMouseLeave={() => st.setHovered(null)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-bold text-[var(--text-primary)] ${
                  selected === b.id ? "border-[var(--primary)] bg-[var(--accent-soft)]" : "border-transparent hover:bg-[var(--bg-input)]"
                }`}>
                <span className="flex-1 truncate">{BLOCK_REGISTRY[b.type]?.label || b.type}{b.type === "custom_text" ? `: ${b.props?.text || ""}` : ""}</span>
                <button type="button" title="حذف"
                  onClick={(e) => { e.stopPropagation(); st.removeInsert(b.id); }}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)]"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">إضافة عنصر</div>
        <div className="grid grid-cols-2 gap-1.5">
          {insertableList.map(({ type, label, icon: Icon }) => (
            <button key={type} type="button" onClick={() => st.insert(type)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-2 py-2 text-[10px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-lg bg-[var(--bg-input)] p-2 text-[9px] font-bold leading-relaxed text-[var(--text-muted)]">
        انقر عنصراً لتحديده • نقرة مزدوجة لتحرير النص • اسحب لإعادة الترتيب • مقابض ⬤ للحجم • Delete للإخفاء • Ctrl+Z تراجع • Ctrl+S حفظ
      </div>
    </div>
  );
}
