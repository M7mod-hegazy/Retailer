import React from "react";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { DEFAULT_ORDER } from "./families/defaultOrder";
import RollWrapper from "./families/RollWrapper";
import PageWrapper from "./families/PageWrapper";

export default function LayoutRenderer({ family = "roll", invoice = {}, settings = {}, layout = null, size = "A4", editing = false }) {
  const famLayout = (layout || settings.layout || {})[family] || {};
  const order = Array.isArray(famLayout.order) && famLayout.order.length ? famLayout.order : DEFAULT_ORDER[family];
  const perBlock = famLayout.perBlock || {};

  const blocks = order.map((type, i) => {
    const entry = BLOCK_REGISTRY[type];
    if (!entry || !entry.families.includes(family)) return null;
    const Block = entry.component;
    const props = { ...(entry.defaultProps || {}), ...(perBlock[type] || {}) };
    return <Block key={`${type}-${i}`} invoice={invoice} settings={settings} props={props} family={family} editing={editing} />;
  });

  const Wrapper = family === "roll" ? RollWrapper : PageWrapper;
  return <Wrapper settings={settings} size={size}>{blocks}</Wrapper>;
}
