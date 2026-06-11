const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'server', 'data', 'retailer.db');
try {
  const db = new Database(dbPath);
  const info = db.prepare('PRAGMA table_info(revenues)').all();
  const fk = db.prepare('PRAGMA foreign_key_list(revenues)').all();
  console.log(JSON.stringify({ columns: info, foreignKeys: fk }));
  db.close();
} catch (e) {
  console.error(e.message);
}
