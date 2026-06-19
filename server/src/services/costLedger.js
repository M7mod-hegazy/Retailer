const { roundMoney, multiplyMoney, divideMoney } = require("../utils/money");
const { nowSql } = require("../utils/datetime");

function hasTable(db, table) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
}

function normalizeOccurredAt(value) {
  if (!value) return nowSql();
  const text = String(value);
  return text.includes("T") ? text.replace("T", " ").slice(0, 19) : text.slice(0, 19);
}

function movementKey(row) {
  const lineId = row.source_line_id == null ? row.id : Math.abs(Number(row.source_line_id));
  return `${row.source_table}:${row.source_id}:${lineId}`;
}

function ensureLedgerTable(db) {
  if (!hasTable(db, "cost_movements")) {
    throw new Error("cost_movements table is missing; run database migrations first");
  }
}

function recordMovement(db, movement) {
  ensureLedgerTable(db);
  const quantity = roundMoney(Number(movement.quantity || 0));
  const unitCost = roundMoney(Number(movement.unit_cost || 0));
  if (!movement.item_id || quantity === 0) return null;

  return db.prepare(`
    INSERT OR IGNORE INTO cost_movements
      (item_id, warehouse_id, occurred_at, movement_type, quantity, unit_cost,
       source_table, source_id, source_line_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(movement.item_id),
    movement.warehouse_id == null ? null : Number(movement.warehouse_id),
    normalizeOccurredAt(movement.occurred_at),
    movement.movement_type,
    quantity,
    unitCost,
    movement.source_table,
    Number(movement.source_id),
    movement.source_line_id == null ? null : Number(movement.source_line_id),
  );
}

function fetchMovements(db, itemId) {
  if (!hasTable(db, "cost_movements")) return [];
  return db.prepare(`
    SELECT *
    FROM cost_movements
    WHERE item_id = ?
    ORDER BY occurred_at ASC, id ASC
  `).all(Number(itemId));
}

function reduceLayers(layers, quantity, preferredKey = null) {
  let remaining = roundMoney(Math.abs(Number(quantity || 0)));
  if (remaining <= 0) return;

  if (preferredKey) {
    for (const layer of layers) {
      if (layer.key !== preferredKey || layer.quantity <= 0) continue;
      const take = Math.min(layer.quantity, remaining);
      layer.quantity = roundMoney(layer.quantity - take);
      remaining = roundMoney(remaining - take);
      if (remaining <= 0) return;
    }
  }

  for (let index = layers.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const layer = layers[index];
    if (layer.quantity <= 0) continue;
    const take = Math.min(layer.quantity, remaining);
    layer.quantity = roundMoney(layer.quantity - take);
    remaining = roundMoney(remaining - take);
  }
}

function buildReceiptLayers(db, itemId) {
  const layers = [];
  for (const row of fetchMovements(db, itemId)) {
    const qty = roundMoney(Number(row.quantity || 0));
    const key = movementKey(row);
    if (qty > 0) {
      layers.push({
        key,
        occurred_at: row.occurred_at,
        id: row.id,
        quantity: qty,
        unit_cost: roundMoney(Number(row.unit_cost || 0)),
      });
    } else if (qty < 0) {
      const preferredKey = row.source_line_id != null && Number(row.source_line_id) < 0
        ? `${row.source_table}:${row.source_id}:${Math.abs(Number(row.source_line_id))}`
        : null;
      reduceLayers(layers, qty, preferredKey);
    }
  }
  return layers.filter((layer) => layer.quantity > 0.000001);
}

function deriveWACC(db, itemId) {
  const movements = fetchMovements(db, itemId);
  let runningQty = 0;
  let runningValue = 0;
  let wacc = 0;

  for (const row of movements) {
    const qty = roundMoney(Number(row.quantity || 0));
    const cost = roundMoney(Number(row.unit_cost || 0));
    runningQty = roundMoney(runningQty + qty);
    runningValue = roundMoney(runningValue + multiplyMoney(qty, cost));
    if (runningQty > 0) {
      wacc = divideMoney(runningValue, runningQty);
    } else {
      runningQty = 0;
      runningValue = 0;
      wacc = 0;
    }
  }

  const activeLayers = buildReceiptLayers(db, itemId);
  const lastLayer = activeLayers[activeLayers.length - 1];
  return {
    quantity: runningQty,
    wacc: movements.length > 0 ? roundMoney(wacc) : 0,
    last_cost: lastLayer ? roundMoney(lastLayer.unit_cost) : 0,
    movement_count: movements.length,
  };
}

function costFromLayers(layers, consumedQty, newestFirst = false) {
  let remaining = roundMoney(Number(consumedQty || 0));
  let totalCost = 0;
  const ordered = newestFirst ? [...layers].reverse() : [...layers];

  for (const layer of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(layer.quantity, remaining);
    totalCost = roundMoney(totalCost + multiplyMoney(take, layer.unit_cost));
    remaining = roundMoney(remaining - take);
  }

  const consumed = roundMoney(Number(consumedQty || 0) - remaining);
  return {
    consumed_quantity: consumed,
    total_cost: roundMoney(totalCost),
    unit_cost: consumed > 0 ? divideMoney(totalCost, consumed) : 0,
    shortage: Math.max(0, remaining),
  };
}

function deriveFIFO(db, itemId, consumedQty) {
  return costFromLayers(buildReceiptLayers(db, itemId), consumedQty, false);
}

function deriveLIFO(db, itemId, consumedQty) {
  return costFromLayers(buildReceiptLayers(db, itemId), consumedQty, true);
}

function deriveLastCost(db, itemId) {
  return deriveWACC(db, itemId).last_cost;
}

module.exports = {
  hasTable,
  recordMovement,
  deriveWACC,
  deriveFIFO,
  deriveLIFO,
  deriveLastCost,
  buildReceiptLayers,
};
