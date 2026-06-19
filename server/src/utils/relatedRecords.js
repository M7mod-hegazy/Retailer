// Shared helpers for "what is this record linked to?" checks used by definitions delete routes.
//
// These power two things that MUST stay in sync:
//   1. GET /:id/delete-impact  — preview shown in the client warning modal before deleting
//   2. DELETE /:id             — the actual archive-vs-hard-delete decision
//
// Robustness: counting is wrapped so a query against a table/column that does not exist in a
// drifted database returns null instead of throwing. A thrown count used to bubble up as an
// HTTP 500 ("تعذر الحذف") and left the record neither deleted nor archived. A null count is
// treated as "linked" — we never hard-delete when uncertain.

/**
 * Run a `SELECT COUNT(*) AS c ...` query safely.
 * @returns {number|null} the count, or null if the query errored (missing table/column).
 */
function countSafe(db, sql, ...params) {
  try {
    return Number(db.prepare(sql).get(...params)?.c || 0);
  } catch (_e) {
    return null;
  }
}

/**
 * @param {Array<{label:string,count:number|null}>} related
 * @returns {boolean} true if any related group has rows (or could not be checked).
 */
function hasAnyRelated(related) {
  return related.some((r) => r.count === null || Number(r.count) > 0);
}

/**
 * Build the payload the client delete-impact modal expects.
 * @param {Array<{label:string,count:number|null}>} related
 * @param {{blocked?: string|null}} [opts] blocked reason → record cannot be deleted at all.
 */
function buildImpact(related, { blocked = null } = {}) {
  if (blocked) return { mode: "blocked", blockedReason: blocked, related: [] };
  const shown = related
    .filter((r) => r.count === null || Number(r.count) > 0)
    .map((r) => ({ label: r.label, count: r.count === null ? null : Number(r.count) }));
  return { mode: hasAnyRelated(related) ? "archive" : "hard_delete", related: shown };
}

module.exports = { countSafe, hasAnyRelated, buildImpact };
