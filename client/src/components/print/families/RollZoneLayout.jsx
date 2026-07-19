import React from "react";
import { g } from "../blocks/blockUtils";

const SECTION = {
  logo: "brand", company_name: "brand", branch: "brand", address: "brand", tax_id: "brand",
  image: "brand",
  receipt_header_text: "headtext",
  doc_number: "meta", doc_date: "meta", customer: "meta", cashier: "meta",
  order_number: "meta",
  items_table: "items",
  subtotal: "totals", discount: "totals", increase: "totals", tax: "totals", grand_total: "totals",
  payments: "payments",
  footer_text: "footer", qr: "qr", barcode: "qr",
};
const GAP_BEFORE = { meta: "6px", items: "8px", totals: "8px", payments: "6px", footer: "10px" };

export default function RollZoneLayout({ items, settings: s }) {
  const itemFont = `${g(s, "item_font_size")}px`;
  const addressAtBottom = s.address_position === "bottom";

  const bottom = [];
  const flow = [];
  let lastReal = "brand";
  items.forEach((it) => {
    if (addressAtBottom && (it.type === "address" || it.type === "tax_id")) { bottom.push(it.node); return; }
    const sec = SECTION[it.type] || lastReal;
    if (SECTION[it.type]) lastReal = sec;
    flow.push({ sec, node: it.node });
  });

  const runs = [];
  flow.forEach((it) => {
    const last = runs[runs.length - 1];
    if (last && last.sec === it.sec) last.nodes.push(it.node);
    else runs.push({ sec: it.sec, nodes: [it.node] });
  });

  const wrapRun = (run, i) => {
    let content;
    if (run.sec === "brand") content = <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>{run.nodes}</div>;
    else if (run.sec === "meta") content = <div style={{ fontSize: itemFont, marginBottom: "5px" }}>{run.nodes}</div>;
    else if (run.sec === "totals" || run.sec === "payments") content = <div style={{ fontSize: itemFont }}>{run.nodes}</div>;
    else content = <>{run.nodes}</>;
    const gap = GAP_BEFORE[run.sec];
    return (
      <React.Fragment key={i}>
        {gap && i > 0 && <div style={{ height: gap }} />}
        {content}
      </React.Fragment>
    );
  };

  return (
    <>
      {runs.map(wrapRun)}
      {bottom.length > 0 && (
        <div style={{ marginTop: "8px", fontSize: "10px", textAlign: "center" }}>{bottom}</div>
      )}
    </>
  );
}
