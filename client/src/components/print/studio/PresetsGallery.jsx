import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { X, BookmarkPlus, Download, Upload, Trash2, Check } from "lucide-react";
import toast from "react-hot-toast";
import LayoutRenderer from "../LayoutRenderer";
import { presetsForSize } from "../presets/builtinPresets";
import {
  applyPreset, captureAsPreset, getUserPresets, saveUserPreset,
  deleteUserPreset, exportUserPresets, importUserPresets,
} from "../presets/presetEngine";
import { SHEET_W, sampleById } from "./studioData";

export const TAG_LABELS = {
  bilingual: "ثنائي اللغة", compact: "موفر للورق", ticket: "تذكرة طلب",
  kitchen: "مطبخ", modern: "عصري", classic: "كلاسيكي", minimal: "بسيط",
  bordered: "مؤطَّر", dense: "كثيف", user: "قوالبي",
  simple: "بسيط", whitespace: "هوائي", framed: "مؤطَّر", elegant: "أنيق",
  boutique: "بوتيك", pharmacy: "صيدلية", cafe: "كافيه", electronics: "إلكترونيات",
  delivery: "توصيل", zatca: "زاتكا ZATCA", compliance: "امتثال ضريبي",
  service: "خدمات", supermarket: "سوبرماركت", wholesale: "جملة",
  ultra: "فائق التوفير", formal: "رسمي", draft: "مسودة", letterhead: "ترويسة",
  dark: "داكن", quotation: "عرض سعر", statement: "كشف حساب",
  retail: "تجزئة", warranty: "ضمان", restaurant: "مطعم", kiosk: "كشك",
  promo: "عروض", luxury: "فاخر", station: "محطة",
};
const tagLabel = (t) => TAG_LABELS[t] || t;

// A thumbnail that always shows the WHOLE sheet: render at true size, measure,
// then scale to fit the card box (width and height) — no more cut-off A4s.
function Thumb({ family, size, invoice, settings, layout }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const box = boxRef.current, inner = innerRef.current;
    if (!box || !inner) return;
    const w = inner.offsetWidth, h = inner.offsetHeight;
    if (!w || !h) return;
    setScale(Math.min((box.clientWidth - 14) / w, (box.clientHeight - 14) / h));
  }, [settings, layout, size]);
  return (
    <div ref={boxRef} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div ref={innerRef} style={{
        flexShrink: 0, width: SHEET_W[size], background: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        transform: `scale(${scale || 0.15})`, transformOrigin: "center center",
        visibility: scale ? "visible" : "hidden",
      }}>
        <LayoutRenderer family={family} size={size} invoice={invoice} settings={settings} layout={layout} />
      </div>
    </div>
  );
}

