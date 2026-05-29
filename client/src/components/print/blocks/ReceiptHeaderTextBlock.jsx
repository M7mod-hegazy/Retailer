import React from "react";
import { g } from "./blockUtils";

export default function ReceiptHeaderTextBlock({ settings: s }) {
  const text = g(s, "receipt_header");
  if (!text) return null;
  return <div style={{ textAlign: "center", fontSize: "10px", fontStyle: "italic" }}>{text}</div>;
}
