import React from "react";
import { g } from "./blockUtils";

export default function ReceiptHeaderTextBlock({ settings: s, family }) {
  const text = g(s, "receipt_header");
  if (!text) return null;
  if (family === "page") {
    return <div style={{ textAlign: "center", fontSize: "10px", marginBottom: "8px", fontStyle: "italic", color: "#64748b" }}>{text}</div>;
  }
  return <div style={{ textAlign: "center", fontSize: "10px", marginBottom: "4px", fontStyle: "italic" }}>{text}</div>;
}
