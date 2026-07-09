import React from "react";
import { g, parseJsonArray } from "./blockUtils";

const ALIGN = { right: "flex-start", center: "center", left: "flex-end" };

export default function AddressBlock({ settings: s, family, editing }) {
  const showAddress = g(s, "show_address") !== false;
  const showPhone = g(s, "show_phone") !== false;

  const addrs = [s.address, ...parseJsonArray(s.additional_addresses)];
  const phones = [s.phone, ...parseJsonArray(s.additional_phones)];

  // Inject a realistic mock address + phone if both are empty in editing mode
  const hasAnyReal = addrs.some(Boolean) || phones.some(Boolean);
  const mockAddrs = editing && !hasAnyReal ? ["شارع الملك فهد، حي العليا، الرياض 12345"] : addrs;
  const mockPhones = editing && !hasAnyReal ? ["0114567890"] : phones;

  const flex = ALIGN[g(s, "address_alignment")] || "flex-start";
  const fontSize = `${g(s, "address_font_size") || 10}px`;
  const isPage = family === "page";
  const spanStyle = isPage ? { fontSize, color: "#475569", fontWeight: 600 } : { fontSize };
  const sepStyle = isPage
    ? { marginTop: "4px", borderTop: "1px solid #e2e8f0", paddingTop: "4px" }
    : { marginTop: "4px", paddingTop: "4px" };

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
