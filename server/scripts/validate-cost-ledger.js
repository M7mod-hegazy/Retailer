const { initDb, closeDb } = require("../src/config/database");
const { deriveWACC, hasTable } = require("../src/services/costLedger");
const { roundMoney, multiplyMoney, divideMoney } = require("../src/utils/money");

function legacyReplay(db, itemId) {
  const lines = db.prepare(`
    SELECT quantity, unit_cost, created_at_sort, line_id, src FROM (
      SELECT pl.quantity, pl.unit_cost,
             p.created_at AS created_at_sort, pl.id AS line_id, 'P' AS src
      FROM purchase_lines pl
      JOIN purchases p ON p.id = pl.purchase_id
      WHERE pl.item_id = ?
        AND COALESCE(p.status, 'active') NOT IN ('cancelled', 'voided')
      UNION ALL
      SELECT btl.quantity, btl.unit_cost,
             bt.created_at AS created_at_sort, btl.id AS line_id, 'B' AS src
      FROM branch_transfer_lines btl
      JOIN branch_transfers bt ON bt.id = btl.transfer_id
      WHERE btl.item_id = ?
        AND COALESCE(bt.type, 'receive') = 'receive'
        AND COALESCE(bt.status, 'active') NOT IN ('cancelled', 'voided')
    )
    ORDER BY created_at_sort ASC, src ASC, line_id ASC
  `).all(itemId, itemId);

  let wacc = 0;
  let runningQty = 0;
  let lastCost = 0;

  for (const line of lines) {
    const qty = roundMoney(Number(line.quantity || 0));
    const cost = roundMoney(Number(line.unit_cost || 0));
    const totalQty = roundMoney(runningQty + qty);
    wacc = totalQty > 0
      ? divideMoney(roundMoney(multiplyMoney(runningQty, wacc) + multiplyMoney(qty, cost)), totalQty)
      : cost;
    runningQty = totalQty;
    lastCost = cost;
  }

  return {
    quantity: runningQty,
    wacc: lines.length > 0 ? roundMoney(wacc) : 0,
    last_cost: lines.length > 0 ? roundMoney(lastCost) : 0,
    movement_count: lines.length,
  };
}

function main() {
  const db = initDb(process.env.DB_PATH);
  try {
    if (!hasTable(db, "cost_movements")) {
      throw new Error("cost_movements table is missing");
    }

    const items = db.prepare("SELECT id, name FROM items WHERE deleted_at IS NULL ORDER BY id").all();
    const diffs = [];

    for (const item of items) {
      const legacy = legacyReplay(db, item.id);
      const ledger = deriveWACC(db, item.id);
      const diff = roundMoney(legacy.wacc - ledger.wacc);
      if (Math.abs(diff) > 0.01) {
        diffs.push({
          item_id: item.id,
          item_name: item.name,
          legacy_wacc: legacy.wacc,
          ledger_wacc: ledger.wacc,
          diff,
          legacy_count: legacy.movement_count,
          ledger_count: ledger.movement_count,
        });
      }
    }

    if (diffs.length) {
      console.error(`Cost ledger validation failed: ${diffs.length} item(s) differ by more than 0.01.`);
      for (const row of diffs.slice(0, 100)) {
        console.error(JSON.stringify(row));
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Cost ledger validation passed: ${items.length} item(s) checked.`);
  } finally {
    closeDb();
  }
}

main();
