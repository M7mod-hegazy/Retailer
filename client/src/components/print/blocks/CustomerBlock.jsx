import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string keeps just the name).
export default function CustomerBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const showCustomer = g(s, "show_customer_name") !== false;
  if (!showCustomer) return null;
  // Anonymous sale with a captured walk-in contact → print it as the customer.
  const isWalkIn = !invoice.customer_name && Boolean(invoice.walk_in_phone);
  // Realistic mock: a full Arabic name as would appear in a retail invoice
  const name = invoice.customer_name || (isWalkIn ? (invoice.walk_in_name || "عميل نقدي") : (editing ? "أحمد محمد الشمري" : ""));
  if (!name) return null;

  const phone = invoice.customer_phone || invoice.customer?.phone || (isWalkIn ? invoice.walk_in_phone : "") || (editing ? "0501234567" : "");
  const address = invoice.customer_address || invoice.customer?.address || (editing ? "الرياض، المملكة العربية السعودية" : "");
  const taxId = invoice.customer_tax_id || invoice.customer_tax_no || invoice.customer?.tax_id || invoice.customer?.tax_no || (editing ? "300012345600003" : "");
  
  const balance = invoice.customer_balance !== undefined ? invoice.customer_balance : (invoice.customer?.balance || (editing ? 150 : 0));
  const points = invoice.customer_points !== undefined ? invoice.customer_points : (invoice.customer?.points || invoice.customer_loyalty_points || (editing ? 320 : 0));

  // Walk-in: the phone IS the customer identity — always print it.
  const showPhone = props.showPhone === true || isWalkIn;
  const showAddress = props.showAddress === true;
  const showTaxId = props.showTaxId === true;
  const showBalance = props.showBalance === true;
  const showPoints = props.showPoints === true;

  const label = props.label !== undefined ? props.label : "العميل";
  const variant = props.variant || (props.layoutStyle === "stacked" ? "stacked" : "standard");
  const isStacked = variant === "stacked";
  const currency = g(s, "currency_symbol") || "ر.س";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    if (variant === "boxed") {
      return (
        <div style={{
          border: `1px solid ${accent}40`,
          background: `${accent}03`,
          borderRadius: "8px",
          padding: "10px 12px",
          fontSize: "10px",
          color: "#475569",
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}>
          <div style={{ borderBottom: `1px solid ${accent}20`, paddingBottom: "4px", marginBottom: "4px" }}>
            <span style={{ fontSize: "9px", color: "#64748b" }}>{label || "العميل"}: </span>
            <strong style={{ color: "#0f172a", fontSize: "12px" }}>{name}</strong>
          </div>
          {showPhone && phone && <div>الهاتف: <span style={{ fontFamily: "monospace", color: "#0f172a" }}>{phone}</span></div>}
          {showAddress && address && <div>العنوان: <span style={{ color: "#0f172a" }}>{address}</span></div>}
          {showTaxId && taxId && <div>الرقم الضريبي: <span style={{ fontFamily: "monospace", color: "#0f172a" }}>{taxId}</span></div>}
          {showBalance && balance !== undefined && <div>رصيد العميل: <strong style={{ color: "#dc2626" }}>{currency} {smartFormat(balance, s)}</strong></div>}
          {showPoints && points !== undefined && <div>نقاط الولاء: <strong style={{ color: "#059669" }}>{points} نقطة</strong></div>}
        </div>
      );
    }

    if (variant === "two-column") {
      return (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 12px",
          fontSize: "10px",
          color: "#64748b",
          padding: "6px 0",
          borderTop: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
          width: "100%"
        }}>
          <div>{label || "العميل"}: <strong style={{ color: "#334155" }}>{name}</strong></div>
          {showPhone && phone && <div>هاتف العميل: <span style={{ fontFamily: "monospace", color: "#334155" }}>{phone}</span></div>}
          {showAddress && address && <div style={{ gridColumn: "span 2" }}>عنوان العميل: <span style={{ color: "#334155" }}>{address}</span></div>}
          {showTaxId && taxId && <div>الرقم الضريبي: <span style={{ fontFamily: "monospace", color: "#334155" }}>{taxId}</span></div>}
          {showBalance && balance !== undefined && <div>رصيد العميل: <strong style={{ color: "#dc2626" }}>{currency} {smartFormat(balance, s)}</strong></div>}
          {showPoints && points !== undefined && <div>نقاط الولاء: <strong style={{ color: "#059669" }}>{points} نقطة</strong></div>}
        </div>
      );
    }

    return (
      <div style={{ fontSize: "10px", color: "#64748b", display: "flex", flexDirection: "column", gap: "2px" }}>
        {isStacked ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "9px", color: "#94a3b8" }}>{label || "العميل"}</span>
            <strong style={{ color: "#334155", fontSize: "11px" }}>{name}</strong>
          </div>
        ) : (
          <div>
            {label ? `${label}: ` : ""}<strong style={{ color: "#334155" }}>{name}</strong>
          </div>
        )}
        
        {showPhone && phone && (
          <div>هاتف العميل: <span style={{ fontFamily: "monospace", color: "#334155" }}>{phone}</span></div>
        )}
        {showAddress && address && (
          <div>عنوان العميل: <span style={{ color: "#334155" }}>{address}</span></div>
        )}
        {showTaxId && taxId && (
          <div>الرقم الضريبي للعميل: <span style={{ fontFamily: "monospace", color: "#334155" }}>{taxId}</span></div>
        )}
        {showBalance && balance !== undefined && (
          <div>رصيد العميل: <strong style={{ color: "#dc2626" }}>{currency} {smartFormat(balance, s)}</strong></div>
        )}
        {showPoints && points !== undefined && (
          <div>نقاط الولاء للعميل: <strong style={{ color: "#059669" }}>{points} نقطة</strong></div>
        )}
      </div>
    );
  }

  if (variant === "boxed" || variant === "two-column") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "10px", border: "1px solid #000", padding: "4px 6px", margin: "4px 0" }}>
        <div style={{ borderBottom: "1px dashed #000", paddingBottom: "3px", marginBottom: "2px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>{label || "العميل"}:</span>
          <span style={{ fontWeight: 800 }}>{name}</span>
        </div>
        {showPhone && phone && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>الهاتف:</span>
            <span style={{ fontFamily: "monospace" }}>{phone}</span>
          </div>
        )}
        {showAddress && address && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>العنوان:</span>
            <span>{address}</span>
          </div>
        )}
        {showTaxId && taxId && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>الرقم الضريبي:</span>
            <span style={{ fontFamily: "monospace" }}>{taxId}</span>
          </div>
        )}
        {showBalance && balance !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>الرصيد:</span>
            <span style={{ fontWeight: 800 }}>{currency} {smartFormat(balance, s)}</span>
          </div>
        )}
        {showPoints && points !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>النقاط:</span>
            <span style={{ fontWeight: 800 }}>{points}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5px", fontSize: "10px" }}>
      {isStacked ? (
        <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px dashed #e2e8f0", paddingBottom: "2px" }}>
          <span style={{ fontSize: "8.5px", color: "#64748b" }}>{label || "العميل"}:</span>
          <span style={{ fontWeight: 800, color: "#000" }}>{name}</span>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>{label ? `${label}:` : ""}</span>
          <span>{name}</span>
        </div>
      )}
      
      {showPhone && phone && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>هاتف العميل:</span>
          <span style={{ fontFamily: "monospace" }}>{phone}</span>
        </div>
      )}
      {showAddress && address && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>عنوان العميل:</span>
          <span>{address}</span>
        </div>
      )}
      {showTaxId && taxId && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>الرقم الضريبي للعميل:</span>
          <span style={{ fontFamily: "monospace" }}>{taxId}</span>
        </div>
      )}
      {showBalance && balance !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>رصيد العميل:</span>
          <span style={{ fontWeight: 800, color: "#dc2626" }}>{currency} {smartFormat(balance, s)}</span>
        </div>
      )}
      {showPoints && points !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }}>نقاط الولاء للعميل:</span>
          <span style={{ fontWeight: 800, color: "#059669" }}>{points}</span>
        </div>
      )}
    </div>
  );
}
