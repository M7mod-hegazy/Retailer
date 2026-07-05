function createSnapshot(direction, entityType, snapshotData, syncLogId, db) {
  const json = JSON.stringify(snapshotData);
  const itemsCount = snapshotData.items ? snapshotData.items.length : (snapshotData.changes ? snapshotData.changes.length : 0);

  let metadata = null;
  if (direction === "pull" && snapshotData.items) {
    const breakdown = { newProducts: 0, pricesChanged: 0, stockChanged: 0, namesChanged: 0 };
    for (const item of snapshotData.items) {
      if (item.action === "create") {
        breakdown.newProducts++;
      } else if (item.action === "update" && item.oldValues) {
        if (item.oldValues.sale_price !== undefined) breakdown.pricesChanged++;
        if (item.oldValues.stock !== undefined) breakdown.stockChanged++;
        if (item.oldValues.name !== undefined) breakdown.namesChanged++;
      }
    }
    metadata = JSON.stringify(breakdown);
  } else if (direction === "push" && snapshotData.changes) {
    const breakdown = { pricesChanged: 0, stockChanged: 0, namesChanged: 0 };
    for (const ch of snapshotData.changes) {
      if (ch.field_name === "sale_price") breakdown.pricesChanged++;
      else if (ch.field_name === "stock") breakdown.stockChanged++;
      else if (ch.field_name === "name" || ch.field_name === "name_en") breakdown.namesChanged++;
    }
    metadata = JSON.stringify(breakdown);
  }

  const stmt = db.prepare(`
    INSERT INTO sync_snapshots (sync_log_id, direction, entity_type, snapshot_data, items_count, size_bytes, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  return stmt.run(syncLogId, direction, entityType, json, itemsCount, json.length, metadata);
}

module.exports = { createSnapshot };
