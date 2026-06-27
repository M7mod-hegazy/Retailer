/**
 * Turns an opaque "FOREIGN KEY constraint failed" SQLite error into a detailed,
 * copyable report naming exactly which child tables hold references to missing
 * parent rows. SQLite's native message never says which table/row — this asks the
 * engine via PRAGMA foreign_key_check and summarises the result.
 */

function isForeignKeyError(err) {
  if (!err) return false;
  return (
    err.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
    /FOREIGN KEY constraint failed/i.test(err.message || "")
  );
}

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {{ summary: Array<{child:string, parent:string, column:string, count:number, sampleIds:Array}>, text:string }}
 */
function describeForeignKeyViolations(db) {
  let violations = [];
  try {
    violations = db.prepare("PRAGMA foreign_key_check").all();
  } catch (_) {
    return { summary: [], text: "تعذّر فحص الروابط (foreign_key_check)." };
  }

  const groups = new Map(); // key: child|parent|column
  for (const v of violations) {
    if (!v.table) continue;
    let fk = null;
    try {
      const fks = db.prepare(`PRAGMA foreign_key_list("${v.table}")`).all();
      fk = fks.find((f) => f.id === v.fkid) || null;
    } catch (_) {
      /* ignore */
    }
    const parent = fk ? fk.table : "?";
    const column = fk ? fk.from : `fk#${v.fkid}`;
    const key = `${v.table}|${parent}|${column}`;
    if (!groups.has(key)) groups.set(key, { child: v.table, parent, column, count: 0, sampleIds: [] });
    const g = groups.get(key);
    g.count += 1;
    if (g.sampleIds.length < 5) {
      try {
        const row = db.prepare(`SELECT "${column}" AS v FROM "${v.table}" WHERE rowid = ?`).get(v.rowid);
        if (row && row.v != null && !g.sampleIds.includes(row.v)) g.sampleIds.push(row.v);
      } catch (_) {
        /* ignore */
      }
    }
  }

  const summary = [...groups.values()].sort((a, b) => b.count - a.count);
  const lines = summary.map(
    (g) =>
      `• ${g.child}.${g.column} → ${g.parent} (مفقود): ${g.count} صف` +
      (g.sampleIds.length ? ` — أمثلة id: ${g.sampleIds.join(", ")}` : "")
  );
  const text = summary.length
    ? `روابط مكسورة (مراجع لصفوف محذوفة):\n${lines.join("\n")}`
    : "خطأ مفتاح خارجي، لكن لم يُعثر على روابط مكسورة حالية.";

  return { summary, text };
}

module.exports = { isForeignKeyError, describeForeignKeyViolations };
