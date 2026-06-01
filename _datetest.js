const fs = require('fs');
let out = '';
try {
  require('./server/src/config/database.js').initDb('./server/data/retailer.db');
  const { listRows } = require('./server/src/reports/index.js');
  function n(slug, a, b) {
    try {
      const r = listRows(slug, a, b, {});
      const rows = Array.isArray(r) ? r : (r.rows || r.transactions || []);
      return Array.isArray(rows) ? rows.length : 'obj';
    } catch (e) { return 'ERR:' + e.message.slice(0, 50); }
  }
  const tests = ['detailed-sales','daily-sales','sales-by-item','detailed-purchases','customer-statement','cash-flow','detailed-expenses','top-customers','installment-collections','user-activity','margin-by-item','profit-by-period'];
  for (const s of tests) {
    out += s + ' | month=' + n(s,'2026-05-01','2026-05-31') + ' week=' + n(s,'2026-05-01','2026-05-07') + ' old=' + n(s,'2020-01-01','2020-01-02') + '\n';
  }
} catch (e) { out = 'TOPERR: ' + e.message + '\n' + e.stack; }
fs.writeFileSync('./_dateout.txt', out);
process.stdout.write(out);
