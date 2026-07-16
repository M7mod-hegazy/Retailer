/**
 * Single source of truth for date/time in the app.
 *
 * The business runs on Egypt local time (Africa/Cairo, DST-aware). Every stored
 * timestamp, every date-bucket query string, and every displayed value must come
 * from here so pages never disagree.
 *
 * By default the helpers compute Cairo wall-clock via Intl + formatToParts, so
 * they are correct even if the host machine's clock/timezone is misconfigured (we
 * do NOT rely on `new Date()` local methods, which follow the OS).
 *
 * ── Win7 stale-DST override ───────────────────────────────────────────────────
 * Windows 7 is end-of-life and never received the update that re-added Egypt's
 * summer DST (reinstated 2023). Its "Egypt Standard Time" zone applies a flat
 * +02:00 all year, while our bundled ICU data knows DST and applies +03:00 in
 * summer. On such a box the app would render every time one hour ahead of the
 * Windows clock the operator actually reads.
 *
 * To match the taskbar on exactly those machines — and NOWHERE else — we probe
 * Windows' own timezone. When (and only when) the OS is configured for Egypt
 * ("Egypt Standard Time") AND its applied offset disagrees with our ICU
 * Africa/Cairo offset, we adopt the OS offset. A machine whose zone is set to
 * anything else keeps the ICU pin (the misconfigured-zone hardening is intact),
 * and a correctly-patched machine sees zero difference (the offsets match, so the
 * override never fires).
 *
 * Stored format is the SQLite-friendly `YYYY-MM-DD HH:MM:SS` (no timezone suffix);
 * it represents Cairo wall-clock, consistently across the whole app.
 */

const { execFileSync } = require("child_process");

const CAIRO_TZ = "Africa/Cairo";

// The Windows registry TimeZoneKeyName / TimeZoneInfo.Id for Egypt.
const EGYPT_WINDOWS_ID = "Egypt Standard Time";

// Re-probe the OS timezone at most this often (a running box's zone/DST state
// barely changes; this keeps us correct across a DST boundary without shelling
// out per timestamp).
const PROBE_TTL_MS = 10 * 60 * 1000;

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
 * The offset (in minutes, east-positive) that `timeZone` applies at `date`.
 * @param {Date} date
 * @param {string} timeZone IANA id
 * @returns {number}
 */
function offsetMinutesForZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  if (map.hour === "24") map.hour = "00";
  const asUTC = Date.UTC(
    +map.year,
    +map.month - 1,
    +map.day,
    +map.hour,
    +map.minute,
    +map.second,
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// ── Windows timezone probe (win32 only) ──────────────────────────────────────

// Test seam: `undefined` = live probe; `null` = force "no override"; an object
// `{ zone, offsetMinutes }` = force that OS timezone.
let _forcedWindowsTz;
let _probeCache = { at: 0, info: null };

/**
 * Read Windows' active timezone id and applied UTC offset from the registry
 * (falling back to PowerShell). Returns null off-Windows or on any failure.
 * @returns {{zone:string, offsetMinutes:number}|null}
 */
function probeWindowsTz() {
  if (process.platform !== "win32") return null;
  try {
    const out = execFileSync(
      "reg",
      ["query", "HKLM\\SYSTEM\\CurrentControlSet\\Control\\TimeZoneInformation"],
      { timeout: 3000, windowsHide: true },
    ).toString();
    const zoneM = out.match(/TimeZoneKeyName\s+REG_SZ\s+([^\r\n]+)/i);
    const biasM = out.match(/ActiveTimeBias\s+REG_DWORD\s+0x([0-9a-fA-F]+)/i);
    if (!zoneM || !biasM) return probeViaPowerShell();
    // ActiveTimeBias is (UTC - local) in minutes, stored as a signed DWORD.
    let bias = parseInt(biasM[1], 16);
    if (bias > 0x7fffffff) bias -= 0x100000000;
    return { zone: zoneM[1].trim(), offsetMinutes: -bias };
  } catch (_e) {
    try {
      return probeViaPowerShell();
    } catch (_e2) {
      return null;
    }
  }
}

function probeViaPowerShell() {
  const out = execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$tz=[System.TimeZoneInfo]::Local; '' + $tz.Id + '|' + [int]$tz.GetUtcOffset([DateTime]::UtcNow).TotalMinutes",
    ],
    { timeout: 4000, windowsHide: true },
  )
    .toString()
    .trim();
  const [zone, off] = out.split("|");
  if (!zone) return null;
  return { zone: zone.trim(), offsetMinutes: parseInt(off, 10) };
}

