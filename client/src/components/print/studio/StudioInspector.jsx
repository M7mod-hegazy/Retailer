import React, { useRef, useState } from "react";
import {
  Bold, Italic, AlignRight, AlignCenter, AlignLeft, Eye, EyeOff, Trash2,
  ArrowUp, ArrowDown, Copy, ClipboardPaste, Wrench, RotateCcw, Stamp,
  Type, Image as ImageIcon, Move, X,
} from "lucide-react";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { PLACEHOLDER_KEYS } from "../blocks/placeholders";
import { PRINT_FONT_FAMILIES } from "../../../services/printFonts";
import { COLUMN_CATALOG } from "./studioData";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SYSTEM_FONTS = [
  { value: "Tahoma", label: "Tahoma" },
  { value: "sans-serif", label: "Arial" },
  { value: "serif", label: "Times" },
  { value: "monospace", label: "Courier" },
];

// Blocks with no meaningful typography — they get only the controls that
// actually change their output (the audit rule: no for-show controls).
const NO_TYPOGRAPHY = new Set(["logo", "qr", "image", "divider", "spacer", "barcode"]);
// Blocks where the surface/box styling makes no sense either.
const NO_BOX = new Set(["spacer", "divider", "watermark"]);

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-[var(--border-subtle)] p-2.5">
    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{title}</div>
    {children}
  </div>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
    <span className="shrink-0">{label}</span>
    {children}
  </div>
);

