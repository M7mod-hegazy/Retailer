import React, { useLayoutEffect, useRef, useState, useMemo } from "react";
import {
  Bold, Italic, AlignRight, AlignCenter, AlignLeft, Eye, EyeOff, Trash2,
  Move, Pencil, Copy,
} from "lucide-react";
import LayoutRenderer from "../LayoutRenderer";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { rollPrintWidthMm, rollBandLeftMm } from "../blocks/blockUtils";
import { SIZES, SHEET_W, PX_PER_MM, pageDimensions, pageWidthStr, pageHeightStr, findNaturalBreaks, INHERITABLE_SCOPES } from "./studioData";

const NO_TYPOGRAPHY = new Set(["logo", "qr", "image", "divider", "spacer", "barcode"]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function FloatingToolbar({ st }) {
  const { selected, fam } = st;
  const selInsert = (fam.inserted || []).find((b) => b.id === selected);
  const isOverlay = st.overlays.some((o) => o.id === selected);
  if (!selected || isOverlay) return null;
  const selType = selInsert ? selInsert.type : selected;
  const entry = BLOCK_REGISTRY[selType];
  if (!entry) return null;
  const ov = st.ov(selected);
  const isAbs = ov.abs && ov.abs.xMm != null;
  const texty = !NO_TYPOGRAPHY.has(selType);
  const editable = st.designer.editableOf && st.designer.editableOf(selected);
  const inOrder = fam.order.includes(selected);
  const btn = (active) => `flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-bold transition-colors ${active ? "bg-[var(--primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"}`;
  return (
    <div dir="rtl" onClick={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-[var(--border-normal)] bg-[var(--bg-elevated)] px-1.5 py-1 shadow-lg">
      <span className="max-w-[90px] truncate px-1 text-[10px] font-black text-[var(--text-primary)]">{entry.label}</span>
      {texty && (
        <>
          <span className="mx-0.5 h-4 w-px bg-[var(--border-subtle)]" />
          <button type="button" className={btn(false)} title="تصغير الخط"
            onClick={() => st.setOverride(selected, { fontSize: clamp((Number(ov.fontSize) || Number(st.merged.item_font_size) || 11) - 1, 6, 90) })}>−</button>
          <button type="button" className={btn(false)} title="تكبير الخط"
            onClick={() => st.setOverride(selected, { fontSize: clamp((Number(ov.fontSize) || Number(st.merged.item_font_size) || 11) + 1, 6, 90) })}>+</button>
          <button type="button" className={btn(!!ov.bold)} title="عريض" onClick={() => st.setOverride(selected, { bold: !ov.bold })}><Bold size={12} /></button>
          <button type="button" className={btn(!!ov.italic)} title="مائل" onClick={() => st.setOverride(selected, { italic: !ov.italic })}><Italic size={12} /></button>
          <button type="button" className={btn(ov.align === "right")} title="يمين" onClick={() => st.setOverride(selected, { align: ov.align === "right" ? undefined : "right" })}><AlignRight size={12} /></button>
          <button type="button" className={btn(ov.align === "center")} title="وسط" onClick={() => st.setOverride(selected, { align: ov.align === "center" ? undefined : "center" })}><AlignCenter size={12} /></button>
          <button type="button" className={btn(ov.align === "left")} title="يسار" onClick={() => st.setOverride(selected, { align: ov.align === "left" ? undefined : "left" })}><AlignLeft size={12} /></button>
          <input type="color" value={ov.color || "#0f172a"} onChange={(e) => st.setOverride(selected, { color: e.target.value })}
            className="h-6 w-7 cursor-pointer rounded border border-[var(--border-normal)]" title="اللون" />
        </>
      )}
      <span className="mx-0.5 h-4 w-px bg-[var(--border-subtle)]" />
      <button type="button" className={btn(!!isAbs)} title={isAbs ? "إلغاء التثبيت المطلق" : "تثبيت مطلق (فوق التدفق)"}
        onClick={() => st.setPinMode(selected, !isAbs)}><Move size={12} /></button>
      {editable && (
        <button type="button" className={btn(false)} title="تحرير النص مباشرة"
          onClick={() => st.startEditText(selected)}><Pencil size={12} /></button>
      )}
      {selInsert && <button type="button" className={btn(false)} title="تكرار" onClick={st.duplicateSelected}><Copy size={12} /></button>}
      <button type="button" className={btn(false)} title="إخفاء/إظهار" disabled={!inOrder} onClick={() => st.toggleVisible(selected)}>
        {st.isVisible(selected) ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <button type="button" className={btn(false)} title="حذف (Delete)" onClick={st.deleteSelected}><Trash2 size={12} /></button>
    </div>
  );
}

export default function StudioCanvas({ st, children, fitToViewRef }) {
  const sheetRef = useRef(null);
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [contentMm, setContentMm] = useState(0);
  const [sheetPxH, setSheetPxH] = useState(0);
  const [dragGhost, setDragGhost] = useState(null);
  const [pageViewMode, setPageViewMode] = useState("stacked");
  const [currentPage, setCurrentPage] = useState(0);
  const [smartBreaksMm, setSmartBreaksMm] = useState([]);
  const { family, size, zoom, orientation } = st;

  const [panMode, setPanMode] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const wasDrag = useRef(false);
  const panRef = useRef({ active: false, startX: 0, startY: 0, px: 0, py: 0 });

  // Fit ALL rendered content height into the viewport — width scrolls if needed.
  // Capped at 100% so we never zoom in beyond native; floor at 10%.
  const fitToView = () => {
    const el = containerRef.current;
    if (!el) return;
    const vh = el.clientHeight - 56; // p-6 padding + small breathing room
    if (vh <= 0) return;
    const dims = pageDimensions(size, orientation);
    const pageHmm = dims.hMm || 0;
    // Use the LARGER of measured content height and page height (covers multi-page stacks + rolls)
    const targetMm = Math.max(contentMm || 0, pageHmm, 80);
    const targetPxH = targetMm * PX_PER_MM;
    if (targetPxH <= 0) return;
    const z = clamp(vh / targetPxH, 0.10, 1);
    st.setZoom(Math.round(z * 100) / 100);
    setPan({ x: 0, y: 0 });
  };

  // Expose fitToView to parent via ref
  if (fitToViewRef) fitToViewRef.current = fitToView;

  // Auto-fit when scope/size/orientation/family changes.
  // Double rAF so contentMm's measurement layout-effect has fully run first.
  const scopeKey = st.scope;
  useLayoutEffect(() => {
    if (children || st.compare) return;
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => fitToView()); });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, size, orientation, family]);

  const onBgPointerDown = (e) => {
    if (st.compare || children) return;
    const paper = e.target.closest("[data-paper]");
    if (!panMode && paper) return;
    const c = containerRef.current;
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, px: pan.x, py: pan.y };
    wasDrag.current = false;
    c.setPointerCapture(e.pointerId);
    c.style.cursor = "grabbing";
  };
  const onBgPointerMove = (e) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDrag.current = true;
    setPan({ x: panRef.current.px + dx, y: panRef.current.py + dy });
  };
  const onBgPointerUp = (e) => {
    panRef.current.active = false;
    e.currentTarget.style.cursor = panMode ? "grab" : "";
  };

  const dims = pageDimensions(size, orientation);
  const pageH = dims.hMm;
  const sheetW = pageWidthStr(size, orientation);

  // Measure content height and calculate smart breaks
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (el) setContentMm(el.scrollHeight / PX_PER_MM);
    if (family === "page" && el && pageH > 0) {
      requestAnimationFrame(() => {
        const breaks = findNaturalBreaks(el, pageH, PX_PER_MM);
        setSmartBreaksMm(breaks);
      });
    } else {
      setSmartBreaksMm([]);
    }
  }, [st.renderLayout, st.canvasSettings, family, size, orientation, st.sampleId, st.compare, st.fam, pageH]);

  // Measure the actual unscaled sheet height (includes page gaps in stacked view)
  // and compute unscaled sheet width — used by the wrapper to give correct layout height.
  const sheetPxW = (pageDimensions(size, orientation).wMm || parseFloat(size) || 80) * PX_PER_MM;

  // Total pages based on smart breaks — must be declared before useLayoutEffect that depends on it
  const smartPages = smartBreaksMm.length + 1;
  const theoryPages = pageH && contentMm ? Math.max(1, Math.ceil(contentMm / pageH - 0.005)) : 1;
  const pages = smartPages > 1 ? smartPages : theoryPages;
  const fillRatio = pageH && contentMm ? contentMm / pageH : 0;
  const fitTone = fillRatio <= 0.92 ? "ok" : fillRatio <= 1.0 ? "warn" : "over";

  useLayoutEffect(() => {
    const sheet = st.sheetElRef?.current;
    if (!sheet) return;
    setSheetPxH(sheet.scrollHeight);
  }, [contentMm, pages, pageViewMode, sheetW, size, orientation, family, st.renderLayout, st.fam]);

  const paperMm = parseFloat(size) || 80;
  const isCalibrated = !!(st.calibration && st.calibration.printAreaWidthMm > 0);
  const bandW = family === "roll" ? rollPrintWidthMm(st.canvasSettings) : 0;
  const bandL = family === "roll" ? rollBandLeftMm(st.canvasSettings) : 0;
  const bandClipped = family === "roll" && isCalibrated && st.showBand && bandW < paperMm - 1;

  // Build page break points: [break0, break1, ...] in mm from content top
  const pageBreaksMm = useMemo(() => {
    if (family !== "page" || pages <= 1) return [];
    if (smartBreaksMm.length) return smartBreaksMm;
    const b = [];
    for (let i = 1; i < pages; i++) b.push(i * pageH);
    return b;
  }, [family, pages, pageH, smartBreaksMm]);

  const startOverlayDrag = (o, e) => {
    e.preventDefault(); e.stopPropagation();
    st.setSelected(o.id);
    const startX = e.clientX, startY = e.clientY;
    let dx = 0, dy = 0;
    const move = (ev) => {
      dx = (ev.clientX - startX) / (PX_PER_MM * st.zoom);
      dy = (ev.clientY - startY) / (PX_PER_MM * st.zoom);
      setDragGhost({ id: o.id, dxMm: dx, dyMm: dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragGhost(null);
      if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
        st.setOverlay(o.id, {
          xMm: Math.max(0, Math.round((o.xMm + dx) * 2) / 2),
          yMm: Math.max(0, Math.round((o.yMm + dy) * 2) / 2),
        });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const overlayLayer = st.isBlockDoc && family === "page" && st.overlays.length > 0 && (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none" }}>
      {st.overlays.map((o) => {
        const ghost = dragGhost && dragGhost.id === o.id ? dragGhost : null;
        const sel = st.selected === o.id;
        return (
          <div key={o.id}
            onPointerDown={(e) => startOverlayDrag(o, e)}
            onClick={(e) => { e.stopPropagation(); st.setSelected(o.id); }}
            title="اسحب لتغيير الموضع"
            style={{
              position: "absolute",
              left: `${o.xMm + (ghost ? ghost.dxMm : 0)}mm`,
              top: `${o.yMm + (ghost ? ghost.dyMm : 0)}mm`,
              width: o.widthMm ? `${o.widthMm}mm` : "24mm",
              minHeight: "6mm",
              pointerEvents: "auto",
              cursor: "move",
              outline: sel ? "2px solid var(--primary)" : "1px dashed rgba(124,58,237,0.5)",
              outlineOffset: 1,
              background: ghost ? "rgba(124,58,237,0.08)" : "transparent",
            }} />
        );
      })}
    </div>
  );

  const handleContainerClick = (e) => {
    if (wasDrag.current) { wasDrag.current = false; return; }
    st.setSelected(null);
  };

  // pageBreaksMm are positions from content top where pages break.
  // Each page's height = break[i] - (break[i-1] || 0), last page auto.
  // Offset for page i = break[i-1] || 0 (content position to shift up).
  const pageHeightFor = (pageIdx) => {
    if (pageBreaksMm.length === 0) return pageHeightStr(size, orientation);
    if (pageIdx === 0) return `${pageBreaksMm[0]}mm`;
    if (pageIdx < pageBreaksMm.length) {
      return `${pageBreaksMm[pageIdx] - pageBreaksMm[pageIdx - 1]}mm`;
    }
    return "auto";
  };

  const contentOffsetFor = (pageIdx) => {
    if (pageIdx === 0) return 0;
    return pageBreaksMm[pageIdx - 1];
  };
  const marginTopFor = (pageIdx) => {
    return `-${contentOffsetFor(pageIdx)}mm`;
  };

  const renderPages = () => {
    if (family !== "page") {
      return (
        <div ref={sheetRef} data-paper
          style={{ position: "relative", width: sheetW, background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
          <div ref={measureRef}>
            <LayoutRenderer family={family} size={size} orientation={orientation} invoice={st.invoiceData}
              settings={st.canvasSettings} layout={st.renderLayout} editing designer={st.designer} scope={st.scope} />
          </div>
          {overlayLayer}
        </div>
      );
    }

    const contentNode = (
      <div ref={measureRef}>
        <LayoutRenderer family={family} size={size} orientation={orientation} invoice={st.invoiceData}
          settings={st.canvasSettings} layout={st.renderLayout} editing designer={st.designer} scope={st.scope} />
      </div>
    );

    if (pages <= 1) {
      return (
        <div ref={sheetRef} data-paper
          style={{ position: "relative", width: sheetW, minHeight: pageHeightStr(size, orientation), background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
          {contentNode}
          {overlayLayer}
        </div>
      );
    }

    // Stacked view
    if (pageViewMode === "stacked") {
      const pageArr = Array.from({ length: pages });
      return (
        <div ref={sheetRef} data-paper style={{ width: sheetW }}>
          {pageArr.map((_, i) => {
            const ph = pageHeightFor(i);
            const mt = marginTopFor(i);
            return (
              <div key={i} style={{
                height: ph,
                overflow: "hidden",
                background: "#fff",
                boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                marginBottom: i < pages - 1 ? "6mm" : 0,
                position: "relative",
                borderRadius: "1mm",
              }}>
                {pages > 1 && (
                  <div style={{
                    position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                    zIndex: 25, pointerEvents: "none",
                    fontSize: "7px", fontWeight: 700, color: "#94a3b8",
                    background: "#fff", padding: "0 4px", borderRadius: "0 0 2px 2px",
                    borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0",
                  }}>
                    {i + 1} / {pages}
                  </div>
                )}
                <div style={{ marginTop: mt }}>
                  {i === 0 ? contentNode : (
                    <LayoutRenderer family={family} size={size} orientation={orientation} invoice={st.invoiceData}
                      settings={st.canvasSettings} layout={st.renderLayout} editing designer={st.designer} scope={st.scope} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Single page mode
    if (pageViewMode === "page") {
      const i = Math.min(currentPage, pages - 1);
      const ph = pageHeightFor(i);
      const mt = marginTopFor(i);
      return (
        <div ref={sheetRef} data-paper style={{ width: sheetW }}>
          <div style={{
            height: ph,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            position: "relative",
            borderRadius: "1mm",
          }}>
            {pages > 1 && (
              <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                zIndex: 25, pointerEvents: "none",
                fontSize: "7px", fontWeight: 700, color: "#94a3b8",
                background: "#fff", padding: "0 4px", borderRadius: "0 0 2px 2px",
                borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0",
              }}>
                {i + 1} / {pages}
              </div>
            )}
            <div style={{ marginTop: mt }}>
              {contentNode}
            </div>
          </div>
          {pages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "4mm", marginTop: "3mm" }}>
              <button type="button" disabled={i === 0} onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                style={{ padding: "2mm 6mm", fontSize: "10px", fontWeight: 700, background: i === 0 ? "#e2e8f0" : "var(--primary)", color: i === 0 ? "#94a3b8" : "#fff", border: "none", borderRadius: "4px", cursor: i === 0 ? "default" : "pointer" }}>
                السابق
              </button>
              <button type="button" disabled={i === pages - 1} onClick={() => setCurrentPage((p) => Math.min(pages - 1, p + 1))}
                style={{ padding: "2mm 6mm", fontSize: "10px", fontWeight: 700, background: i === pages - 1 ? "#e2e8f0" : "var(--primary)", color: i === pages - 1 ? "#94a3b8" : "#fff", border: "none", borderRadius: "4px", cursor: i === pages - 1 ? "default" : "pointer" }}>
                التالي
              </button>
            </div>
          )}
        </div>
      );
    }

    // Grid mode
    if (pageViewMode === "grid") {
      const cols = 2;
      const rows = Math.ceil(pages / cols);
      const pageArr = Array.from({ length: pages });
      return (
        <div ref={sheetRef} data-paper style={{ width: `calc(${sheetW} * ${cols} + 4mm)` }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${sheetW})`, gap: "4mm" }}>
            {pageArr.map((_, i) => {
              const ph = pageHeightFor(i);
              const mt = marginTopFor(i);
              return (
                <div key={i} style={{
                  height: ph,
                  overflow: "hidden",
                  background: "#fff",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                  position: "relative",
                  borderRadius: "1mm",
                }}>
                  {pages > 1 && (
                    <div style={{
                      position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                      zIndex: 25, pointerEvents: "none",
                      fontSize: "7px", fontWeight: 700, color: "#94a3b8",
                      background: "#fff", padding: "0 4px", borderRadius: "0 0 2px 2px",
                      borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0",
                    }}>
                      {i + 1} / {pages}
                    </div>
                  )}
                  <div style={{ marginTop: mt }}>
                    {contentNode}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Fallback stacked
    return null;
  };

  return (
    <div className="relative flex-1 min-h-0 bg-[var(--bg-base)] select-none">
      {(children || st.compare) ? (
        <div className="h-full w-full overflow-auto p-6">
          {children ? (
            <div className="flex min-h-full w-full">
              <div className="m-auto" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ width: sheetW, background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
                  {children}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-full w-full">
              <div className="m-auto flex items-start justify-center gap-8" onClick={(e) => e.stopPropagation()}>
                {SIZES[family].map((sz) => (
                  <div key={sz} className="flex flex-col items-center gap-1">
                    <span className="text-[11px] font-black text-[var(--text-muted)]">{sz}</span>
                    <div style={{ width: SHEET_W[sz], transform: `scale(${family === "roll" ? 0.9 : 0.42})`, transformOrigin: "top center", background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
                      <LayoutRenderer family={family} size={sz} orientation={orientation} invoice={st.invoiceData}
                        settings={{ ...st.canvasSettings, receipt_width: family === "roll" ? sz : st.canvasSettings.receipt_width }}
                        layout={st.renderLayout} scope={st.scope} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div ref={containerRef}
          className="h-full w-full overflow-auto"
          onPointerDown={panMode ? onBgPointerDown : undefined}
          onPointerMove={panMode ? onBgPointerMove : undefined}
          onPointerUp={panMode ? onBgPointerUp : undefined}
          onPointerCancel={panMode ? onBgPointerUp : undefined}
          onClick={panMode ? handleContainerClick : (e) => { if (!e.target.closest("[data-paper]")) st.setSelected(null); }}
          style={{ cursor: panMode ? "grab" : undefined }}
        >
          <div className="flex min-h-full w-full p-6">
            {/* Wrapper provides correct layout height (scaled), so scrollbar matches visual —			transform: scale() alone doesn't shrink the layout box. */}
            <div className="m-auto" style={{
              position: "relative",
              width: `${sheetPxW * zoom}px`,
              height: `${sheetPxH * zoom}px`,
            }}>
            <div ref={(el) => { if (st.sheetElRef) st.sheetElRef.current = el; }}
              style={{ position: "absolute", top: 0, left: "50%", width: sheetW, transform: `translate(-50%, 0) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "top center", pointerEvents: panMode ? "none" : undefined }}
            onClick={(e) => e.stopPropagation()}>
            {st.showRuler && <MmRulers size={size} orientation={orientation} contentMm={contentMm} pageH={pageH} />}
            {bandClipped && (
              <>
                <div title="حد منطقة الطباعة الفعلية" style={{ position: "absolute", top: 0, bottom: 0, left: `${bandL}mm`, width: 0, borderLeft: "1.5px dashed rgba(220,38,38,0.55)", zIndex: 26, pointerEvents: "none" }} />
                <div title="حد منطقة الطباعة الفعلية" style={{ position: "absolute", top: 0, bottom: 0, left: `${bandL + bandW}mm`, width: 0, borderLeft: "1.5px dashed rgba(220,38,38,0.55)", zIndex: 26, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${bandL}mm`, background: "rgba(220,38,38,0.06)", zIndex: 25, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${bandL + bandW}mm`, right: 0, background: "rgba(220,38,38,0.06)", zIndex: 25, pointerEvents: "none" }} />
              </>
            )}
            {st.dragSnap?.centerX && (
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 0, borderLeft: "1.5px dashed var(--primary, #7c3aed)", zIndex: 45, pointerEvents: "none" }} />
            )}
            {renderPages()}
            </div>
            </div> {/* end scaled wrapper */}
          </div>
        </div>
      )}

      {!children && !st.compare && <FloatingToolbar st={st} />}

      {/* Page controls top-right */}
      {!children && family === "page" && !st.compare && pageH > 0 && (
        <div style={{ pointerEvents: "auto" }}
          className="absolute top-3 right-3 flex items-center gap-2 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-elevated)] px-2.5 py-1.5 shadow">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-input)]">
              <div style={{ width: `${Math.min(100, Math.round(fillRatio * 100))}%`, background: fitTone === "ok" ? "var(--success-text)" : fitTone === "warn" ? "var(--warning-text)" : "var(--danger)" }} className="h-full rounded-full" />
            </div>
            <span className="text-[9px] font-black text-[var(--text-secondary)]">
              {Math.round(fillRatio * 100)}% · {pages} {pages > 1 ? "صفحات" : "صفحة"}
            </span>
          </div>
          {pages > 1 && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />
              {["stacked", "page", "grid"].map((mode) => (
                <button key={mode} type="button" onClick={(e) => { e.stopPropagation(); setPageViewMode(mode); }}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-black transition-colors ${pageViewMode === mode ? "bg-primary text-white" : "text-text-secondary hover:bg-bg-input"}`}>
                  {mode === "stacked" ? "عمودي" : mode === "page" ? "فردي" : "شبكي"}
                </button>
              ))}
            </>
          )}
          {size === "A5" && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />
              <button type="button" onClick={(e) => { e.stopPropagation(); st.setOrientation((o) => o === "portrait" ? "landscape" : "portrait"); }}
                className={`rounded px-1.5 py-0.5 text-[9px] font-black transition-colors ${orientation === "landscape" ? "bg-primary text-white" : "text-text-secondary hover:bg-bg-input"}`}>
                {orientation === "portrait" ? "عرضي" : "طولي"}
              </button>
            </>
          )}
        </div>
      )}

      {!children && family === "roll" && isCalibrated && (
        <button type="button" onClick={(e) => { e.stopPropagation(); st.setShowBand((v) => !v); }}
          title="إظهار/إخفاء حدود منطقة الطباعة الفعلية"
          className={`absolute top-3 right-3 rounded-lg border px-2.5 py-1.5 text-[9px] font-black shadow transition-colors ${st.showBand ? "border-[var(--border-normal)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]" : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] opacity-70"}`}>
          منطقة الطباعة: {bandW}مم من {paperMm}مم {st.showBand ? "◉" : "◎"}
        </button>
      )}

      {INHERITABLE_SCOPES.has(st.scope) && (
        <div
          dir="rtl"
          className={`absolute right-3 z-50 flex items-center gap-1.5 overflow-hidden rounded-lg border border-[var(--border-normal)] bg-[var(--bg-elevated)] shadow ${
            !children && family === "page" && !st.compare && pageH > 0 ? "top-16" : "top-3"
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              st.toggleInheritGlobal?.();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black transition-all ${
              st.inheritGlobal
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "bg-[var(--bg-input)] text-[var(--text-secondary)]"
            }`}
            title={st.inheritGlobal ? `يرث من التصميم العام (${st.family === "roll" ? "رول" : "صفحة"}) — اضغط لتفعيل التصميم الخاص` : `تصميم خاص (${st.family === "roll" ? "رول" : "صفحة"}) — اضغط للارث من التصميم العام`}
          >
            {st.inheritGlobal ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18" /><path d="M3 12h18" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
            {st.inheritGlobal ? `يرث من العام` : `تصميم خاص`}
            <span className="text-[8px] opacity-60 font-normal">{st.family === "roll" ? "رول" : "صفحة"}</span>
          </button>
          {/* Show a dot when there are local edits hidden by inheritance */}
          {st.inheritGlobal && st.ownFamily && (
            <span
              className="h-2 w-2 rounded-full bg-[var(--warning-text)]"
              title="يوجد تعديلات محلية محفوظة لكنها غير معتمدة حالياً — تعطيل الارث لاستعمالها"
            />
          )}
          <span className="px-1.5 text-[9px] font-bold text-[var(--text-muted)] select-none">
            {st.inheritGlobal ? "يرث" : "مخصص"}
          </span>
        </div>
      )}

      <div className="absolute top-3 left-3 z-50 flex items-center gap-0.5 overflow-hidden rounded-lg border border-[var(--border-normal)] bg-[var(--bg-elevated)] shadow">
        <button type="button" onClick={(e) => { e.stopPropagation(); setPanMode((v) => !v); }}
          className={`px-2.5 py-1.5 text-sm font-black transition-colors ${panMode ? "bg-primary text-white" : "text-text-secondary hover:bg-bg-input"}`}
          title={panMode ? "الخروج من يد التصفح" : "يد التصفح — حرك اللوحة بحرية"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v1"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2a5 5 0 0 1-5-5 3 3 0 0 1 1.5-2.6L4 16"/></svg>
        </button>
        <span className="h-4 w-px bg-border-subtle" />
        <button type="button" onClick={(e) => { e.stopPropagation(); fitToView(); }}
          className="px-2.5 py-1.5 text-sm font-black text-[var(--text-secondary)] hover:bg-[var(--bg-input)]"
          title="ملاءمة العرض — زوم وتوسيط تلقائي">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
        </button>
        <span className="h-4 w-px bg-border-subtle" />
        <button type="button" onClick={(e) => { e.stopPropagation(); st.setZoom((z) => Math.min(4, Math.round((z + 0.1) * 10) / 10)); }}
          className="px-2.5 py-1.5 text-sm font-black text-[var(--text-primary)] hover:bg-[var(--bg-input)]">+</button>
        <span className="min-w-[42px] px-1 text-center text-[11px] font-black text-[var(--text-secondary)]">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); st.setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10)); }}
          className="px-2.5 py-1.5 text-sm font-black text-[var(--text-primary)] hover:bg-[var(--bg-input)]">−</button>
      </div>
    </div>
  );
}

function MmRulers({ size, orientation, contentMm, pageH }) {
  const dims = pageDimensions(size, orientation);
  const widthMm = dims.wMm;
  const heightMm = pageH || Math.max(contentMm || 0, 80);
  const wpx = widthMm * PX_PER_MM, hpx = heightMm * PX_PER_MM;
  const ticks = (lenMm, axis) => {
    const out = [];
    for (let mm = 0; mm <= lenMm; mm += 5) {
      const px = mm * PX_PER_MM, major = mm % 50 === 0, mid = mm % 10 === 0;
      const len = major ? 9 : mid ? 6 : 3;
      out.push(<div key={mm} style={{ position: "absolute", background: "#94a3b8", ...(axis === "x" ? { left: px, top: 16 - len, width: 1, height: len } : { top: px, left: 16 - len, height: 1, width: len }) }} />);
      if (major) out.push(<span key={`l${mm}`} style={{ position: "absolute", fontSize: 6, color: "#64748b", ...(axis === "x" ? { left: px + 1, top: 1 } : { top: px + 1, left: 1 }) }}>{mm}</span>);
    }
    return out;
  };
  return (
    <>
      <div style={{ position: "absolute", top: -18, insetInlineStart: 0, width: wpx, height: 16, background: "#fff", border: "1px solid #e2e8f0", zIndex: 30, pointerEvents: "none" }}>{ticks(widthMm, "x")}</div>
      <div style={{ position: "absolute", top: 0, insetInlineStart: -18, width: 16, height: hpx, background: "#fff", border: "1px solid #e2e8f0", zIndex: 30, pointerEvents: "none" }}>{ticks(heightMm, "y")}</div>
    </>
  );
}
