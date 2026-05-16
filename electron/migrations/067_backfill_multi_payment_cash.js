module.exports = {
  version: 67,
  up: (db) => {
    // Find multi-payment invoices where the allocated amount is less than the invoice total.
    // The gap is the cash portion that was silently skipped due to method_id=null bug.
    const defaultTreasuryId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id || null;

    const invoices = db.prepare(`
      SELECT i.id, i.invoice_no, i.total, i.customer_id,
             COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id), 0) AS allocated
      FROM invoices i
      WHERE i.payment_type = 'multi'
        AND i.status != 'cancelled'
    `).all();

    for (const inv of invoices) {
      const missing = Math.round((inv.total - inv.allocated) * 1000) / 1000;
      if (missing <= 0.005) continue;

      const treasuryId = defaultTreasuryId;

      // Insert the missing cash payment
      const payment = db.prepare(`
        INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, bank_id, allocated_amount, unallocated_amount, invoice_id)
        VALUES ('customer', ?, ?, 'cash', ?, ?, NULL, ?, 0, ?)
      `).run(
        inv.customer_id || 0,
        missing,
        `Invoice ${inv.invoice_no} (backfill)`,
        treasuryId,
        missing,
        inv.id,
      );

      db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)")
        .run(payment.lastInsertRowid, inv.id, missing);

      // Update treasury balance
      if (treasuryId) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(missing, treasuryId);
      }
    }
  },
};
