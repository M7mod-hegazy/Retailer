// Centralized phone normalization (Egypt-focused). Keep dependency-free so the Electron WA engine
// can require it without pulling in server modules.

// Returns digits-only, country-coded string (e.g. "201001234567") or null if too short to be valid.
function normalizeDigits(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  // Egypt local "01XXXXXXXXX" (11 digits) -> prepend country code
  if (d.startsWith("0") && d.length === 11) d = "2" + d;
  // Bare 10-digit local -> prepend "20"
  if (!d.startsWith("2") && d.length === 10) d = "20" + d;
  if (d.length < 10) return null;
  return d;
}

// WhatsApp JID for Baileys send, or null.
function toJid(raw) {
  const d = normalizeDigits(raw);
  return d ? d + "@s.whatsapp.net" : null;
}

// Digits for a wa.me link, or null.
function toWaMeNumber(raw) {
  return normalizeDigits(raw);
}

module.exports = { normalizeDigits, toJid, toWaMeNumber };
