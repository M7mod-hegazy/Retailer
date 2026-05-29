import React from "react";
import { g } from "../blocks/blockUtils";

// Groups already-rendered, ordered block descriptors into zones by registry group.
// `items` is an array of { type, group, node } in layout order.
export default function PageZoneLayout({ items, settings: s }) {
  const accent = g(s, "accent_color");
  const pick = (...groups) => items.filter((it) => groups.includes(it.group)).map((it) => it.node);
  const brand = pick("brand");
  const meta = items.filter((it) => it.group === "dochead").map((it) => it.node);
  const body = pick("body", "inserted");
  const totals = pick("money");
  const foot = pick("foot");

  return (
    <>
      <div data-zone="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px" }}>
        <div data-zone-col="brand">{brand}</div>
        <div data-zone-col="meta" style={{ textAlign: "left" }}>{meta}</div>
      </div>
      <div data-zone="body">{body}</div>
      <div data-zone="totals" style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "45%" }}>{totals}</div>
      </div>
      <div data-zone="footer">{foot}</div>
    </>
  );
}
