import React from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import PageWrapper from "./families/PageWrapper";
import PageZoneLayout from "./families/PageZoneLayout";
import { customInserts } from "./customBlockBridge";

export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", editing = false }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  const order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : DEFAULT_ORDER[family];
  const perBlock = famLayout.perBlock || {};
  const inserts = customInserts(settings, family);

  const items = [];
  let key = 0;
  const pushBlock = (type, extraProps) => {
    const entry = BLOCK_REGISTRY[type];
    if (!entry || !entry.families.includes(family)) return;
    const Block = entry.component;
    const props = { ...(entry.defaultProps || {}), ...(perBlock[type] || {}), ...(extraProps || {}) };
    items.push({
      type,
      group: entry.group,
      node: <Block key={`${type}-${key++}`} invoice={invoice} settings={settings} props={props} family={family} editing={editing} />,
    });
  };

  order.forEach((type) => {
    pushBlock(type);
    inserts.filter((ins) => ins.after === type).forEach((ins) => pushBlock(ins.type, ins.props));
  });

  if (family === "page") {
    return (
      <PageWrapper settings={settings} size={size}>
        <PageZoneLayout items={items} settings={settings} />
      </PageWrapper>
    );
  }
  return <RollWrapper settings={settings}>{items.map((it) => it.node)}</RollWrapper>;
}
