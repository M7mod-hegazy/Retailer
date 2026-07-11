const Database = require('better-sqlite3');
const db = new Database('D:/code/retailer/server/data/retailer.db', { fileMustExist: true });
const rows = db.prepare('SELECT name, applied_at FROM _migrations ORDER BY id').all();
console.log('Total migrations applied:', rows.length);
rows.forEach(r => console.log(r.id, '|', r.applied_at));
db.close();