// Preset gallery: live thumbnails rendered by the REAL LayoutRenderer, so what
// you see is exactly what applying the preset produces. One click applies
// (undoable); the current design can be captured as a new user preset.
export default function PresetsGallery({ open, onClose, family, size, merged, currentFamilyLayout, onApply }) {
  const [tag, setTag] = useState("");
  const [userPresets, setUserPresets] = useState(getUserPresets);
  const [appliedId, setAppliedId] = useState(null);
  const importRef = useRef(null);
  const invoice = sampleById("normal");

  const builtins = useMemo(() => presetsForSize(size), [size]);
  const users = userPresets.filter((p) => p.family === family && (!p.sizes || !p.sizes.length || p.sizes.includes(size)));
  const all = [...users, ...builtins];
  const tags = useMemo(() => {
    const s = new Set();
    all.forEach((p) => (p.tags || []).forEach((t) => s.add(t)));
    return [...s];
  }, [all]);
  const visible = tag ? all.filter((p) => (p.tags || []).includes(tag)) : all;

  const CARD_W = family === "roll" ? 200 : 250;
  const THUMB_H = family === "roll" ? 320 : 330;

  const saveCurrent = () => {
    const name = (window.prompt("اسم القالب الجديد:") || "").trim();
    if (!name) return;
    const preset = captureAsPreset(
      { ...merged, layout: { [family]: currentFamilyLayout } },
      {
        name, family, sizes: [size],
        flatKeys: ["print_font", "accent_color", "thermal_pure_black", "print_numerals", "qr_mode",
          "header_font_size", "body_font_size", "footer_font_size", "item_font_size"],
      }
    );
    setUserPresets(saveUserPreset(preset));
    toast.success(`حُفظ القالب: ${name}`);
  };

  const doExport = () => {
    const blob = exportUserPresets();
    if (!blob.presets.length) { toast("لا توجد قوالب مخصصة للتصدير"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: "application/json" }));
    a.download = `retailer-print-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("تم تصدير القوالب");
  };

  const doImport = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        setUserPresets(importUserPresets(JSON.parse(r.result)));
        toast.success("تم استيراد القوالب");
      } catch { toast.error("ملف قوالب غير صالح"); }
    };
    r.readAsText(file);
  };

  if (!open) return null;

  return (
    <div dir="rtl" className="fixed inset-0 z-[10000] flex flex-col bg-[var(--bg-base)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-normal)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-[var(--text-primary)]">القوالب الجاهزة — {size}</span>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">{visible.length} قالباً · كل قالب قابل للتعديل الكامل بعد تطبيقه</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={saveCurrent}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-normal)] px-3 py-1.5 text-[11px] font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input)]">
            <BookmarkPlus size={13} /> حفظ التصميم الحالي كقالب
          </button>
          <button type="button" onClick={doExport} title="تصدير قوالبي كملف"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><Download size={13} /></button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => doImport(e.target.files && e.target.files[0])} />
          <button type="button" onClick={() => importRef.current?.click()} title="استيراد قوالب من ملف"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"><Upload size={13} /></button>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-input)]"><X size={16} /></button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2">
          <button type="button" onClick={() => setTag("")}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${!tag ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>الكل</button>
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => setTag(tag === t ? "" : t)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${tag === t ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-[var(--bg-input)]"}`}>
              {tagLabel(t)}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_W + 24}px, 1fr))` }}>
          {visible.map((p) => {
            const previewSettings = { ...merged, ...(p.flat || {}), receipt_width: family === "roll" ? size : merged.receipt_width };
            const previewLayout = applyPreset({}, p).layout;
            const isUser = (p.tags || []).includes("user");
            return (
              <div key={p.id} className="group flex flex-col overflow-hidden rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] transition-shadow hover:shadow-lg">
                <button type="button" onClick={() => { onApply(p); setAppliedId(p.id); }}
                  title="انقر لتطبيق القالب (يمكن التراجع بـ Ctrl+Z)"
                  className="relative block overflow-hidden bg-[#e0e0e2] text-right" style={{ height: THUMB_H }}>
                  <div className="pointer-events-none absolute inset-0">
                    <Thumb family={family} size={size} invoice={invoice} settings={previewSettings} layout={previewLayout} />
                  </div>
                  {appliedId === p.id && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[var(--primary)] px-2 py-0.5 text-[9px] font-black text-white"><Check size={10} /> مطبَّق</span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-1.5 pt-6 text-center text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
                    انقر للتطبيق
                  </span>
                </button>
                <div className="flex items-center gap-1.5 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-black text-[var(--text-primary)]">{p.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {(p.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-[var(--bg-input)] px-1 py-px text-[8px] font-bold text-[var(--text-muted)]">{tagLabel(t)}</span>
                      ))}
                    </div>
                  </div>
                  {isUser && (
                    <button type="button" title="حذف القالب"
                      onClick={() => { setUserPresets(deleteUserPreset(p.id)); toast.success("حُذف القالب"); }}
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)]"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!visible.length && (
          <div className="py-16 text-center text-sm font-bold text-[var(--text-muted)]">لا توجد قوالب مطابقة لهذا التصنيف.</div>
        )}
      </div>
    </div>
  );
}
