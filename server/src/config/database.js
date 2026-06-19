const fs = require("fs");
const path = require("path");
const { openDatabase } = require("../../../electron/dbManager");
const { firstWritableDir } = require("./paths");

let dbInstance = null;
let dbPathRef = null;

function resolveDbPath(customPath) {
  if (customPath) return customPath;
  if (process.env.DB_PATH) {
    try {
      fs.mkdirSync(path.dirname(process.env.DB_PATH), { recursive: true });
      fs.accessSync(path.dirname(process.env.DB_PATH), fs.constants.W_OK);
      return process.env.DB_PATH;
    } catch (_e) {
      // env path not writable (e.g. ProgramData on Win7) — fall through
    }
  }
  const candidates = [
    process.env.RETAILER_DATA_DIR && path.join(process.env.RETAILER_DATA_DIR, "data"),
    path.join(process.cwd(), "data"),
    process.env.APPDATA && path.join(process.env.APPDATA, "ElHegaziRetailer", "data"),
  ];
  const dir = firstWritableDir(candidates, "db");
  const resolved = path.join(dir, "retailer.db");
  process.env.DB_PATH = resolved;
  return resolved;
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
