import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X, BookmarkPlus, Download, Upload, Trash2, Check, Maximize2, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import LayoutRenderer from "../LayoutRenderer";
import { presetsForSize } from "../presets/builtinPresets";
import {
  applyPreset, captureAsPreset, getUserPresets, saveUserPreset,
  deleteUserPreset, exportUserPresets, importUserPresets,
} from "../presets/presetEngine";
import { SHEET_W, sampleById, TEMPLATE_PRESETS, TEMPLATE_MOCK, SCOPE_PRESETS } from "./studioData";

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
  warm: "دافئ",
};
const tagLabel = (t) => TAG_LABELS[t] || t;

// A thumbnail that always shows the WHOLE sheet: render at true size, measure
// via ResizeObserver (captures async QR/barcode canvas renders), then scale to
// fit anchored at top-center so the bottom is never clipped.
function Thumb({ family, size, invoice, settings, layout, isBlockDoc, renderPreview, scope }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(0);

  // ResizeObserver recalculates whenever content changes size (including async
  // canvas-painted QR codes and barcode SVGs that finish after initial mount).
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const box = boxRef.current;
    if (!inner || !box) return;
    const measure = () => {
      const w = inner.offsetWidth;
      const h = inner.scrollHeight || inner.offsetHeight;
      if (!w || !h) return;
      // anchor = top-center: scale fits by width primarily, height secondarily
      const scaleW = (box.clientWidth - 8) / w;
      const scaleH = (box.clientHeight - 8) / h;
      setScale(Math.min(scaleW, scaleH));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [settings, layout, size]);

  return (
    <div ref={boxRef} style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div ref={innerRef} style={{
        flexShrink: 0,
        width: SHEET_W[size],
        background: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        transform: `scale(${scale || 0.12})`,
        transformOrigin: "top center",
        visibility: scale ? "visible" : "hidden",
      }}>
        {isBlockDoc
          ? <LayoutRenderer family={family} size={size} invoice={invoice} settings={settings} layout={layout} scope={scope} />
          : renderPreview ? renderPreview(settings) : null
        }
      </div>
    </div>
  );
}

