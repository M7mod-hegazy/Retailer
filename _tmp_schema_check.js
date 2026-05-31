const db = require('better-sqlite3')('server/data/retailer.db');
console.log('purchases:', db.prepare('PRAGMA table_info(purchases)').all().map(c => c.name).join(', '));
const has = db.prepare('PRAGMA table_info(purchases)').all().map(c => c.name);
console.log('has payment_method:', has.includes('payment_method'), '| has payment_type:', has.includes('payment_type'));
