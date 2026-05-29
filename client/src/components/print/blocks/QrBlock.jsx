import React from "react";
import { g } from "./blockUtils";

export default function QrBlock({ settings: s }) {
  if (g(s, "show_qr") === false) return null;
  const size = g(s, "qr_size");
  return (
    <div style={{ margin: "8px auto 0", width: `${size}px`, height: `${size}px`, background: "#f0f0f0", border: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#888" }}>QR</div>
  );
}
