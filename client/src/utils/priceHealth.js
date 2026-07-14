// Selling context (POS): is the price a healthy margin over cost?
export function getMarginHealth(price, cost, listPrice) {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const list = Number(listPrice) || 0;

  if (list > 0 && p > list * 1.3) {
    return {
      level: "high",
      diffFlat: c > 0 ? p - c : null,
      diffPct: c > 0 ? ((p - c) / c) * 100 : null,
    };
  }

  if (c <= 0 || p <= 0) return { level: "neutral", diffFlat: null, diffPct: null };

  const diffFlat = p - c;
  const diffPct = (diffFlat / c) * 100;
  if (p <= c) return { level: "loss", diffFlat, diffPct };
  if (diffPct < 10) return { level: "thin", diffFlat, diffPct };
  return { level: "healthy", diffFlat, diffPct };
}

// Refund context (Sales Return): is the refund safe relative to what the customer actually paid?
export function getRefundHealth(price, originalPrice) {
  const p = Number(price) || 0;
  const orig = Number(originalPrice) || 0;
  if (orig <= 0 || p <= 0) return { level: "neutral", diffFlat: null, diffPct: null };

  const diffFlat = p - orig;
  const diffPct = (diffFlat / orig) * 100;
  if (diffPct > 10) return { level: "loss", diffFlat, diffPct };
  if (diffPct > 0) return { level: "thin", diffFlat, diffPct };
  return { level: "healthy", diffFlat, diffPct };
}

// For plain Tailwind inputs (no .entry-control base class), e.g. DataGrid/table cells.
export const HEALTH_BORDER_CLASSES = {
  loss: "border-rose-400 bg-rose-50",
  high: "border-sky-400 bg-sky-50",
  thin: "border-amber-400 bg-amber-50",
  healthy: "",
  neutral: "",
};

// For inputs using the .entry-control base class (needs !important to win, see index.css).
export const ENTRY_HEALTH_CLASSES = {
  loss: "entry-control--error",
  high: "entry-control--info",
  thin: "entry-control--warning",
  healthy: "",
  neutral: "",
};
