import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, RotateCcw, Printer, Save, GripVertical, Eye, EyeOff, Trash2,
  Bold, Italic, AlignRight, AlignCenter, AlignLeft, Type, Minus, Square, QrCode,
  Undo2, Redo2, ArrowUp, ArrowDown,
} from "lucide-react";
import LayoutRenderer from "../LayoutRenderer";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { ensureLayout, seedFamilyLayout, SHOW_KEY, defaultColumns, newInsertId } from "../layout/layoutModel";

const MOCK = {
  invoice_no: "INV-2025-0001",
  created_at: new Date().toISOString(),
  customer_name: "عميل تجريبي",
  cashier_name: "الكاشير",
  lines: [
    { sku: "K-100", product_name: "منتج تجريبي ١", quantity: 2, unit_price: 45 },
    { sku: "K-200", product_name: "منتج تجريبي ٢", quantity: 1, unit_price: 120, discount_amount: 10 },
  ],
  payments: [{ method_name: "نقدًا", amount: 200 }],
};

const SIZES = { roll: ["58mm", "80mm"], page: ["A5", "A4"] };
const SHEET_W = { "58mm": "58mm", "80mm": "80mm", A5: "148mm", A4: "210mm" };
const INSERTABLE = [
  { type: "custom_text", label: "نص", icon: Type },
  { type: "divider", label: "فاصل", icon: Minus },
  { type: "spacer", label: "مسافة", icon: Square },
  { type: "qr", label: "QR", icon: QrCode },
];

