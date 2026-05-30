import React from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import RollZoneLayout from "./families/RollZoneLayout";
import PageWrapper from "./families/PageWrapper";
import PageZoneLayout from "./families/PageZoneLayout";
import { customInserts } from "./customBlockBridge";
import { overrideStyle } from "./layout/layoutModel";

// `designer` (optional) turns on in-canvas affordances: per-block selection,
// hover highlight, label badge, and drag-to-reorder. It is ignored for the
// production print path (editing=false / no designer), so output stays clean.
export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", editing = false, designer = null }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  const order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : DEFAULT_ORDER[family];
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
    const ov = perBlock[selKey] || {};
    const props = { ...(entry.defaultProps || {}), ...ov, ...(extraProps || {}) };
    let node = <Block key={`${type}-${key++}`} invoice={invoice} settings={settings} props={props} family={family} editing={editing} />;
    const wrap = overrideStyle(ov);
    if (wrap) node = <div style={wrap}>{node}</div>;
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

const HANDLE = { position: "absolute", width: 12, height: 12, background: "#7c3aed", border: "2px solid #fff", borderRadius: "50%", zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" };

function wrapSelectable(node, selKey, type, label, draggable, designer) {
  const selected = designer.selectedKey === selKey;
  const hovered = designer.hoveredKey === selKey;
  const dropping = designer.dragOverKey === selKey;
  const outline = selected ? "2px solid #7c3aed" : hovered ? "1px dashed #a78bfa" : "1px solid transparent";
  const isDim = type === "logo" || type === "qr";
  const showWidth = !isDim;
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(e); };
  return (
    <div
      data-designer-key={selKey}
      draggable={draggable}
      onClick={(e) => { e.stopPropagation(); designer.onSelect(selKey); }}
      onMouseEnter={() => designer.onHover(selKey)}
      onMouseLeave={() => designer.onHover(null)}
      onDragStart={(e) => { e.stopPropagation(); designer.onDragStart(selKey); }}
      onDragOver={(e) => { if (draggable) { e.preventDefault(); designer.onDragOverKey && designer.onDragOverKey(selKey); } }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); designer.onDrop(selKey); }}
      onDragEnd={() => designer.onDragEnd && designer.onDragEnd()}
      style={{ position: "relative", cursor: draggable ? "move" : "pointer", outline, outlineOffset: "1px", borderRadius: "2px", transition: "outline-color 0.1s" }}
    >
      {dropping && <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, top: -2, height: 3, background: "#2563eb", zIndex: 25, borderRadius: 2 }} />}
      {selected && (
        <span style={{ position: "absolute", top: "-9px", insetInlineStart: "0", zIndex: 20, background: "#7c3aed", color: "#fff", fontSize: "8px", fontWeight: 900, padding: "1px 5px", borderRadius: "3px", whiteSpace: "nowrap", pointerEvents: "none" }}>{label}</span>
      )}
      {node}
      {selected && designer.onResizeStart && (
        <>
          <div title="تغيير الحجم" onPointerDown={stop((e) => designer.onResizeStart(selKey, isDim ? "size" : "font", e))} onDragStart={(e) => e.preventDefault()}
            style={{ ...HANDLE, bottom: -6, insetInlineStart: -6, cursor: "nwse-resize" }} />
          {showWidth && (
            <div title="تغيير العرض" onPointerDown={stop((e) => designer.onResizeStart(selKey, "width", e))} onDragStart={(e) => e.preventDefault()}
              style={{ ...HANDLE, top: "50%", insetInlineStart: -6, transform: "translateY(-50%)", cursor: "ew-resize" }} />
          )}
        </>
      )}
    </div>
  );
}
