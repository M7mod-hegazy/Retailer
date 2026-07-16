import React, { useState, useLayoutEffect, useRef } from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import RollZoneLayout from "./families/RollZoneLayout";
import PageWrapper from "./families/PageWrapper";
import PageZoneLayout from "./families/PageZoneLayout";
import { customInserts } from "./customBlockBridge";
import { overrideCss, overrideBox } from "./layout/layoutModel";
import { g, rollSafeColor, rollClampFontPx, ROLL_MIN_TABLE_PX } from "./blocks/blockUtils";

// `designer` (optional) turns on in-canvas affordances: per-block selection,
// hover highlight, label badge, and drag-to-reorder. It is ignored for the
// production print path (editing=false / no designer), so output stays clean.
export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", orientation = "portrait", editing = false, designer = null, scope }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  let orderVal = DEFAULT_ORDER[scope] || DEFAULT_ORDER[family];
  if (orderVal && !Array.isArray(orderVal)) {
    orderVal = orderVal[family] || DEFAULT_ORDER[family];
  }
  let order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : orderVal;
  // "increase" (رسوم/إضافة) is a newer money block. Layouts saved before it
  // existed won't list it, so surface it right after the discount line (falling
  // back to just before the grand total). Safe to force in — IncreaseBlock
  // renders nothing when there are no fees.
  if (!order.includes("increase")) {
    order = [...order];
    const at = order.indexOf("discount");
    if (at >= 0) order.splice(at + 1, 0, "increase");
    else {
      const gt = order.indexOf("grand_total");
      if (gt >= 0) order.splice(gt, 0, "increase"); else order.push("increase");
    }
  }
  const perBlock = famLayout.perBlock || {};
  const designerInserts = Array.isArray(famLayout.inserted)
    ? famLayout.inserted.map((b) => ({ id: b.id, after: b.after, type: b.type, props: b.props || {} }))
    : [];
  const inserts = [...customInserts(settings, family), ...designerInserts];
  const orderSet = new Set(order);

  const items = [];
  const absBlocks = []; // page family: freely-positioned blocks (perBlock[key].abs)
  let key = 0;
  const pushBlock = (type, extraProps, overrideKey) => {
    const entry = BLOCK_REGISTRY[type];
    if (!entry || !entry.families.includes(family)) return;
    const Block = entry.component;
    const selKey = overrideKey != null ? overrideKey : type;
    let ov = perBlock[selKey] || {};
    // Thermal guard: on roll output, coerce too-light override colors to black
    // and keep font sizes above the 203dpi legibility floor.
    if (family === "roll" && (ov.color || ov.fontSize != null)) {
      ov = { ...ov };
      if (ov.color) ov.color = rollSafeColor(settings, ov.color);
      if (ov.fontSize != null && ov.fontSize !== "") ov.fontSize = rollClampFontPx(ov.fontSize, ROLL_MIN_TABLE_PX);
    }
    const props = { ...(entry.defaultProps || {}), ...ov, ...(extraProps || {}) };
    const blockSettings = {
      ...settings,
      layout: {
        ...(settings.layout || {}),
        [family]: famLayout,
      }
    };
    let node = <Block key={`${type}-${key++}`} invoice={invoice} settings={blockSettings} props={props} family={family} editing={editing} />;
    const css = overrideCss(ov, `[data-ov="${selKey}"]`);
    const box = overrideBox(ov);
    if (css || box) {
      node = (
        <div data-ov={selKey} style={box || undefined}>
          {css ? <style>{css}</style> : null}
          {node}
        </div>
      );
    }
    // On page family every element is grabbable (drag = free move); on roll
    // only flow-order blocks move (drag = reorder).
    if (editing && designer) node = wrapSelectable(node, selKey, type, entry.label, family === "page" || orderSet.has(selKey), designer);
    // Relative free-move (default): the block STAYS in the flow — it keeps its
    // slot and still respects whatever grows above/below it — but is visually
    // nudged by a mm offset. This is what "move a part freely without it going
    // fixed" means; a longer table still pushes a nudged total down with it.
    const rel = ov.rel && (ov.rel.dxMm || ov.rel.dyMm) ? ov.rel : null;
    if (rel && !(ov.abs && ov.abs.xMm != null)) {
      items.push({
        type, group: entry.group,
        node: (
          <div key={`rel-${selKey}-${key}`} data-block-key={selKey} style={{ transform: `translate(${rel.dxMm || 0}mm, ${rel.dyMm || 0}mm)` }}>
            {node}
          </div>
        ),
      });
      return;
    }
    // Absolute pin: the block LEAVES the flow and renders at fixed mm
    // coordinates (for stamps/badges/watermarks that must sit at an exact spot).
    // `holdMm` optionally keeps the original slot as empty space.
    const abs = ov.abs && ov.abs.xMm != null && ov.abs.yMm != null ? ov.abs : null;
    if (abs) {
      absBlocks.push(
        <div key={`abs-${selKey}-${key}`} data-block-key={selKey} data-abs-block={selKey} dir="rtl" style={{
          position: "absolute",
          left: `${abs.xMm}mm`,
          top: `${abs.yMm}mm`,
          ...(abs.widthMm ? { width: `${abs.widthMm}mm` } : {}),
          zIndex: 5,
          // Roll abs blocks escape the band div, so restore the receipt's
          // typography context (the outer paper div sets none of it).
          ...(family === "roll" ? {
            color: "#000",
            fontFamily: `${g(settings, "print_font")}, "Tahoma", "Segoe UI", Arial, sans-serif`,
            fontSize: `${rollClampFontPx(g(settings, "body_font_size"))}px`,
            lineHeight: 1.6,
          } : {}),
        }}>{node}</div>
      );
      if (Number(abs.holdMm) > 0) {
        items.push({
          type, group: entry.group,
          node: <div key={`hold-${selKey}-${key}`} data-abs-hold={selKey} style={{ height: `${abs.holdMm}mm` }} />,
        });
      }
      return;
    }
    items.push({
      type, group: entry.group,
      node: designer ? <React.Fragment key={`f-${selKey}-${key}`}>{node}</React.Fragment>
        : <div key={`f-${selKey}-${key}`} data-block-key={selKey}>{node}</div>,
    });
  };

  // Inserts anchored to "__top__" render before everything (top of document).
  inserts.filter((ins) => ins.after === "__top__").forEach((ins) => pushBlock(ins.type, ins.props, ins.id));
  order.forEach((type) => {
    pushBlock(type);
    inserts.filter((ins) => ins.after === type).forEach((ins) => pushBlock(ins.type, ins.props, ins.id));
  });

  if (family === "page") {
    return (
      <PageWrapper settings={settings} size={size} orientation={orientation}>
        <PageZoneLayout items={items} invoice={invoice} settings={settings} layout={famLayout} scope={scope} />
        {absBlocks}
        <PageOverlays overlays={famLayout.overlays} invoice={invoice} />
      </PageWrapper>
    );
  }
  return (
    <RollWrapper settings={settings} designer={designer} overlay={absBlocks.length ? absBlocks : null}>
      <RollZoneLayout items={items} settings={settings} />
    </RollWrapper>
  );
}

