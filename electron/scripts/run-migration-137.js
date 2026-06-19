const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.resolve(__dirname, "../../server/data/retailer.db");
try {
  const db = new Database(dbPath);
  const { up } = require("../migrations/137_fix_branch_transfers_columns.js");
  up(db);
  const cols = db.prepare("PRAGMA table_info(branch_transfers)").all().map(c => c.name);
  process.stdout.write("Migration OK. Columns: " + cols.join(", ") + "\n");
  db.close();
  process.exit(0);
} catch (e) {
  process.stderr.write("Migration FAILED: " + e.message + "\n");
  process.exit(1);
}
