const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = path.join(process.cwd(), 'server', 'data', 'retailer.db');

try {
  const db = new Database(dbPath);

  // Check FK before
  console.log('=== BEFORE ===');
  const fkBefore = db.prepare('PRAGMA foreign_key_list(revenues)').all();
  fkBefore.forEach(f => console.log('FK: table=' + f.table + ' from=' + f.from + ' to=' + f.to));

  // Run migration 119
  const migration = require('./electron/migrations/119_fix_revenues_category_fk');
  migration.up(db);
  console.log('Migration 119 applied successfully');

  // Check FK after
  console.log('=== AFTER ===');
  const fkAfter = db.prepare('PRAGMA foreign_key_list(revenues)').all();
  fkAfter.forEach(f => console.log('FK: table=' + f.table + ' from=' + f.from + ' to=' + f.to));

  db.close();
  console.log('---TEST PASSED---');
} catch(e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
