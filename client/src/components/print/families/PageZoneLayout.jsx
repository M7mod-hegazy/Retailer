import React from "react";
import { g } from "../blocks/blockUtils";

// Groups already-rendered, ordered block descriptors into the A4/A5 zones,
// reproducing the legacy PrintA4Doc structure: a two-column header (brand +
// doc-meta with a large doc title), an optional receipt-header line, a
// customer/cashier band, a full-width body, a right-aligned 45% totals box,
// full-width payments, then footer + QR (and an optional bottom address block).
// `items` is an array of { type, group, node } in layout order.
export default function PageZoneLayout({ items, invoice = {}, settings: s }) {
  const accent = g(s, "accent_color");
  const addressAtBottom = s.address_position === "bottom";
  const byType = (...t) => items.filter((it) => t.includes(it.type)).map((it) => it.node);

  const brandTypes = addressAtBottom
    ? ["logo", "company_name", "branch"]
    : ["logo", "company_name", "branch", "address", "tax_id"];
  const brand = items.filter((it) => it.group === "brand" && brandTypes.includes(it.type)).map((it) => it.node);
  const bottomAddr = addressAtBottom ? byType("address", "tax_id") : [];
  const receiptHeader = byType("receipt_header_text");
  const meta = byType("doc_number", "doc_date");
  const body = items.filter((it) => it.group === "body" || it.group === "inserted").map((it) => it.node);
  const totals = byType("subtotal", "discount", "tax", "grand_total");
  const payments = byType("payments");
  const footerText = byType("footer_text");
  const qr = byType("qr");

  const metaAlign = (s.layout && s.layout.page && s.layout.page.headerMetaAlign) || "left";
  const docTitle = g(s, "receipt_footer") || "فاتورة";
  const showCustomer = g(s, "show_customer_name") !== false && invoice.customer_name;
  const cashierName = invoice.cashier_name || invoice.cashier;
  const showCashier = g(s, "show_cashier_name") !== false && cashierName;

  return (
    <>
      <div data-zone="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px" }}>
        <div data-zone-col="brand">{brand}</div>
        <div data-zone-col="meta" style={{ textAlign: metaAlign }}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: accent }}>{docTitle}</div>
          {meta}
        </div>
      </div>

      {receiptHeader}

      {(showCustomer || showCashier) && (
        <div data-zone="parties" style={{ display: "flex", gap: "24px", marginBottom: "10px", fontSize: "11px", background: "#f8fafc", padding: "8px 10px", borderRadius: "4px" }}>
          {showCustomer && (
            <div><span style={{ color: "#64748b" }}>العميل: </span><strong>{invoice.customer_name}</strong></div>
          )}
          {showCashier && (
            <div><span style={{ color: "#64748b" }}>الكاشير: </span><strong>{cashierName}</strong></div>
          )}
        </div>
      )}

      <div data-zone="body">{body}</div>

      <div data-zone="totals" style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "45%", fontSize: `${g(s, "item_font_size")}px` }}>{totals}</div>
      </div>

      {payments.length > 0 && <div data-zone="payments">{payments}</div>}

      <div data-zone="footer">
        {footerText.length > 0 && (
          <>
            <div style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44` }} />
            {footerText}
          </>
        )}
        {qr}
      </div>

      {bottomAddr.length > 0 && (
        <div data-zone="address-bottom" style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44`, fontSize: "10px", color: "#94a3b8", textAlign: "center" }}>{bottomAddr}</div>
      )}
    </>
  );
}
