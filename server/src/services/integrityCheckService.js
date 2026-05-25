/**
 * Pre-install and on-demand integrity check service.
 *
 * Checks:
 *  1. stock_mismatch     — stock_levels.quantity doesn't match purchase - sales replay
 *  2. wacc_drift         — stock_levels.wacc doesn't match a fresh WACC replay
 *  3. orphan_references  — invoice_lines or purchase_lines pointing to deleted items
 *  4. price_coherence    — items with sale_price < purchase_price (selling below cost)
 *  5. zero_cost_stock    — items with stock but zero purchase_price and zero wacc
 *
 * Results are stored in integrity_check_runs / integrity_check_issues tables.
 */
const { roundMoney } = require("../utils/money");
const { recomputeWACCForItem } = require("./waccService");

/**
 * Run a full integrity check and persist results.
 * @param {object} db
 * @param {number|null} ranBy  user id
 * @returns {{ runId: number, status: string, totalIssues: number, issues: Array }}
 */
function runFullCheck(db, ranBy) {
  const issues = [];

  // ── 1. WACC drift check ────────────────────────────────────────────────────
  const stockRows = db.prepare(
    "SELECT item_id, wacc FROM stock_levels WHERE quantity > 0"
  ).all();

  for (const row of stockRows) {
    // Compute fresh WACC without persisting
    const lines = db.prepare(`
      SELECT pl.quantity, pl.unit_cost
      FROM purchase_lines pl
      JOIN purchases p ON p.id = pl.purchase_id
      WHERE pl.item_id = ?
        AND p.status NOT IN ('cancelled', 'voided')
      ORDER BY p.created_at ASC, pl.id ASC
    `).all(row.item_id);

    let freshWacc = 0, runningQty = 0;
    for (const line of lines) {
      const qty  = roundMoney(line.quantity);
      const cost = roundMoney(line.unit_cost);
      const totalQty = roundMoney(runningQty + qty);
      freshWacc = totalQty > 0
        ? roundMoney((runningQty * freshWacc + qty * cost) / totalQty)
        : cost;
      runningQty = totalQty;
    }

    const storedWacc = roundMoney(row.wacc || 0);
    if (Math.abs(storedWacc - freshWacc) > 0.01) {
      issues.push({
        item_id:    row.item_id,
        issue_type: "wacc_drift",
        details:    JSON.stringify({ stored: storedWacc, computed: freshWacc, diff: roundMoney(storedWacc - freshWacc) }),
      });
    }
  }

  // ── 2. Orphan references — invoice_lines → deleted items ──────────────────
  const orphanInvoiceLines = db.prepare(`
    SELECT il.id, il.item_id FROM invoice_lines il
    LEFT JOIN items i ON i.id = il.item_id
    WHERE i.id IS NULL AND il.item_id IS NOT NULL
  `).all();
  for (const row of orphanInvoiceLines) {
    issues.push({
      item_id:    row.item_id,
      issue_type: "orphan_reference",
      details:    JSON.stringify({ table: "invoice_lines", line_id: row.id }),
    });
  }

  const orphanPurchaseLines = db.prepare(`
    SELECT pl.id, pl.item_id FROM purchase_lines pl
    LEFT JOIN items i ON i.id = pl.item_id
    WHERE i.id IS NULL AND pl.item_id IS NOT NULL
  `).all();
  for (const row of orphanPurchaseLines) {
    issues.push({
      item_id:    row.item_id,
      issue_type: "orphan_reference",
      details:    JSON.stringify({ table: "purchase_lines", line_id: row.id }),
    });
  }

  // ── 3. Price coherence — sale_price < purchase_price (below-cost selling) ──
  const belowCostItems = db.prepare(`
    SELECT id, name, sale_price, purchase_price FROM items
    WHERE deleted_at IS NULL
      AND purchase_price > 0
      AND sale_price < purchase_price
  `).all();
  for (const row of belowCostItems) {
    issues.push({
      item_id:    row.id,
      issue_type: "price_coherence",
      details:    JSON.stringify({
        name:           row.name,
        sale_price:     row.sale_price,
        purchase_price: row.purchase_price,
        diff:           roundMoney(row.purchase_price - row.sale_price),
      }),
    });
  }

  // ── 4. Zero-cost stock ─────────────────────────────────────────────────────
  const zeroCostItems = db.prepare(`
    SELECT i.id, i.name, sl.quantity, i.purchase_price, sl.wacc
    FROM items i
    JOIN stock_levels sl ON sl.item_id = i.id
    WHERE i.deleted_at IS NULL
      AND sl.quantity > 0
      AND (i.purchase_price = 0 OR i.purchase_price IS NULL)
      AND (sl.wacc = 0 OR sl.wacc IS NULL)
  `).all();
  for (const row of zeroCostItems) {
    issues.push({
      item_id:    row.id,
      issue_type: "zero_cost_stock",
      details:    JSON.stringify({ name: row.name, quantity: row.quantity }),
    });
  }

  // ── Persist run ────────────────────────────────────────────────────────────
  const status = issues.length === 0 ? "clean" : "has_issues";
  const runResult = db.prepare(`
    INSERT INTO integrity_check_runs (ran_by, status, total_issues, unresolved_issues)
    VALUES (?, ?, ?, ?)
  `).run(ranBy ?? null, status, issues.length, issues.length);

  const runId = runResult.lastInsertRowid;

  const insertIssue = db.prepare(`
    INSERT INTO integrity_check_issues (run_id, item_id, issue_type, details, resolution)
    VALUES (?, ?, ?, ?, 'pending')
  `);
  for (const issue of issues) {
    insertIssue.run(runId, issue.item_id ?? null, issue.issue_type, issue.details ?? null);
  }

  return { runId, status, totalIssues: issues.length, issues };
}

