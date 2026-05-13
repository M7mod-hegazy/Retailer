import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, AlignLeft, AlignCenter, AlignRight, GripVertical, Eye, EyeOff } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────────

export const INSERTION_POINTS = [
  { value: "after_header",   label: "بعد رأس الشركة",          hint: "بعد الاسم والعنوان مباشرة" },
  { value: "before_meta",    label: "قبل بيانات الفاتورة",     hint: "قبل رقم الفاتورة والتاريخ" },
  { value: "after_meta",     label: "بعد بيانات الفاتورة",     hint: "قبل جدول الأصناف" },
  { value: "before_items",   label: "فوق جدول الأصناف",        hint: "مباشرة قبل رؤوس الجدول" },
  { value: "after_items",    label: "أسفل جدول الأصناف",       hint: "بعد آخر صنف في الجدول" },
  { value: "before_totals",  label: "قبل الإجماليات",          hint: "قبل الإجمالي الفرعي" },
  { value: "after_totals",   label: "بعد الإجماليات",          hint: "بعد الإجمالي المستحق" },
  { value: "before_footer",  label: "قبل التذييل",             hint: "قبل رسالة الشكر" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

export const getCustomBlocks = (settings) => {
  try { return JSON.parse(settings.custom_text_blocks || "[]"); }
  catch { return []; }
};

export const saveCustomBlocks = (blocks, onChange) => {
  onChange("custom_text_blocks", JSON.stringify(blocks));
};

const makeBlock = () => ({
  id: `blk_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
  text: "",
  position: "after_header",
  paperSizes: ["58mm", "80mm", "A5", "A4"],
  align: "center",
  fontSize: 10,
  bold: false,
  italic: false,
  enabled: true,
});

// ─── Block Renderer (used inside previews) ───────────────────────────────────────

export function BlockRenderer({ blocks, position, paperSize, accentColor = "#0f172a", hovered, onElementClick }) {
  const matching = blocks.filter(b =>
    b.position === position &&
    b.enabled !== false &&
    b.text?.trim() &&
    (!b.paperSizes || b.paperSizes.length === 0 || b.paperSizes.includes(paperSize))
  );
  if (!matching.length) return null;
  return (
    <>
      {matching.map(b => (
        <div
          key={b.id}
          onClick={() => onElementClick?.(`custom_block_${b.id}`)}
          style={{
            textAlign: b.align || "center",
            fontSize: `${b.fontSize || 10}px`,
            fontWeight: b.bold ? "900" : "normal",
            fontStyle: b.italic ? "italic" : "normal",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: "4px 0",
            padding: "2px 0",
            color: accentColor,
            outline: hovered === `custom_block_${b.id}` ? "2px solid #f59e0b" : "none",
            outlineOffset: "2px",
            borderRadius: "1px",
            cursor: "pointer",
          }}
        >
          {b.text}
        </div>
      ))}
    </>
  );
}

// ─── Single Block Card ──────────────────────────────────────────────────────────

function BlockCard({ block, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(true);
  const upd = (key, val) => onUpdate({ ...block, [key]: val });

  const posLabel = INSERTION_POINTS.find(p => p.value === block.position)?.label || block.position;

  return (
    <div className={`rounded-sm border transition-all ${block.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
      {/* Card Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="rounded px-0.5 py-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            className="rounded px-0.5 py-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Position badge */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-800 truncate">
            {block.text?.trim() ? `"${block.text.slice(0, 28).replace(/\n/g, " ↵ ")}${block.text.length > 28 ? "…" : ""}"` : "نص فارغ"}
          </div>
          <div className="text-[9px] font-bold text-slate-400 mt-0.5">{posLabel}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => upd("enabled", !block.enabled)}
            className={`rounded-sm p-1 transition-colors ${block.enabled ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100"}`}
            title={block.enabled ? "مفعّل" : "معطّل"}>
            {block.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => setOpen(o => !o)}
            className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 transition-colors">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onDelete}
            className="rounded-sm p-1 text-rose-300 hover:bg-rose-50 hover:text-rose-600 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      {open && (
        <div className="p-3 space-y-3">
          {/* Textarea */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              النص (المسافات والأسطر محفوظة)
            </label>
            <textarea
              value={block.text}
              onChange={e => upd("text", e.target.value)}
              dir="auto"
              rows={3}
              placeholder={"مثال:\nشركة إلهيجازي للتجزئة\nالسجل التجاري: 1234567"}
              style={{ fontFamily: "monospace" }}
              className="w-full resize-y rounded-sm border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all placeholder:text-slate-300 leading-relaxed"
            />
            <div className="mt-1 text-[9px] font-bold text-slate-400 text-left ltr">
              {block.text.length} حرف • {block.text.split("\n").length} سطر
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              موضع الظهور في المستند
            </label>
            <div className="grid grid-cols-2 gap-1">
              {INSERTION_POINTS.map(pt => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => upd("position", pt.value)}
                  className={`flex flex-col items-start rounded-sm border px-2.5 py-2 text-right transition-all ${block.position === pt.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  <div className={`text-[10px] font-black ${block.position === pt.value ? "text-white" : "text-slate-800"}`}>{pt.label}</div>
                  <div className={`text-[9px] font-bold mt-0.5 ${block.position === pt.value ? "text-slate-300" : "text-slate-400"}`}>{pt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Paper Size Filter */}
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
              يظهر على هذه المقاسات
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {["58mm", "80mm", "A5", "A4"].map(size => {
                const sizes = block.paperSizes ?? ["58mm", "80mm", "A5", "A4"];
                const active = sizes.includes(size);
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      const cur = block.paperSizes ?? ["58mm", "80mm", "A5", "A4"];
                      upd("paperSizes", active
                        ? cur.filter(s => s !== size)
                        : [...cur, size]
                      );
                    }}
                    className={`rounded-sm border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-[9px] font-bold text-slate-400">
              {(() => {
                const sz = block.paperSizes ?? ["58mm", "80mm", "A5", "A4"];
                if (sz.length === 4) return "يظهر على جميع المقاسات";
                if (sz.length === 0) return "⚠ لا يظهر على أي مقاس";
                return `يظهر فقط على: ${sz.join(" ، ")}`;
              })()}
            </div>
          </div>

          {/* Style Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Alignment */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">المحاذاة</div>
              <div className="flex rounded-sm overflow-hidden border border-slate-200">
                {[["right", <AlignRight className="h-3.5 w-3.5" />], ["center", <AlignCenter className="h-3.5 w-3.5" />], ["left", <AlignLeft className="h-3.5 w-3.5" />]].map(([a, icon]) => (
                  <button key={a} type="button" onClick={() => upd("align", a)}
                    className={`px-2.5 py-1.5 transition-colors border-l last:border-l-0 border-slate-200 ${block.align === a ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">حجم الخط</div>
              <div className="flex items-center rounded-sm border border-slate-200 overflow-hidden">
                <button type="button" onClick={() => upd("fontSize", Math.max(7, (block.fontSize || 10) - 1))}
                  className="px-2 py-1.5 text-[12px] font-black text-slate-500 hover:bg-slate-100 border-l border-slate-200">−</button>
                <div className="px-3 text-[12px] font-black text-slate-800">{block.fontSize || 10}px</div>
                <button type="button" onClick={() => upd("fontSize", Math.min(24, (block.fontSize || 10) + 1))}
                  className="px-2 py-1.5 text-[12px] font-black text-slate-500 hover:bg-slate-100 border-r border-slate-200">+</button>
              </div>
            </div>

            {/* Bold / Italic */}
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">التنسيق</div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => upd("bold", !block.bold)}
                  className={`rounded-sm border px-3 py-1.5 text-[12px] font-black transition-all ${block.bold ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  style={{ fontWeight: "900" }}>
                  B
                </button>
                <button type="button" onClick={() => upd("italic", !block.italic)}
                  className={`rounded-sm border px-3 py-1.5 text-[12px] transition-all ${block.italic ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  style={{ fontStyle: "italic", fontFamily: "serif" }}>
                  I
                </button>
              </div>
            </div>

            {/* Live text preview */}
            {block.text?.trim() && (
              <div className="flex-1 min-w-[100px]">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">معاينة مصغرة</div>
                <div
                  style={{
                    textAlign: block.align,
                    fontSize: `${block.fontSize || 10}px`,
                    fontWeight: block.bold ? "900" : "normal",
                    fontStyle: block.italic ? "italic" : "normal",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    padding: "6px 8px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "2px",
                    maxHeight: "56px",
                    overflow: "hidden",
                    color: "#0f172a",
                  }}
                >
                  {block.text}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Component ───────────────────────────────────────────────────────────

export function CustomTextBlocksSection({ blocks, onUpdate }) {
  const addBlock = () => onUpdate([...blocks, makeBlock()]);

  const updateBlock = (id, updated) =>
    onUpdate(blocks.map(b => b.id === id ? updated : b));

  const deleteBlock = (id) =>
    onUpdate(blocks.filter(b => b.id !== id));

  const moveUp = (i) => {
    if (i === 0) return;
    const arr = [...blocks];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    onUpdate(arr);
  };

  const moveDown = (i) => {
    if (i === blocks.length - 1) return;
    const arr = [...blocks];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    onUpdate(arr);
  };

  return (
    <div className="space-y-3">
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-slate-200 bg-slate-50 py-8 text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">لا توجد نصوص مضافة بعد</div>
          <div className="text-[10px] font-bold text-slate-300 max-w-[240px] leading-relaxed">
            أضف نصوصاً مخصصة مثل بيانات الضمان، ملاحظات الدفع، أو رسائل ترويجية في أي موضع من المستند
          </div>
        </div>
      ) : (
        blocks.map((block, i) => (
          <BlockCard
            key={block.id}
            block={block}
            index={i}
            total={blocks.length}
            onUpdate={(updated) => updateBlock(block.id, updated)}
            onDelete={() => deleteBlock(block.id)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
          />
        ))
      )}

      <button
        type="button"
        onClick={addBlock}
        className="flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-slate-300 bg-white py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white"
      >
        <Plus className="h-4 w-4" />
        إضافة نص مخصص جديد
      </button>
    </div>
  );
}
