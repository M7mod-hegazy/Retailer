import React, { useLayoutEffect, useRef, useState } from "react";
import LayoutRenderer from "../LayoutRenderer";
import { rollPrintWidthMm, rollBandLeftMm } from "../blocks/blockUtils";
import { SIZES, SHEET_W, PAGE_H_MM, PX_PER_MM } from "./studioData";

// Center canvas: true-scale sheet centered on BOTH axes, zoom, mm rulers,
// printable-band guides (roll), fit meter (page), size compare, and a drag
// layer for free-position page overlays.
export default function StudioCanvas({ st, children }) {
  const sheetRef = useRef(null);
  const [contentMm, setContentMm] = useState(0);
  const [dragGhost, setDragGhost] = useState(null); // {id, dxMm, dyMm}
  const { family, size, zoom } = st;

  useLayoutEffect(() => {
    if (sheetRef.current) setContentMm(sheetRef.current.offsetHeight / PX_PER_MM);
  }, [st.renderLayout, st.canvasSettings, family, size, st.sampleId, st.compare]);

  const pageH = PAGE_H_MM[size];
  const fillRatio = pageH && contentMm ? contentMm / pageH : 0;
  const pages = Math.max(1, Math.ceil(fillRatio - 0.005));
  const fitTone = fillRatio <= 0.92 ? "ok" : fillRatio <= 1.0 ? "warn" : "over";

  // printable-band guides (roll): canvasSettings already carries calibration
  const paperMm = parseFloat(size) || 80;
  const bandW = family === "roll" ? rollPrintWidthMm(st.canvasSettings) : 0;
  const bandL = family === "roll" ? rollBandLeftMm(st.canvasSettings) : 0;
  const bandClipped = family === "roll" && bandW < paperMm - 1;

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

  // drag layer for page overlays (rendered above the sheet content)
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

  return (
    <div className="relative flex-1 overflow-auto bg-[var(--bg-base)] p-6" onClick={() => st.setSelected(null)}>
      {children ? (
        // template-doc mode: centered real template (or info card)
        <div className="flex min-h-full w-full">
          <div className="m-auto" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: SHEET_W[size], background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
              {children}
            </div>
          </div>
        </div>
      ) : st.compare ? (
        <div className="flex min-h-full w-full">
          <div className="m-auto flex items-start justify-center gap-8" onClick={(e) => e.stopPropagation()}>
            {SIZES[family].map((sz) => (
              <div key={sz} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-black text-[var(--text-muted)]">{sz}</span>
                <div style={{ width: SHEET_W[sz], transform: `scale(${family === "roll" ? 0.9 : 0.42})`, transformOrigin: "top center", background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
                  <LayoutRenderer family={family} size={sz} invoice={st.invoiceData}
                    settings={{ ...st.canvasSettings, receipt_width: family === "roll" ? sz : st.canvasSettings.receipt_width }}
                    layout={st.renderLayout} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // m-auto inside a min-h-full flex row centers the sheet on BOTH axes
        // while staying scroll-safe when the sheet outgrows the viewport.
        <div className="flex min-h-full w-full">
          <div ref={sheetRef} className="m-auto"
            style={{ position: "relative", width: SHEET_W[size], transform: `scale(${zoom})`, transformOrigin: "center center", background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}>
            {st.showRuler && <MmRulers size={size} contentMm={contentMm} pageH={pageH} />}
            {/* printable-band guides: what the thermal head can physically reach */}
            {st.showBand && bandClipped && (
              <>
                <div title="حد منطقة الطباعة الفعلية" style={{ position: "absolute", top: 0, bottom: 0, left: `${bandL}mm`, width: 0, borderLeft: "1.5px dashed rgba(220,38,38,0.55)", zIndex: 26, pointerEvents: "none" }} />
                <div title="حد منطقة الطباعة الفعلية" style={{ position: "absolute", top: 0, bottom: 0, left: `${bandL + bandW}mm`, width: 0, borderLeft: "1.5px dashed rgba(220,38,38,0.55)", zIndex: 26, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${bandL}mm`, background: "rgba(220,38,38,0.06)", zIndex: 25, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${bandL + bandW}mm`, right: 0, background: "rgba(220,38,38,0.06)", zIndex: 25, pointerEvents: "none" }} />
              </>
            )}
            <LayoutRenderer family={family} size={size} invoice={st.invoiceData}
              settings={st.canvasSettings} layout={st.renderLayout} editing designer={st.designer} />
            {overlayLayer}
          </div>
        </div>
      )}

      {/* fit / overflow meter (page family) */}
      {!children && family === "page" && !st.compare && pageH > 0 && (
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-elevated)] px-2.5 py-1.5 shadow">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-input)]">
            <div style={{ width: `${Math.min(100, Math.round(fillRatio * 100))}%`, background: fitTone === "ok" ? "var(--success-text)" : fitTone === "warn" ? "var(--warning-text)" : "var(--danger)" }} className="h-full rounded-full" />
          </div>
          <span className="text-[9px] font-black" style={{ color: fitTone === "ok" ? "var(--success-text)" : fitTone === "warn" ? "var(--warning-text)" : "var(--danger)" }}>
            {Math.round(fillRatio * 100)}% · {pages} {pages > 1 ? "صفحات" : "صفحة"}
          </span>
        </div>
      )}

      {/* band info chip (roll) */}
      {!children && family === "roll" && bandClipped && st.showBand && (
        <div className="pointer-events-none absolute top-3 left-3 rounded-lg border border-[var(--border-normal)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[9px] font-black text-[var(--text-secondary)] shadow">
          منطقة الطباعة الفعلية: {bandW}مم من {paperMm}مم
        </div>
      )}

      {/* zoom control */}
      <div className="absolute bottom-3 left-3 flex items-center overflow-hidden rounded-lg border border-[var(--border-normal)] bg-[var(--bg-elevated)] shadow">
        <button type="button" onClick={(e) => { e.stopPropagation(); st.setZoom((z) => Math.min(4, Math.round((z + 0.1) * 10) / 10)); }}
          className="px-2.5 py-1.5 text-sm font-black text-[var(--text-primary)] hover:bg-[var(--bg-input)]">+</button>
        <span className="min-w-[42px] px-1 text-center text-[11px] font-black text-[var(--text-secondary)]">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); st.setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10)); }}
          className="px-2.5 py-1.5 text-sm font-black text-[var(--text-primary)] hover:bg-[var(--bg-input)]">−</button>
      </div>
    </div>
  );
}

// mm rulers on the top/inline-start edges of the sheet.
function MmRulers({ size, contentMm, pageH }) {
  const widthMm = parseFloat(SHEET_W[size]) || 80;
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
