// One-time backfill: ajal_payments and ajal_schedules written via
// SQLite datetime('now', 'localtime') on Windows + TZ=Africa/Cairo env var
// stored UTC timestamps (because Windows _tzset() doesn't recognise IANA
// timezone names, causing localtime() to fall back to UTC).
//
// This shifts those stored UTC values to Cairo wall-clock. It mirrors the
// logic in migration 139 but covers the ajal tables that were missed.
//
// The ajal_debts.updated_at column is excluded — it's only used for internal
// ordering and isn't displayed to the user.
//
// Idempotent: migration runner marks it applied, runs once.

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

function utcStringToCairoSql(value) {
  const text = String(value);
  const iso = text.includes("T") ? text : text.replace(" ", "T");
  const d = new Date(`${iso}Z`);
  if (Number.isNaN(d.getTime())) return null;
  const map = {};
  for (const p of partsFormatter.formatToParts(d)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  if (map.hour === "24") map.hour = "00";
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

const TARGETS = [
  ["ajal_payments", ["created_at"]],
  ["ajal_schedules", ["paid_at"]],
];

module.exports = {
  name: "152_fix_ajal_payments_cairo_timestamps",
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
