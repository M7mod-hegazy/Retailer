// One-time backfill: historical timestamps written by SQLite CURRENT_TIMESTAMP /
// datetime('now') and JS toISOString() were stored in UTC. The app now stores
// (and displays) everything as Egypt-local (Africa/Cairo) wall-clock. This shifts
// the old UTC values to Cairo wall-clock so historical reports line up with new
// rows.
//
// Idempotency: the migration runner records applied migrations in `_migrations`,
// so this runs exactly once.
//
// Conversion is DST-aware (Egypt is +02:00 in winter, +03:00 in summer): we parse
// each stored value as UTC and re-emit the Cairo wall-clock string via Intl. The
// logic mirrors server/src/utils/datetime.js `toSql`; it is inlined here so the
// migration stays self-contained and immune to future refactors of that util.

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

// Interpret a stored bare "YYYY-MM-DD HH:MM:SS" (or ISO) value as UTC and return
// the equivalent Cairo wall-clock "YYYY-MM-DD HH:MM:SS".
function utcStringToCairoSql(value) {
  const text = String(value);
  const iso = text.includes("T") ? text : text.replace(" ", "T");
  const d = new Date(`${iso}Z`); // force-UTC interpretation
  if (Number.isNaN(d.getTime())) return null;
  const map = {};
  for (const p of partsFormatter.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  if (map.hour === "24") map.hour = "00";
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

// Columns that were *exclusively* UTC-sourced (CURRENT_TIMESTAMP / datetime('now') /
// toISOString) and never written by local-time code. Mixed-source columns
// (e.g. invoices.created_at, cost_movements.occurred_at, payments/purchases/
// expenses timestamps written via toTimeString) are deliberately EXCLUDED — they
// were already local wall-clock, so shifting them would corrupt them.
const TARGETS = [
  ["shifts", ["opened_at", "closed_at"]],
  ["audit_logs", ["created_at"]],
  ["invoices", ["paid_at", "cancelled_at"]],
  ["sales_returns", ["cancelled_at"]],
  ["branch_transfers", ["cancelled_at"]],
  ["daily_sessions", ["closed_at", "reopened_at", "opening_adjusted_at"]],
];

module.exports = {
  name: "139_backfill_cairo_timestamps",
  up(db) {
    const tableExists = (t) =>
      !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);

    const run = db.transaction(() => {
      for (const [table, cols] of TARGETS) {
        if (!tableExists(table)) continue;
        const present = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
        for (const col of cols) {
          if (!present.includes(col)) continue;
          const rows = db
            .prepare(`SELECT rowid AS rid, ${col} AS val FROM ${table} WHERE ${col} IS NOT NULL AND ${col} <> ''`)
            .all();
          const upd = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE rowid = ?`);
          for (const r of rows) {
            const v = String(r.val);
            // Skip values that already carry an explicit timezone designator —
            // they are absolute, not naive UTC, so we must not re-shift them.
            if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) continue;
            const converted = utcStringToCairoSql(v);
            if (converted && converted !== v) upd.run(converted, r.rid);
          }
        }
      }
    });

    run();
  },
};
