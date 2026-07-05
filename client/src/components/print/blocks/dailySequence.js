// A per-day auto-incrementing counter kept in localStorage. It starts at 1 and
// resets automatically when the calendar day changes — used by the "الرقم
// اليومي" custom field / order number so each day's receipts number 1, 2, 3…
//
// peek() reads the current day's last-assigned number WITHOUT advancing (for
// on-screen previews). next() advances and returns the new number (called once
// per real print job by the print pipeline).

const KEY = "retailer_daily_seq";
const today = () => new Date().toISOString().slice(0, 10);

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && v.date === today() ? Number(v.n) || 0 : 0;
  } catch { return 0; }
}

// The number the NEXT receipt would get (current + 1). Preview-safe.
export function peekDailySeq() {
  return read() + 1;
}

// Advance and return the new daily number. Call once when a receipt prints.
export function nextDailySeq() {
  const n = read() + 1;
  try { localStorage.setItem(KEY, JSON.stringify({ date: today(), n })); } catch { /* quota */ }
  return n;
}

// Resolve the daily number for an invoice: a backend-assigned value wins;
// otherwise fall back to the local peek so the field always shows something.
export function resolveDailyNo(invoice = {}) {
  const v = invoice.daily_no ?? invoice.daily_sequence ?? invoice.daily_seq;
  if (v != null && v !== "") return Number(v);
  return peekDailySeq();
}
