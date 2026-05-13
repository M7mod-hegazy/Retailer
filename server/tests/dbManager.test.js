const fs = require("fs");
const path = require("path");
const { openDatabase } = require("../../electron/dbManager");

describe("dbManager", () => {
  test("enables WAL and creates sqlite file", () => {
    const os = require("os");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-db-"));
    const dbPath = path.join(dir, "test.db");

    const db = openDatabase(dbPath);
    const mode = db.pragma("journal_mode", { simple: true });
    db.close();

    expect(fs.existsSync(dbPath)).toBe(true);
    expect(String(mode).toLowerCase()).toBe("wal");
  });
});
