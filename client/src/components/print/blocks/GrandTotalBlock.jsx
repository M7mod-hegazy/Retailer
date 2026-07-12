import React from "react";
import { g, computeTotals, smartFormat, formatPrintDigits } from "./blockUtils";
import { tafqeet } from "./tafqeet";

/**
 * Grand total — fully parametric so any look can be built (props):
 *  variant     "band"          | filled row, accent bg (default)
 *              "boxed"         | double-border box
 *              "plain"         | simple ruled row
 *              "huge"          | centered large amount (ticket style)
 *              "dual-row"      | amount row + Tafqeet below
 *              "stripe"        | FULL-WIDTH thick accent stripe, amount centered
 *              "receipt-tape"  | dashed top+bottom borders, receipt feel
 *              "tag"           | price-tag badge: label pill left, amount right
 *              "split-amount"  | giant amount on left, stacked caption right
 *  label       line caption (default "الإجمالي")
 *  decor       decoration text around the label on band (default none; e.g. "✦")
 *  labelSize   caption font size in px
 *  amountSize  number font size in px
 *  background / textColor   band colors on PAGE (roll band stays black/white)
 */
export default function GrandTotalBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const { grandTotal: realTotal } = computeTotals(invoice, s);
  const grandTotal = realTotal > 0 ? realTotal : (editing ? 565 : 0);
  const currency = g(s, "currency_symbol") || "ر.س";
  const accent = g(s, "accent_color") || "#1e3a8a";
  const variant = props.variant || "band";
  const label = props.label !== undefined && props.label !== "" ? props.label : "الإجمالي";
  const decor = props.decor !== undefined ? props.decor : "";
  const decorPos = props.decorPos || "both";
  
  const decimals = props.decimals !== undefined ? Number(props.decimals) : 2;
  const formattedNum = grandTotal.toFixed(decimals);
  const amountStr = s !== undefined ? formatPrintDigits(s, formattedNum) : formattedNum;
  const placement = props.currencyPlacement || "before";
  const amount = placement === "before" ? `${currency} ${amountStr}` : `${amountStr} ${currency}`;

  const labelFs = props.labelSize != null ? `${props.labelSize}px` : null;
  const amountFs = props.amountSize != null ? `${props.amountSize}px` : null;

  const leadDecor = decor && (decorPos === "both" || decorPos === "before");
  const trailDecor = decor && (decorPos === "both" || decorPos === "after");
  const labelNode = decor
    ? (
      <span style={labelFs ? { fontSize: labelFs } : undefined}>
        {leadDecor && <span style={{ marginLeft: "5px", fontSize: "11px" }}>{decor}</span>}
        {label}
        {trailDecor && <span style={{ marginRight: "5px", fontSize: "11px" }}>{decor}</span>}
      </span>
    )
    : <span style={labelFs ? { fontSize: labelFs } : undefined}>{label}</span>;

  let tafqeetText = tafqeet(grandTotal, currency);
  if (props.tafqeetPrefix !== undefined || props.tafqeetSuffix !== undefined) {
    let inner = tafqeetText;
    if (inner.startsWith("فقط ")) {
      inner = inner.slice(4);
    }
    if (inner.endsWith(" لا غير")) {
      inner = inner.slice(0, -7);
    }
    const prefix = props.tafqeetPrefix !== undefined ? props.tafqeetPrefix : "فقط";
    const suffix = props.tafqeetSuffix !== undefined ? props.tafqeetSuffix : "لا غير";
    tafqeetText = `${prefix} ${inner} ${suffix}`.trim();
  }

  if (family === "page") {
    const bandBg = props.background || accent;
    const bandColor = props.textColor || "#fff";

    /* ── stripe: full-width thick bar, amount dead-center ── */
    if (variant === "stripe") {
      return (
        <div style={{
          background: bandBg,
          color: bandColor,
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "6px",
          borderRadius: "0",
          fontWeight: 900,
        }}>
          <span style={{ fontSize: labelFs || "11px", opacity: 0.85, letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</span>
          <span style={{ fontSize: amountFs || "18px", fontWeight: 900, fontFamily: "monospace", letterSpacing: "1px" }}>{amount}</span>
        </div>
      );
    }

    /* ── receipt-tape: dashed top+bottom, ledger-style ── */
    if (variant === "receipt-tape") {
      return (
        <div style={{
          borderTop: `2px dashed ${bandBg}`,
          borderBottom: `2px dashed ${bandBg}`,
          padding: "7px 4px",
          marginTop: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 900,
          color: props.textColor || "#0f172a",
        }}>
          <span style={{ fontSize: labelFs || "10px", color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
          <span style={{ fontSize: amountFs || "16px", fontFamily: "monospace", color: bandBg }}>{amount}</span>
        </div>
      );
    }

    /* ── tag: label in a left accent pill, amount bold right ── */
    if (variant === "tag") {
      return (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "6px",
          padding: "4px 0",
          borderTop: `1px solid #e2e8f0`,
        }}>
          <span style={{
            background: bandBg,
            color: bandColor,
            borderRadius: "20px",
            padding: "3px 12px",
            fontSize: labelFs || "10px",
            fontWeight: 800,
            letterSpacing: "0.5px",
          }}>{label}</span>
          <span style={{
            fontSize: amountFs || "17px",
            fontWeight: 900,
            color: bandBg,
            fontFamily: "monospace",
          }}>{amount}</span>
        </div>
      );
    }

    /* ── split-amount: giant amount left, caption stacked right ── */
    if (variant === "split-amount") {
      return (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "6px",
          padding: "6px 4px",
          borderTop: `2px solid ${bandBg}`,
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>المبلغ الإجمالي</span>
            <span style={{ fontSize: amountFs || "26px", fontWeight: 900, color: bandBg, lineHeight: 1.1, fontFamily: "monospace" }}>{amount}</span>
          </div>
          <div style={{ textAlign: "left", fontSize: "9px", color: "#64748b", fontStyle: "italic", maxWidth: "45%" }}>{tafqeetText}</div>
        </div>
      );
    }

    /* ── dual-row: row + tafqeet below ── */
    if (variant === "dual-row") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "3px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 6px", background: bandBg, color: bandColor, borderRadius: "4px", fontWeight: 900 }}>
            {labelNode}
            <span style={{ fontWeight: 900, ...(amountFs ? { fontSize: amountFs } : {}) }}>{amount}</span>
          </div>
          <div style={{ fontSize: "10px", color: "#475569", fontWeight: 700, fontStyle: "italic", textAlign: "left", paddingLeft: "4px" }}>
            {tafqeetText}
          </div>
        </div>
      );
    }

    /* ── boxed ── */
    if (variant === "boxed") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", border: `2px solid ${props.background || accent}`, color: props.textColor || accent, borderRadius: "4px", marginTop: "3px", fontWeight: 900 }}>
          {labelNode}<span style={amountFs ? { fontSize: amountFs } : undefined}>{amount}</span>
        </div>
      );
    }

    /* ── plain ── */
    if (variant === "plain") {
      return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 2px", borderTop: `2px solid ${props.background || accent}`, marginTop: "3px", fontWeight: 900, color: props.textColor || "#0f172a" }}>
          {labelNode}<span style={amountFs ? { fontSize: amountFs } : undefined}>{amount}</span>
        </div>
      );
    }

    /* ── huge ── */
    if (variant === "huge") {
      return (
        <div style={{ textAlign: "center", marginTop: "4px" }}>
          <div style={{ fontSize: labelFs || "10px", fontWeight: 700, color: "#475569" }}>{label}</div>
          <div style={{ fontSize: amountFs || "24px", fontWeight: 900, color: props.textColor || accent, lineHeight: 1.2 }}>{amount}</div>
        </div>
      );
    }

    /* ── band (default) ── */
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 6px", background: bandBg, color: bandColor, borderRadius: "2px", marginTop: "3px", fontWeight: 900 }}>
        {labelNode}
        <span style={{ fontWeight: 900, ...(amountFs ? { fontSize: amountFs } : {}) }}>{amount}</span>
      </div>
    );
  }

  // ── roll (thermal: pure black/white only) ──
  const size = amountFs || `${Math.max(13, Number(g(s, "body_font_size")) + 1)}px`;

  /* ── tafqeet-band: black band with tafqeet below ── */
  if (variant === "tafqeet-band") {
    return (
      <div style={{ marginTop: "6px" }}>
        <div style={{ background: "#000", color: "#fff", padding: "7px 5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
            {labelNode}
            <span style={{ fontFamily: "monospace" }}>{amount}</span>
          </div>
        </div>
        <div style={{ fontSize: "8px", fontWeight: 700, textAlign: "center", marginTop: "3px", padding: "2px 0", borderTop: "1px dashed #000", borderBottom: "1px dashed #000" }}>
          {tafqeetText}
        </div>
      </div>
    );
  }

  /* ── stacked: amount centered on top, label below, no borders ── */
  if (variant === "stacked") {
    return (
      <div style={{ textAlign: "center", marginTop: "6px", padding: "4px 0" }}>
        <div style={{ fontSize: amountFs || "20px", fontWeight: 900, fontFamily: "monospace", lineHeight: 1.1 }}>{amount}</div>
        <div style={{ fontSize: labelFs || "9px", fontWeight: 700, marginTop: "2px" }}>{label}</div>
      </div>
    );
  }

  /* ── double-line: double top/bottom border ── */
  if (variant === "double-line") {
    return (
      <div style={{ borderTop: "3px double #000", borderBottom: "3px double #000", padding: "5px 4px", marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
          {labelNode}
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
      </div>
    );
  }

  /* ── reverse-band: white on black inverted ── */
  if (variant === "reverse-band") {
    return (
      <div style={{ marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 4px", background: "#000", color: "#fff", fontSize: size, fontWeight: 900 }}>
          <span>{label}</span>
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
        <div style={{ fontSize: "8px", fontWeight: 700, textAlign: "left", paddingLeft: "2px", marginTop: "1px" }}>
          {tafqeetText}
        </div>
      </div>
    );
  }

  if (variant === "stripe" || variant === "band") {
    return (
      <div style={{ background: "#000", color: "#fff", padding: "7px 5px", marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
          {labelNode}
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
      </div>
    );
  }
  if (variant === "receipt-tape" || variant === "tag") {
    return (
      <div style={{ borderTop: "2px dashed #000", borderBottom: "2px dashed #000", padding: "4px 2px", marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
          {labelNode}
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
      </div>
    );
  }
  if (variant === "split-amount") {
    return (
      <div style={{ borderTop: "2px solid #000", padding: "4px 2px 0", marginTop: "6px" }}>
        <div style={{ fontSize: size, fontWeight: 900, fontFamily: "monospace" }}>{amount}</div>
        <div style={{ fontSize: "9px", fontWeight: 700 }}>{label}</div>
      </div>
    );
  }
  if (variant === "dual-row") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "6px" }}>
        <div style={{ background: "#000", color: "#fff", padding: "7px 5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
            {labelNode}
            <span style={{ fontFamily: "monospace" }}>{amount}</span>
          </div>
        </div>
        <div style={{ fontSize: "9px", fontWeight: 900, textAlign: "left", paddingLeft: "2px" }}>
          {tafqeetText}
        </div>
      </div>
    );
  }
  if (variant === "boxed") {
    return (
      <div style={{ border: "3px double #000", padding: "5px 6px", marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
          {labelNode}
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
      </div>
    );
  }
  if (variant === "plain") {
    return (
      <div style={{ borderTop: "2px solid #000", padding: "4px 2px 0", marginTop: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
          {labelNode}
          <span style={{ fontFamily: "monospace" }}>{amount}</span>
        </div>
      </div>
    );
  }
  if (variant === "huge") {
    return (
      <div style={{ textAlign: "center", marginTop: "6px" }}>
        <div style={{ fontSize: labelFs || "10px", fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: amountFs || "22px", fontWeight: 900, lineHeight: 1.15, fontFamily: "monospace" }}>{amount}</div>
      </div>
    );
  }
  return (
    <div style={{ background: "#000", color: "#fff", padding: "7px 5px", marginTop: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size, fontWeight: 900 }}>
        {labelNode}
        <span style={{ fontFamily: "monospace" }}>{amount}</span>
      </div>
    </div>
  );
}
