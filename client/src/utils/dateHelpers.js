// Single source of truth for date/time on the client.
//
// The whole app stores timestamps as Egypt-local (Africa/Cairo) wall-clock
// strings ("YYYY-MM-DD HH:MM:SS", no timezone suffix). Two distinct concerns:
//
//   1. Generating "today"/date-bucket strings from the *current* moment to send
//      to the API. These derive from the live clock, so they MUST be pinned to
//      Cairo — otherwise a machine in another timezone (or near midnight) buckets
//      into the wrong day. Use todayCairo()/today().
//
//   2. Displaying a *stored* timestamp. The stored value already is Cairo
//      wall-clock, so we format it as-is (parse-local → format-local). We must
//      NOT pin a timeZone here: doing so would re-shift the value on a machine
//      whose OS clock isn't Cairo. Plain local formatting round-trips the stored
//      digits on any machine. Use formatDate/formatDateTime/formatTime.

export const CAIRO_TZ = "Africa/Cairo";

// Standard display locale across the app: Arabic labels, Latin digits, Gregorian.
const DISPLAY_LOCALE = "ar-EG-u-nu-latn";

// Stable formatter for "YYYY-MM-DD" date buckets in Cairo (for API queries).
const cairoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAIRO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(value) {
  if (value == null) return new Date();
  return value instanceof Date ? value : new Date(value);
}

// ── Concern 1: live "today"/date buckets, pinned to Cairo ────────────────────

// "YYYY-MM-DD" in Cairo for the given instant (defaults to now).
export function todayCairo(value = new Date()) {
  return cairoDayFormatter.format(toDate(value));
}

// Back-compat alias. Previously returned a UTC date (toISOString) which caused
// off-by-one-day bugs; now Cairo-local.
export function today() {
  return todayCairo();
}

// ── Concern 2: display of stored Cairo wall-clock values (no timeZone pin) ────

export function formatDate(dateStr, format = "YYYY/MM/DD") {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return format
    .replace("YYYY", y)
    .replace("MM", m)
    .replace("DD", day)
    .replace("HH", h)
    .replace("mm", min);
}

export function formatDateArabic(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(DISPLAY_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Display date + time. Pass Intl options to override defaults.
export function formatDateTime(value, opts = {}) {
  if (!value) return "";
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...opts,
  }).format(d);
}

// Display time-of-day.
export function formatTime(value, opts = {}) {
  if (!value) return "";
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...opts,
  }).format(d);
}

// Convert an "HH:MM" string (from raw ISO extraction) to 12-hour Arabic display.
// Graceful fallback: returns the raw string unchanged if parsing fails.
export function formatHHMM(value) {
  if (!value) return "";
  const m = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(value);
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "م" : "ص";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${min} ${ampm}`;
}
