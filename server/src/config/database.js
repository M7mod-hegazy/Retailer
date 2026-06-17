const path = require("path");
const { openDatabase } = require("../../../electron/dbManager");
const { firstWritableDir } = require("./paths");

let dbInstance = null;
let dbPathRef = null;

// Resolve the SQLite path, guaranteeing a writable location. In the packaged app
// ensurePackagedEnv sets DB_PATH to %ProgramData%; the cwd fallback (dev/standalone)
// is routed through firstWritableDir so it can never land in a read-only install dir
// (which would EPERM on mkdir and take the whole server down → disconnect overlay).
function resolveDbPath(customPath) {
  if (customPath) return customPath;
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const dir = firstWritableDir([path.join(process.cwd(), "data")], "db");
  return path.join(dir, "retailer.db");
}

function initDb(customPath) {
  if (!dbInstance) {
    const resolved = resolveDbPath(customPath);
    dbPathRef = resolved;
    dbInstance = openDatabase(resolved);
  }
  return dbInstance;
}

function setDb(db) {
  dbInstance = db;
}

function closeDb() {
  if (dbInstance?.close) {
    dbInstance.close();
  }
  dbInstance = null;
}

function getDbPath() {
  return dbPathRef || resolveDbPath();
}

function getDb() {
  if (!dbInstance) throw new Error("Database has not been initialized");
  return dbInstance;
}

module.exports = { initDb, setDb, getDb, closeDb, getDbPath };