const inputCls = "h-8 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] px-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]";
const btnCls = (active) => `flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[11px] font-bold transition-colors disabled:opacity-30 ${active ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-normal)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"}`;

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border-normal)] px-3 py-2 hover:bg-[var(--bg-input)]">
      <span className="text-[11px] font-bold text-[var(--text-secondary)]">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "right-0.5" : "right-[18px]"}`} />
      </button>
    </label>
  );
}

// Color swatch + clear ("وراثة") — clearing removes the override entirely.
function ColorField({ value, onChange, onClear, fallback = "#0f172a" }) {
  return (
    <div className="flex items-center gap-1">
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded-md border border-[var(--border-normal)]" />
      {value && onClear && (
        <button type="button" title="إزالة اللون (وراثة)" onClick={onClear}
          className="flex h-8 w-6 items-center justify-center rounded-md border border-[var(--border-normal)] text-[var(--text-muted)] hover:text-[var(--danger)]"><X size={11} /></button>
      )}
    </div>
  );
}

// Right panel: contextual inspector — every control shown maps to a value the
// renderer actually consumes for the selected element type.
export default function StudioInspector({ st }) {
  const [copiedStyle, setCopiedStyle] = useState(null);
  const logoFileRef = useRef(null);
  const imageFileRef = useRef(null);
  const overlayImgRef = useRef(null);

  const { selected, family, merged, fam } = st;
  const selInsert = selected ? (fam.inserted || []).find((b) => b.id === selected) : null;
  const selOverlay = selected && family === "page" ? st.overlays.find((o) => o.id === selected) : null;
  const selInOrder = selected && fam.order.includes(selected);
  const isBlockSel = !!selected && !selOverlay && (selInOrder || selInsert);
  const selType = selInsert ? selInsert.type : selected;
  const selOv = isBlockSel ? st.ov(selected) : {};
  const isAbs = isBlockSel && selOv.abs && selOv.abs.xMm != null;
  const hasTypography = isBlockSel && !NO_TYPOGRAPHY.has(selType);
  const hasBox = isBlockSel && !NO_BOX.has(selType);
  const selLabel = selected
    ? (selOverlay ? ({ text: "نص حر", stamp: "ختم", image: "صورة" }[selOverlay.type] || "عنصر حر")
      : (BLOCK_REGISTRY[selType]?.label || selected))
    : null;

  const readFile = (file, cb) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  };

  const setOv = (patch) => st.setOverride(selected, patch);
  const setAbs = (patch) => st.setOverride(selected, { abs: { ...selOv.abs, ...patch } });

  // ── template docs: reduced inspector (flat settings only) ──────────────
  if (!st.isBlockDoc) {
    return (
      <div className="flex w-[310px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--border-normal)] bg-[var(--bg-surface)] p-3">
        <Section title="الورق والخط">
          <Row label="الخط">
            <select value={merged.print_font || "Tajawal"} onChange={(e) => st.setFlat("print_font", e.target.value)} className={`${inputCls} w-40`}>
              {PRINT_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f} (مضمّن)</option>)}
              {SYSTEM_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Row>
          <Row label="الحجم الافتراضي">
            <select value={merged.paper_size || ""} onChange={(e) => st.setFlat("paper_size", e.target.value)} className={`${inputCls} w-28`}>
              <option value="">يرث العام</option>
              {["58mm", "80mm", "A5", "A4"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Row>
        </Section>
        <Section title="نصوص المستند">
          {[["receipt_header", "رأس المستند"], ["receipt_footer", "تذييل المستند"], ["watermark_text", "نص العلامة المائية"]].map(([k, lbl]) => (
            <label key={k} className="mb-2 block space-y-1">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">{lbl}</span>
              <input value={merged[k] || ""} onChange={(e) => st.setFlat(k, e.target.value)} className={`${inputCls} w-full`} />
            </label>
          ))}
        </Section>
        <Section title="الإظهار">
          <div className="space-y-1.5">
            {[["show_logo", "الشعار"], ["show_address", "العنوان"], ["show_phone", "الهاتف"], ["show_watermark", "العلامة المائية"], ["show_signature_lines", "خطوط التوقيع"]].map(([k, lbl]) => (
              <Toggle key={k} label={lbl} checked={merged[k] !== false} onChange={(v) => st.setFlat(k, v)} />
            ))}
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="flex w-[310px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--border-normal)] bg-[var(--bg-surface)] p-3">

      {/* ═══ selected free overlay (page decorations) ═══ */}
      {selOverlay && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-[var(--text-primary)]">عنصر حر: {selLabel}</span>
            <button type="button" title="حذف" onClick={() => st.removeOverlay(selOverlay.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--danger-border)] text-[var(--danger)] hover:bg-[var(--danger-light)]"><Trash2 size={12} /></button>
          </div>
          <Section title="المحتوى">
            {(selOverlay.type === "text" || selOverlay.type === "stamp") && (
              <textarea value={selOverlay.props?.text || ""} onChange={(e) => st.setOverlay(selOverlay.id, { props: { text: e.target.value } })}
                className="h-16 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
            )}
            {selOverlay.type === "image" && (
              <>
                <input ref={overlayImgRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => readFile(e.target.files && e.target.files[0], (src) => st.setOverlay(selOverlay.id, { props: { src } }))} />
                <button type="button" onClick={() => overlayImgRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)]">
                  {selOverlay.props?.src ? "تغيير الصورة…" : "اختيار صورة…"}
                </button>
              </>
            )}
            {selOverlay.type !== "image" && (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Row label="حجم الخط">
                  <input type="number" value={selOverlay.props?.fontSize || 12} onChange={(e) => st.setOverlay(selOverlay.id, { props: { fontSize: clamp(Number(e.target.value) || 12, 6, 90) } })} className={`${inputCls} w-16`} />
                </Row>
                <Row label="اللون">
                  <ColorField value={selOverlay.props?.color} fallback="#0f172a"
                    onChange={(v) => st.setOverlay(selOverlay.id, { props: { color: v } })} />
                </Row>
              </div>
            )}
            {selOverlay.type === "stamp" && (
              <Row label="شفافية">
                <input type="range" min="0.2" max="1" step="0.1" value={selOverlay.props?.opacity ?? 0.9}
                  onChange={(e) => st.setOverlay(selOverlay.id, { props: { opacity: Number(e.target.value) } })} className="w-24" />
              </Row>
            )}
          </Section>
          <Section title="الموضع (مم) — أو اسحبه على الورقة">
            <div className="grid grid-cols-2 gap-2">
              <Row label="س"><input type="number" value={selOverlay.xMm} onChange={(e) => st.setOverlay(selOverlay.id, { xMm: Number(e.target.value) || 0 })} className={`${inputCls} w-16`} /></Row>
              <Row label="ص"><input type="number" value={selOverlay.yMm} onChange={(e) => st.setOverlay(selOverlay.id, { yMm: Number(e.target.value) || 0 })} className={`${inputCls} w-16`} /></Row>
              <Row label="عرض"><input type="number" value={selOverlay.widthMm || ""} placeholder="تلقائي" onChange={(e) => st.setOverlay(selOverlay.id, { widthMm: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-16`} /></Row>
              <Row label="زاوية°"><input type="number" value={selOverlay.props?.angle || 0} onChange={(e) => st.setOverlay(selOverlay.id, { props: { angle: Number(e.target.value) || 0 } })} className={`${inputCls} w-16`} /></Row>
            </div>
          </Section>
        </>
      )}

      {/* ═══ selected block ═══ */}
      {isBlockSel && (
        <>
          {/* header: name + quick actions that apply to every block */}
          <div className="flex items-center justify-between gap-1">
            <span className="min-w-0 truncate text-[11px] font-black text-[var(--text-primary)]">{selLabel}</span>
            <div className="flex shrink-0 items-center gap-1">
              {family === "roll" && (
                <>
                  <button type="button" className={btnCls(false)} title="تحريك لأعلى" disabled={!selInOrder} onClick={() => st.nudge(-1)}><ArrowUp size={12} /></button>
                  <button type="button" className={btnCls(false)} title="تحريك لأسفل" disabled={!selInOrder} onClick={() => st.nudge(1)}><ArrowDown size={12} /></button>
                </>
              )}
              <button type="button" className={btnCls(false)} title="إخفاء/إظهار" disabled={!selInOrder} onClick={() => st.toggleVisible(selected)}>
                {st.isVisible(selected) ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              {selInsert && <button type="button" className={btnCls(false)} title="تكرار (Ctrl+D)" onClick={st.duplicateSelected}><Copy size={12} /></button>}
              <button type="button" className={btnCls(false)} title="حذف (Delete)" onClick={st.deleteSelected}><Trash2 size={12} /></button>
            </div>
          </div>

          {/* free position — every block, every paper size */}
          <Section title="الموضع">
            <Toggle label="وضع حر — ضعه في أي مكان بالمليمتر" checked={!!isAbs} onChange={(v) => st.setFreePosition(selected, v)} />
            {isAbs && (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[["xMm", "س"], ["yMm", "ص"], ["widthMm", "عرض"]].map(([k, lbl]) => (
                    <label key={k} className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">{lbl} (مم)
                      <input type="number" value={selOv.abs[k] ?? ""} onChange={(e) => setAbs({ [k]: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-full`} />
                    </label>
                  ))}
                </div>
                <div className="mt-1.5">
                  <Toggle label="حجز مساحته الأصلية (لا يُزاح الباقي)" checked={Number(selOv.abs.holdMm) > 0}
                    onChange={(v) => setAbs({ holdMm: v ? Math.max(2, Number(selOv.abs.holdMm) || 6) : 0 })} />
                  {Number(selOv.abs.holdMm) > 0 && (
                    <Row label="ارتفاع المساحة (مم)">
                      <input type="number" value={selOv.abs.holdMm} onChange={(e) => setAbs({ holdMm: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} w-16`} />
                    </Row>
                  )}
                </div>
              </>
            )}
            <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-[var(--text-muted)]">
              <Move size={10} /> اسحب العنصر مباشرة على الورقة لتحريكه بحرية{family === "roll" ? " — Ctrl+سحب لإعادة الترتيب" : ""}. ينجذب تلقائياً لمنتصف الورقة.
            </div>
          </Section>

          {/* typography — text-driven blocks only */}
          {hasTypography && (
            <Section title="النص">
              <Row label="الخط">
                <select value={selOv.fontFamily || ""} onChange={(e) => setOv({ fontFamily: e.target.value || undefined })} className={`${inputCls} w-36`}>
                  <option value="">وراثة</option>
                  {PRINT_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  {SYSTEM_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Row>
              <div className="flex flex-wrap items-center gap-1 py-1">
                <button type="button" className={btnCls(false)} title="تصغير"
                  onClick={() => setOv({ fontSize: clamp((Number(selOv.fontSize) || Number(merged.item_font_size) || 11) - 1, 6, 90) })}>−</button>
                <input type="number" value={selOv.fontSize || ""} placeholder="—"
                  onChange={(e) => setOv({ fontSize: e.target.value === "" ? undefined : clamp(Number(e.target.value), 6, 90) })}
                  className={`${inputCls} w-12 text-center`} title="حجم الخط (px)" />
                <button type="button" className={btnCls(false)} title="تكبير"
                  onClick={() => setOv({ fontSize: clamp((Number(selOv.fontSize) || Number(merged.item_font_size) || 11) + 1, 6, 90) })}>+</button>
                <button type="button" className={btnCls(!!selOv.bold)} title="عريض" onClick={() => setOv({ bold: !selOv.bold })}><Bold size={12} /></button>
                <button type="button" className={btnCls(!!selOv.italic)} title="مائل" onClick={() => setOv({ italic: !selOv.italic })}><Italic size={12} /></button>
                <button type="button" className={btnCls(selOv.align === "right")} title="يمين" onClick={() => setOv({ align: selOv.align === "right" ? undefined : "right" })}><AlignRight size={12} /></button>
                <button type="button" className={btnCls(selOv.align === "center")} title="وسط" onClick={() => setOv({ align: selOv.align === "center" ? undefined : "center" })}><AlignCenter size={12} /></button>
                <button type="button" className={btnCls(selOv.align === "left")} title="يسار" onClick={() => setOv({ align: selOv.align === "left" ? undefined : "left" })}><AlignLeft size={12} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Row label="اللون">
                  <ColorField value={selOv.color} onChange={(v) => setOv({ color: v })} onClear={() => setOv({ color: undefined })} />
                </Row>
                <Row label="ارتفاع السطر">
                  <input type="number" step="0.1" value={selOv.lineHeight ?? ""} placeholder="—"
                    onChange={(e) => setOv({ lineHeight: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0.8, 3) })} className={`${inputCls} w-16`} />
                </Row>
              </div>
            </Section>
          )}

          {/* box / surface — background, border, padding, width, spacing */}
          {hasBox && (
            <Section title="الصندوق">
              {!isAbs && (
                <Row label="العرض">
                  <div className="flex items-center gap-1">
                    <button type="button" className={btnCls(false)} onClick={() => setOv({ width: clamp((Number(selOv.width) || 100) - 5, 10, 100) })}>−</button>
                    <span className="min-w-10 text-center text-[11px] font-bold text-[var(--text-secondary)]">{selOv.width ? `${selOv.width}%` : "كامل"}</span>
                    <button type="button" className={btnCls(false)} onClick={() => setOv({ width: clamp((Number(selOv.width) || 100) + 5, 10, 100) })}>+</button>
                    {selOv.width && <button type="button" className={btnCls(false)} title="عرض كامل" onClick={() => setOv({ width: undefined })}><X size={11} /></button>}
                  </div>
                </Row>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Row label="الخلفية">
                  <ColorField value={selOv.background} fallback="#ffffff"
                    onChange={(v) => setOv({ background: v })} onClear={() => setOv({ background: undefined })} />
                </Row>
                <Row label="حشو (px)">
                  <input type="number" value={selOv.padding ?? ""} placeholder="0"
                    onChange={(e) => setOv({ padding: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0, 40) })} className={`${inputCls} w-14`} />
                </Row>
              </div>
              <Row label="الإطار">
                <div className="flex items-center gap-1">
                  <input type="number" value={selOv.borderWidth ?? ""} placeholder="0" title="سماكة"
                    onChange={(e) => setOv({ borderWidth: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0, 5) })} className={`${inputCls} w-12`} />
                  <select value={selOv.borderStyle || "solid"} onChange={(e) => setOv({ borderStyle: e.target.value })} className={`${inputCls} w-18`}>
                    <option value="solid">متصل</option><option value="dashed">متقطع</option><option value="dotted">منقّط</option><option value="double">مزدوج</option>
                  </select>
                  <ColorField value={selOv.borderColor} fallback="#000000"
                    onChange={(v) => setOv({ borderColor: v })} onClear={() => setOv({ borderColor: undefined })} />
                </div>
              </Row>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">استدارة
                  <input type="number" value={selOv.borderRadius ?? ""} placeholder="0"
                    onChange={(e) => setOv({ borderRadius: e.target.value === "" ? undefined : clamp(Number(e.target.value), 0, 24) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">تباعد علوي
                  <input type="number" value={selOv.marginTop ?? ""} placeholder="0"
                    onChange={(e) => setOv({ marginTop: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">تباعد سفلي
                  <input type="number" value={selOv.marginBottom ?? ""} placeholder="0"
                    onChange={(e) => setOv({ marginBottom: e.target.value === "" ? undefined : Number(e.target.value) })} className={`${inputCls} w-full`} />
                </label>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button type="button" className={btnCls(false)} title="نسخ التنسيق" onClick={() => setCopiedStyle({ ...selOv, abs: undefined })}><Copy size={12} /> <span className="mr-1 text-[9px]">نسخ التنسيق</span></button>
                <button type="button" className={btnCls(false)} title="لصق التنسيق" disabled={!copiedStyle} onClick={() => copiedStyle && setOv(copiedStyle)}><ClipboardPaste size={12} /> <span className="mr-1 text-[9px]">لصق</span></button>
              </div>
            </Section>
          )}

          {/* ── block-specific controls ─────────────────────────────────── */}
          {selInsert && selInsert.type === "custom_text" && (
            <Section title="نص العنصر">
              <textarea value={selInsert.props?.text || ""} onChange={(e) => st.setInsert(selInsert.id, { props: { text: e.target.value } })}
                className="h-20 w-full resize-none rounded-lg border border-[var(--border-normal)] bg-[var(--bg-input)] p-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PLACEHOLDER_KEYS.map((k) => (
                  <button key={k} type="button" title="إدراج متغير — يُستبدل بقيمته الحقيقية عند الطباعة"
                    onClick={() => st.setInsert(selInsert.id, { props: { text: `${selInsert.props?.text || ""}{${k}}` } })}
                    className="rounded border border-dashed border-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                    {`{${k}}`}
                  </button>
                ))}
              </div>
              <Row label="الموضع بعد">
                <select value={selInsert.after} onChange={(e) => st.setInsert(selInsert.id, { after: e.target.value })} className={`${inputCls} w-36`}>
                  {fam.order.map((t) => <option key={t} value={t}>{BLOCK_REGISTRY[t]?.label || t}</option>)}
                </select>
              </Row>
            </Section>
          )}

          {selInsert && selInsert.type === "divider" && (
            <Section title="شكل الفاصل">
              <div className="grid grid-cols-4 gap-1">
                {[["solid", "───"], ["dash", "— —"], ["dots", "· · ·"], ["wave", "∼∼∼"]].map(([v, lbl]) => (
                  <button key={v} type="button" onClick={() => st.setInsert(selInsert.id, { props: { style: v } })}
                    className={btnCls((selInsert.props?.style || "solid") === v)}>{lbl}</button>
                ))}
              </div>
            </Section>
          )}

          {selInsert && selInsert.type === "spacer" && (
            <Section title="المسافة">
              <Row label="الارتفاع (px)">
                <input type="number" value={selInsert.props?.height ?? 8}
                  onChange={(e) => st.setInsert(selInsert.id, { props: { height: clamp(Number(e.target.value) || 8, 2, 120) } })} className={`${inputCls} w-20`} />
              </Row>
            </Section>
          )}

          {selected === "items_table" && (
            <Section title="أعمدة الجدول">
              <div className="space-y-0.5">
                {st.columns.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-1.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} title="لأعلى"
                        onClick={() => { const n = [...st.columns]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; st.setColumns(n); }}
                        className="text-[8px] leading-none text-[var(--text-muted)] disabled:opacity-20">▲</button>
                      <button type="button" disabled={i === st.columns.length - 1} title="لأسفل"
                        onClick={() => { const n = [...st.columns]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; st.setColumns(n); }}
                        className="text-[8px] leading-none text-[var(--text-muted)] disabled:opacity-20">▼</button>
                    </div>
                    <input value={c.label} title="اسم العمود على الورقة"
                      onChange={(e) => st.setColumns(st.columns.map((x) => x.key === c.key ? { ...x, label: e.target.value } : x))}
                      className="w-14 rounded border border-[var(--border-normal)] bg-[var(--bg-input)] px-1 py-0.5 text-[10px] text-[var(--text-primary)]" />
                    <select value={c.align || "right"}
                      onChange={(e) => st.setColumns(st.columns.map((x) => x.key === c.key ? { ...x, align: e.target.value } : x))}
                      className="rounded border border-[var(--border-normal)] bg-[var(--bg-input)] px-1 py-0.5 text-[10px] text-[var(--text-primary)]">
                      <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                    </select>
                    <button type="button" title={c.visible === false ? "إظهار" : "إخفاء"}
                      onClick={() => st.setColumns(st.columns.map((x) => x.key === c.key ? { ...x, visible: x.visible === false } : x))}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      {c.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button type="button" title="إزالة العمود"
                      onClick={() => st.setColumns(st.columns.filter((x) => x.key !== c.key))}
                      className="mr-auto text-[var(--text-muted)] hover:text-[var(--danger)]"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              {COLUMN_CATALOG.filter((c) => !st.columns.some((x) => x.key === c.key)).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {COLUMN_CATALOG.filter((c) => !st.columns.some((x) => x.key === c.key)).map((c) => (
                    <button key={c.key} type="button"
                      onClick={() => st.setColumns([...st.columns, { key: c.key, label: c.label, visible: true, align: "center" }])}
                      className="rounded border border-dashed border-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                      + {c.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 space-y-1.5">
                <Toggle label="تظليل الصفوف (زيبرا)" checked={st.ov("items_table").zebra !== false} onChange={(v) => st.setOverride("items_table", { zebra: v })} />
                <Row label="الحدود">
                  <select value={st.ov("items_table").tableBorder || "none"} onChange={(e) => st.setOverride("items_table", { tableBorder: e.target.value })} className={`${inputCls} w-24`}>
                    <option value="none">بلا</option><option value="lines">خطوط</option><option value="grid">شبكة</option>
                  </select>
                </Row>
                <Row label="حجم خط الجدول">
                  <input type="number" value={st.ov("items_table").fontSize || ""} placeholder={String(merged.item_font_size || 13)}
                    onChange={(e) => st.setOverride("items_table", { fontSize: e.target.value === "" ? undefined : clamp(Number(e.target.value), 7, 24) })} className={`${inputCls} w-16`} />
                </Row>
              </div>
            </Section>
          )}

          {selected === "logo" && (
            <Section title="الشعار">
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => readFile(e.target.files && e.target.files[0], (src) => st.setFlat("logo_url", src))} />
              <button type="button" onClick={() => logoFileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)]">
                {merged.logo_url ? "تغيير الشعار…" : "رفع شعار…"}
              </button>
              <Row label="المحاذاة">
                <div className="flex gap-1">
                  {[["right", "يمين"], ["center", "وسط"], ["left", "يسار"]].map(([a, lbl]) => (
                    <button key={a} type="button" onClick={() => st.setFlat("logo_alignment", a)} className={btnCls((merged.logo_alignment || "center") === a)}>{lbl}</button>
                  ))}
                </div>
              </Row>
              <Row label="الارتفاع (px)">
                <input type="number" value={Number(merged.logo_max_height) || 48}
                  onChange={(e) => st.setFlat("logo_max_height", clamp(Number(e.target.value) || 48, 16, 400))} className={`${inputCls} w-20`} />
              </Row>
              <div className="mt-1 text-[9px] font-bold text-[var(--text-muted)]">أو اسحب مقبض الزاوية على الورقة لتغيير الحجم.</div>
            </Section>
          )}

          {(selected === "qr" || (selInsert && selInsert.type === "qr")) && (
            <Section title="رمز QR">
              <Row label="النوع">
                <select value={merged.qr_mode || "free_text"} onChange={(e) => st.setFlat("qr_mode", e.target.value)} className={`${inputCls} w-36`}>
                  <option value="free_text">نص حر</option>
                  <option value="zatca">فاتورة إلكترونية ZATCA</option>
                </select>
              </Row>
              {(merged.qr_mode || "free_text") === "free_text" && (
                <label className="mt-1 block space-y-1">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">محتوى الرمز (رابط أو نص)</span>
                  <input value={merged.qr_content || ""} onChange={(e) => st.setFlat("qr_content", e.target.value)} className={`${inputCls} w-full`} />
                </label>
              )}
              {merged.qr_mode === "zatca" && (
                <div className="mt-1 rounded-lg bg-[var(--info-bg)] p-2 text-[9px] font-bold leading-relaxed text-[var(--info-text)]">
                  يُولَّد الرمز تلقائياً من اسم الشركة والرقم الضريبي وبيانات الفاتورة وفق مواصفة ZATCA.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Row label="الحجم (px)">
                  <input type="number" value={Number(merged.qr_size) || 44}
                    onChange={(e) => st.setFlat("qr_size", clamp(Number(e.target.value) || 44, 24, 400))} className={`${inputCls} w-16`} />
                </Row>
                <Row label="المحاذاة">
                  <select value={merged.qr_alignment || "right"} onChange={(e) => st.setFlat("qr_alignment", e.target.value)} className={`${inputCls} w-20`}>
                    <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                  </select>
                </Row>
              </div>
            </Section>
          )}

          {selected === "image" && (
            <Section title="صورة / بانر">
              <input ref={imageFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => readFile(e.target.files && e.target.files[0], (src) => st.setOverride("image", { src }))} />
              <button type="button" onClick={() => imageFileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)]">
                {st.ov("image").src ? "تغيير الصورة…" : "رفع صورة…"}
              </button>
              <Row label="الارتفاع (px)">
                <input type="number" value={st.ov("image").maxHeight ?? 60}
                  onChange={(e) => st.setOverride("image", { maxHeight: clamp(Number(e.target.value) || 60, 16, 400) })} className={`${inputCls} w-20`} />
              </Row>
              {family === "roll" && (
                <Toggle label="معالجة حرارية (أبيض/أسود)" checked={st.ov("image").thermalProcess !== false}
                  onChange={(v) => st.setOverride("image", { thermalProcess: v })} />
              )}
            </Section>
          )}

          {selected === "order_number" && (
            <Section title="رقم الطلب">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">التسمية فوق الرقم (اتركها فارغة لإخفائها)</span>
                <input value={st.ov("order_number").label ?? "رقم الطلب"}
                  onChange={(e) => st.setOverride("order_number", { label: e.target.value })} className={`${inputCls} w-full`} />
              </label>
              <Row label="حجم الرقم (px)">
                <input type="number" value={st.ov("order_number").fontSize ?? 34}
                  onChange={(e) => st.setOverride("order_number", { fontSize: clamp(Number(e.target.value) || 34, 14, 120) })} className={`${inputCls} w-20`} />
              </Row>
            </Section>
          )}

          {selected === "watermark" && (
            <Section title="العلامة المائية">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">النص</span>
                <input value={merged.watermark_text || ""} onChange={(e) => st.setFlat("watermark_text", e.target.value)} className={`${inputCls} w-full`} />
              </label>
              <div className="mt-1.5">
                <Toggle label="إظهار العلامة المائية" checked={merged.show_watermark === true} onChange={(v) => st.setFlat("show_watermark", v)} />
              </div>
            </Section>
          )}

          {selected === "address" && (
            <Section title="العنوان والهاتف">
              <Row label="الموضع">
                <select value={merged.address_position || "top"} onChange={(e) => st.setFlat("address_position", e.target.value)} className={`${inputCls} w-32`}>
                  <option value="top">في رأس المستند</option>
                  <option value="bottom">أسفل المستند</option>
                </select>
              </Row>
            </Section>
          )}

          <button type="button" onClick={() => st.setSelected(null)}
            className="rounded-lg border border-[var(--border-normal)] py-1.5 text-[10px] font-bold text-[var(--text-muted)] hover:bg-[var(--bg-input)]">
            إلغاء التحديد — عرض إعدادات الورقة
          </button>
        </>
      )}

      {/* ═══ nothing selected: paper / typography panel ═══ */}
      {!selected && (
        <>
          <Section title="الخط والألوان">
            <Row label="الخط">
              <select value={merged.print_font || "Tajawal"} onChange={(e) => st.setFlat("print_font", e.target.value)} className={`${inputCls} w-40`}>
                {PRINT_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f} (مضمّن)</option>)}
                {SYSTEM_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Row>
            <Row label="لون العناوين">
              <ColorField value={merged.accent_color} fallback="#0f172a" onChange={(v) => st.setFlat("accent_color", v)} />
            </Row>
            <Row label="الأرقام">
              <select value={merged.print_numerals || "western"} onChange={(e) => st.setFlat("print_numerals", e.target.value)} className={`${inputCls} w-32`}>
                <option value="western">1 2 3</option>
                <option value="arabic">١ ٢ ٣</option>
              </select>
            </Row>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[["header_font_size", "اسم الشركة", 10, 32, 16], ["body_font_size", "نص الجسم", 8, 18, 13],
                ["item_font_size", "جدول الأصناف", 8, 16, 13], ["footer_font_size", "التذييل", 8, 16, 11]].map(([k, lbl, min, max, dflt]) => (
                <label key={k} className="flex flex-col gap-1 text-[10px] font-bold text-[var(--text-muted)]">خط {lbl}
                  <input type="number" value={Number(merged[k]) || dflt}
                    onChange={(e) => st.setFlat(k, clamp(Number(e.target.value) || dflt, min, max))} className={`${inputCls} w-full`} />
                </label>
              ))}
            </div>
          </Section>

          {family === "roll" && (
            <Section title="الطباعة الحرارية">
              <Toggle label="أسود نقي (وضوح أقصى)" checked={merged.thermal_pure_black !== false} onChange={(v) => st.setFlat("thermal_pure_black", v)} />
              <div className="mt-2 rounded-lg border border-[var(--border-normal)] p-2.5">
                <div className="text-[10px] font-black text-[var(--text-secondary)]">الطابعة: <span className="font-bold text-[var(--text-muted)]">{st.printerName || "غير معيّنة"}</span></div>
                {st.calibration && (
                  <div className="mt-1 text-[9px] font-bold text-[var(--text-muted)]">
                    منطقة الطباعة: {st.calibration.printAreaWidthMm ? `${st.calibration.printAreaWidthMm}مم` : "افتراضية"} · إزاحة: {st.calibration.shiftXMm || 0}مم
                  </div>
                )}
                <button type="button" onClick={st.openCalibration}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-normal)] py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
                  <Wrench size={12} /> معالج المعايرة
                </button>
              </div>
            </Section>
          )}

          {family === "page" && (
            <Section title="تصميم الصفحة">
              <Row label="شكل الترويسة">
                <select value={(fam.headerStyle) || "band"} onChange={(e) => st.setFamLayout(() => ({ headerStyle: e.target.value }))} className={`${inputCls} w-28`}>
                  <option value="band">شريط ملوّن</option>
                  <option value="classic">كلاسيكي</option>
                  <option value="minimal">بسيط</option>
                </select>
              </Row>
              <Row label="محاذاة بيانات الرأس">
                <select value={fam.headerMetaAlign || "left"} onChange={(e) => st.setFamLayout(() => ({ headerMetaAlign: e.target.value }))} className={`${inputCls} w-24`}>
                  <option value="left">يسار</option><option value="center">وسط</option><option value="right">يمين</option>
                </select>
              </Row>
            </Section>
          )}

          <Section title="نصوص المستند">
            {[["receipt_header", "رأس المستند"], ["receipt_footer", "تذييل المستند"]].map(([k, lbl]) => (
              <label key={k} className="mb-2 block space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)]">{lbl}</span>
                <input value={merged[k] || ""} onChange={(e) => st.setFlat(k, e.target.value)} className={`${inputCls} w-full`} />
              </label>
            ))}
            <Toggle label='ختم "نسخة" عند إعادة الطباعة' checked={merged.reprint_stamp === true} onChange={(v) => st.setFlat("reprint_stamp", v)} />
          </Section>

          {family === "page" && (
            <Section title="عناصر حرة (بالمليمتر)">
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => st.addOverlay("text")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-normal)] py-2 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  <Type size={13} /> نص حر
                </button>
                <button type="button" onClick={() => st.addOverlay("stamp")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-normal)] py-2 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  <Stamp size={13} /> ختم
                </button>
                <button type="button" onClick={() => st.addOverlay("image")}
                  className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-normal)] py-2 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]">
                  <ImageIcon size={13} /> صورة
                </button>
              </div>
              {st.overlays.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {st.overlays.map((o) => (
                    <button key={o.id} type="button" onClick={() => st.setSelected(o.id)}
                      className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-right text-[10px] font-bold ${st.selected === o.id ? "border-[var(--primary)] bg-[var(--accent-soft)]" : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"}`}>
                      <span className="flex-1 truncate">{{ text: "نص حر", stamp: "ختم", image: "صورة" }[o.type]}{o.props?.text ? `: ${o.props.text}` : ""}</span>
                      <span className="text-[8px] text-[var(--text-muted)]">{o.xMm}،{o.yMm}مم</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          )}

          <button type="button" onClick={st.resetFamily}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-normal)] py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
            <RotateCcw size={12} /> إعادة ضبط تخطيط {family === "roll" ? "الرول" : "الصفحة"}
          </button>
        </>
      )}
    </div>
  );
}
