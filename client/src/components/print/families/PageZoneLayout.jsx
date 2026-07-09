import React from "react";
import { g } from "../blocks/blockUtils";

/**
 * Groups already-rendered, ordered block descriptors into the A4/A5 zones.
 *
 * Layout types (layout.page.pageLayoutType):
 *  "standard"     — full-width header band, 45% totals card bottom-right
 *  "sidebar"      — left sidebar with brand/meta, main content right
 *  "executive"    — double-border frame, three-column header
 *  "split-header" — header split 40%/60% with giant doc# right, full-width totals
 *  "ticket"       — centered brand, huge order#, full-width total stripe
 *  "letterhead"   — two-col top (logo+address | doc info), ruled sep, sig grid bottom
 *  "minimal-top"  — no header bg, name in large type, chip meta, dark full-width total
 *
 * Header styles (layout.page.headerStyle) applied inside standard / split-header:
 *  "band" | "classic" | "minimal" | "centered" | "boxed"
 */
export default function PageZoneLayout({ items, invoice = {}, settings: s, layout, scope }) {
  const accent = g(s, "accent_color");
  const addressAtBottom = s.address_position === "bottom";
  const byType = (...t) => items.filter((it) => t.includes(it.type)).map((it) => it.node);
  const headerStyle = (layout && layout.headerStyle) || (s.layout && s.layout.page && s.layout.page.headerStyle) || s.header_style || "band";

  const brandTypes = addressAtBottom
    ? ["logo", "company_name", "branch", "image"]
    : ["logo", "company_name", "branch", "address", "tax_id", "image"];
  const brand = items.filter((it) => it.group === "brand" && brandTypes.includes(it.type)).map((it) => it.node);
  const logo = byType("logo");
  const companyName = byType("company_name");
  const branch = byType("branch");
  const address = byType("address");
  const taxId = byType("tax_id");
  const image = byType("image");
  const restBrand = null; // kept for legacy; not used

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
  const watermark = byType("watermark");

  const metaAlign = s.header_meta_align || (layout && layout.headerMetaAlign) || (s.layout && s.layout.page && s.layout.page.headerMetaAlign) || "left";
  const reportTitles = {
    bank_statement: "كشف حساب بنكي",
    daily_treasury: "تقرير حركة الخزينة اليومي",
    cheque_register: "سجل حركة الشيكات",
    payment_methods_report: "تقرير حركة وسائل الدفع",
    ajal_statement: "كشف حساب آجل",
    ajal_schedule: "جدول الأقساط",
    ajal_full_statement: "كشف الديون الآجلة الشامل",
    reports_generic: "تقرير عام",
  };
  const docTitle = invoice.title || reportTitles[scope] || g(s, "receipt_footer") || "فاتورة";
  const showCustomer = g(s, "show_customer_name") !== false && invoice.customer_name;
  const cashierName = invoice.cashier_name || invoice.cashier;
  const showCashier = g(s, "show_cashier_name") !== false && cashierName;

  const chip = {
    display: "inline-flex", alignItems: "center", gap: "4px",
    border: "1px solid #cbd5e1", borderRadius: "4px",
    padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: "#334155",
    background: "#fff",
  };

  const pageLayoutType = (layout && layout.pageLayoutType) || (s.layout && s.layout.page && s.layout.page.pageLayoutType) || s.page_layout_type || "standard";

  // ═══════════════════════════════════════════════════════════
  // LAYOUT: split-header
  // 40% brand | 60% giant doc-number. Full-width totals strip at bottom.
  // ═══════════════════════════════════════════════════════════
  if (pageLayoutType === "split-header") {
    const isDarkHeader = headerStyle === "asymmetric" || headerStyle === "band" || headerStyle === "brutalist" || !headerStyle;
    
    let headerContainerStyle = {
      display: "grid",
      gridTemplateColumns: "2fr 3fr",
      background: accent,
      color: "#fff",
      borderRadius: "4px 4px 0 0",
      marginBottom: "16px",
      overflow: "hidden",
    };
    let brandPaneStyle = {
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      borderLeft: `1px solid #ffffff22`
    };
    let docPaneStyle = {
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    };
    let docTitleStyle = {
      fontSize: "22px",
      fontWeight: 900,
      letterSpacing: "1px",
      marginBottom: "6px"
    };
    let metaWrapperStyle = {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      fontSize: "11px",
      opacity: 0.9
    };

    if (headerStyle === "badge") {
      headerContainerStyle = {
        display: "grid",
        gridTemplateColumns: "2fr 3fr",
        background: "transparent",
        color: "var(--text-primary)",
        borderBottom: `2px dashed #cbd5e1`,
        marginBottom: "16px",
        paddingBottom: "12px",
      };
      brandPaneStyle = {
        padding: "8px 0",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        borderLeft: `1px solid var(--border-normal)`,
        paddingLeft: "16px",
      };
      docPaneStyle = {
        padding: "8px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      };
      docTitleStyle = {
        display: "inline-block",
        background: accent,
        color: "#fff",
        borderRadius: "20px",
        padding: "4px 14px",
        fontSize: "11px",
        fontWeight: 900,
        letterSpacing: "0.5px",
        alignSelf: "flex-start",
        marginBottom: "6px",
      };
      metaWrapperStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "10px",
        color: "#64748b",
      };
    } else if (headerStyle === "boxed") {
      headerContainerStyle = {
        display: "grid",
        gridTemplateColumns: "2fr 3fr",
        background: `${accent}05`,
        color: "var(--text-primary)",
        border: `1px solid ${accent}33`,
        borderRadius: "8px",
        marginBottom: "16px",
        overflow: "hidden",
      };
      brandPaneStyle = {
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        borderLeft: `1px solid ${accent}33`,
      };
      docPaneStyle = {
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      };
      docTitleStyle = {
        border: `1px solid ${accent}33`,
        background: "#fff",
        padding: "6px 12px",
        borderRadius: "4px",
        fontSize: "16px",
        fontWeight: 900,
        color: accent,
        alignSelf: "flex-start",
        marginBottom: "6px",
      };
      metaWrapperStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "11px",
        color: "#334155",
      };
    } else if (headerStyle === "inline") {
      headerContainerStyle = {
        display: "grid",
        gridTemplateColumns: "2fr 3fr",
        background: "transparent",
        color: "var(--text-primary)",
        borderTop: "2px solid #cbd5e1",
        borderBottom: "2px solid #cbd5e1",
        marginBottom: "16px",
        padding: "8px 0",
      };
      brandPaneStyle = {
        padding: "4px 0",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        borderLeft: `1px solid var(--border-normal)`,
        paddingLeft: "16px",
      };
      docPaneStyle = {
        padding: "4px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      };
      docTitleStyle = {
        fontSize: "16px",
        fontWeight: 900,
        color: accent,
        borderBottom: `2px solid ${accent}`,
        paddingBottom: "2px",
        alignSelf: "flex-start",
        marginBottom: "6px",
      };
      metaWrapperStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "10px",
        color: "#334155",
      };
    } else if (headerStyle === "centered") {
      headerContainerStyle = {
        display: "grid",
        gridTemplateColumns: "2fr 3fr",
        background: "transparent",
        color: "var(--text-primary)",
        borderBottom: `4px double ${accent}`,
        paddingBottom: "12px",
        marginBottom: "16px",
      };
      brandPaneStyle = {
        padding: "6px 0",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        borderLeft: `1px solid var(--border-normal)`,
        paddingLeft: "16px",
      };
      docPaneStyle = {
        padding: "6px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      };
      docTitleStyle = {
        fontSize: "20px",
        fontWeight: 900,
        color: accent,
        textAlign: "center",
        marginBottom: "6px",
      };
      metaWrapperStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "10px",
        color: "#334155",
      };
    } else if (headerStyle === "brutalist") {
      headerContainerStyle = {
        display: "grid",
        gridTemplateColumns: "2fr 3fr",
        background: "#0f172a",
        color: "#fff",
        border: "3px solid #0f172a",
        marginBottom: "16px",
        overflow: "hidden",
      };
      brandPaneStyle = {
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        borderLeft: "3px solid #fff",
      };
      docPaneStyle = {
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      };
      docTitleStyle = {
        fontFamily: "monospace",
        fontSize: "20px",
        fontWeight: 900,
        letterSpacing: "1px",
        marginBottom: "6px",
      };
      metaWrapperStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize: "11px",
        opacity: 0.9,
      };
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", direction: "rtl" }}>
        {watermark}

        {/* Split header: brand 40% | doc-info 60% */}
        <div 
          className={isDarkHeader ? "print-dark-bg" : ""}
          style={headerContainerStyle}>
          {/* Brand pane */}
          <div style={brandPaneStyle}>
            {brand}
          </div>
          {/* Doc-info pane */}
          <div style={docPaneStyle}>
            <div style={docTitleStyle}>{docTitle}</div>
            <div style={metaWrapperStyle}>
              {meta}
              {orderNumber}
            </div>
          </div>
        </div>

        {/* Parties chips row */}
        {(showCustomer || showCashier) && (
          <div style={{ display: "flex", gap: "8px", padding: "6px 0", flexWrap: "wrap" }}>
            {showCustomer && <span style={chip}><span style={{ color: "#64748b" }}>العميل</span><strong style={{ color: "#0f172a" }}>{invoice.customer_name}</strong></span>}
            {showCashier && <span style={chip}><span style={{ color: "#64748b" }}>الكاشير</span><strong style={{ color: "#0f172a" }}>{cashierName}</strong></span>}
          </div>
        )}

        {receiptHeader}

        {/* Body — full width */}
        <div data-zone="body" style={{ flex: 1, marginTop: "8px" }}>{body}</div>

        {/* Full-width totals strip */}
        <div data-zone="totals" style={{ marginTop: "12px" }}>
          {totals}
        </div>

        {payments.length > 0 && <div data-zone="payments" style={{ marginTop: "8px" }}>{payments}</div>}

        <div data-zone="footer" style={{ marginTop: "12px", paddingTop: "8px", borderTop: `1px solid ${accent}44` }}>
          {footerText}
          {(qr.length > 0 || barcode.length > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "8px" }}>
              <div>{qr}</div>
              <div>{barcode}</div>
            </div>
          )}
          {signatures}
        </div>
        {bottomAddr.length > 0 && (
          <div style={{ marginTop: "8px", fontSize: "10px", color: "#475569", fontWeight: 600, textAlign: "center", borderTop: `1px solid ${accent}22`, paddingTop: "4px" }}>{bottomAddr}</div>
        )}
      </div>
    );
  }

  if (pageLayoutType === "ticket") {
    let isDarkTicket = false;
    let headerBorder = `3px solid ${accent}`;
    let titleBlock = <div style={{ fontSize: "13px", fontWeight: 700, color: accent, marginTop: "8px", letterSpacing: "2px", textTransform: "uppercase" }}>{docTitle}</div>;
    let headerBg = "transparent";
    let headerColor = "var(--text-primary)";
    let headerPadding = "16px 12px 12px";

    if (headerStyle === "brutalist") {
      isDarkTicket = true;
      headerBg = "#0f172a";
      headerColor = "#fff";
      headerBorder = "3px solid #0f172a";
      headerPadding = "14px";
      titleBlock = (
        <div style={{
          background: "#fff",
          color: "#0f172a",
          padding: "6px 16px",
          fontWeight: 900,
          fontSize: "14px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginTop: "8px",
          display: "inline-block"
        }}>{docTitle}</div>
      );
    } else if (headerStyle === "badge") {
      headerBorder = "1px dashed #cbd5e1";
      titleBlock = (
        <div style={{
          background: accent,
          color: "#fff",
          borderRadius: "20px",
          padding: "3px 14px",
          fontSize: "10px",
          fontWeight: 900,
          letterSpacing: "0.5px",
          marginTop: "8px",
          display: "inline-block"
        }}>{docTitle}</div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", direction: "rtl" }}>
        {watermark}

        {/* Centered header */}
        <div 
          className={isDarkTicket ? "print-dark-bg" : ""}
          style={{
            textAlign: "center",
            padding: headerPadding,
            borderBottom: headerBorder,
            background: headerBg,
            color: headerColor,
            marginBottom: "12px",
          }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            {brand}
          </div>
          {titleBlock}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "4px", fontSize: "10px", color: isDarkTicket ? "#fff" : "#64748b", opacity: isDarkTicket ? 0.9 : 1 }}>
            {meta}
          </div>
        </div>

        {/* Big order number */}
        {orderNumber.length > 0 && (
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            {orderNumber}
          </div>
        )}

        {(showCustomer || showCashier) && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px", justifyContent: "center" }}>
            {showCustomer && <span style={chip}><span style={{ color: "#64748b" }}>العميل</span><strong style={{ color: "#0f172a" }}>{invoice.customer_name}</strong></span>}
            {showCashier && <span style={chip}><span style={{ color: "#64748b" }}>الكاشير</span><strong style={{ color: "#0f172a" }}>{cashierName}</strong></span>}
          </div>
        )}

        {receiptHeader}

        <div data-zone="body" style={{ flex: 1 }}>{body}</div>

        {/* Full-width totals */}
        <div data-zone="totals" style={{ marginTop: "8px" }}>
          {totals}
        </div>

        {payments.length > 0 && <div data-zone="payments" style={{ marginTop: "6px" }}>{payments}</div>}

        <div data-zone="footer" style={{ marginTop: "12px", borderTop: `1px dashed ${accent}66`, paddingTop: "8px" }}>
          {footerText}
          {(qr.length > 0 || barcode.length > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "8px" }}>
              <div>{qr}</div>
              <div>{barcode}</div>
            </div>
          )}
          {signatures}
        </div>
        {bottomAddr.length > 0 && (
          <div style={{ marginTop: "8px", fontSize: "10px", color: "#475569", textAlign: "center" }}>{bottomAddr}</div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LAYOUT: letterhead
  // Two-col header (logo+address left | doc info right), ruled sep, sig grid bottom.
  // ═══════════════════════════════════════════════════════════
  if (pageLayoutType === "letterhead") {
    let isDarkHeader = false;
    let headerContainerStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", paddingBottom: "12px", borderBottom: `3px solid ${accent}`, marginBottom: "16px" };
    let brandColStyle = { display: "flex", flexDirection: "column", gap: "4px" };
    let docColStyle = { textAlign: "left", display: "flex", flexDirection: "column", gap: "6px", justifyContent: "flex-end" };

    if (headerStyle === "centered") {
      headerContainerStyle = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: "12px", borderBottom: `3px solid ${accent}`, marginBottom: "16px", gap: "8px" };
      brandColStyle = { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" };
      docColStyle = { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" };
    } else if (headerStyle === "boxed") {
      headerContainerStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "14px", border: `1px solid ${accent}33`, background: `${accent}05`, borderRadius: "8px", marginBottom: "16px" };
      brandColStyle = { display: "flex", flexDirection: "column", gap: "4px" };
      docColStyle = { textAlign: "left", display: "flex", flexDirection: "column", gap: "6px", justifyContent: "center" };
    } else if (headerStyle === "band") {
      isDarkHeader = true;
      headerContainerStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "14px 16px", background: accent, color: "#fff", borderRadius: "4px", marginBottom: "16px" };
      brandColStyle = { display: "flex", flexDirection: "column", gap: "4px" };
      docColStyle = { textAlign: "left", display: "flex", flexDirection: "column", gap: "6px", justifyContent: "center" };
    } else if (headerStyle === "inline") {
      headerContainerStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", paddingBottom: "8px", borderBottom: "1px solid #cbd5e1", marginBottom: "16px" };
      brandColStyle = { display: "flex", flexDirection: "column", gap: "4px" };
      docColStyle = { textAlign: "left", display: "flex", flexDirection: "column", gap: "4px", justifyContent: "flex-end" };
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", direction: "rtl" }}>
        {watermark}

        {/* Two-column letterhead header */}
        <div 
          className={isDarkHeader ? "print-dark-bg" : ""}
          style={headerContainerStyle}>
          {/* Left col: brand */}
          <div style={brandColStyle}>
            {brand}
          </div>
          {/* Right col: doc info as labeled rows */}
          <div style={docColStyle}>
            <div style={{ fontSize: "18px", fontWeight: 900, color: isDarkHeader ? "#fff" : accent, marginBottom: "4px" }}>{docTitle}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", color: isDarkHeader ? "#fff" : "inherit" }}>
              {meta}
            </div>
            {orderNumber}
          </div>
        </div>

        {/* Customer/cashier bar */}
        {(showCustomer || showCashier) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "8px 12px", border: `1px solid ${accent}22`, background: `${accent}04`, borderRadius: "4px", marginBottom: "12px", fontSize: "10px" }}>
            {showCustomer && <div><span style={{ color: "#64748b" }}>السيد / السادة: </span><strong style={{ color: "#0f172a" }}>{invoice.customer_name}</strong></div>}
            {showCashier && <div><span style={{ color: "#64748b" }}>المسؤول: </span><strong style={{ color: "#0f172a" }}>{cashierName}</strong></div>}
          </div>
        )}

        {receiptHeader}

        <div data-zone="body" style={{ flex: 1, minHeight: "200px" }}>{body}</div>

        {/* Totals: right-aligned card */}
        <div data-zone="totals" style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
          <div style={{ width: "48%", borderTop: `2px solid ${accent}`, paddingTop: "8px" }}>
            {totals}
          </div>
        </div>

        {payments.length > 0 && <div data-zone="payments" style={{ marginTop: "8px" }}>{payments}</div>}

        {/* Footer with signature grid */}
        <div data-zone="footer" style={{ marginTop: "20px", borderTop: `2px solid ${accent}`, paddingTop: "12px" }}>
          {footerText}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "12px" }}>
            <div>{qr}</div>
            {signatures}
            <div>{barcode}</div>
          </div>
        </div>

        {bottomAddr.length > 0 && (
          <div style={{ marginTop: "12px", fontSize: "10px", color: "#475569", textAlign: "center", borderTop: `1px solid ${accent}22`, paddingTop: "4px" }}>{bottomAddr}</div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LAYOUT: minimal-top
  // No header background. Company name in large type. Chip meta row.
  // Totals FULL-WIDTH dark accent stripe.
  // ═══════════════════════════════════════════════════════════
  if (pageLayoutType === "minimal-top") {
    let isDarkHeader = false;
    let headerBorder = `1px solid #e2e8f0`;
    let headerPadding = "0 0 12px";
    let headerContainerStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start" };
    let brandColStyle = { display: "flex", flexDirection: "column", gap: "4px" };
    let docColStyle = { textAlign: "left" };
    let titleBlock = <div style={{ fontSize: "14px", fontWeight: 900, color: accent, letterSpacing: "1px" }}>{docTitle}</div>;
    let metaWrapperStyle = { display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px", fontSize: "10px", color: "#64748b" };

    if (headerStyle === "badge") {
      headerBorder = "1px dashed #cbd5e1";
      titleBlock = (
        <div style={{
          background: accent,
          color: "#fff",
          borderRadius: "20px",
          padding: "4px 14px",
          fontSize: "11px",
          fontWeight: 900,
          letterSpacing: "0.5px",
          display: "inline-block"
        }}>{docTitle}</div>
      );
    } else if (headerStyle === "centered") {
      headerContainerStyle = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "6px" };
      brandColStyle = { display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" };
      docColStyle = { display: "flex", flexDirection: "column", alignItems: "center" };
      titleBlock = <div style={{ fontSize: "18px", fontWeight: 900, color: accent }}>{docTitle}</div>;
      metaWrapperStyle = { display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "4px", fontSize: "10px", color: "#64748b" };
    } else if (headerStyle === "classic") {
      headerBorder = `3px solid ${accent}`;
      headerPadding = "0 0 8px";
      titleBlock = <div style={{ fontSize: "16px", fontWeight: 900, color: accent }}>{docTitle}</div>;
    } else if (headerStyle === "asymmetric") {
      headerContainerStyle = { display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" };
      isDarkHeader = true;
      brandColStyle = { display: "flex", flexDirection: "column", gap: "4px", background: accent, color: "#fff", padding: "10px", borderRadius: "6px" };
      docColStyle = { textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "center" };
      titleBlock = <div style={{ fontSize: "18px", fontWeight: 900, color: accent }}>{docTitle}</div>;
      metaWrapperStyle = { display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", color: "var(--text-secondary)" };
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", position: "relative", direction: "rtl" }}>
        {watermark}

        {/* No-background header */}
        <div style={{ paddingBottom: headerPadding, borderBottom: headerBorder, marginBottom: "14px" }}>
          <div style={headerContainerStyle}>
            <div 
              className={isDarkHeader ? "print-dark-bg" : ""}
              style={brandColStyle}>
              {brand}
            </div>
            <div style={docColStyle}>
              {titleBlock}
              <div style={metaWrapperStyle}>
                {meta}
              </div>
              {orderNumber}
            </div>
          </div>
        </div>

        {(showCustomer || showCashier) && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            {showCustomer && <span style={chip}><span style={{ color: "#64748b" }}>العميل</span><strong style={{ color: "#0f172a" }}>{invoice.customer_name}</strong></span>}
            {showCashier && <span style={chip}><span style={{ color: "#64748b" }}>الكاشير</span><strong style={{ color: "#0f172a" }}>{cashierName}</strong></span>}
          </div>
        )}

        {receiptHeader}

        <div data-zone="body" style={{ flex: 1 }}>{body}</div>

        {/* Full-width totals — no box, just left-aligned */}
        <div data-zone="totals" style={{ marginTop: "12px" }}>
          {totals}
        </div>

        {payments.length > 0 && <div data-zone="payments" style={{ marginTop: "6px" }}>{payments}</div>}

        <div data-zone="footer" style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}33` }}>
          {footerText}
          {(qr.length > 0 || barcode.length > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "8px" }}>
              <div>{qr}</div>
              <div>{barcode}</div>
            </div>
          )}
          {signatures}
        </div>
        {bottomAddr.length > 0 && (
          <div style={{ marginTop: "8px", fontSize: "10px", color: "#475569", textAlign: "center" }}>{bottomAddr}</div>
        )}
      </div>
    );
  }

  if (pageLayoutType === "sidebar") {
    let isDarkSidebar = headerStyle === "band" || !headerStyle;
    let sidebarBg = accent;
    let sidebarColor = "#fff";
    let sidebarBorder = "none";
    let metaDivider = "1px solid #ffffff33";
    let customerBg = "#ffffff15";
    let mainBorder = `1px solid ${accent}33`;

    if (headerStyle === "asymmetric") {
      isDarkSidebar = false;
      sidebarBg = "#f8fafc";
      sidebarColor = "var(--text-primary)";
      sidebarBorder = `1px solid var(--border-normal)`;
      metaDivider = `1px solid var(--border-subtle)`;
      customerBg = "var(--bg-input)";
    } else if (headerStyle === "classic") {
      isDarkSidebar = false;
      sidebarBg = "#ffffff";
      sidebarColor = "var(--text-primary)";
      sidebarBorder = `1px solid var(--border-normal)`;
      metaDivider = `2px solid ${accent}`;
      customerBg = `${accent}05`;
    }

    return (
      <div style={{ display: "flex", gap: "0", direction: "rtl", minHeight: "100%", position: "relative" }}>
        {watermark}

        {/* Sidebar pane */}
        <div 
          className={isDarkSidebar ? "print-dark-bg" : ""}
          style={{
            width: "200px",
            background: sidebarBg,
            color: sidebarColor,
            borderLeft: sidebarBorder,
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            flexShrink: 0,
            borderRadius: "4px 0 0 4px",
          }}>
          {headerStyle === "asymmetric" ? (
            <div className="print-dark-bg" style={{ background: accent, color: "#fff", padding: "10px", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {brand}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {brand}
            </div>
          )}
          <div style={{ borderTop: metaDivider, paddingTop: "10px", marginTop: "2px" }}>
            <div style={{ fontSize: "15px", fontWeight: 900, marginBottom: "6px", letterSpacing: "0.5px", color: isDarkSidebar ? "#fff" : accent }}>{docTitle}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", opacity: isDarkSidebar ? 0.85 : 1 }}>{meta}</div>
            <div style={{ marginTop: "4px" }}>{orderNumber}</div>
          </div>
          {(showCustomer || showCashier) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: customerBg, padding: "8px", borderRadius: "4px", fontSize: "10px" }}>
              {showCustomer && <div><span style={{ opacity: isDarkSidebar ? 0.7 : 0.8 }}>العميل: </span><strong>{invoice.customer_name}</strong></div>}
              {showCashier && <div><span style={{ opacity: isDarkSidebar ? 0.7 : 0.8 }}>الكاشير: </span><strong>{cashierName}</strong></div>}
            </div>
          )}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {qr}
            {barcode}
          </div>
        </div>

        {/* Main Content Pane */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, padding: "12px 14px", border: mainBorder, borderLeft: "none", borderRadius: "0 4px 4px 0" }}>
          {receiptHeader}
          <div data-zone="body" style={{ flex: 1 }}>{body}</div>
          <div data-zone="totals" style={{ marginTop: "12px" }}>
            {totals}
          </div>
          {payments.length > 0 && <div data-zone="payments" style={{ marginTop: "10px" }}>{payments}</div>}
          <div data-zone="footer" style={{ marginTop: "14px", borderTop: `1px solid ${accent}22`, paddingTop: "10px" }}>
            {footerText}
            {signatures}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LAYOUT: executive (existing)
  // Full border frame, three-column header.
  // ═══════════════════════════════════════════════════════════
  if (pageLayoutType === "executive") {
    let isDarkHeader = false;
    let headerContainerStyle = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: `2px solid ${accent}`,
      paddingBottom: "16px",
      marginBottom: "16px",
    };
    let titleStyle = { fontSize: "22px", fontWeight: 900, color: accent, letterSpacing: "1px" };
    let metaStyle = { textAlign: "left", fontSize: "11px", color: "var(--text-secondary)" };

    if (headerStyle === "band") {
      isDarkHeader = true;
      headerContainerStyle = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: accent,
        color: "#fff",
        padding: "12px 16px",
        borderRadius: "4px",
        marginBottom: "16px",
      };
      titleStyle = { fontSize: "22px", fontWeight: 900, color: "#fff", letterSpacing: "1px" };
      metaStyle = { textAlign: "left", fontSize: "11px", color: "#fff", opacity: 0.9 };
    } else if (headerStyle === "boxed") {
      headerContainerStyle = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: `1px solid ${accent}33`,
        background: `${accent}05`,
        color: "var(--text-primary)",
        padding: "12px 16px",
        borderRadius: "6px",
        marginBottom: "16px",
      };
      titleStyle = { fontSize: "20px", fontWeight: 900, color: accent, letterSpacing: "1px" };
      metaStyle = { textAlign: "left", fontSize: "11px", color: "#475569" };
    } else if (headerStyle === "minimal") {
      headerContainerStyle = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #cbd5e1",
        paddingBottom: "10px",
        marginBottom: "16px",
      };
      titleStyle = { fontSize: "18px", fontWeight: 900, color: accent };
      metaStyle = { textAlign: "left", fontSize: "10px", color: "#64748b" };
    }

    return (
      <div style={{ border: `3px double ${accent}`, padding: "24px", borderRadius: "8px", minHeight: "100%", position: "relative" }}>
        {watermark}

        {/* Official Frame Header */}
        <div 
          className={isDarkHeader ? "print-dark-bg" : ""}
          style={headerContainerStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>{brand}</div>
          <div style={{ textAlign: "center" }}>
            <div style={titleStyle}>{docTitle}</div>
            {orderNumber}
          </div>
          <div style={metaStyle}>
            {meta}
          </div>
        </div>

        {receiptHeader}

        {(showCustomer || showCashier) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", border: `1px solid ${accent}22`, background: `${accent}03`, borderRadius: "4px", marginBottom: "16px" }}>
            {showCustomer && <div><span style={{ color: "#64748b" }}>السيد / السادة: </span><strong style={{ color: "#0f172a" }}>{invoice.customer_name}</strong></div>}
            {showCashier && <div><span style={{ color: "#64748b" }}>المسؤول: </span><strong style={{ color: "#0f172a" }}>{cashierName}</strong></div>}
          </div>
        )}

        <div data-zone="body" style={{ minHeight: "250px" }}>{body}</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "20px" }}>
          <div style={{ width: "40%" }}>{payments}</div>
          <div style={{ width: "50%", borderTop: `2px solid ${accent}`, paddingTop: "8px" }}>{totals}</div>
        </div>

        <div data-zone="footer" style={{ borderTop: `2px solid ${accent}`, marginTop: "20px", paddingTop: "16px" }}>
          {footerText}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
            {qr}
            {signatures}
            {barcode}
          </div>
        </div>

        {bottomAddr.length > 0 && (
          <div data-zone="address-bottom" style={{ marginTop: "16px", paddingTop: "8px", borderTop: `1px solid ${accent}22`, fontSize: "10px", color: "#475569", fontWeight: 600, textAlign: "center" }}>{bottomAddr}</div>
        )}
      </div>
    );
  }



  // ═══════════════════════════════════════════════════════════
  // LAYOUT: standard (default)
  // Header treatments — five styles controlled by headerStyle.
  // ═══════════════════════════════════════════════════════════
  const headerWrapStyle = headerStyle === "band"
    ? { background: accent, color: "#fff", padding: "10px 12px", borderRadius: "4px", marginBottom: "10px" }
    : headerStyle === "classic"
      ? { borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px" }
      : { paddingBottom: "6px", marginBottom: "12px" };
  const bandText = headerStyle === "band" ? { color: "#fff" } : {};

  const renderHeader = () => {
    // 1. asymmetric: 2-column card split (accent right, white metadata grid left)
    if (headerStyle === "asymmetric") {
      return (
        <div data-zone="header" style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0",
          marginBottom: "16px",
          border: `1px solid ${accent}33`,
          borderRadius: "6px",
          overflow: "hidden"
        }}>
          {/* Right Side: Filled Accent Brand Pane */}
          <div style={{
            background: accent,
            color: "#fff",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            justifyContent: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {logo}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {companyName}
                <div style={{ fontSize: "10px", opacity: 0.9 }}>{branch}</div>
              </div>
            </div>
          </div>
          {/* Left Side: Metadata Card */}
          <div style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            background: "#fff"
          }}>
            <div style={{ fontSize: "18px", fontWeight: 900, color: accent, marginBottom: "6px" }}>{docTitle}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", fontSize: "11px", color: "#334155" }}>
              {meta}
              {orderNumber}
              {taxId}
            </div>
          </div>
        </div>
      );
    }

    // 2. brutalist: heavy dark/black borders, sharp contrast blocks
    if (headerStyle === "brutalist") {
      return (
        <div data-zone="header" style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "0",
          border: "3px solid #0f172a",
          marginBottom: "16px"
        }}>
          {/* Right Cell: Title & Meta */}
          <div style={{
            padding: "12px",
            borderLeft: "3px solid #0f172a",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center"
          }}>
            <div style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a", marginBottom: "4px" }}>{docTitle}</div>
            <div style={{ fontSize: "11px", color: "#334155" }}>{meta}</div>
            {orderNumber}
          </div>
          {/* Left Cell: Company Name & Brand */}
          <div style={{
            background: "#0f172a",
            color: "#fff",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {logo}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {companyName}
                <div style={{ fontSize: "10px", opacity: 0.8 }}>{branch}</div>
                {taxId}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. inline: slim single horizontal row
    if (headerStyle === "inline") {
      return (
        <div data-zone="header" style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 0",
          borderTop: "2px solid #cbd5e1",
          borderBottom: "2px solid #cbd5e1",
          marginBottom: "16px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {logo}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {companyName}
              <div style={{ fontSize: "9px", color: "#64748b" }}>{branch} {taxId}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "16px", fontWeight: 900, color: accent }}>{docTitle}</div>
            <div style={{ height: "16px", width: "1px", background: "#cbd5e1" }} />
            <div style={{ display: "flex", gap: "8px", fontSize: "10px", color: "#334155" }}>
              {meta}
            </div>
          </div>
        </div>
      );
    }

    // 4. badge: clean layout with modern accent badge pill
    if (headerStyle === "badge") {
      return (
        <div data-zone="header" style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px dashed #cbd5e1"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {logo}
              {companyName}
            </div>
            <div style={{
              background: accent,
              color: "#fff",
              borderRadius: "20px",
              padding: "4px 14px",
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.5px"
            }}>{docTitle}</div>
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "10px",
            color: "#64748b"
          }}>
            <div style={{ display: "flex", gap: "12px" }}>
              {meta}
            </div>
            <div>{branch} {taxId}</div>
          </div>
        </div>
      );
    }

    // 5. centered: double-underlined centered header
    if (headerStyle === "centered") {
      return (
        <div data-zone="header" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          borderBottom: `4px double ${accent}`,
          paddingBottom: "14px",
          marginBottom: "16px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            {logo}
            {companyName}
            <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#64748b", flexWrap: "wrap", justifyContent: "center" }}>
              {branch}
              {address}
              {taxId}
            </div>
          </div>
          <div style={{
            marginTop: "10px",
            background: "#f1f5f9",
            padding: "6px 16px",
            borderRadius: "4px",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ fontSize: "16px", fontWeight: 900, color: accent }}>{docTitle}</div>
            <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#334155" }}>
              {meta}
            </div>
          </div>
          {orderNumber}
        </div>
      );
    }

    // 6. boxed: light tint framed box
    if (headerStyle === "boxed") {
      return (
        <div data-zone="header" style={{
          border: `2px solid ${accent}`,
          borderRadius: "8px",
          padding: "14px",
          background: `${accent}05`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "16px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {logo}
            {companyName}
            <div style={{ fontSize: "10px", color: "#475569" }}>{branch} {taxId}</div>
          </div>
          <div style={{ textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 900, color: accent, marginBottom: "4px" }}>{docTitle}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "#334155" }}>
              {meta}
            </div>
            {orderNumber}
          </div>
        </div>
      );
    }

    // Default styles: band, classic, minimal
    return (
      <div 
        data-zone="header" 
        className={headerStyle === "band" ? "print-dark-bg" : ""}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", ...headerWrapStyle }}>
        <div data-zone-col="brand" style={bandText}>
          {brand}
        </div>
        <div data-zone-col="meta" style={{ textAlign: metaAlign, ...bandText }}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: headerStyle === "band" ? "#fff" : accent, marginBottom: "4px" }}>{docTitle}</div>
          {meta}
          {orderNumber}
        </div>
      </div>
    );
  };

  return (
    <>
      {watermark}

      {renderHeader()}

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
