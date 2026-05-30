import React from "react";
import { g } from "../blocks/blockUtils";

// Renders the thermal stack in the *actual* block order (so the designer can
// reorder freely), grouping consecutive blocks of the same section into the
// legacy wrappers (centered brand header, font-sized meta/totals) and inserting
// dashed dividers at section boundaries. For the default order this reproduces
// the original PrintThermalDoc structure exactly.
const SECTION = {
  logo: "brand", company_name: "brand", branch: "brand", address: "brand", tax_id: "brand",
  receipt_header_text: "headtext",
  doc_number: "meta", doc_date: "meta", customer: "meta", cashier: "meta",
  items_table: "items",
  subtotal: "totals", discount: "totals", tax: "totals", grand_total: "totals",
  payments: "payments",
  footer_text: "footer", qr: "qr",
};
// Sections that get a dashed divider before them.
const DIVIDER_BEFORE = { meta: "5px", items: "5px", totals: "5px", payments: "5px", footer: "6px" };

export default function RollZoneLayout({ items, settings: s }) {
  const accent = g(s, "accent_color");
  const itemFont = `${g(s, "item_font_size")}px`;
  const dashed = `1px dashed ${accent}66`;
  const addressAtBottom = s.address_position === "bottom";

  // Split into the body items (in order) and the optional bottom address block.
  const bottom = [];
  const flow = [];
  let lastReal = "brand";
  items.forEach((it) => {
    if (addressAtBottom && (it.type === "address" || it.type === "tax_id")) { bottom.push(it.node); return; }
    const sec = SECTION[it.type] || lastReal; // inserted/custom join the current section
    if (SECTION[it.type]) lastReal = sec;
    flow.push({ sec, node: it.node });
  });

  // Group consecutive items into runs by section.
  const runs = [];
  flow.forEach((it) => {
    const last = runs[runs.length - 1];
    if (last && last.sec === it.sec) last.nodes.push(it.node);
    else runs.push({ sec: it.sec, nodes: [it.node] });
  });

  const wrapRun = (run, i) => {
    let content;
    if (run.sec === "brand") content = <div style={{ textAlign: "center", marginBottom: "8px" }}>{run.nodes}</div>;
    else if (run.sec === "meta") content = <div style={{ fontSize: itemFont, marginBottom: "5px" }}>{run.nodes}</div>;
    else if (run.sec === "totals" || run.sec === "payments") content = <div style={{ fontSize: itemFont }}>{run.nodes}</div>;
    else content = <>{run.nodes}</>;
    const m = DIVIDER_BEFORE[run.sec];
    return (
      <React.Fragment key={i}>
        {m && i > 0 && <div style={{ borderTop: dashed, margin: `${m} 0` }} />}
        {content}
      </React.Fragment>
    );
  };

  return (
    <>
      {runs.map(wrapRun)}
      {bottom.length > 0 && (
        <div style={{ marginTop: "8px", borderTop: dashed, paddingTop: "6px", fontSize: "10px", textAlign: "center" }}>{bottom}</div>
      )}
    </>
  );
}
