const path = require("path");
const { openDatabase } = require("../../../electron/dbManager");

let dbInstance = null;
let dbPathRef = null;

function initDb(customPath) {
  if (!dbInstance) {
    const resolved =
      customPath || process.env.DB_PATH || path.join(process.cwd(), "data", "retailer.db");
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
  return dbPathRef || process.env.DB_PATH || path.join(process.cwd(), "data", "retailer.db");
}

function getDb() {
  if (!dbInstance) throw new Error("Database has not been initialized");
  return dbInstance;
}

module.exports = { initDb, setDb, getDb, closeDb, getDbPath };
