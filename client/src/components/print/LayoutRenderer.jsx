import React from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import RollZoneLayout from "./families/RollZoneLayout";
import PageWrapper from "./families/PageWrapper";
import PageZoneLayout from "./families/PageZoneLayout";
import { customInserts } from "./customBlockBridge";
import { overrideStyle } from "./layout/layoutModel";

export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", editing = false }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  const order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : DEFAULT_ORDER[family];
  const perBlock = famLayout.perBlock || {};
  // Inserts come from the Designer (layout.<family>.inserted) and from the
  // legacy custom_text_blocks bridge; both anchor "after" a block type.
  const designerInserts = Array.isArray(famLayout.inserted)
    ? famLayout.inserted.map((b) => ({ id: b.id, after: b.after, type: b.type, props: b.props || {} }))
    : [];
  const inserts = [...customInserts(settings, family), ...designerInserts];

  const items = [];
  let key = 0;
  const pushBlock = (type, extraProps, overrideKey) => {
    const entry = BLOCK_REGISTRY[type];
    if (!entry || !entry.families.includes(family)) return;
    const Block = entry.component;
    const ov = perBlock[overrideKey != null ? overrideKey : type] || {};
    const props = { ...(entry.defaultProps || {}), ...ov, ...(extraProps || {}) };
    let node = <Block key={`${type}-${key++}`} invoice={invoice} settings={settings} props={props} family={family} editing={editing} />;
    const wrap = overrideStyle(ov);
    if (wrap) node = <div key={`w-${type}-${key}`} style={wrap}>{node}</div>;
    items.push({ type, group: entry.group, node });
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