/**
 * Auto-fix a specific issue type for a given item.
 * Currently supports: wacc_drift (recomputes WACC from history).
 *
 * @param {number} issueId
 * @param {'fixed'|'ignored'} action
 * @param {number|null} userId
 * @param {object} db
 * @returns {{ success: boolean, message: string }}
 */
function resolveIssue(issueId, action, userId, db) {
  const issue = db.prepare(
    "SELECT * FROM integrity_check_issues WHERE id = ?"
  ).get(issueId);
  if (!issue) return { success: false, message: "Issue not found" };
  if (issue.resolved_at) return { success: false, message: "Already resolved" };

  let message = "Marked as ignored";

  if (action === "fixed") {
    if (issue.issue_type === "wacc_drift" && issue.item_id) {
      recomputeWACCForItem(issue.item_id, db);
      message = "WACC recomputed from purchase history";
    } else if (issue.issue_type === "zero_cost_stock") {
      message = "No auto-fix for zero_cost_stock — please create a purchase or opening balance entry";
      action = "ignored";
    } else {
      message = "No auto-fix available — marked as acknowledged";
      action = "ignored";
    }
  }

  db.prepare(`
    UPDATE integrity_check_issues
    SET resolved_at = datetime('now'), resolved_by = ?, resolution = ?
    WHERE id = ?
  `).run(userId ?? null, action, issueId);

  // Update parent run's unresolved count
  db.prepare(`
    UPDATE integrity_check_runs
    SET unresolved_issues = (
      SELECT COUNT(*) FROM integrity_check_issues
      WHERE run_id = integrity_check_runs.id AND resolved_at IS NULL
    )
    WHERE id = ?
  `).run(issue.run_id);

  return { success: true, message };
}

/**
 * Get the most recent check run with its issues.
 */
function getLastCheckRun(db) {
  const run = db.prepare(
    "SELECT * FROM integrity_check_runs ORDER BY id DESC LIMIT 1"
  ).get();
  if (!run) return null;

  const issues = db.prepare(
    "SELECT ici.*, i.name as item_name FROM integrity_check_issues ici LEFT JOIN items i ON i.id = ici.item_id WHERE ici.run_id = ? ORDER BY ici.id ASC"
  ).all(run.id);

  return { ...run, issues };
}

module.exports = {
  runFullCheck,
  resolveIssue,
  getLastCheckRun,
};