// Preset gallery: live thumbnails rendered by the REAL LayoutRenderer, so what
// you see is exactly what applying the preset produces. One click applies
// (undoable); the current design can be captured as a new user preset.
export default function PresetsGallery({ open, onClose, family, size, merged, currentFamilyLayout, onApply, isBlockDoc, scope, renderPreview, appliedPresetId }) {
  const [tag, setTag] = useState("");
  const [userPresets, setUserPresets] = useState(getUserPresets);
  const [previewOpen, setPreviewOpen] = useState(null);
  const [appliedId, setAppliedId] = useState(() => {
    // Exact hint wins: the doc stamped which preset it was created from.
    if (appliedPresetId) return appliedPresetId;
    if (!currentFamilyLayout) return null;
    const cfl = currentFamilyLayout;
    const isReport = scope !== "_global" && !["pos_receipt", "sales_invoice", "purchase_order", "sales_return", "quotation", "branch_transfer", "purchase_return", "payment_receipt"].includes(scope);
    const builtins = isReport ? (SCOPE_PRESETS[scope] || TEMPLATE_PRESETS) : presetsForSize(size);
    const users = isReport
      ? getUserPresets().filter((p) => p.isTemplate)
      : getUserPresets().filter((p) => !p.isTemplate && p.family === family && (!p.sizes || !p.sizes.length || p.sizes.includes(size)));
    const all = [...users, ...builtins];

    if (isBlockDoc) {
      if (family === "page") {
        const match = all.find(p => p.layout && p.layout.pageLayoutType === cfl.pageLayoutType && p.layout.headerStyle === cfl.headerStyle);
        return match ? match.id : null;
      } else {
        const cflCols = cfl.perBlock?.items_table?.columns?.map(c => c.key).join();
        const cflBorder = cfl.perBlock?.items_table?.tableBorder;
        const match = all.find(p => {
          if (!p.layout) return false;
          const pCols = p.layout.perBlock?.items_table?.columns?.map(c => c.key).join();
          const pBorder = p.layout.perBlock?.items_table?.tableBorder || p.layout.items_table?.tableBorder;
          return pCols === cflCols && pBorder === cflBorder;
        });
        return match ? match.id : null;
      }
    } else {
      const match = all.find(p => {
        if (!p.flat) return false;
        return Object.keys(p.flat).every(k => merged[k] === p.flat[k]);
      });
      return match ? match.id : null;
    }
  });
  const importRef = useRef(null);
  useEffect(() => {
    if (!previewOpen) return;
    const h = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPreviewOpen(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [previewOpen]);
  const isReport = scope !== "_global" && !["pos_receipt", "sales_invoice", "purchase_order", "sales_return", "quotation", "branch_transfer", "purchase_return", "payment_receipt"].includes(scope);
  const invoice = useMemo(() => {
    if (isReport && TEMPLATE_MOCK[scope]) {
      const raw = TEMPLATE_MOCK[scope];
      if (scope === "account_statement") {
        return { ...raw, statement_rows: raw.rows || [], statement_summary: raw.summary || {} };
      }
      return raw;
    }
    return sampleById("normal");
  }, [isReport, scope]);

  const builtins = useMemo(() => {
    if (isReport) {
      return SCOPE_PRESETS[scope] || TEMPLATE_PRESETS;
    }
    return presetsForSize(size);
  }, [size, isReport, scope]);

  const users = useMemo(() => {
    if (isReport) {
      return userPresets.filter((p) => p.isTemplate);
    }
    return userPresets.filter((p) => !p.isTemplate && p.family === family && (!p.sizes || !p.sizes.length || p.sizes.includes(size)));
  }, [userPresets, family, size, isReport]);

  const all = [
    ...(scope !== "_global" ? [{ id: "fallback-global", name: "بدون قالب (العودة للتصميم العام)", isFallback: true }] : []),
    ...users,
    ...builtins
  ];
  const tags = useMemo(() => {
    const s = new Set();
    all.forEach((p) => {
      if (p && p.tags) p.tags.forEach((t) => s.add(t));
    });
    return [...s];
  }, [all]);
  const visible = tag ? all.filter((p) => (p.tags || []).includes(tag)) : all;

  const CARD_W = family === "roll" && isBlockDoc ? 200 : 250;
  const THUMB_H = family === "roll" && isBlockDoc ? 320 : 330;

  const saveCurrent = () => {
    const name = (window.prompt("اسم القالب الجديد:") || "").trim();
    if (!name) return;
    let preset;
    if (!isBlockDoc) {
      preset = {
        id: `user_tmpl_${Date.now().toString(36)}`,
        name,
        isTemplate: true,
        tags: ["user"],
        flat: {},
      };
      const flatKeys = [
        "print_font", "accent_color", "item_font_size", "page_padding", "paper_size",
        "table_header_style", "table_border", "table_zebra", "table_row_pad", "header_style",
        "show_logo", "show_address", "show_phone", "show_watermark", "show_signature_lines",
        "show_receiver_signature",
        "receipt_header", "receipt_footer", "watermark_text"
      ];
      flatKeys.forEach((k) => {
        if (merged[k] !== undefined) preset.flat[k] = merged[k];
      });
    } else {
      preset = captureAsPreset(
        { ...merged, layout: { [family]: currentFamilyLayout } },
        {
          name, family, sizes: [size],
          flatKeys: ["print_font", "accent_color", "thermal_pure_black", "print_numerals", "qr_mode",
            "header_font_size", "body_font_size", "footer_font_size", "item_font_size"],
        }
      );
      if (isReport) {
        preset.isTemplate = true;
      }
    }
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
            const presetApplied = isBlockDoc ? applyPreset({}, p, scope) : null;
            const { layout: _lo, ...presetFlat } = presetApplied || {};
            const previewSettings = { ...merged, ...presetFlat, receipt_width: family === "roll" ? size : merged.receipt_width };
            const previewLayout = isBlockDoc ? (presetApplied?.layout || null) : null;
            const isUser = (p.tags || []).includes("user");
            const isApplied = p.isFallback ? (!appliedId) : (appliedId === p.id);

            if (p.isFallback) {
              return (
                <div key={p.id} 
                  className="group flex flex-col overflow-hidden rounded-xl border transition-all duration-200"
                  style={isApplied ? {
                    borderWidth: "2px",
                    borderColor: "var(--primary)",
                    boxShadow: "0 0 14px rgba(var(--primary-rgb, 59, 130, 246), 0.18)",
                    backgroundColor: "rgba(var(--primary-rgb, 59, 130, 246), 0.03)"
                  } : {
                    borderColor: "var(--border-normal)"
                  }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { onApply(p); setAppliedId(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { onApply(p); setAppliedId(null); } }}
                    title="العودة لوراثة التصميم العام المشترك"
                    className="relative flex flex-col items-center justify-center bg-[var(--bg-input)] p-6 text-center cursor-pointer select-none" style={{ height: THUMB_H }}>
                    
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-600 mb-4 group-hover:scale-110 transition-transform">
                      <RotateCcw size={28} />
                    </div>
                    
                    <h4 className="text-2sm font-black text-[var(--text-primary)] mb-2">وراثة التصميم العام</h4>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] leading-relaxed max-w-[180px]">
                      يرث هذا المستند التصميم المشترك مباشرة. أي تعديل في "التصميم العام" بالاستوديو سيظهر هنا فوراً.
                    </p>

                    {isApplied ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-[var(--primary)]/10 backdrop-blur-[0.5px]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg border border-white/20">
                          <Check size={28} strokeWidth={3} />
                        </div>
                      </div>
                    ) : (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-1.5 pt-6 text-center text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
                        انقر للعودة للتصميم العام
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-2 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-black text-[var(--text-primary)]">{p.name}</div>
                      {isApplied && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] font-black text-[var(--success-text)]">
                          <Check size={10} strokeWidth={3} /> مطبَّق حالياً
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={p.id} 
                className="group flex flex-col overflow-hidden rounded-xl border transition-all duration-200"
                style={isApplied ? {
                  borderWidth: "2px",
                  borderColor: "var(--primary)",
                  boxShadow: "0 0 14px rgba(var(--primary-rgb, 59, 130, 246), 0.18)",
                  backgroundColor: "rgba(var(--primary-rgb, 59, 130, 246), 0.03)"
                } : {
                  borderColor: "var(--border-normal)"
                }}>
                {/* Outer wrapper is a div (not button) to avoid nested-button DOM violation.
                    Click-to-apply is on the div; fullscreen is a real button inside. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => { onApply(p); setAppliedId(p.id); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { onApply(p); setAppliedId(p.id); } }}
                  title="انقر لتطبيق القالب (يمكن التراجع بـ Ctrl+Z)"
                  className="relative block overflow-hidden bg-[#e0e0e2] text-right cursor-pointer select-none" style={{ height: THUMB_H }}>
                  <div className="pointer-events-none absolute inset-0">
                    <Thumb family={family} size={size} invoice={invoice} settings={previewSettings} layout={previewLayout} isBlockDoc={isBlockDoc} renderPreview={renderPreview} scope={scope} />
                  </div>

                  {/* Fullscreen Preview — real button (not nested inside another button now) */}
                  <button type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewOpen({ preset: p, settings: previewSettings, layout: previewLayout });
                    }}
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/85 group-hover:opacity-100 shadow-md cursor-pointer"
                    title="معاينة بكامل الشاشة">
                    <Maximize2 size={14} />
                  </button>

                  {isApplied ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--primary)]/10 backdrop-blur-[0.5px]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg border border-white/20">
                        <Check size={28} strokeWidth={3} />
                      </div>
                    </div>
                  ) : (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-1.5 pt-6 text-center text-[10px] font-black text-white opacity-0 transition-opacity group-hover:opacity-100">
                      انقر للتطبيق
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-2 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-black text-[var(--text-primary)]">{p.name}</div>
                    {isApplied ? (
                      <div className="mt-1 flex items-center gap-1 text-[9px] font-black text-[var(--success-text)]">
                        <Check size={10} strokeWidth={3} /> مطبَّق حالياً
                      </div>
                    ) : (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {(p.tags || []).slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-[var(--bg-input)] px-1 py-px text-[8px] font-bold text-[var(--text-muted)]">{tagLabel(t)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isUser && (
                    <button type="button" title="حذف القالب"
                      onClick={() => { setUserPresets(deleteUserPreset(p.id)); toast.success("حُذف القالب"); }}
                      className="shrink-0 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"><Trash2 size={13} /></button>
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

      {/* Fullscreen Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-[10001] flex flex-col bg-black/80 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4 text-white">
            <div>
              <h3 className="text-base font-black">{previewOpen.preset.name}</h3>
              <p className="mt-1 text-[10px] text-zinc-400">معاينة كاملة للقالب قبل التطبيق</p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => {
                  onApply(previewOpen.preset);
                  setAppliedId(previewOpen.preset.id);
                  setPreviewOpen(null);
                }}
                className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-black text-white hover:bg-[var(--primary)]/90 transition-colors shadow-lg cursor-pointer">
                <Check size={14} strokeWidth={3} /> تطبيق هذا القالب
              </button>
              <button type="button" onClick={() => setPreviewOpen(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 flex justify-center items-start">
            <div className="relative border border-zinc-800" style={{
              width: SHEET_W[size],
              background: "#fff",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}>
              {isBlockDoc
                ? <LayoutRenderer family={family} size={size} invoice={invoice} settings={previewOpen.settings} layout={previewOpen.layout} scope={scope} />
                : renderPreview ? renderPreview(previewOpen.settings) : null
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

