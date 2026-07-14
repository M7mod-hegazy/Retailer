import React from "react";
import { g } from "./blockUtils";

// props.label renames the caption (empty string hides it).
export default function NotesBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  if (g(s, "show_notes") === false) return null;
  // Real configured/invoice notes always win — the editing sample is only
  // for the empty state, otherwise the Studio shows text that never prints.
  let notes = (props.text != null && props.text !== "")
    ? props.text
    : (g(s, "receipt_notes") || invoice.notes
      || (editing ? "مثال: يرجى التواصل قبل الاستبدال — صالحة خلال 7 أيام من تاريخ الشراء." : ""));
  if (!notes || !String(notes).trim()) return null;
  if (props.maxChars && notes.length > props.maxChars) {
    notes = notes.slice(0, props.maxChars) + "...";
  }
  const label = props.label !== undefined ? props.label : "ملاحظات";
  const variant = props.variant || "standard";
  const accent = s ? (s.accent_color || "#1e3a8a") : "#1e3a8a";

  if (family === "page") {
    if (variant === "boxed") {
      return (
        <div style={{
          marginTop: 6,
          padding: "10px 12px",
          border: `1px solid ${accent}40`,
          background: `${accent}03`,
          borderRadius: "8px"
        }}>
          {label && <div style={{ fontSize: "9px", color: accent, fontWeight: 800, marginBottom: 4 }}>{label}</div>}
          <div style={{ fontSize: "11px", color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{notes}</div>
        </div>
      );
    }

    if (variant === "alert") {
      return (
        <div style={{
          marginTop: 6,
          padding: "10px 12px",
          background: "#fef3c7",
          borderRight: "4px solid #d97706",
          borderRadius: "4px"
        }}>
          {label && <div style={{ fontSize: "10px", color: "#b45309", fontWeight: 800, marginBottom: 2 }}>{label}</div>}
          <div style={{ fontSize: "11px", color: "#78350f", whiteSpace: "pre-wrap", lineHeight: 1.4, fontWeight: 700 }}>{notes}</div>
        </div>
      );
    }

    if (variant === "quote") {
      return (
        <div style={{
          marginTop: 6,
          padding: "4px 12px",
          borderRight: `3px solid ${accent}`,
          color: "#475569"
        }}>
          {label && <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: 2 }}>{label}</div>}
          <div style={{ fontSize: "11px", fontStyle: "italic", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{notes}</div>
        </div>
      );
    }

    return (
      <div style={{ marginTop: 4, padding: "4px 0", borderTop: "1px solid #e2e8f0" }}>
        {label && <div style={{ fontSize: "9px", color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>}
        <div style={{ fontSize: "11px", color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{notes}</div>
      </div>
    );
  }

  if (variant === "boxed" || variant === "alert") {
    return (
      <div style={{ marginTop: 6, fontSize: "10px", border: "1px solid #000", padding: "4px 6px" }}>
        {label && <div style={{ fontWeight: 900, borderBottom: "1px dashed #000", paddingBottom: "2px", marginBottom: "2px" }}>{label}:</div>}
        <div style={{ whiteSpace: "pre-wrap" }}>{notes}</div>
      </div>
    );
  }

  if (variant === "quote") {
    return (
      <div style={{ marginTop: 6, fontSize: "10px", borderRight: "3px solid #000", paddingRight: "6px" }}>
        {label && <div style={{ fontWeight: 700, color: "#475569" }}>{label}:</div>}
        <div style={{ whiteSpace: "pre-wrap", fontStyle: "italic" }}>{notes}</div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div style={{ marginTop: 3, fontSize: "10px", display: "flex", gap: "6px" }}>
        {label && <span style={{ fontWeight: 700, color: "#64748b" }}>{label}:</span>}
        <span style={{ whiteSpace: "pre-wrap" }}>{notes}</span>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div style={{ marginTop: 3, fontSize: "9px", color: "#64748b" }}>
        {label && <span style={{ fontWeight: 700 }}>{label}: </span>}
        <span>{notes}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={{ marginTop: 3, fontSize: "9px", borderTop: "1px dashed #000", paddingTop: "2px" }}>
        {label && <span style={{ fontWeight: 900 }}>{label}: </span>}
        <span>{notes}</span>
      </div>
    );
  }

  if (variant === "centered") {
    return (
      <div style={{ marginTop: 3, fontSize: "9px", textAlign: "center", borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "2px 0" }}>
        {label && <span style={{ fontWeight: 900 }}>{label}: </span>}
        <span>{notes}</span>
      </div>
    );
  }

  if (variant === "boxed-centered") {
    return (
      <div style={{ marginTop: 3, fontSize: "9px", border: "1px solid #000", padding: "3px 4px", textAlign: "center" }}>
        {label && <div style={{ fontWeight: 900, borderBottom: "1px dashed #000", paddingBottom: "1px", marginBottom: "1px" }}>{label}:</div>}
        <div>{notes}</div>
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