function getWindowsTz() {
  if (_forcedWindowsTz !== undefined) return _forcedWindowsTz;
  if (process.platform !== "win32") return null;
  const now = Date.now();
  if (_probeCache.at && now - _probeCache.at < PROBE_TTL_MS) return _probeCache.info;
  _probeCache = { at: now, info: probeWindowsTz() };
  return _probeCache.info;
}

/**
 * Decide the wall-clock offset to use. Returns the OS offset ONLY when the OS is
 * configured for Egypt and disagrees with our ICU offset (the Win7 stale-DST
 * case); otherwise null, meaning "use the default ICU Africa/Cairo path".
 * Pure — exported for unit testing.
 * @param {{zone:?string, winOffset:?number, icuOffset:number}} args
 * @returns {number|null}
 */
function _resolveWallOffset({ zone, winOffset, icuOffset }) {
  if (zone !== EGYPT_WINDOWS_ID) return null;
  if (winOffset == null || winOffset === icuOffset) return null;
  return winOffset;
}

/** The wall-clock offset (minutes) to use for `date`, or null for the ICU path. */
function effectiveWallOffset(date) {
  const info = getWindowsTz();
  if (!info) return null;
  return _resolveWallOffset({
    zone: info.zone,
    winOffset: info.offsetMinutes,
    icuOffset: offsetMinutesForZone(date, CAIRO_TZ),
  });
}

/** Test hook: force the probed OS timezone (or null / undefined to reset). */
function __setWindowsTz(info) {
  _forcedWindowsTz = info;
  _probeCache = { at: 0, info: null };
}

// ── Parts extraction ─────────────────────────────────────────────────────────

function partsFromOffset(date, offsetMinutes) {
  const s = new Date(date.getTime() + offsetMinutes * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    year: String(s.getUTCFullYear()),
    month: pad(s.getUTCMonth() + 1),
    day: pad(s.getUTCDate()),
    hour: pad(s.getUTCHours()),
    minute: pad(s.getUTCMinutes()),
    second: pad(s.getUTCSeconds()),
  };
}

/**
 * Break a Date down into Cairo wall-clock parts. Uses the Win7 OS override when
 * active, else ICU Africa/Cairo.
 * @param {Date} date
 * @returns {{year:string,month:string,day:string,hour:string,minute:string,second:string}}
 */
function cairoParts(date) {
  const off = effectiveWallOffset(date);
  if (off != null) return partsFromOffset(date, off);
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

/**
 * The UTC offset (minutes, east-positive) the app is currently applying for
 * Egypt wall-clock — the OS override when active, else the ICU offset. The
 * renderer reads this via /api/time so client-side clocks/date-buckets match the
 * server (and the taskbar) on stale-DST boxes.
 * @param {Date|string|number} [value]
 * @returns {number}
 */
function wallOffsetMinutes(value = new Date()) {
  const d = toDate(value);
  const off = effectiveWallOffset(d);
  return off != null ? off : offsetMinutesForZone(d, CAIRO_TZ);
}

module.exports = {
  CAIRO_TZ,
  EGYPT_WINDOWS_ID,
  nowSql,
  today,
  toSql,
  dayStamp,
  cairoParts,
  toDate,
  offsetMinutesForZone,
  wallOffsetMinutes,
  _resolveWallOffset,
  __setWindowsTz,
};
