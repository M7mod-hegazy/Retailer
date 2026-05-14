const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { performBackup, resolveCurrentDbPath } = require("../src/services/backupService");

describe("backup service", () => {
  let tempDir;

  beforeEach(() => {
    setDb(null);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-backup-"));
    initDb(path.join(tempDir, "runtime.db"));
  });

  test("resolves current database path from active sqlite connection", () => {
    const db = getDb();
    const currentPath = resolveCurrentDbPath(db);
    expect(currentPath.endsWith("runtime.db")).toBe(true);
  });

  test("creates backup in configured backup directory", () => {
    const db = getDb();
    const backupDir = path.join(tempDir, "snapshots");
    db.prepare("UPDATE settings SET auto_backup_path = ? WHERE id = 1").run(backupDir);

    const backupPath = performBackup();
    expect(backupPath.startsWith(backupDir)).toBe(true);
    expect(fs.existsSync(backupPath)).toBe(true);
  });
});
