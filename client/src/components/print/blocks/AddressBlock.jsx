import React from "react";
import { g, parseJsonArray } from "./blockUtils";

const ALIGN = { right: "flex-start", center: "center", left: "flex-end" };

export default function AddressBlock({ settings: s, props = {}, family, editing }) {
  const showAddress = g(s, "show_address") !== false;
  const showPhone = g(s, "show_phone") !== false;

  const addrs = [s.address, ...parseJsonArray(s.additional_addresses)];
  const phones = [s.phone, ...parseJsonArray(s.additional_phones)];

  // Inject a realistic mock address + phone if both are empty in editing mode
  const hasAnyReal = addrs.some(Boolean) || phones.some(Boolean);
  const mockAddrs = editing && !hasAnyReal ? ["شارع الملك فهد، حي العليا، الرياض 12345"] : addrs;
  const mockPhones = editing && !hasAnyReal ? ["0114567890"] : phones;

  const variant = props.variant || "standard";
  const flex = ALIGN[g(s, "address_alignment") || props.align] || "flex-start";
  const fontSize = `${g(s, "address_font_size") || 10}px`;
  const isPage = family === "page";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  const spanStyle = isPage ? { fontSize, color: "#475569", fontWeight: 600 } : { fontSize };
  const sepStyle = isPage
    ? { marginTop: "4px", borderTop: "1px solid #e2e8f0", paddingTop: "4px" }
    : { marginTop: "4px", paddingTop: "4px" };

  const validItems = [];
  mockAddrs.forEach((addr, i) => {
    const phone = mockPhones[i];
    if (showAddress && addr) validItems.push({ type: "address", val: addr });
    if (showPhone && phone) validItems.push({ type: "phone", val: phone });
  });

  if (!validItems.length) return null;

  if (variant === "inline") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: flex, fontSize, color: isPage ? "#475569" : "#000", fontWeight: 600 }}>
        {validItems.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span style={{ opacity: 0.5 }}>•</span>}
            <span dir={item.type === "phone" ? "ltr" : "rtl"}>{item.val}</span>
          </React.Fragment>
        ))}
      </div>
    );
  }

  if (variant === "badge") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: flex }}>
        {validItems.map((item, index) => (
          <span key={index} dir={item.type === "phone" ? "ltr" : "rtl"} style={{
            border: isPage ? `1px solid ${accent}40` : "1px solid #000",
            borderRadius: "10px",
            padding: "1px 8px",
            fontSize,
            fontWeight: 700,
            color: isPage ? accent : "#000",
          }}>
            {item.val}
          </span>
        ))}
      </div>
    );
  }

  if (variant === "boxed") {
    return (
      <div style={{
        border: isPage ? `1px solid ${accent}20` : "1px solid #000",
        background: isPage ? `${accent}03` : "transparent",
        borderRadius: "6px",
        padding: "8px 12px",
        marginTop: "4px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontSize,
        color: isPage ? "#475569" : "#000"
      }}>
        {validItems.map((item, index) => (
          <div key={index} style={{ display: "flex", justifyContent: flex }}>
            <span dir={item.type === "phone" ? "ltr" : "rtl"} style={{ fontWeight: 600 }}>{item.val}</span>
          </div>
        ))}
      </div>
    );
  }

  const rows = mockAddrs.map((addr, i) => {
    const phone = mockPhones[i];
    const dispAddr = showAddress && addr;
    const dispPhone = showPhone && phone;
    if (!dispAddr && !dispPhone) return null;
    return (
      <div key={i} style={{ display: "flex", gap: "8px", justifyContent: flex, ...(i > 0 ? sepStyle : {}) }}>
        {dispAddr && <span style={isPage ? spanStyle : { ...spanStyle, fontWeight: 600 }}>{addr}</span>}
        {dispPhone && (
          <span style={spanStyle} dir="ltr">
            {phone}
          </span>
        )}
      </div>
    );
  }).filter(Boolean);

  if (!rows.length) return null;
  return <>{rows}</>;
}
