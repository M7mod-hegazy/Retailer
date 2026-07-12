import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Maximize2, ExternalLink, ChevronRight } from "lucide-react";
import LayoutRenderer from "../LayoutRenderer";
import { CLASSIFICATIONS } from "./DocClassificationPreview";
import { seedFamilyLayout, resolveEffectiveLayout } from "../layout/layoutModel";
import {
  SAMPLES, sampleById, templateMockBySample, familyOfSize,
  pageWidthStr, pageHeightStr, pageDimensions, PX_PER_MM,
  resolveDocPaperSize, BLOCK_DOC_SCOPES as SHARED_BLOCK_DOC_SCOPES,
} from "./studioData";

/** Match Studio's effFam() exactly — raw layout, no normalizeLayout. */
function getRawLayout(scopeSettings, globalSettings, fam, scope) {
  const isReport = scope !== "_global" && !SHARED_BLOCK_DOC_SCOPES.has(scope);
  // Respect per-family inherit flags (inherit_global_roll / inherit_global_page)
  const familyKey = fam ? `inherit_global_${fam}` : null;
  const docInherit = familyKey ? (scopeSettings?.[familyKey] ?? scopeSettings?.inherit_global) : scopeSettings?.inherit_global;
  const inherit = docInherit !== undefined ? docInherit : !isReport;
  if (scope === "_global" || inherit) {
    return (globalSettings?.layout || {})[fam] || seedFamilyLayout(fam, scope);
  }
  return (scopeSettings?.layout || {})[fam] || seedFamilyLayout(fam, scope);
}

/**
 * MiniPreview — renders a scaled-down LayoutRenderer for a given scope.
 * Uses the exact same layout + settings path as the Studio canvas.
 *
 * Roll papers: two-pass render.
 *   1. Hidden measuring pass → natural content height
 *   2. Visible pass → smart zoom that fits full height, centered
 *
 * Page papers: single-pass, fit within both bounds.
 */
