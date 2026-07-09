// Records POS→store pending changes into the `sync_changes` table so the
// "pending changes" tab and the push/apply flow have data to work with.
//
// Only store-linked items (those with an ecom_id, i.e. already known to the
// online store) produce change rows — editing a purely-local item does not.

function tableHasSyncChanges(db) {
  try {
    return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sync_changes'").get();
  } catch {
    return false;
  }
}

/**
 * Record a single field-level change for an entity.
 */
function recordSyncChange(db, { entity_type, entity_id, action = "update", field_name, old_value, new_value, direction = "push" }) {
  if (!tableHasSyncChanges(db)) return;
  try {
    // Coalesce: keep at most one pending row per (entity, field, direction) — the
    // latest desired state — so frequent edits/stock moves don't pile up.
    db.prepare(
      `DELETE FROM sync_changes WHERE entity_type = ? AND entity_id = ? AND COALESCE(field_name,'') = COALESCE(?, '') AND direction = ? AND status = 'pending'`
    ).run(entity_type, String(entity_id), field_name || null, direction);
    db.prepare(
      `INSERT INTO sync_changes (entity_type, entity_id, action, field_name, old_value, new_value, direction, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
    ).run(
      entity_type,
      String(entity_id),
      action,
      field_name || null,
      old_value === undefined || old_value === null ? null : String(old_value),
      new_value === undefined || new_value === null ? null : String(new_value),
      direction,
    );
  } catch {
    // Never let sync bookkeeping break the primary write.
  }
}

/**
 * Compare selected fields on a store-linked item and record a pending push per change.
 * `fields` maps sync field_name → { old, next }.
 */
function recordItemFieldChanges(db, item, fields) {
  if (!item || !item.ecom_id) return; // only push changes for linked items
  for (const [field_name, vals] of Object.entries(fields)) {
    const oldV = vals.old ?? null;
    const newV = vals.next ?? null;
    const same = String(oldV ?? "") === String(newV ?? "");
    if (same) continue;
    recordSyncChange(db, {
      entity_type: "item", // must match the pending/apply/conflict JOINs in sync.routes.js
      entity_id: item.id,
      action: "update",
      field_name,
      old_value: oldV,
      new_value: newV,
    });
  }
}

module.exports = { recordSyncChange, recordItemFieldChanges };
