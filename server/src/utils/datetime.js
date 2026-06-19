/**
 * Single source of truth for date/time in the app.
 *
 * The business runs on Egypt local time (Africa/Cairo, DST-aware). Every stored
 * timestamp, every date-bucket query string, and every displayed value must come
 * from here so pages never disagree.
 *
 * All helpers compute Cairo wall-clock via Intl + formatToParts, so they are
 * correct even if the host machine's clock/timezone is misconfigured (we do NOT
 * rely on `new Date()` local methods, which follow the OS).
 *
 * Stored format is the SQLite-friendly `YYYY-MM-DD HH:MM:SS` (no timezone suffix);
 * it represents Cairo wall-clock, consistently across the whole app.
 */

const CAIRO_TZ = "Africa/Cairo";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAIRO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Break a Date down into Cairo wall-clock parts.
 * @param {Date} date
 * @returns {{year:string,month:string,day:string,hour:string,minute:string,second:string}}
 */
function cairoParts(date) {
  const map = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  // Intl can emit "24" for midnight in some engines — normalize to "00".
  if (map.hour === "24") map.hour = "00";
  return map;
}

/**
 * Coerce any accepted input to a Date instance.
 * Strings without a timezone designator are interpreted as UTC so that
 * conversions are deterministic regardless of host TZ.
 * @param {Date|string|number} [value]
 * @returns {Date}
 */
function toDate(value = new Date()) {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    // A bare "YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DD" has no zone → treat as UTC.
    const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
    const iso = value.includes("T") ? value : value.replace(" ", "T");
    return new Date(hasZone ? iso : `${iso}Z`);
  }
  return new Date(value);
}

/**
 * Cairo wall-clock SQL timestamp "YYYY-MM-DD HH:MM:SS" for the given instant.
 * @param {Date|string|number} [value] defaults to now
 * @returns {string}
 */
function toSql(value = new Date()) {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = cairoParts(d);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** Current Cairo wall-clock SQL timestamp. */
function nowSql() {
  return toSql(new Date());
}

/**
 * Cairo date bucket "YYYY-MM-DD" for the given instant (defaults to now).
 * Use for WHERE date(col) = ? and "today" filters.
 * @param {Date|string|number} [value]
 * @returns {string}
 */
function today(value = new Date()) {
  const d = toDate(value);
  const p = cairoParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Cairo "YYYYMMDD" stamp for the given instant (defaults to now).
 * Use for daily document-number sequences.
 * @param {Date|string|number} [value]
 * @returns {string}
 */
function dayStamp(value = new Date()) {
  const p = cairoParts(toDate(value));
  return `${p.year}${p.month}${p.day}`;
}

module.exports = { CAIRO_TZ, nowSql, today, toSql, dayStamp, cairoParts, toDate };