/**
 * Free-position overlay elements for the page family (hybrid positioning):
 * absolutely-placed text/image/stamp elements at exact mm coordinates inside
 * the sheet (PageWrapper is position:relative). Stored as
 * layout.page.overlays = [{ id, type, xMm, yMm, widthMm?, props }].
 * The flow-based zone layout stays authoritative for document content; these
 * are decorations (stamps, badges, extra images) the Studio drags around.
 */
function PageOverlays({ overlays, invoice = {} }) {
  if (!Array.isArray(overlays) || !overlays.length) return null;
  return overlays.map((o) => {
    if (!o || o.xMm == null || o.yMm == null) return null;
    const p = o.props || {};
    const base = {
      position: "absolute",
      left: `${o.xMm}mm`,
      top: `${o.yMm}mm`,
      ...(o.widthMm ? { width: `${o.widthMm}mm` } : {}),
      ...(p.angle ? { transform: `rotate(${p.angle}deg)` } : {}),
      pointerEvents: "none",
    };
    if (o.type === "image" && p.src) {
      return <img key={o.id} data-overlay={o.id} src={p.src} alt="" style={{ ...base, maxWidth: o.widthMm ? undefined : "40mm" }} />;
    }
    if (o.type === "stamp") {
      return (
        <div key={o.id} data-overlay={o.id} style={{
          ...base,
          border: `2px solid ${p.color || "#b91c1c"}`, color: p.color || "#b91c1c",
          fontWeight: 900, fontSize: `${p.fontSize || 14}px`, padding: "1mm 3mm",
          textAlign: "center", opacity: p.opacity != null ? p.opacity : 0.9,
        }}>{p.text || ""}</div>
      );
    }
    // default: free text
    return (
      <div key={o.id} data-overlay={o.id} style={{
        ...base,
        fontSize: `${p.fontSize || 12}px`,
        fontWeight: p.bold ? 900 : 600,
        color: p.color || "#0f172a",
        textAlign: p.align || "right",
      }}>{p.text || ""}</div>
    );
  });
}