export function MiniPreview({ scope, scopeSettings, globalSettings, rendererSettings, width = 200, height = 280 }) {
  const sampleId = "normal";
  const size = rendererSettings?.paper_size || scopeSettings?.paper_size || "A4";
  const fam = familyOfSize(size);
  const orientation = rendererSettings?.orientation || scopeSettings?.orientation || "portrait";

  const mockData = useMemo(() => templateMockBySample(scope, sampleId) || sampleById(sampleId), [scope, sampleId]);
  const layout = useMemo(() => getRawLayout(scopeSettings, globalSettings, fam, scope), [scopeSettings, globalSettings, fam, scope]);

  const sheetW = pageWidthStr(size, orientation);
  const dims = pageDimensions(size, orientation);
  const pxW = dims.wMm * PX_PER_MM;

  // RollWrapper reads `receipt_width` from settings, not `paper_size`.
  // Inject it so the paper renders at the correct width for this size.
  const rrSettings = useMemo(() => {
    const base = rendererSettings || scopeSettings || {};
    if (fam === "roll") return { ...base, receipt_width: size };
    return base;
  }, [rendererSettings, scopeSettings, fam, size]);

  // ── Roll: measure content height, then smart-zoom ──
  const [rollH, setRollH] = useState(null);
  const measureRef = useRef(null);

  useEffect(() => {
    if (fam !== "roll") return;
    setRollH(null);
    const raf = requestAnimationFrame(() => {
      const el = measureRef.current;
      if (!el) return;
      const h = el.scrollHeight || el.offsetHeight;
      if (h > 0) setRollH(h);
    });
    return () => cancelAnimationFrame(raf);
  }, [fam, size, scope, layout, mockData]);

  if (fam === "roll") {
    if (!rollH) {
      // Pass 1 — hidden measuring: render at actual paper width, measure natural height
      const placeholderW = Math.round(pxW * Math.min(height / 600, 1));
      return (
        <div style={{
          width: `${width}px`, height: `${height}px`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: `${placeholderW}px`, height: `${height}px`,
            position: "relative", overflow: "hidden",
            borderRadius: "8px", background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid var(--border-normal)",
          }}>
            <div ref={measureRef} style={{
              position: "absolute", visibility: "hidden", width: sheetW, top: 0, right: 0,
            }}>
              <LayoutRenderer
                family={fam} size={size} orientation={orientation}
                invoice={mockData}
                settings={rrSettings}
                layout={{ [fam]: layout }}
                scope={scope}
              />
            </div>
          </div>
        </div>
      );
    }

    // Pass 2 — height-driven zoom: fit FULL content height.
    // Width is whatever it naturally is at that scale (narrow receipt strip).
    // 58mm naturally appears narrower than 80mm — no special handling needed.
    const scale = Math.min(height / rollH, width / pxW, 1);
    const scaledW = Math.round(pxW * scale);
    const scaledH = Math.min(Math.round(rollH * scale), height);

    return (
      <div style={{
        width: `${width}px`, height: `${height}px`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: `${scaledW}px`, height: `${scaledH}px`,
          overflow: "hidden", borderRadius: "8px", background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid var(--border-normal)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
        }}>
          <div style={{ zoom: scale, width: sheetW, background: "#fff", flexShrink: 0 }}>
            <LayoutRenderer
              family={fam} size={size} orientation={orientation}
              invoice={mockData}
              settings={rrSettings}
              layout={{ [fam]: layout }}
              scope={scope}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Page papers: fit within both bounds ──
  const pxH = dims.hMm * PX_PER_MM;
  const scale = Math.min(width / pxW, height / pxH, 1);
  const scaledW = Math.round(pxW * scale);
  const scaledH = Math.round(pxH * scale);

  return (
    <div style={{
      width: `${scaledW}px`, height: `${scaledH}px`,
      margin: "0 auto", overflow: "hidden",
      borderRadius: "8px", background: "#fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      border: "1px solid var(--border-normal)",
      display: "flex", justifyContent: "center",
    }}>
      <div style={{
        zoom: scale, width: sheetW,
        minHeight: pageHeightStr(size, orientation),
        background: "#fff", flexShrink: 0,
      }}>
        <LayoutRenderer
          family={fam} size={size} orientation={orientation}
          invoice={mockData}
          settings={rrSettings}
          layout={{ [fam]: layout }}
          scope={scope}
        />
      </div>
    </div>
  );
}

/**
 * DocPreviewGallery — Full-screen gallery showing mini previews for each
 * classification and size. Click a preview to see it fullscreen.
 */
export default function DocPreviewGallery({ open, onClose, docSettings = {}, appSettings = {} }) {
  const [fullscreenScope, setFullscreenScope] = useState(null);
  const globalSettings = docSettings._global || {};

  const closeFullscreen = useCallback(() => setFullscreenScope(null), []);

  const stripLayout = ({ layout, ...rest } = {}) => rest;
  const mergedFor = (scope, family) => {
    const doc = docSettings[scope] || {};
    const isReportScope = scope !== "_global" && !SHARED_BLOCK_DOC_SCOPES.has(scope);
    // Per-family inherit: check inherit_global_roll / inherit_global_page, fallback to legacy inherit_global
    const familyKey = family ? `inherit_global_${family}` : null;
    const docInherit = familyKey ? (doc[familyKey] ?? doc.inherit_global) : doc.inherit_global;
    const inheritGlobal = docInherit !== undefined ? docInherit : !isReportScope;
    if (scope === "_global" || inheritGlobal) return { ...appSettings, ...stripLayout(globalSettings) };
    return { ...appSettings, ...stripLayout(doc) };
  };

  if (!open) return null;

  const fullscreenDoc = fullscreenScope
    ? CLASSIFICATIONS.flatMap(c => c.items).find(i => i.key === fullscreenScope)
    : null;
  const fullscreenSettings = fullscreenScope ? (docSettings[fullscreenScope] || {}) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="relative w-full max-w-7xl h-[92vh] bg-[var(--bg-base)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-normal)] bg-[var(--bg-surface)] px-6 py-3">
          <h2 className="text-lg font-black text-[var(--text-primary)]">معرض معاينات التصاميم</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-danger-bg hover:text-danger-text hover:border-danger-border transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable grid of classifications */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {CLASSIFICATIONS.map((cls) => {
            const Icon = cls.icon;
            const hasAny = cls.items.some(i => !!docSettings[i.key]);
            return (
              <div key={cls.id} className="rounded-xl border border-[var(--border-normal)] overflow-hidden">
                {/* Classification header */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0"
                    style={{ backgroundColor: cls.color }}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-[var(--text-primary)]">{cls.label}</div>
                  </div>
                  <div className="text-[9px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                    {hasAny ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-bg text-success-text border border-success-border px-2 py-0.5">
                        ✔ {cls.items.filter(i => !!docSettings[i.key]).length} محفوظ
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">لا توجد تصاميم محفوظة</span>
                    )}
                  </div>
                </div>

                {/* Items grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3 bg-[var(--bg-base)]">
                  {cls.items.map((item) => {
                    const settings = docSettings[item.key] || {};
                    const hasLayout = !!settings?.layout;
                    const itemSize = resolveDocPaperSize(item.key, settings);
                    const itemFamily = familyOfSize(itemSize);
                    const itemInheritKey = `inherit_global_${itemFamily}`;
                    const itemInheritVal = settings[itemInheritKey] ?? settings.inherit_global;
                    const isInheriting = item.key !== "_global" && (itemInheritVal !== undefined ? itemInheritVal : SHARED_BLOCK_DOC_SCOPES.has(item.key));
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setFullscreenScope(item.key)}
                        className="group relative flex flex-col gap-2 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-surface)] p-2.5 hover:border-primary hover:shadow-md transition-all cursor-pointer text-right"
                      >
                        {/* Mini preview thumbnail */}
                        <div className="relative w-full">
                          <MiniPreview
                            scope={item.key}
                            scopeSettings={settings}
                            globalSettings={globalSettings}
                            rendererSettings={{ ...mergedFor(item.key, itemFamily), paper_size: itemSize }}
                            width={160}
                            height={200}
                          />
                          {/* Inheritance indicator */}
                          {isInheriting && (
                            <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full bg-[var(--primary)]/15 border border-[var(--primary)]/25 px-1.5 py-0.5 text-[7px] font-black text-[var(--primary)] backdrop-blur-sm">
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
                              يرث من العام
                            </span>
                          )}
                          {!isInheriting && item.key !== "_global" && (itemInheritVal === false || !!settings.layout) && (
                            <span className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full bg-[var(--success-bg)] border border-[var(--success-border)] px-1.5 py-0.5 text-[7px] font-black text-[var(--success-text)] backdrop-blur-sm">
                              تصميم خاص
                            </span>
                          )}
                          {/* Saved dot */}
                          {hasLayout && (
                            <span className="absolute top-1.5 left-1.5 z-10 h-2 w-2 rounded-full bg-[var(--success-text)] shadow-sm" title="تصميم محفوظ" />
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-all rounded-lg">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] px-2 py-1 shadow-lg">
                              <Maximize2 size={11} className="text-primary" />
                              <span className="text-[9px] font-black text-primary">عرض كامل</span>
                            </div>
                          </div>
                        </div>

                        {/* Item info */}
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-[var(--text-primary)] truncate">{item.label}</div>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black"
                            style={{
                              backgroundColor: hasLayout ? "var(--success-bg)" : "var(--bg-input)",
                              color: hasLayout ? "var(--success-text)" : "var(--text-muted)",
                            }}
                          >
                            {hasLayout ? "✔" : "—"}
                          </span>
                        </div>

                        {/* App page tags */}
                        <div className="flex flex-wrap gap-0.5">
                          {item.pages.slice(0, 3).map((page) => (
                            <span
                              key={page}
                              className="inline-flex items-center gap-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)] px-1 py-0.5 text-[7px] font-bold text-[var(--text-muted)]"
                            >
                              <ExternalLink size={6} />
                              {page}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fullscreen preview overlay */}
      {fullscreenDoc && fullscreenSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" dir="rtl">
          <div className="relative w-full max-w-5xl h-[92vh] bg-[var(--bg-base)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Fullscreen header */}
            <div className="flex items-center justify-between border-b border-[var(--border-normal)] bg-[var(--bg-surface)] px-6 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-[10px] font-bold"
                >
                  <ChevronRight size={14} /> رجوع
                </button>
                <span className="text-border-subtle">|</span>
                <div>
                  <div className="text-sm font-black text-[var(--text-primary)]">{fullscreenDoc.label}</div>
                  <div className="text-[9px] font-bold text-[var(--text-muted)]">
                    {fullscreenDoc.pages.join(" ← ")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-black">
                  {fullscreenSettings.paper_size || "A4"}
                </span>
                {fullscreenSettings.layout ? (
                  <span className="rounded-full bg-success-bg text-success-text border border-success-border px-2 py-0.5 text-[9px] font-black">
                    ✔ محفوظ
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--bg-input)] text-[var(--text-muted)] px-2 py-0.5 text-[9px] font-black">
                    افتراضي
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-normal)] text-[var(--text-muted)] hover:bg-danger-bg hover:text-danger-text hover:border-danger-border transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Fullscreen preview content */}
            <div data-scroll-area className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[var(--bg-base)]">
              <div className="relative">
                <FullscreenPreview
                  scope={fullscreenScope}
                  settings={fullscreenSettings}
                  globalSettings={globalSettings}
                  appSettings={appSettings}
                  docSettings={docSettings}
                />
              </div>
            </div>

            {/* Fullscreen description */}
            <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-2">
              <div className="text-[10px] font-bold text-[var(--text-muted)]">
                {fullscreenDoc.description}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FullscreenPreview — large LayoutRenderer rendering
 */
function FullscreenPreview({ scope, settings, globalSettings, appSettings, docSettings }) {
  const sampleId = "normal";
  const size = resolveDocPaperSize(scope, settings);
  const fam = familyOfSize(size);
  const orientation = settings?.orientation || "portrait";
  const mockData = useMemo(() => templateMockBySample(scope, sampleId) || sampleById(sampleId), [scope, sampleId]);

  const layout = useMemo(() => getRawLayout(settings, globalSettings, fam, scope), [settings, globalSettings, fam, scope]);

  // Compute merged flat settings matching Studio behavior
  const stripLayoutFn = ({ layout: _l, ...rest } = {}) => rest;
  const rendererSettings = useMemo(() => {
    const doc = settings || {};
    const isReportScope = scope !== "_global" && !SHARED_BLOCK_DOC_SCOPES.has(scope);
    const familyKey = `inherit_global_${fam}`;
    const docInherit = doc[familyKey] ?? doc.inherit_global;
    const inheritGlobal = docInherit !== undefined ? docInherit : !isReportScope;
    if (scope === "_global" || inheritGlobal) return { ...appSettings, ...stripLayoutFn(globalSettings) };
    return { ...appSettings, ...stripLayoutFn(doc) };
  }, [appSettings, globalSettings, settings, scope, fam]);

  // RollWrapper reads `receipt_width`, not `paper_size` — inject it for correct paper width
  const rrSettings = useMemo(
    () => fam === "roll" ? { ...rendererSettings, receipt_width: size } : rendererSettings,
    [rendererSettings, fam, size]
  );

  const paperRef = useRef(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [rollH, setRollH] = useState(null);

  const dims = pageDimensions(size, orientation);
  const contentW = dims.wMm * PX_PER_MM;
  const isRoll = fam === "roll";
  // Reference width: always 80mm so 58mm is narrower at the same zoom
  const ROLL_REF_MM = 80;
  const refPxW = ROLL_REF_MM * PX_PER_MM;

  useEffect(() => {
    if (isRoll) {
      setRollH(null);
    }
  }, [isRoll, scope, size, layout, mockData]);

  useEffect(() => {
    const container = containerRef.current?.closest('[data-scroll-area]');
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      const availW = container.clientWidth - 48;
      const availH = container.clientHeight - 48;
      if (availW <= 0 || availH <= 0) return;
      if (isRoll) {
        if (rollH === null) {
          const el = paperRef.current;
          if (el) {
            const h = el.scrollHeight || el.offsetHeight;
            if (h > 0) {
              setRollH(h / scale);
            }
          }
        } else {
          const z = Math.min(availW / refPxW, availH / rollH, 1);
          setScale(Math.round(z * 100) / 100);
        }
      } else {
        const contentH = dims.hMm * PX_PER_MM;
        if (contentW <= 0 || contentH <= 0) return;
        const z = Math.min(availW / contentW, availH / contentH, 1);
        setScale(Math.round(z * 100) / 100);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [isRoll, contentW, dims.hMm, rollH, scale]);

  return (
    <div ref={containerRef} style={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div
        ref={paperRef}
        style={{
          zoom: scale,
          width: pageWidthStr(size, orientation),
          ...(isRoll ? {} : { minHeight: pageHeightStr(size, orientation) }),
          background: "#fff",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          borderRadius: "2px",
        }}
      >
        <LayoutRenderer
          family={fam}
          size={size}
          orientation={orientation}
          invoice={mockData}
          settings={rrSettings}
          layout={{ [fam]: layout }}
          scope={scope}
        />
      </div>
    </div>
  );
}