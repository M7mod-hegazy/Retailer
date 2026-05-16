module.exports = {
  version: 69,
  up: (db) => {
    const systemMethods = new Set(['cash', 'credit', 'bank', 'bank_transfer', 'installments', 'multi']);

    // Find payments whose method is a category string, not a specific name
    const stalePayments = db.prepare(`
      SELECT p.id, p.method, p.treasury_id, p.bank_id
      FROM payments p
      WHERE p.method NOT IN ('cash','credit','bank','bank_transfer','installments','multi')
        AND (
          SELECT COUNT(*) FROM payment_methods pm
          WHERE pm.name = p.method
        ) = 0
    `).all();

    for (const p of stalePayments) {
      let match = null;

      if (p.bank_id) {
        // Try to find the payment_method whose target_id matches this bank_id
        const matches = db.prepare(`
          SELECT id, name FROM payment_methods
          WHERE target_id = ? AND type = 'bank'
        `).all(p.bank_id);
        if (matches.length === 1) match = matches[0].name;
      }

      if (!match && p.treasury_id) {
        const matches = db.prepare(`
          SELECT id, name FROM payment_methods
          WHERE target_id = ? AND type = 'cash'
        `).all(p.treasury_id);
        if (matches.length === 1) match = matches[0].name;
      }

      if (match) {
        db.prepare(`UPDATE payments SET method = ? WHERE id = ?`).run(match, p.id);
      }
    }
  },
};
