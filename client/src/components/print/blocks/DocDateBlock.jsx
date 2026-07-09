import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption; props.showTime=false prints the date only.
export default function DocDateBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  if (g(s, "show_invoice_date") === false) return null;
  // Always falls back to current date/time — perfect for editing preview
  const d = invoice.created_at ? new Date(invoice.created_at) : new Date();
  
  let date = "";
  const format = props.format;
  if (format === "yyyy-MM-dd") {
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } else if (format === "MM/yyyy") {
    date = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } else if (format === "dd/MM/yyyy") {
    date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } else {
    // Force Gregorian calendar — bare "ar-SA" defaults to Umm al-Qura (Hijri)
    date = d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn");
  }

  const time = d.toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  const dateTime = props.showTime === false ? date : `${date} ${time}`;
  if (family === "page") {
    const label = props.label !== undefined ? props.label : "";
    return (
      <div style={{ fontSize: "10px", color: "#334155", fontWeight: 600 }}>
        {label ? `${label}: ` : ""}{dateTime}
      </div>
    );
  }
  const rollLabel = props.label !== undefined ? props.label : "التاريخ";
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{rollLabel ? `${rollLabel}:` : ""}</span>
      <span>{dateTime}</span>
    </div>
  );
}
