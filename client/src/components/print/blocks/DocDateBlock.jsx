import React from "react";
import { g } from "./blockUtils";

export default function DocDateBlock({ invoice = {}, settings: s, family }) {
  if (g(s, "show_invoice_date") === false) return null;
  const d = invoice.created_at ? new Date(invoice.created_at) : new Date();
  // Force the Gregorian (ميلادي) calendar — bare "ar-SA" defaults to the Umm al-Qura
  // (Hijri) calendar, which printed dates like "1447/12/29 هـ" on receipts.
  const date = d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn");
  const time = d.toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateTime = `${date} ${time}`;
  if (family === "page") {
    return <div style={{ fontSize: "10px", color: "#334155", fontWeight: 600 }}>{dateTime}</div>;
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>التاريخ:</span><span>{dateTime}</span>
    </div>
  );
}
