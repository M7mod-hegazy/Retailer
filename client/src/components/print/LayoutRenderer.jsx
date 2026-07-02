import React from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import RollZoneLayout from "./families/RollZoneLayout";
import PageWrapper from "./families/PageWrapper";
import PageZoneLayout from "./families/PageZoneLayout";
import { customInserts } from "./customBlockBridge";
import { overrideCss, overrideBox } from "./layout/layoutModel";
import { rollSafeColor, rollClampFontPx, ROLL_MIN_TABLE_PX } from "./blocks/blockUtils";

// `designer` (optional) turns on in-canvas affordances: per-block selection,
// hover highlight, label badge, and drag-to-reorder. It is ignored for the
// production print path (editing=false / no designer), so output stays clean.
export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", editing = false, designer = null }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  let order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : DEFAULT_ORDER[family];
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
    let node = <Block key={`${type}-${key++}`} invoice={invoice} settings={settings} props={props} family={family} editing={editing} />;
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
    if (editing && designer) node = wrapSelectable(node, selKey, type, entry.label, orderSet.has(selKey), designer);
    items.push({ type, group: entry.group, node: <React.Fragment key={`f-${selKey}-${key}`}>{node}</React.Fragment> });
  };

  order.forEach((type) => {
    pushBlock(type);
    inserts.filter((ins) => ins.after === type).forEach((ins) => pushBlock(ins.type, ins.props, ins.id));
  });

  if (family === "page") {
    return (
      <PageWrapper settings={settings} size={size}>
        <PageZoneLayout items={items} invoice={invoice} settings={settings} />
      </PageWrapper>
    );
  }
  return (
    <RollWrapper settings={settings}>
      <RollZoneLayout items={items} settings={settings} />
    </RollWrapper>
  );
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
      data-designer-key={selKey}
      contentEditable={editingText}
      suppressContentEditableWarning
      onPointerDown={(e) => { if (canMove && e.button === 0) designer.onMoveStart(selKey, e); }}
      onClick={(e) => { if (!editingText) { e.stopPropagation(); designer.onSelect(selKey); } }}
      onDoubleClick={(e) => { if (editable) { e.stopPropagation(); designer.onStartEditText && designer.onStartEditText(selKey); } }}
      onBlur={(e) => { if (editingText) designer.onCommitText && designer.onCommitText(selKey, e.currentTarget.textContent); }}
      onMouseEnter={() => designer.onHover(selKey)}
      onMouseLeave={() => designer.onHover(null)}
      style={{ position: "relative", cursor: editingText ? "text" : canMove ? "move" : "pointer", outline, outlineOffset: "1px", borderRadius: "2px", transition: "outline-color 0.1s" }}
    >
      {dropping && <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: -2, height: 3, background: "#2563eb", zIndex: 28, borderRadius: 2 }} />}
      {showBox && (
        <span contentEditable={false} style={{ position: "absolute", top: "-9px", insetInlineStart: "0", zIndex: 31, background: "#7c3aed", color: "#fff", fontSize: "8px", fontWeight: 900, padding: "1px 5px", borderRadius: "3px", whiteSpace: "nowrap", pointerEvents: "none" }}>{editable ? `${label} ✎` : label}</span>
      )}
      {node}
      {showBox && designer.onResizeStart && HANDLES.map(([id, pos, dir]) => (
        <div key={id} contentEditable={false} title="تغيير الحجم"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={stop((e) => designer.onResizeStart(selKey, dir, e))}
          style={{ ...HANDLE, ...pos }} />
      ))}
    </div>
  );
}
