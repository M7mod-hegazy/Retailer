module.exports = {
  version: 68,
  up: (db) => {
    // Payments for multi invoices may have stored a category (e.g. 'digital_wallet')
    // instead of the actual method name (e.g. 'InstaPay').
    // Fix: where exactly one payment_method has that category, update to use its name.
    const systemMethods = new Set(['cash', 'credit', 'bank', 'bank_transfer', 'installments', 'multi']);

    const candidates = db.prepare(`
      SELECT DISTINCT p.method
      FROM payments p
      WHERE p.method NOT IN ('cash','credit','bank','bank_transfer','installments','multi')
    `).all();

    for (const { method } of candidates) {
      if (systemMethods.has(method)) continue;

      // Find payment_methods matching this category (or type or name)
      const matches = db.prepare(`
        SELECT id, name FROM payment_methods
        WHERE category = ? OR type = ? OR name = ?
      `).all(method, method, method);

      // Only update when unambiguous (exactly one match)
      if (matches.length !== 1) continue;

      const correctName = matches[0].name;
      if (correctName === method) continue;

      db.prepare(`UPDATE payments SET method = ? WHERE method = ?`).run(correctName, method);
    }
  },
};