export default function PrintDesigner({ open = true, onClose, docType, label, initialFamily = "page", globalSettings = {}, value = {}, onChange, onSave }) {
  const [draft, setDraft] = useState(() => ensureLayout(value));
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [family, setFamily] = useState(initialFamily);
  const [size, setSize] = useState(() => (SIZES[initialFamily] ? SIZES[initialFamily][SIZES[initialFamily].length - 1] : "A4"));
  const [selected, setSelected] = useState(null); // block type or insert id
  const [hovered, setHovered] = useState(null);
  const [zoom, setZoom] = useState(family === "roll" ? 1.1 : 0.7);
  const [dragIdx, setDragIdx] = useState(null);     // outline drag (by index)
  const [canvasDrag, setCanvasDrag] = useState(null); // canvas drag (by key)
  const [dragOverKey, setDragOverKey] = useState(null);
  const [resizing, setResizing] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const printRef = useRef(null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Blocks whose visible text maps to an editable field (inline double-click).
  const EDIT_TOP = { company_name: "company_name", branch: "branch_name", footer_text: "receipt_footer", receipt_header_text: "receipt_header" };
  const editableOf = (key) => {
    if ((draft.layout[family].inserted || []).some((b) => b.id === key && b.type === "custom_text")) return "insert";
    return EDIT_TOP[key] || null;
  };

  // reset when (re)opened
  useEffect(() => { setDraft(ensureLayout(value)); setPast([]); setFuture([]); setSelected(null); setHovered(null); }, [open]);

  const fam = draft.layout[family];
  const merged = useMemo(() => ({ ...globalSettings, ...draft }), [globalSettings, draft]);

  // ── history-aware commit + undo/redo ─────────────────────────────────────
  const commit = (next) => { setPast((p) => [...p, draft]); setFuture([]); setDraft(next); onChange && onChange(next); };
  const undo = () => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setFuture((f) => [draft, ...f]); setPast((p) => p.slice(0, -1)); setDraft(prev); onChange && onChange(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const nxt = future[0];
    setPast((p) => [...p, draft]); setFuture((f) => f.slice(1)); setDraft(nxt); onChange && onChange(nxt);
  };

  const setFamLayout = (mut) => {
    const cur = draft.layout[family];
    const nextFam = { ...cur, ...mut(cur) };
    commit({ ...draft, layout: { ...draft.layout, [family]: nextFam } });
  };
  const setTopLevel = (key, val) => commit({ ...draft, [key]: val });

  const switchFamily = (f) => {
    setFamily(f); setSize(SIZES[f][SIZES[f].length - 1]); setZoom(f === "roll" ? 1.1 : 0.7); setSelected(null); setHovered(null);
  };

  // ── visibility ───────────────────────────────────────────────────────────
  const isVisible = (type) => {
    const sk = SHOW_KEY[type];
    if (sk) return merged[sk] !== false;
    return fam.order.includes(type);
  };
  const toggleVisible = (type) => {
    const sk = SHOW_KEY[type];
    if (sk) { setTopLevel(sk, !(merged[sk] !== false)); return; }
    setFamLayout((c) => ({ order: c.order.includes(type) ? c.order.filter((t) => t !== type) : [...c.order, type] }));
  };

  // ── reorder ────────────────────────────────────────────────────────────
  const moveOrder = (from, to) => {
    if (from == null || to == null || from === to) return;
    setFamLayout((c) => { const order = [...c.order]; const [m] = order.splice(from, 1); order.splice(to, 0, m); return { order }; });
  };
  const reorderByKey = (fromKey, toKey) => {
    if (!fromKey || fromKey === toKey) return;
    setFamLayout((c) => {
      if (!c.order.includes(fromKey)) return {};
      const order = c.order.filter((t) => t !== fromKey);
      const ti = order.indexOf(toKey);
      if (ti < 0) order.push(fromKey); else order.splice(ti, 0, fromKey);
      return { order };
    });
  };
  const nudge = (dir) => {
    if (!selected) return;
    setFamLayout((c) => { const order = [...c.order]; const i = order.indexOf(selected); const j = i + dir; if (i < 0 || j < 0 || j >= order.length) return {}; [order[i], order[j]] = [order[j], order[i]]; return { order }; });
  };
  const bumpFont = (d) => {
    if (!selected) return;
    if (selected === "logo") setTopLevel("logo_max_height", clamp((Number(merged.logo_max_height) || 48) + d * 4, 16, 400));
    else if (selected === "qr") setTopLevel("qr_size", clamp((Number(merged.qr_size) || 44) + d * 4, 24, 400));
    else setOverride(selected, { fontSize: clamp((Number(ov(selected).fontSize) || Number(merged.item_font_size) || 11) + d, 6, 72) });
  };

  // ── per-block style overrides ────────────────────────────────────────────
  const ov = (key) => (draft.layout[family].perBlock || {})[key] || {};
  const setOverride = (key, patch) =>
    setFamLayout((c) => ({ perBlock: { ...(c.perBlock || {}), [key]: { ...((c.perBlock || {})[key] || {}), ...patch } } }));

  // ── inserted elements ────────────────────────────────────────────────────
  const insert = (type) => {
    const id = newInsertId();
    const after = (selected && fam.order.includes(selected)) ? selected : fam.order[fam.order.length - 1];
    const props = type === "custom_text" ? { text: "نص جديد", align: "center" } : {};
    setFamLayout((c) => ({ inserted: [...(c.inserted || []), { id, type, after, props }] }));
    setSelected(id);
  };
  const removeInsert = (id) => setFamLayout((c) => ({ inserted: (c.inserted || []).filter((b) => b.id !== id) }));
  const setInsert = (id, patch) =>
    setFamLayout((c) => ({ inserted: (c.inserted || []).map((b) => (b.id === id ? { ...b, ...patch, props: { ...b.props, ...(patch.props || {}) } } : b)) }));
  const duplicateSelected = () => {
    const src = (fam.inserted || []).find((b) => b.id === selected);
    if (!src) return; // only inserted elements can be duplicated
    const id = newInsertId();
    setFamLayout((c) => ({ inserted: [...(c.inserted || []), { ...src, id, props: { ...src.props } }] }));
    setSelected(id);
  };

  // Inline text editing (double-click on canvas) → write the bound field.
  const startEditText = (key) => setEditingKey(key);
  const commitText = (key, text) => {
    setEditingKey(null);
    const t = (text || "").trim();
    if (EDIT_TOP[key]) { if ((merged[EDIT_TOP[key]] || "") !== t) setTopLevel(EDIT_TOP[key], t); return; }
    const ins = (fam.inserted || []).find((b) => b.id === key);
    if (ins && (ins.props?.text || "") !== t) setInsert(key, { props: { text: t } });
  };

  const deleteSelected = () => {
    if (!selected) return;
    if ((fam.inserted || []).some((b) => b.id === selected)) { removeInsert(selected); setSelected(null); return; }
    const sk = SHOW_KEY[selected];
    if (sk) setTopLevel(sk, false);
    else setFamLayout((c) => ({ order: c.order.filter((t) => t !== selected) }));
    setSelected(null);
  };

  // ── columns (items_table) ────────────────────────────────────────────────
  const columns = (fam.columns && fam.columns.items_table) || defaultColumns(family);
  const setColumns = (cols) => setFamLayout((c) => ({ columns: { ...(c.columns || {}), items_table: cols } }));
  const draftForRender = useMemo(() => {
    const f = draft.layout[family];
    const pb = { ...(f.perBlock || {}), items_table: { ...((f.perBlock || {}).items_table || {}), columns } };
    return { ...draft, layout: { ...draft.layout, [family]: { ...f, perBlock: pb } } };
  }, [draft, family, columns]);

  const reset = () => commit({ ...draft, layout: { ...draft.layout, [family]: seedFamilyLayout(family) } });

  const MARGIN_KEY = { top: "margin_top", side: "margin_side" };
  const setMargin = (k, v) => setTopLevel(MARGIN_KEY[k], v);

  // ── direct mouse resize (pointer drag on a handle) ───────────────────────
  // One undo step per gesture: snapshot once on pointerdown, then live-apply
  // absolute values computed from the start value + pointer delta (/zoom).
  const onResizeStart = (key, axis, e) => {
    const startX = e.clientX, startY = e.clientY, z = zoom;
    const draftBase = draft, famBase = draft.layout[family];
    const applyLive = (next) => { setDraft(next); onChange && onChange(next); };
    const setTopLive = (k, v) => applyLive({ ...draftBase, [k]: v });
    const setOvLive = (k, patch) => applyLive({ ...draftBase, layout: { ...draftBase.layout, [family]: { ...famBase, perBlock: { ...(famBase.perBlock || {}), [k]: { ...((famBase.perBlock || {})[k] || {}), ...patch } } } } });
    let base, applyVal, horizontal = false;
    if (axis === "width") { base = Number((famBase.perBlock || {})[key]?.width) || 100; horizontal = true; applyVal = (v) => setOvLive(key, { width: clamp(Math.round(v), 10, 100) }); }
    else if (key === "logo") { base = Number(merged.logo_max_height) || 48; applyVal = (v) => setTopLive("logo_max_height", clamp(Math.round(v), 16, 400)); }
    else if (key === "qr") { base = Number(merged.qr_size) || 44; applyVal = (v) => setTopLive("qr_size", clamp(Math.round(v), 24, 400)); }
    else { base = Number((famBase.perBlock || {})[key]?.fontSize) || Number(merged.item_font_size) || 11; applyVal = (v) => setOvLive(key, { fontSize: clamp(Math.round(v), 6, 72) }); }
    setPast((p) => [...p, draftBase]); setFuture([]); setResizing(true);
    const move = (ev) => {
      if (horizontal) applyVal(base + ((startX - ev.clientX) / z) * 0.4);
      else applyVal(base + ((ev.clientY - startY) / z) * (axis === "font" ? 0.3 : 1));
    };
    const up = () => { setResizing(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // ── canvas designer context (selection + hover + drag + resize + edit) ───
  const designer = {
    selectedKey: selected, hoveredKey: hovered, dragOverKey, editingKey, resizing,
    onSelect: setSelected, onHover: setHovered,
    onDragStart: setCanvasDrag, onDragOverKey: setDragOverKey,
    onDrop: (toKey) => { reorderByKey(canvasDrag, toKey); setCanvasDrag(null); setDragOverKey(null); },
    onDragEnd: () => { setCanvasDrag(null); setDragOverKey(null); },
    onResizeStart,
    editableOf, onStartEditText: startEditText, onCommitText: commitText,
  };

  // Registry blocks valid for this family that are not currently in the order
  // (i.e. hidden by removal) — surfaced in a tray so hiding is reversible.
  const hiddenBlocks = Object.keys(BLOCK_REGISTRY).filter((t) => {
    const e = BLOCK_REGISTRY[t];
    return e.families.includes(family) && e.group !== "inserted" && !fam.order.includes(t);
  });
  const addToOrder = (t) => { setFamLayout((c) => ({ order: [...c.order, t] })); setSelected(t); };

  // ── keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      const tag = (e.target.tagName || "").toUpperCase();
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (typing || editingKey) return;
      if (e.key === "Escape") { setSelected(null); return; }
      if (mod && e.key.toLowerCase() === "d" && selected) { e.preventDefault(); duplicateSelected(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); mod ? bumpFont(1) : nudge(-1); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); mod ? bumpFont(-1) : nudge(1); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); deleteSelected(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, selected, past, future, draft, family, editingKey]);

  // ── test print ───────────────────────────────────────────────────────────
  const testPrint = () => {
    const html = printRef.current ? printRef.current.innerHTML : "";
    const pageSize = size === "58mm" ? "58mm auto" : size === "80mm" ? "80mm auto" : size === "A5" ? "148mm 210mm" : "210mm 297mm";
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);
    const idoc = iframe.contentWindow.document;
    idoc.open();
    idoc.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:${pageSize};margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Tajawal","Noto Sans Arabic",system-ui,sans-serif;direction:rtl;color:#0f172a;background:#fff}table{width:100%;border-collapse:collapse}</style></head><body>${html.replace(/@page\s*\{[^}]*\}/g, "")}</body></html>`);
    idoc.close();
    iframe.contentWindow.focus();
    requestAnimationFrame(() => { iframe.contentWindow.print(); setTimeout(() => iframe.parentNode && iframe.parentNode.removeChild(iframe), 2000); });
  };

  if (!open) return null;

  const selOv = selected ? ov(selected) : {};
  const selInsert = selected ? (fam.inserted || []).find((b) => b.id === selected) : null;
  const selInOrder = selected && fam.order.includes(selected);
  const selLabel = selected ? (BLOCK_REGISTRY[selected]?.label || (selInsert ? BLOCK_REGISTRY[selInsert.type]?.label : selected)) : null;

  const Btn = ({ active, onClick, title, disabled, children }) => (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[12px] font-bold transition-colors disabled:opacity-30 ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      {children}
    </button>
  );

  return createPortal((
    <div dir="rtl" className="fixed inset-0 z-[9999] flex flex-col bg-slate-100">
      {/* hidden clean render for test print */}
      <div ref={printRef} style={{ position: "fixed", left: "-9999px", top: 0, visibility: "hidden", pointerEvents: "none", width: SHEET_W[size] }}>
        <LayoutRenderer family={family} size={size} invoice={MOCK} settings={merged} layout={draftForRender.layout} />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-black text-slate-900">المحرر المتقدم — {label}</span>
          <div className="flex rounded-lg border border-slate-200 p-0.5">
            {["page", "roll"].map((f) => (
              <button key={f} type="button" onClick={() => switchFamily(f)}
                className={`rounded-md px-3 py-1 text-[11px] font-black transition-colors ${family === f ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                {f === "page" ? "صفحة A4/A5" : "رول 58/80"}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {SIZES[family].map((sz) => (
              <button key={sz} type="button" onClick={() => setSize(sz)}
                className={`rounded-md border px-2 py-1 text-[10px] font-bold ${size === sz ? "border-slate-700 bg-slate-700 text-white" : "border-slate-200 text-slate-500"}`}>{sz}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button type="button" title="تراجع (Ctrl+Z)" disabled={!past.length} onClick={undo} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><Undo2 size={14} /></button>
            <button type="button" title="إعادة (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30"><Redo2 size={14} /></button>
          </div>
          <button type="button" onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"><RotateCcw size={13} /> إعادة ضبط</button>
          <button type="button" onClick={testPrint} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"><Printer size={13} /> طباعة تجريبية</button>
          <button type="button" onClick={() => { onSave && onSave(draft); onClose && onClose(); }} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-700"><Save size={13} /> حفظ وإغلاق</button>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
      </div>

      {/* Format toolbar (acts on the selected block) */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-1.5">
        <span className="min-w-[120px] text-[10px] font-black text-slate-400">{selected ? `العنصر: ${selLabel}` : "اختر عنصراً من المعاينة أو القائمة"}</span>
        <div className={`flex items-center gap-1 ${selected ? "" : "pointer-events-none opacity-40"}`}>
          <button type="button" onClick={() => setOverride(selected, { fontSize: Math.max(6, (Number(selOv.fontSize) || 11) - 1) })} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">−</button>
          <span className="min-w-9 text-center text-[11px] font-bold text-slate-600">{selOv.fontSize || "—"}</span>
          <button type="button" onClick={() => setOverride(selected, { fontSize: (Number(selOv.fontSize) || 11) + 1 })} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">+</button>
          <Btn active={!!selOv.bold} title="عريض" onClick={() => setOverride(selected, { bold: !selOv.bold })}><Bold size={13} /></Btn>
          <Btn active={!!selOv.italic} title="مائل" onClick={() => setOverride(selected, { italic: !selOv.italic })}><Italic size={13} /></Btn>
          <Btn active={selOv.align === "right"} title="يمين" onClick={() => setOverride(selected, { align: "right" })}><AlignRight size={13} /></Btn>
          <Btn active={selOv.align === "center"} title="وسط" onClick={() => setOverride(selected, { align: "center" })}><AlignCenter size={13} /></Btn>
          <Btn active={selOv.align === "left"} title="يسار" onClick={() => setOverride(selected, { align: "left" })}><AlignLeft size={13} /></Btn>
          <input type="color" value={selOv.color || "#0f172a"} onChange={(e) => setOverride(selected, { color: e.target.value })} className="h-8 w-9 cursor-pointer rounded-md border border-slate-200" title="اللون" />
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <Btn title="تحريك لأعلى" disabled={!selInOrder} onClick={() => nudge(-1)}><ArrowUp size={13} /></Btn>
          <Btn title="تحريك لأسفل" disabled={!selInOrder} onClick={() => nudge(1)}><ArrowDown size={13} /></Btn>
          <Btn title="إخفاء/إظهار" disabled={!selInOrder} onClick={() => toggleVisible(selected)}>{isVisible(selected) ? <Eye size={13} /> : <EyeOff size={13} />}</Btn>
          <Btn title="حذف (Delete)" onClick={deleteSelected}><Trash2 size={13} /></Btn>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left palette */}
        <div className="flex w-[150px] shrink-0 flex-col gap-2 border-l border-slate-200 bg-white p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">إضافة عنصر</div>
          {INSERTABLE.map(({ type, label: lbl, icon: Icon }) => (
            <button key={type} type="button" onClick={() => insert(type)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 hover:border-slate-400 hover:bg-slate-50">
              <Icon size={14} /> {lbl}
            </button>
          ))}
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[9px] font-bold leading-relaxed text-slate-400">
            انقر عنصراً لتحديده • نقرة مزدوجة لتحرير النص • اسحب مقابض ⬤ لتغيير الحجم/العرض • اسحب لإعادة الترتيب • الأسهم للنقل و Ctrl+الأسهم للحجم • Ctrl+D تكرار • Delete إخفاء • Ctrl+Z تراجع
          </div>
        </div>

        {/* Center canvas */}
        <div className="relative flex-1 overflow-auto bg-[#e8ecf0] p-6" onClick={() => setSelected(null)}>
          <div className="mx-auto" style={{ width: SHEET_W[size], transform: `scale(${zoom})`, transformOrigin: "top center", background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.12)" }} onClick={(e) => e.stopPropagation()}>
            <LayoutRenderer family={family} size={size} invoice={MOCK} settings={merged} layout={draftForRender.layout} editing designer={designer} />
          </div>
          <div className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow">
            <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="px-2.5 py-1.5 text-[14px] font-black text-slate-700 hover:bg-slate-100">+</button>
            <span className="min-w-[42px] px-1 text-center text-[10px] font-black text-slate-600">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))} className="px-2.5 py-1.5 text-[14px] font-black text-slate-700 hover:bg-slate-100">−</button>
          </div>
        </div>

        {/* Right inspector */}
        <div className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-3">
          {/* Outline */}
          <div>
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">ترتيب العناصر — اسحب للترتيب</div>
            <div className="space-y-0.5">
              {fam.order.map((type, idx) => {
                const entry = BLOCK_REGISTRY[type];
                if (!entry || !entry.families.includes(family)) return null;
                const vis = isVisible(type);
                const isSel = selected === type;
                const isHov = hovered === type;
                return (
                  <div key={type} draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { moveOrder(dragIdx, idx); setDragIdx(null); }}
                    onClick={() => setSelected(type)}
                    onMouseEnter={() => setHovered(type)} onMouseLeave={() => setHovered(null)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors ${isSel ? "border-violet-500 bg-violet-50" : isHov ? "border-violet-200 bg-violet-50/40" : "border-transparent hover:bg-slate-50"} ${vis ? "text-slate-700" : "text-slate-300"}`}>
                    <GripVertical size={12} className="shrink-0 text-slate-300" />
                    <span className="flex-1 truncate">{entry.label}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleVisible(type); }} className="shrink-0 text-slate-400 hover:text-slate-700">
                      {vis ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hidden blocks tray — re-add removed sections */}
          {hiddenBlocks.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">عناصر مخفية — انقر للإرجاع</div>
              <div className="flex flex-wrap gap-1.5">
                {hiddenBlocks.map((t) => (
                  <button key={t} type="button" onClick={() => addToOrder(t)}
                    className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700">
                    + {BLOCK_REGISTRY[t]?.label || t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inserted elements */}
          {(fam.inserted || []).length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">العناصر المضافة</div>
              <div className="space-y-0.5">
                {(fam.inserted || []).map((b) => (
                  <div key={b.id} onClick={() => setSelected(b.id)} onMouseEnter={() => setHovered(b.id)} onMouseLeave={() => setHovered(null)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-bold ${selected === b.id ? "border-violet-500 bg-violet-50" : "border-transparent hover:bg-slate-50"} text-slate-700`}>
                    <span className="flex-1 truncate">{BLOCK_REGISTRY[b.type]?.label || b.type}{b.type === "custom_text" ? `: ${b.props?.text || ""}` : ""}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeInsert(b.id); if (selected === b.id) setSelected(null); }} className="shrink-0 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom-text editor for selected insert */}
          {selInsert && selInsert.type === "custom_text" && (
            <div>
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">نص العنصر</div>
              <textarea value={selInsert.props?.text || ""} onChange={(e) => setInsert(selInsert.id, { props: { text: e.target.value } })}
                className="h-20 w-full resize-none rounded-lg border border-slate-300 p-2 text-[12px] outline-none focus:border-violet-500" />
              <div className="mt-2 flex gap-2">
                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500">موضع بعد:
                  <select value={selInsert.after} onChange={(e) => setInsert(selInsert.id, { after: e.target.value })} className="rounded-md border border-slate-200 px-1 py-1 text-[10px]">
                    {fam.order.map((t) => <option key={t} value={t}>{BLOCK_REGISTRY[t]?.label || t}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* Column editor when items table selected */}
          {selected === "items_table" && (
            <div>
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">أعمدة الجدول</div>
              <div className="space-y-0.5">
                {columns.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-1.5 rounded-md border border-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-600">
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} onClick={() => { const n = [...columns]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setColumns(n); }} className="text-[8px] leading-none text-slate-400 disabled:opacity-20">▲</button>
                      <button type="button" disabled={i === columns.length - 1} onClick={() => { const n = [...columns]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setColumns(n); }} className="text-[8px] leading-none text-slate-400 disabled:opacity-20">▼</button>
                    </div>
                    <input value={c.label} onChange={(e) => { const n = columns.map((x) => x.key === c.key ? { ...x, label: e.target.value } : x); setColumns(n); }} className="w-16 rounded border border-slate-200 px-1 py-0.5 text-[10px]" />
                    <select value={c.align || "right"} onChange={(e) => { const n = columns.map((x) => x.key === c.key ? { ...x, align: e.target.value } : x); setColumns(n); }} className="rounded border border-slate-200 px-1 py-0.5 text-[10px]">
                      <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                    </select>
                    <button type="button" onClick={() => { const n = columns.map((x) => x.key === c.key ? { ...x, visible: x.visible === false ? true : false } : x); setColumns(n); }} className="mr-auto text-slate-400 hover:text-slate-700">
                      {c.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Margins */}
          <div>
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">الهوامش (mm)</div>
            <div className="flex gap-2">
              {[["top", "علوي"], ["side", "جانبي"]].map(([k, lbl]) => (
                <label key={k} className="flex flex-1 flex-col gap-1 text-[10px] font-bold text-slate-500">{lbl}
                  <input type="number" value={merged[MARGIN_KEY[k]] ?? 4}
                    onChange={(e) => setMargin(k, Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-[12px] outline-none focus:border-violet-500" />
                </label>
              ))}
            </div>
            <div className="mt-1 text-[9px] font-bold text-slate-400">يُطبَّق على الهوامش العامة لهذا المستند.</div>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
