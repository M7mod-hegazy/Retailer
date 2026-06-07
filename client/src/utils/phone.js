// Client-side phone helpers (Egypt-focused). Mirrors server/src/utils/phone.js.

// Returns digits-only, country-coded string (e.g. "201001234567") or null.
export function normalizeDigits(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = "2" + d;
  if (!d.startsWith("2") && d.length === 10) d = "20" + d;
  if (d.length < 10) return null;
  return d;
}

// Build a wa.me click-to-send URL with optional pre-filled text. Returns null for invalid numbers.
export function toWaMeUrl(raw, text) {
  const d = normalizeDigits(raw);
  if (!d) return null;
  const base = `https://wa.me/${d}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
