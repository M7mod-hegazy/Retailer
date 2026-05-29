import React from "react";
import { g } from "../blocks/blockUtils";

// Reproduces the legacy thermal stack: centered brand header, dashed section
// dividers, and per-section font wrappers. `items` is the ordered list of
// { type, group, node } produced by LayoutRenderer (custom inserts already spliced).
const SECTION = {
  logo: "brand", company_name: "brand", branch: "brand", address: "brand", tax_id: "brand",
  receipt_header_text: "headtext",
  doc_number: "meta", doc_date: "meta", customer: "meta", cashier: "meta",
  items_table: "items",
  subtotal: "totals", discount: "totals", tax: "totals", grand_total: "totals",
  payments: "payments",
  footer_text: "footer", qr: "qr",
};

export default function RollZoneLayout({ items, settings: s }) {
  const accent = g(s, "accent_color");
  const itemFont = `${g(s, "item_font_size")}px`;
  const dashed = `1px dashed ${accent}66`;
  const addressAtBottom = s.address_position === "bottom";
  const buckets = { brand: [], headtext: [], meta: [], items: [], totals: [], payments: [], footer: [], qr: [], bottom: [] };

  // Order-preserving bucketing; inserted/custom blocks join the current section.
  let last = "brand";
  items.forEach((it) => {
    let sec = SECTION[it.type] || last;
    if (addressAtBottom && (it.type === "address" || it.type === "tax_id")) sec = "bottom";
    if (buckets[sec]) {
      buckets[sec].push(it.node);
      if (sec !== "bottom") last = sec;
    }
  });
  const has = (k) => buckets[k].length > 0;
  const Divider = ({ m = "5px" }) => <div style={{ borderTop: dashed, margin: `${m} 0` }} />;

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "8px" }}>{buckets.brand}</div>
      {buckets.headtext}
      <Divider />
      <div style={{ fontSize: itemFont, marginBottom: "5px" }}>{buckets.meta}</div>
      <Divider />
      {buckets.items}
      <Divider />
      <div style={{ fontSize: itemFont }}>{buckets.totals}</div>
      {has("payments") && (
        <>
          <Divider />
          <div style={{ fontSize: itemFont }}>{buckets.payments}</div>
        </>
      )}
      {has("footer") && (
        <>
          <Divider m="6px" />
          {buckets.footer}
        </>
      )}
      {buckets.qr}
      {has("bottom") && (
        <div style={{ marginTop: "8px", borderTop: dashed, paddingTop: "6px", fontSize: "10px", textAlign: "center" }}>{buckets.bottom}</div>
      )}
    </>
  );
}
