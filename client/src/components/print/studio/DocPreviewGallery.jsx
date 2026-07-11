import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Maximize2, ExternalLink, ChevronRight } from "lucide-react";
import LayoutRenderer from "../LayoutRenderer";
import { CLASSIFICATIONS } from "./DocClassificationPreview";
import { seedFamilyLayout, resolveEffectiveLayout } from "../layout/layoutModel";
import {
  SAMPLES, sampleById, templateMockBySample, familyOfSize,
  pageWidthStr, pageHeightStr, pageDimensions, PX_PER_MM,
} from "./studioData";

const BLOCK_DOC_SCOPES = new Set([
  "_global", "pos_receipt", "sales_invoice", "purchase_order", "sales_return",
  "quotation", "branch_transfer", "purchase_return", "payment_receipt",
]);

/** Match Studio's effFam() exactly — raw layout, no normalizeLayout. */
function getRawLayout(scopeSettings, globalSettings, fam, scope) {
  const isReport = scope !== "_global" && !BLOCK_DOC_SCOPES.has(scope);
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
 */
export function MiniPreview({ scope, scopeSettings, globalSettings, rendererSettings, width = 200, height = 280 }) {
  const sampleId = "normal";
  const size = rendererSettings?.paper_size || scopeSettings?.paper_size || "A4";
  const fam = familyOfSize(size);
  const orientation = rendererSettings?.orientation || scopeSettings?.orientation || "portrait";

  const mockData = useMemo(() => templateMockBySample(scope, sampleId) || sampleById(sampleId), [scope, sampleId]);

  const layout = useMemo(() => {
    return getRawLayout(scopeSettings, globalSettings, fam, scope);
  }, [scopeSettings, globalSettings, fam, scope]);

  const sheetW = pageWidthStr(size, orientation);
  const dims = pageDimensions(size, orientation);
  const pxW = dims.wMm * PX_PER_MM;
  const pxH = dims.hMm > 0 ? dims.hMm * PX_PER_MM : 200 * PX_PER_MM; // roll: use 200mm default height

  // Roll: width only (tall receipt). Page: fit within both bounds.
  const scale = fam === "roll" ? width / pxW : Math.min(width / pxW, height / pxH);
  const scaledW = Math.round(pxW * scale);
  const scaledH = Math.round(pxH * scale);

  return (
    <div
      style={{
        width: `${scaledW}px`,
        height: `${scaledH}px`,
        margin: "0 auto",
        overflow: "hidden",
        borderRadius: "8px",
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid var(--border-normal)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{
        zoom: scale,
        width: sheetW,
        minHeight: pageHeightStr(size, orientation) === "auto" ? "200mm" : pageHeightStr(size, orientation),
        background: "#fff",
        flexShrink: 0,
      }}>
        <LayoutRenderer
          family={fam}
          size={size}
          orientation={orientation}
          invoice={mockData}
          settings={rendererSettings || scopeSettings || {}}
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
  const BLOCK_DOC_SCOPES = new Set([
    "_global", "pos_receipt", "sales_invoice", "purchase_order", "sales_return",
    "quotation", "branch_transfer", "purchase_return", "payment_receipt",
  ]);
  const mergedFor = (scope, family) => {
    const doc = docSettings[scope] || {};
    const isReportScope = scope !== "_global" && !BLOCK_DOC_SCOPES.has(scope);
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
                    const itemSize = settings.paper_size || "A4";
                    const itemFamily = familyOfSize(itemSize);
                    const itemInheritKey = `inherit_global_${itemFamily}`;
                    const itemInheritVal = settings[itemInheritKey] ?? settings.inherit_global;
                    const BLOCK_DOC = ["pos_receipt","sales_invoice","purchase_order","sales_return","quotation","branch_transfer","purchase_return","payment_receipt"];
                    const isInheriting = item.key !== "_global" && (itemInheritVal !== undefined ? itemInheritVal : BLOCK_DOC.includes(item.key));
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
                            rendererSettings={mergedFor(item.key, itemFamily)}
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
  const size = settings?.paper_size || "A4";
  const fam = familyOfSize(size);
  const orientation = settings?.orientation || "portrait";
  const mockData = useMemo(() => templateMockBySample(scope, sampleId) || sampleById(sampleId), [scope, sampleId]);

  const layout = useMemo(() => getRawLayout(settings, globalSettings, fam, scope), [settings, globalSettings, fam, scope]);

  // Compute merged flat settings matching Studio behavior
  const stripLayoutFn = ({ layout: _l, ...rest } = {}) => rest;
  const BLOCK_DOC = new Set(["_global", "pos_receipt", "sales_invoice", "purchase_order", "sales_return", "quotation", "branch_transfer", "purchase_return", "payment_receipt"]);
  const rendererSettings = useMemo(() => {
    const doc = settings || {};
    const isReportScope = scope !== "_global" && !BLOCK_DOC.has(scope);
    // Per-family inherit: check inherit_global_roll / inherit_global_page, fallback to legacy inherit_global
    const familyKey = `inherit_global_${fam}`;
    const docInherit = doc[familyKey] ?? doc.inherit_global;
    const inheritGlobal = docInherit !== undefined ? docInherit : !isReportScope;
    if (scope === "_global" || inheritGlobal) return { ...appSettings, ...stripLayoutFn(globalSettings) };
    return { ...appSettings, ...stripLayoutFn(doc) };
  }, [appSettings, globalSettings, settings, scope, fam]);

  const paperRef = useRef(null);
  const containerRef = useRef(null);
  const [contentH, setContentH] = useState(0);
  const [scale, setScale] = useState(1);

  // Use known paper width (scrollWidth is unreliable for mm units)
  const dims = pageDimensions(size, orientation);
  const contentW = dims.wMm * PX_PER_MM;

  useEffect(() => {
    const el = paperRef.current;
    const container = containerRef.current?.closest('[data-scroll-area]');
    if (!el || !container) return;
    const raf = requestAnimationFrame(() => {
      const h = el.scrollHeight;
      if (h <= 0 || contentW <= 0) return;
      setContentH(h);
      const availH = container.clientHeight - 12;
      const availW = container.clientWidth - 12;
      if (availH <= 0 || availW <= 0) return;
      const z = Math.min(availW / contentW, availH / h, 1);
      setScale(Math.round(z * 100) / 100);
    });
    return () => cancelAnimationFrame(raf);
  }, [layout, size, orientation, scope, contentW]);

  const scaledW = Math.round(contentW * scale);
  const scaledH = Math.round(contentH * scale);

  return (
    <div ref={containerRef} style={{ width: scaledW || "auto", height: scaledH || "auto", overflow: "hidden" }}>
      <div
        ref={paperRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: pageWidthStr(size, orientation),
          minHeight: pageHeightStr(size, orientation) === "auto" ? "200mm" : pageHeightStr(size, orientation),
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
          settings={rendererSettings}
          layout={{ [fam]: layout }}
          scope={scope}
        />
      </div>
    </div>
  );
}