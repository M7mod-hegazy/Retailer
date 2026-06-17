const fs = require("fs");
const os = require("os");
const path = require("path");
let Database;
try {
  Database = require("better-sqlite3");
} catch (error) {
  throw new Error(
    `Failed to load better-sqlite3. Run "npm run electron:rebuild" and try again. ${error.message}`,
  );
}

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function applyPragmas(db) {
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -20000");
  db.pragma("mmap_size = 134217728");
}

function runMigrations(db) {
  ensureMigrationsTable(db);
  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_.*\.js$/.test(name))
    .sort();

  for (const file of files) {
    const id = file.replace(/\.js$/, "");
    const exists = db.prepare("SELECT 1 FROM _migrations WHERE id = ?").get(id);
    if (exists) continue;

    const migrationPath = path.join(MIGRATIONS_DIR, file);
    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);
    if (typeof migration.up !== "function") {
      throw new Error(`Migration ${file} does not export up(db)`);
    }

    const tx = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO _migrations (id) VALUES (?)").run(id);
    });

    tx();
  }
}

// Default path never resolves to process.cwd() (= read-only install dir in the
// packaged app → EPERM). Callers normally pass an explicit, already-writable path;
// the env var + temp fallback only guard a bare openDatabase() call.
function openDatabase(
  dbPath = process.env.DB_PATH || path.join(os.tmpdir(), "ElHegaziRetailer-db", "retailer.db"),
) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  applyPragmas(db);
  runMigrations(db);
  try { db.pragma("optimize"); } catch (_) {}
  return db;
}

module.exports = {
  openDatabase,
  runMigrations,
};
