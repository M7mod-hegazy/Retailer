import React from "react";
import { g, parseJsonArray } from "./blockUtils";

const ALIGN = { right: "flex-start", center: "center", left: "flex-end" };

export default function AddressBlock({ settings: s, family }) {
  const addrs = [s.address, ...parseJsonArray(s.additional_addresses)];
  const phones = [s.phone, ...parseJsonArray(s.additional_phones)];
  const flex = ALIGN[g(s, "address_alignment")] || "flex-start";
  const fontSize = `${g(s, "address_font_size")}px`;
  const isPage = family === "page";
  const spanStyle = isPage ? { fontSize, color: "#475569", fontWeight: 600 } : { fontSize };
  const sepStyle = isPage
    ? { marginTop: "4px", borderTop: "1px solid #e2e8f0", paddingTop: "4px" }
    : { marginTop: "4px", borderTop: "1px dotted rgba(0,0,0,0.1)", paddingTop: "4px" };

  const rows = addrs.map((addr, i) => {
    const phone = phones[i];
    const showAddr = g(s, "show_address") !== false && addr;
    const showPhone = g(s, "show_phone") !== false && phone;
    if (!showAddr && !showPhone) return null;
    return (
      <div key={i} style={{ display: "flex", gap: "8px", justifyContent: flex, ...(i > 0 ? sepStyle : {}) }}>
        {showAddr && <span style={isPage ? spanStyle : { ...spanStyle, fontWeight: 600 }}>{addr}</span>}
        {showPhone && <span style={spanStyle}>{phone}</span>}
      </div>
    );
  }).filter(Boolean);

  if (!rows.length) return null;
  return <>{rows}</>;
}
