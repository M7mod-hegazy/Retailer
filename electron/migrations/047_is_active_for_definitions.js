function up(db) {
  // Add is_active column to definition tables that don't have it
  const tables = [
    { name: 'banks', default: 1 },
    { name: 'warehouses', default: 1 },
    { name: 'item_categories', default: 1 },
    { name: 'branches', default: 1 },
    { name: 'treasuries', default: 1 },
  ];

  for (const table of tables) {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
      const hasIsActive = columns.some(col => col.name === 'is_active');
      if (!hasIsActive) {
        db.exec(`ALTER TABLE ${table.name} ADD COLUMN is_active INTEGER DEFAULT ${table.default}`);
      }
    } catch (e) {
      // Table may not exist in older databases, skip
    }
  }
}

module.exports = { up };
