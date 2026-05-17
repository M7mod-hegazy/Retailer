module.exports = {
  version: 70,
  up: (db) => {
    // Ensure required columns exist (064 may have failed silently)
    try { db.exec("ALTER TABLE purchases ADD COLUMN payment_method TEXT DEFAULT 'cash'"); } catch (_) {}
    try { db.exec("ALTER TABLE invoices ADD COLUMN amount_received REAL"); } catch (_) {}

    // ── 1. Backfill invoice multi credit → ajal_debts ──
    const invoiceMulti = db.prepare(`
      SELECT i.id, i.invoice_no, i.customer_id, i.total
      FROM invoices i
      WHERE i.payment_type = 'multi'
        AND i.status != 'cancelled'
        AND i.customer_id IS NOT NULL
        AND (
          SELECT COALESCE(SUM(pa.amount), 0) FROM payment_allocations pa
          JOIN payments p ON p.id = pa.payment_id
          WHERE pa.invoice_id = i.id AND p.method = 'credit'
        ) > 0
        AND NOT EXISTS (
          SELECT 1 FROM ajal_debts WHERE invoice_id = i.id AND source_type = 'invoice' AND status != 'voided'
        )
    `).all();

    for (const inv of invoiceMulti) {
      const creditSum = db.prepare(`
        SELECT COALESCE(SUM(pa.amount), 0) AS total_credit
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id
        WHERE pa.invoice_id = ? AND p.method = 'credit'
      `).get(inv.id).total_credit;

      if (creditSum <= 0) continue;

      const currentReceived = db.prepare("SELECT COALESCE(amount_received, 0) AS ar FROM invoices WHERE id = ?").get(inv.id).ar;
      const actualReceived = Math.max(0, currentReceived - creditSum);

      db.prepare("UPDATE invoices SET amount_received = ?, status = ? WHERE id = ?")
        .run(actualReceived, actualReceived > 0 ? "partial" : "unpaid", inv.id);

      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?")
        .run(creditSum, inv.customer_id);

      db.prepare(`
        INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
        VALUES (?, ?, 'customer', 'invoice', ?, 0, NULL, 'open', 'تصحيح: جزء آجل من دفعة متعددة')
      `).run(inv.id, inv.customer_id, creditSum);
    }

    // ── 2. Backfill purchase multi credit → ajal_debts ──
    const purchaseMulti = db.prepare(`
      SELECT DISTINCT p.id, p.supplier_id, p.total
      FROM purchases p
      WHERE p.payment_method = 'multi'
        AND p.status NOT IN ('cancelled', 'voided')
        AND p.supplier_id IS NOT NULL
        AND (
          SELECT COALESCE(SUM(pp.amount), 0) FROM purchase_payments pp
          JOIN payment_methods pm ON pm.id = pp.method_id
          WHERE pp.purchase_id = p.id AND pm.type = 'credit'
        ) > 0
        AND NOT EXISTS (
          SELECT 1 FROM ajal_debts WHERE invoice_id = p.id AND source_type = 'purchase' AND status != 'voided'
        )
    `).all();

    for (const purch of purchaseMulti) {
      const creditSum = db.prepare(`
        SELECT COALESCE(SUM(pp.amount), 0) AS total_credit
        FROM purchase_payments pp
        JOIN payment_methods pm ON pm.id = pp.method_id
        WHERE pp.purchase_id = ? AND pm.type = 'credit'
      `).get(purch.id).total_credit;

      if (creditSum <= 0) continue;

      db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?")
        .run(creditSum, purch.supplier_id);

      db.prepare(`
        INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
        VALUES (?, ?, 'supplier', 'purchase', ?, 0, NULL, 'open', 'تصحيح: جزء آجل من دفعة متعددة')
      `).run(purch.id, purch.supplier_id, creditSum);
    }
  },
};
