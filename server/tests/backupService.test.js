const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb, closeDb } = require("../src/config/database");
const {
  performBackup,
  computeBackupPreview,
  listBackups,
  restoreBackup,
  exportCheckpoint,
  emptyDatabase,
  resolveCurrentDbPath,
  OPERATIONAL_TABLES,
} = require("../src/services/backupService");
const { ensureSystemOwnerAccount } = require("../src/services/systemOwner.service");

describe("backup service", () => {
  let tempDir;
  let backupRoot;
  let uploadsBase;

  const uploadsDir = () => path.join(uploadsBase, "uploads");

  beforeEach(() => {
    setDb(null);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-backup-"));
    backupRoot = path.join(tempDir, "snapshots");
    uploadsBase = path.join(tempDir, "files");
    process.env.UPLOADS_DIR = uploadsBase;
    fs.mkdirSync(uploadsDir(), { recursive: true });

    initDb(path.join(tempDir, "runtime.db"));
    // Mirror production startup: seed the system owner (password "275757")
    // so owner-password verification has a real hash to compare against.
    ensureSystemOwnerAccount();
    getDb().prepare("UPDATE settings SET auto_backup_path = ? WHERE id = 1").run(backupRoot);
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
  });

  const writeImage = (name, content) => fs.writeFileSync(path.join(uploadsDir(), name), content);

  test("resolves current database path from active sqlite connection", () => {
    expect(resolveCurrentDbPath(getDb()).endsWith("runtime.db")).toBe(true);
  });

  test("performBackup writes a snapshot, sidecar, and dedup blobs", () => {
    writeImage("a.png", "AAA");
    const result = performBackup({ triggerType: "manual", label: "first" });

    expect(result.dbPath.startsWith(backupRoot)).toBe(true);
    expect(fs.existsSync(result.dbPath)).toBe(true);
    expect(fs.existsSync(result.sidecarPath)).toBe(true);

    const sidecar = JSON.parse(fs.readFileSync(result.sidecarPath, "utf8"));
    expect(sidecar.triggerType).toBe("manual");
    expect(sidecar.label).toBe("first");
    expect(sidecar.images.count).toBe(1);
    expect(sidecar.images.manifest[0].name).toBe("a.png");

    const blobsDir = path.join(backupRoot, "_blobs");
    const countBlobs = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
        const p = path.join(dir, e.name);
        return n + (e.isDirectory() ? countBlobs(p) : 1);
      }, 0);
    expect(countBlobs(blobsDir)).toBe(1);
  });

  test("identical image is stored once across multiple backups (dedup)", () => {
    writeImage("a.png", "SAME");
    performBackup({ triggerType: "manual" });
    performBackup({ triggerType: "manual" });

    const blobsDir = path.join(backupRoot, "_blobs");
    const countBlobs = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
        const p = path.join(dir, e.name);
        return n + (e.isDirectory() ? countBlobs(p) : 1);
      }, 0);
    expect(countBlobs(blobsDir)).toBe(1);
  });

  test("computeBackupPreview reports counts and writes nothing", () => {
    writeImage("a.png", "AAA");
    const before = fs.existsSync(backupRoot) ? fs.readdirSync(backupRoot).length : 0;
    const preview = computeBackupPreview();

    expect(preview.recordCounts).toBeDefined();
    expect(preview.images.total).toBe(1);
    expect(preview.images.newCount).toBe(1);
    expect(preview.estimatedSizeBytes).toBeGreaterThan(0);
    const after = fs.existsSync(backupRoot) ? fs.readdirSync(backupRoot).length : 0;
    expect(after).toBe(before); // nothing written
  });

  test("listBackups returns a Year -> Month -> Day tree", () => {
    performBackup({ triggerType: "manual", label: "x" });
    const tree = listBackups();
    expect(tree.years.length).toBeGreaterThan(0);
    const firstDay = tree.years[0].months[0].days[0];
    expect(firstDay.snapshots.length).toBeGreaterThan(0);
    expect(firstDay.latest).toBeDefined();
  });

  test("legacy bare .db backup is listed and flagged", () => {
    const now = new Date();
    const dir = path.join(
      backupRoot,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    );
    fs.mkdirSync(dir, { recursive: true });
    // Minimal valid sqlite header so isLikelySqliteFile-style listing still works.
    fs.writeFileSync(path.join(dir, "retailer-backup-legacy.db"), "SQLite format 3\0rest");

    const tree = listBackups();
    const snap = tree.years[0].months[0].days[0].snapshots.find((s) => s.fileName.includes("legacy"));
    expect(snap.legacy).toBe(true);
  });

  test("restore rebuilds uploads exactly from the manifest", () => {
    writeImage("a.png", "AAA");
    const snap = performBackup({ triggerType: "manual" });

    // Add an extra file that is NOT in the snapshot's manifest.
    writeImage("b.png", "BBB");
    expect(fs.existsSync(path.join(uploadsDir(), "b.png"))).toBe(true);

    const res = restoreBackup({ path: snap.dbPath });
    expect(res.restored).toBe(true);
    expect(res.legacy).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir(), "a.png"))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir(), "b.png"))).toBe(false); // pruned
  });

  test("restore rejects a path outside the backup root", () => {
    const outside = path.join(tempDir, "evil.db");
    fs.writeFileSync(outside, "SQLite format 3\0");
    expect(() => restoreBackup({ path: outside })).toThrow();
  });

  test("exportCheckpoint writes a portable zip", () => {
    writeImage("a.png", "AAA");
    const snap = performBackup({ triggerType: "manual" });
    const dest = path.join(tempDir, "export.zip");

    const res = exportCheckpoint({ path: snap.dbPath, destPath: dest });
    expect(res.exported).toBe(true);
    expect(fs.existsSync(dest)).toBe(true);
    expect(res.bytes).toBeGreaterThan(0);
  });

  test("OPERATIONAL_TABLES keeps master data, targets transactions", () => {
    for (const t of ["invoices", "payments", "stock_levels", "shifts"]) {
      expect(OPERATIONAL_TABLES).toContain(t);
    }
    for (const t of ["users", "settings", "items", "customers", "role_permissions"]) {
      expect(OPERATIONAL_TABLES).not.toContain(t);
    }
  });

  test("emptyDatabase rejects a wrong owner password without wiping", () => {
    getDb().prepare("INSERT INTO settings_kv (key, value) VALUES (?, ?)").run("marker", "1");
    expect(() => emptyDatabase({ mode: "keep-setup", ownerPassword: "wrong-pass" })).toThrow();
    const row = getDb().prepare("SELECT value FROM settings_kv WHERE key = 'marker'").get();
    expect(row?.value).toBe("1");
  });

  test("emptyDatabase keep-setup clears operational data but keeps setup", () => {
    const db = getDb();
    db.prepare("INSERT INTO settings_kv (key, value) VALUES (?, ?)").run("keepme", "yes");
    db.prepare("INSERT INTO audit_logs (user_id, action, resource) VALUES (?, ?, ?)").run(null, "x", "y");
    db.prepare("INSERT INTO audit_logs (user_id, action, resource) VALUES (?, ?, ?)").run(null, "x", "y");

    const res = emptyDatabase({ mode: "keep-setup", ownerPassword: "275757" });
    expect(res.emptied).toBe(true);
    expect(fs.existsSync(res.preEmptyBackup)).toBe(true);

    // setup survives
    expect(getDb().prepare("SELECT value FROM settings_kv WHERE key = 'keepme'").get()?.value).toBe("yes");
    expect(getDb().prepare("SELECT COUNT(*) c FROM settings").get().c).toBe(1);
    // operational wiped (the only audit_logs row left is the empty-action log itself)
    expect(getDb().prepare("SELECT COUNT(*) c FROM audit_logs").get().c).toBe(1);
  });

  test("keep-setup resets cached balances/stock but keeps setup + opening balances", () => {
    const db = getDb();
    db.prepare("INSERT INTO treasuries (name, balance) VALUES (?, ?)").run("Main", 500);
    db.prepare("INSERT INTO banks (name, balance) VALUES (?, ?)").run("NBE", 800);
    db.prepare(
      "INSERT INTO customers (name, opening_balance, total_spent, loyalty_points) VALUES (?, ?, ?, ?)",
    ).run("Cust", 100, 999, 50);
    const item = db.prepare("INSERT INTO items (name) VALUES (?)").run("Widget");
    db.prepare(
      "INSERT INTO item_batches (item_id, batch_no, expiry_date, quantity) VALUES (?, ?, ?, ?)",
    ).run(item.lastInsertRowid, "B1", "2030-01-01", 30);
    const itemsBefore = db.prepare("SELECT COUNT(*) c FROM items").get().c;

    emptyDatabase({ mode: "keep-setup", ownerPassword: "275757" });

    expect(getDb().prepare("SELECT balance FROM treasuries WHERE name='Main'").get().balance).toBe(0);
    expect(getDb().prepare("SELECT balance FROM banks WHERE name='NBE'").get().balance).toBe(0);
    const c = getDb()
      .prepare("SELECT opening_balance, total_spent, loyalty_points FROM customers WHERE name='Cust'")
      .get();
    expect(c.total_spent).toBe(0);
    expect(c.loyalty_points).toBe(0);
    expect(c.opening_balance).toBe(100); // setup preserved
    // master kept (catalog unchanged), transactional stock lots wiped
    expect(getDb().prepare("SELECT COUNT(*) c FROM items").get().c).toBe(itemsBefore);
    expect(getDb().prepare("SELECT COUNT(*) c FROM item_batches").get().c).toBe(0);
  });

  test("emptyDatabase factory-reset reseeds the system owner", () => {
    const res = emptyDatabase({ mode: "factory-reset", ownerPassword: "275757" });
    expect(res.emptied).toBe(true);
    expect(getDb().prepare("SELECT COUNT(*) c FROM users").get().c).toBeGreaterThanOrEqual(1);
  });
});
