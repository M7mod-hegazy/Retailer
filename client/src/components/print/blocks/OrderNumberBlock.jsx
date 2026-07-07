import React from "react";
import { resolveDocNo } from "./DocNumberBlock";
import { resolveDailyNo } from "./dailySequence";

// Order-ticket style: a huge, unmissable number for kitchen/counter tickets.
// props.source: "doc" (full document number, default) | "daily" (the daily
// sequence that starts at 1 and resets each day — great for order tickets).
export default function OrderNumberBlock({ invoice = {}, props = {}, family, editing }) {
  const isDailySource = props.source === "daily";
  const rawNumber = isDailySource ? resolveDailyNo(invoice) : resolveDocNo(invoice);
  // Realistic mock: daily order ticket number vs full document reference
  const number = (rawNumber != null && rawNumber !== "") ? rawNumber
    : (editing ? (isDailySource ? "42" : "INV-2025-00847") : "");
  if (!number && number !== 0) return null;

  const fontSize = props.fontSize != null ? props.fontSize : 34;
  const label = props.label !== undefined ? props.label : (isDailySource ? "رقم الطلب" : "رقم المستند");

  const daily = isDailySource ? { "data-daily-no": "1" } : {};
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
