import React from "react";
import { g, parseJsonArray } from "./blockUtils";

const ALIGN = { right: "flex-start", center: "center", left: "flex-end" };

export default function AddressBlock({ settings: s }) {
  const addrs = [s.address, ...parseJsonArray(s.additional_addresses)];
  const phones = [s.phone, ...parseJsonArray(s.additional_phones)];
  const flex = ALIGN[g(s, "address_alignment")] || "flex-start";
  const fontSize = `${g(s, "address_font_size")}px`;

  const rows = addrs.map((addr, i) => {
    const phone = phones[i];
    const showAddr = g(s, "show_address") !== false && addr;
    const showPhone = g(s, "show_phone") !== false && phone;
    if (!showAddr && !showPhone) return null;
    return (
      <div key={i} style={{ display: "flex", gap: "8px", justifyContent: flex, ...(i > 0 ? { marginTop: "4px", borderTop: "1px dotted rgba(0,0,0,0.1)", paddingTop: "4px" } : {}) }}>
        {showAddr && <span style={{ fontSize, opacity: 0.6 }}>{addr}</span>}
        {showPhone && <span style={{ fontSize }}>{phone}</span>}
      </div>
    );
  }).filter(Boolean);

  if (!rows.length) return null;
  return <>{rows}</>;
}
