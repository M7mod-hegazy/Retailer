import React from "react";
import { g, computeTotals, smartFormat } from "./blockUtils";
import { resolvePlaceholders } from "./placeholders";
import { resolveDailyNo } from "./dailySequence";

// A user-defined label:value row — the "add any field you want" block. The
// value can be a fixed text/number, a dynamic {token}, or a COMPUTED figure
// (subtotal, paid, remaining, change, item count, …). Registered like an
// inserted block so it can be dropped anywhere and repeated.
//
// props:
//   label     caption on the right (empty = value only)
//   source    "text" | "token" | "computed"
//   value     fixed text / token string (for text & token sources)
//   compute   which figure (for computed source)
//   money     format the computed value as currency (default true for money figures)
//   align     "between" (label⟷value, default) | "right" | "center" | "left"
export const COMPUTED_FIELDS = [
  { key: "subtotal", label: "الإجمالي الفرعي", money: true },
  { key: "discount", label: "إجمالي الخصم", money: true },
  { key: "tax", label: "الضريبة", money: true },
  { key: "increase", label: "الرسوم الإضافية", money: true },
  { key: "grand_total", label: "الإجمالي النهائي", money: true },
  { key: "paid", label: "المدفوع", money: true },
  { key: "remaining", label: "المتبقي", money: true },
  { key: "change", label: "الباقي للعميل", money: true },
  { key: "item_count", label: "عدد الأصناف", money: false },
  { key: "total_qty", label: "إجمالي الكميات", money: false },
  { key: "daily_no", label: "الرقم اليومي (يبدأ من ١ ويتصفّر يومياً)", money: false },
];

function computedValue(compute, invoice, s) {
  const t = computeTotals(invoice, s);
  const lines = invoice.lines || [];
  switch (compute) {
    case "subtotal": return { v: t.subtotal, money: true };
    case "discount": return { v: t.totalDiscount, money: true };
    case "tax": return { v: t.taxAmount, money: true };
    case "increase": return { v: t.totalIncrease, money: true };
    case "grand_total": return { v: t.grandTotal, money: true };
    case "paid": return { v: t.paid, money: true };
    case "remaining": return { v: Math.max(0, t.grandTotal - t.paid), money: true };
    case "change": return { v: t.change, money: true };
    case "item_count": return { v: lines.length, money: false };
    case "total_qty": return { v: lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0), money: false };
    case "daily_no": return { v: resolveDailyNo(invoice), money: false };
    default: return { v: 0, money: false };
  }
}

// Mock values per compute key — coherent with the global mock invoice scenario
const MOCK_COMPUTED = {
  subtotal:    { v: 500,   money: true },
  discount:    { v: 25,    money: true },
  tax:         { v: 75,    money: true },
  increase:    { v: 15,    money: true },
  grand_total: { v: 565,   money: true },
  paid:        { v: 565,   money: true },
  remaining:   { v: 0,     money: true },
  change:      { v: 0,     money: true },
  item_count:  { v: 3,     money: false },
  total_qty:   { v: 4,     money: false },
  daily_no:    { v: "42",  money: false },
};

export default function CustomFieldBlock({ invoice = {}, settings: s, props = {}, family, editing }) {
  const label = props.label !== undefined ? props.label : "";
  const source = props.source || "text";
  let text = "";
  if (source === "computed") {
    const computeKey = props.compute || "grand_total";
    const realResult = computedValue(computeKey, invoice, s);
    // Use real computed value if non-zero, else fall back to specific mock
    const { v, money } = (realResult.v || realResult.v === 0)
      ? (realResult.v !== 0 ? realResult : (editing ? (MOCK_COMPUTED[computeKey] || realResult) : realResult))
      : realResult;
    const useMoney = props.money !== undefined ? props.money : money;
    text = useMoney ? `${g(s, "currency_symbol")} ${smartFormat(Number(v) || 0, s)}` : String(v);
  } else if (source === "token") {
    const resolved = resolvePlaceholders(props.value || "", invoice, s);
    text = resolved || (editing ? `{${props.value || "رمز_متغير"}}` : "");
  } else {
    text = props.value !== undefined ? String(props.value)
      : (editing ? "[ نص ثابت قابل للتعديل ]" : "");
  }
  if (!label && !text) return null;

  const align = props.align || "between";
  const isRoll = family === "roll";
  const strong = { fontWeight: isRoll ? 900 : 800 };
  // Mark daily-number output so the print pipeline advances the counter once
  // per real print (preview shows peek, print commits next — they match).
  const daily = source === "computed" && (props.compute || "grand_total") === "daily_no" ? { "data-daily-no": "1" } : {};

  if (align === "between") {
    return (
      <div {...daily} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: isRoll ? 0 : "2px 0" }}>
        <span style={{ fontWeight: 700, color: isRoll ? "#000" : "#64748b" }}>{label ? `${label}${isRoll ? ":" : ""}` : ""}</span>
        <span style={strong}>{text}</span>
      </div>
    );
  }
  return (
    <div {...daily} style={{ textAlign: align, padding: isRoll ? 0 : "2px 0" }}>
      {label && <span style={{ fontWeight: 700, marginLeft: "6px", color: isRoll ? "#000" : "#64748b" }}>{label}:</span>}
      <span style={strong}>{text}</span>
    </div>
  );
}
