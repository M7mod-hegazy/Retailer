import React from "react";
import { g } from "../blocks/blockUtils";

/**
 * Groups already-rendered, ordered block descriptors into the A4/A5 zones.
 *
 * Modern layout (default): full-width accent header band (brand right, logo +
 * doc meta left in RTL), document title + meta chips row, full-width body,
 * right-aligned totals card, payments, footer (notes/footer text, QR +
 * barcode + signature row), optional bottom address — plus pass-through of
 * absolute overlays (watermark).
 *
 * `layout.page.headerStyle` ("band" | "classic" | "minimal") is a preset
 * lever: band = accent-filled header, classic = bordered two-column header
 * (the pre-overhaul look), minimal = borderless whitespace header.
 * `items` is an array of { type, group, node } in layout order.
 */
export default function PageZoneLayout({ items, invoice = {}, settings: s }) {
  const accent = g(s, "accent_color");
  const addressAtBottom = s.address_position === "bottom";
  const byType = (...t) => items.filter((it) => t.includes(it.type)).map((it) => it.node);
  const headerStyle = (s.layout && s.layout.page && s.layout.page.headerStyle) || "band";

  const brandTypes = addressAtBottom
    ? ["logo", "company_name", "branch", "image"]
    : ["logo", "company_name", "branch", "address", "tax_id", "image"];
  const brand = items.filter((it) => it.group === "brand" && brandTypes.includes(it.type)).map((it) => it.node);
  const bottomAddr = addressAtBottom ? byType("address", "tax_id") : [];
  const receiptHeader = byType("receipt_header_text");
  const meta = byType("doc_number", "doc_date");
  const orderNumber = byType("order_number");
  const body = items.filter((it) => it.group === "body" || it.group === "inserted").map((it) => it.node);
  const totals = byType("subtotal", "discount", "increase", "tax", "grand_total");
  const payments = byType("payments");
  const footerText = byType("footer_text", "notes");
  const qr = byType("qr");
  const barcode = byType("barcode");
  const signatures = byType("signature_lines");
  const watermark = byType("watermark"); // absolute overlay — anywhere in flow

  const metaAlign = (s.layout && s.layout.page && s.layout.page.headerMetaAlign) || "left";
  const docTitle = g(s, "receipt_footer") || "فاتورة";
  const showCustomer = g(s, "show_customer_name") !== false && invoice.customer_name;
  const cashierName = invoice.cashier_name || invoice.cashier;
  const showCashier = g(s, "show_cashier_name") !== false && cashierName;

  // Header treatments — the same content, three densities.
  const headerWrapStyle = headerStyle === "band"
    ? { background: accent, color: "#fff", padding: "10px 12px", borderRadius: "4px", marginBottom: "10px" }
    : headerStyle === "classic"
      ? { borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px" }
      : { paddingBottom: "6px", marginBottom: "12px" };
  const bandText = headerStyle === "band" ? { color: "#fff" } : {};

  const chip = {
    display: "inline-flex", alignItems: "center", gap: "4px",
    border: "1px solid #cbd5e1", borderRadius: "4px",
    padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#334155",
    background: "#fff",
  };

  return (
    <>
      {watermark}

      <div data-zone="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", ...headerWrapStyle }}>
        {/* Band mode inverts text to white; blocks keep their own colors via
            an inherit-friendly wrapper so accents don't vanish into the band. */}
        <div data-zone-col="brand" style={bandText}>{brand}</div>
        <div data-zone-col="meta" style={{ textAlign: metaAlign, ...bandText }}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: headerStyle === "band" ? "#fff" : accent }}>{docTitle}</div>
          {meta}
          {orderNumber}
        </div>
      </div>

      {receiptHeader}

      {(showCustomer || showCashier) && (
        <div data-zone="parties" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {showCustomer && (
            <span style={chip}><span style={{ color: "#64748b" }}>العميل</span><strong style={{ color: "#0f172a" }}>{invoice.customer_name}</strong></span>
          )}
          {showCashier && (
            <span style={chip}><span style={{ color: "#64748b" }}>الكاشير</span><strong style={{ color: "#0f172a" }}>{cashierName}</strong></span>
          )}
          {invoice.branch_name && (
            <span style={chip}><span style={{ color: "#64748b" }}>الفرع</span><strong style={{ color: "#0f172a" }}>{invoice.branch_name}</strong></span>
          )}
        </div>
      )}

      <div data-zone="body">{body}</div>

      <div data-zone="totals" style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          width: "45%", fontSize: `${g(s, "item_font_size")}px`,
          border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 8px",
        }}>{totals}</div>
      </div>

      {payments.length > 0 && <div data-zone="payments">{payments}</div>}

      <div data-zone="footer">
        {footerText.length > 0 && (
          <>
            <div style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44` }} />
            {footerText}
          </>
        )}
        {(qr.length > 0 || barcode.length > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "8px" }}>
            <div>{qr}</div>
            <div>{barcode}</div>
          </div>
        )}
        {signatures}
      </div>

      {bottomAddr.length > 0 && (
        <div data-zone="address-bottom" style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44`, fontSize: "10px", color: "#475569", fontWeight: 600, textAlign: "center" }}>{bottomAddr}</div>
      )}
    </>
  );
}