const HANDLE = { position: "absolute", width: 10, height: 10, background: "#fff", border: "2px solid #7c3aed", borderRadius: 2, zIndex: 30, boxShadow: "0 1px 2px rgba(0,0,0,0.25)" };
// 8 PowerPoint-style handles. w/s = which direction (width / size) the handle
// grows: -1, 0 or +1. Positions are physical (work the same in RTL).
const HANDLES = [
  ["nw", { top: -6, left: -6, cursor: "nwse-resize" }, { w: -1, s: -1 }],
  ["n", { top: -6, left: "calc(50% - 5px)", cursor: "ns-resize" }, { w: 0, s: -1 }],
  ["ne", { top: -6, right: -6, cursor: "nesw-resize" }, { w: 1, s: -1 }],
  ["e", { top: "calc(50% - 5px)", right: -6, cursor: "ew-resize" }, { w: 1, s: 0 }],
  ["se", { bottom: -6, right: -6, cursor: "nwse-resize" }, { w: 1, s: 1 }],
  ["s", { bottom: -6, left: "calc(50% - 5px)", cursor: "ns-resize" }, { w: 0, s: 1 }],
  ["sw", { bottom: -6, left: -6, cursor: "nesw-resize" }, { w: -1, s: 1 }],
  ["w", { top: "calc(50% - 5px)", left: -6, cursor: "ew-resize" }, { w: -1, s: 0 }],
];

function BlockWrapper({ children, label }) {
  const containerRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(false);

  useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const hasText = containerRef.current.textContent.trim().length > 0;
      const hasImages = containerRef.current.getElementsByTagName("img").length > 0;
      const hasCanvas = containerRef.current.getElementsByTagName("canvas").length > 0;
      const hasSvg = containerRef.current.getElementsByTagName("svg").length > 0;
      const isActuallyEmpty = !hasText && !hasImages && !hasCanvas && !hasSvg && (rect.height === 0 || containerRef.current.innerHTML === "");
      if (isActuallyEmpty !== isEmpty) setIsEmpty(isActuallyEmpty);
    }
  }, [children, isEmpty]);

  return (
    <div ref={containerRef} style={{ display: isEmpty ? "none" : "contents" }}>
      {children}
    </div>
  );
}

function wrapSelectable(node, selKey, type, label, inOrder, designer) {
  const selected = designer.selectedKey === selKey;
  const hovered = designer.hoveredKey === selKey;
  const dropping = designer.dragOverKey === selKey;
  const editingText = designer.editingKey === selKey;
  const editable = !!designer.editableOf && designer.editableOf(selKey);
  const showBox = selected && !editingText;
  const outline = editingText ? "2px solid #2563eb" : selected ? "2px solid #7c3aed" : hovered ? "1px dashed #a78bfa" : "1px solid transparent";
  const canMove = inOrder && !editingText;
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(e); };
  return (
    <div
      data-block-key={selKey}
      data-designer-key={selKey}
      contentEditable={editingText}
      suppressContentEditableWarning
      onPointerDown={(e) => { if (canMove && e.button === 0) designer.onMoveStart(selKey, e); }}
      onClick={(e) => { if (!editingText) { e.stopPropagation(); designer.onSelect(selKey); } }}
      onDoubleClick={(e) => { if (editable) { e.stopPropagation(); designer.onStartEditText && designer.onStartEditText(selKey); } }}
      onBlur={(e) => { if (editingText) designer.onCommitText && designer.onCommitText(selKey, e.currentTarget.textContent); }}
      onPointerOver={(e) => { e.stopPropagation(); designer.onHover(selKey); }}
      onPointerOut={(e) => { e.stopPropagation(); designer.onHover(null); }}
      style={{ position: "relative", cursor: editingText ? "text" : canMove ? "move" : "pointer", outline, outlineOffset: "1px", borderRadius: "2px", transition: "outline-color 0.1s" }}
    >
      {dropping && <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: -2, height: 3, background: "#2563eb", zIndex: 28, borderRadius: 2 }} />}
      {showBox && (
        <span contentEditable={false} style={{ position: "absolute", top: "-9px", insetInlineStart: "0", zIndex: 31, background: "#7c3aed", color: "#fff", fontSize: "8px", fontWeight: 900, padding: "1px 5px", borderRadius: "3px", whiteSpace: "nowrap", pointerEvents: "none" }}>{editable ? `${label} ✎` : label}</span>
      )}
      <BlockWrapper label={label}>
        {node}
      </BlockWrapper>
      {showBox && designer.onResizeStart && HANDLES.map(([id, pos, dir]) => (
        <div key={id} contentEditable={false} title="تغيير الحجم"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={stop((e) => designer.onResizeStart(selKey, dir, e))}
          style={{ ...HANDLE, ...pos }} />
      ))}
    </div>
  );
}
