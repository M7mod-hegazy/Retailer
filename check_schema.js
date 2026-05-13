const Database = require('better-sqlite3');
const db = new Database('./server/data/retailer.db');
const sm = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_movements'").get();
const sl = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_levels'").get();
console.log('stock_movements:', sm?.sql);
console.log('stock_levels:', sl?.sql);
db.close();
