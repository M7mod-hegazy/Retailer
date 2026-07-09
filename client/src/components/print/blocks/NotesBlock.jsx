import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string hides it).
export default function NotesBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  if (g(s, "show_notes") === false) return null;
  let notes = (props.text != null && props.text !== "")
    ? props.text
    : (editing
      ? "مثال: يرجى التواصل قبل الاستبدال — صالحة خلال 7 أيام من تاريخ الشراء."
      : g(s, "receipt_notes") || invoice.notes || "");
  if (!notes || !String(notes).trim()) return null;
  if (props.maxChars && notes.length > props.maxChars) {
    notes = notes.slice(0, props.maxChars) + "...";
  }
  const label = props.label !== undefined ? props.label : "ملاحظات";
  if (family === "page") {
    return (
      <div style={{ marginTop: 4, padding: "4px 0", borderTop: "1px solid #e2e8f0" }}>
        {label && <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>}
        <div style={{ fontSize: "11px", color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{notes}</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 5, fontSize: "10px" }}>
      {label && <div style={{ fontWeight: 700 }}>{label}:</div>}
      <div style={{ whiteSpace: "pre-wrap" }}>{notes}</div>
    </div>
  );
}
