import React from "react";
import { resolveDocNo } from "./DocNumberBlock";
import { resolveDailyNo } from "./dailySequence";

// Order-ticket style: a huge, unmissable number for kitchen/counter tickets.
// props.source: "doc" (full document number, default) | "daily" (the daily
// sequence that starts at 1 and resets each day — great for order tickets).
export default function OrderNumberBlock({ invoice = {}, props = {}, family }) {
  const number = (props.source === "daily") ? resolveDailyNo(invoice) : resolveDocNo(invoice);
  if (number == null || number === "") return null;

  const fontSize = props.fontSize != null ? props.fontSize : 34;
  const label = props.label !== undefined ? props.label : "رقم الطلب";

  const daily = props.source === "daily" ? { "data-daily-no": "1" } : {};
  return (
    <div {...daily} style={{ textAlign: "center", margin: family === "page" ? "4mm 0" : "3mm 0" }}>
      {label ? (
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#000", marginBottom: "2px" }}>{label}</div>
      ) : null}
      <div
        dir="ltr"
        style={{ fontSize: `${fontSize}px`, fontWeight: 900, color: "#000", lineHeight: 1.1, fontFamily: "monospace" }}
      >
        {number}
      </div>
    </div>
  );
}
