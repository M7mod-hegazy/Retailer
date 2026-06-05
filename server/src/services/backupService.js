const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const AdmZip = require("adm-zip");
const { getDb, getDbPath, closeDb, initDb } = require("../config/database");
const { getUploadsDir } = require("../middleware/upload");
const { ensureSystemOwnerAccount } = require("./systemOwner.service");

const SIDECAR_SCHEMA_VERSION = 1;
const BLOBS_DIRNAME = "_blobs";

// Tables counted in the pre-backup preview (existence-guarded at runtime).
const COUNT_TABLES = [
  "items", "customers", "suppliers", "invoices", "invoice_lines",
  "purchases", "purchase_orders", "payments", "shifts", "stock_movements",
  "expenses", "revenues", "quotations",
];

// Operational/transactional tables wiped by "keep-setup" empty. Hardcoded and
// reviewed against the schema — never auto-derived — so master data is safe.
const OPERATIONAL_TABLES = [
  "invoices", "invoice_lines",
  "sales_returns", "sales_return_lines", "sales_return_lines_new",
  "payments", "payment_allocations",
  "purchases", "purchase_lines",
  "purchase_orders", "purchase_order_lines", "purchase_payments",
  "purchase_returns", "purchase_return_lines",
  "quotations", "quotation_lines",
  "shifts", "shift_transactions",
  "daily_sessions", "daily_withdrawals", "withdrawals",
  "expenses", "revenues",
  "stock_movements", "stock_adjustments", "stock_levels", "item_batches", "cost_movements", "price_history",
  "branch_transfers", "branch_transfer_lines",
  "physical_count_sessions", "physical_count_lines",
  "loyalty_transactions", "cheques", "installments",
  "ajal_debts", "ajal_payments", "ajal_schedules",
  "bank_transactions", "notifications",
  "owner_statements", "owner_statement_rows", "owner_statement_values",
  "pos_drafts", "import_batches", "import_batch_items",
  "customer_notes", "supplier_notes", "employee_adjustments",
  "integrity_check_runs", "integrity_check_issues", "audit_logs",
  "document_sequences",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveCurrentDbPath(db) {
  const row = db.prepare("PRAGMA database_list").all().find((entry) => entry.name === "main");
  if (!row?.file) {
    throw new Error("Unable to resolve database path");
  }
  return row.file;
}

function isLikelySqliteFile(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 16).toString("utf8");
  return header === "SQLite format 3\0";
}

// Treat blank, "null" and "undefined" (string artifacts from older saves) as
// "not configured" so backups never land in a folder literally named null.
function sanitizePath(value) {
  const v = String(value ?? "").trim();
  return v && v !== "null" && v !== "undefined" ? v : "";
}

function resolveBackupRoot(db) {
  const settings = db.prepare("SELECT auto_backup_path FROM settings WHERE id = 1").get();
  const configuredDir = sanitizePath(settings?.auto_backup_path);
  return configuredDir || path.join(process.cwd(), "backups");
}

function readAppVersion() {
  try {
    const pkg = require(path.join(process.cwd(), "package.json"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

function tableExists(db, name) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name),
  );
}

function listExistingTables(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
}

// Recursively list every file under uploadsDir, with paths relative to it
// (forward-slash normalised). Returns [] if the folder does not exist.
function walkUploads(uploadsDir) {
  const out = [];
  if (!fs.existsSync(uploadsDir)) return out;
  const walk = (absDir, relDir) => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const abs = path.join(absDir, entry.name);
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        out.push({ abs, rel, size: fs.statSync(abs).size });
      }
    }
  };
  walk(uploadsDir, "");
  return out;
}

function sha256File(absPath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(absPath));
  return hash.digest("hex");
}

// Shared content-addressed location for an image: <root>/_blobs/<aa>/<hash><ext>
function blobAbsPath(root, hash, ext) {
  return path.join(root, BLOBS_DIRNAME, hash.slice(0, 2), `${hash}${ext || ""}`);
}

// Verify the owner password against the system owner's CURRENT hash in the DB
// (same credential as owner login, so password rotation propagates). Falls back
// to the SYSTEM_OWNER_PASSWORD_HASH env var, and fails closed if neither exists.
function verifyOwnerPassword(db, plain) {
  if (!plain) return false;
  let hash = null;
  try {
    const row = db
      .prepare("SELECT password_hash FROM users WHERE is_system_account = 1 ORDER BY id LIMIT 1")
      .get();
    hash = row?.password_hash || null;
  } catch {
    /* users table may be missing/unusual — fall through to env */
  }
  if (!hash) hash = process.env.SYSTEM_OWNER_PASSWORD_HASH || null;
  if (!hash) return false; // no credential configured → deny
  return bcrypt.compareSync(String(plain), hash);
}

function getRecordCounts(db) {
  const counts = {};
  for (const table of COUNT_TABLES) {
    if (!tableExists(db, table)) continue;
    try {
      counts[table] = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
    } catch {
      counts[table] = 0;
    }
  }
  return counts;
}

function sidecarPathFor(dbFilePath) {
  return dbFilePath.replace(/\.db$/i, ".json");
}

// Guard: ensure a resolved path lives inside the backup root (anti path-traversal).
function assertInsideRoot(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  const rel = path.relative(resolvedRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    const err = new Error("مسار غير صالح خارج مجلد النسخ الاحتياطي");
    err.status = 400;
    throw err;
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Preview (dry run — writes nothing)
// ---------------------------------------------------------------------------

function computeBackupPreview() {
  const db = getDb();
  const dbPath = resolveCurrentDbPath(db);
  const root = resolveBackupRoot(db);
  const uploadsDir = getUploadsDir();

  const dbSizeBytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

  let newCount = 0;
  let newBytes = 0;
  let reusedCount = 0;
  let reusedBytes = 0;
  let totalBytes = 0;

  for (const file of walkUploads(uploadsDir)) {
    totalBytes += file.size;
    const ext = path.extname(file.rel);
    const hash = sha256File(file.abs);
    if (fs.existsSync(blobAbsPath(root, hash, ext))) {
      reusedCount += 1;
      reusedBytes += file.size;
    } else {
      newCount += 1;
      newBytes += file.size;
    }
  }

  const now = new Date();
  const targetDir = path.join(
    root,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  );

  return {
    recordCounts: getRecordCounts(db),
    db: { sizeBytes: dbSizeBytes },
    images: {
      total: newCount + reusedCount,
      totalSizeBytes: totalBytes,
      newCount,
      newSizeBytes: newBytes,
      reusedCount,
      reusedSizeBytes: reusedBytes,
    },
    estimatedSizeBytes: dbSizeBytes + newBytes,
    targetDir,
    appVersion: readAppVersion(),
  };
}

// ---------------------------------------------------------------------------
// Create a backup (DB snapshot + dedup blobs + sidecar manifest)
// ---------------------------------------------------------------------------

function performBackup(options = {}) {
  const { triggerType = "manual", label = null } = options;
  const db = getDb();
  const dbPath = resolveCurrentDbPath(db);
  const root = resolveBackupRoot(db);
  const uploadsDir = getUploadsDir();

  const now = new Date();
  const dayDir = path.join(
    root,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  );
  fs.mkdirSync(dayDir, { recursive: true });

  // 1. Snapshot the database (checkpoint WAL into the main file first).
  db.pragma("wal_checkpoint(TRUNCATE)");
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const destDb = path.join(dayDir, `retailer-backup-${timestamp}.db`);
  fs.copyFileSync(dbPath, destDb);

  // 2. Dedup-copy every upload into the shared blob pool, build the manifest.
  const manifest = [];
  let imagesTotalBytes = 0;
  for (const file of walkUploads(uploadsDir)) {
    const ext = path.extname(file.rel);
    const hash = sha256File(file.abs);
    const blobPath = blobAbsPath(root, hash, ext);
    if (!fs.existsSync(blobPath)) {
      fs.mkdirSync(path.dirname(blobPath), { recursive: true });
      fs.copyFileSync(file.abs, blobPath);
    }
    manifest.push({ name: file.rel, hash, ext, sizeBytes: file.size });
    imagesTotalBytes += file.size;
  }

  // 3. Write the sidecar LAST — it is the commit marker for a complete backup.
  const sidecar = {
    schemaVersion: SIDECAR_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    triggerType,
    label: label || null,
    appVersion: readAppVersion(),
    db: { fileName: path.basename(destDb), sizeBytes: fs.statSync(destDb).size },
    recordCounts: getRecordCounts(db),
    images: { count: manifest.length, totalSizeBytes: imagesTotalBytes, manifest },
    keepForever: false,
  };
  const sidecarPath = sidecarPathFor(destDb);
  fs.writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2), "utf8");

  return { dbPath: destDb, sidecarPath, summary: sidecar };
}

// ---------------------------------------------------------------------------
// List backups as a Year -> Month -> Day tree
// ---------------------------------------------------------------------------

function readSidecarSafe(sidecarPath) {
  try {
    return JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
  } catch {
    return null;
  }
}

function buildSnapshotEntry(dbFilePath) {
  const sidecarPath = sidecarPathFor(dbFilePath);
  const stat = fs.statSync(dbFilePath);
  const sidecar = fs.existsSync(sidecarPath) ? readSidecarSafe(sidecarPath) : null;

  if (!sidecar) {
    // Legacy bare .db backup (no sidecar/manifest) — images not captured.
    return {
      path: dbFilePath,
      fileName: path.basename(dbFilePath),
      createdAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
      triggerType: "legacy",
      label: null,
      recordCounts: null,
      imageCount: null,
      legacy: true,
    };
  }

  return {
    path: dbFilePath,
    fileName: path.basename(dbFilePath),
    createdAt: sidecar.createdAt,
    sizeBytes: sidecar.db?.sizeBytes ?? stat.size,
    triggerType: sidecar.triggerType || "manual",
    label: sidecar.label || null,
    recordCounts: sidecar.recordCounts || null,
    imageCount: sidecar.images?.count ?? 0,
    appVersion: sidecar.appVersion || null,
    legacy: false,
  };
}

function listBackups() {
  const db = getDb();
  const root = resolveBackupRoot(db);
  if (!fs.existsSync(root)) return { root, years: [] };

  const isYear = (n) => /^\d{4}$/.test(n);
  const isDayMonth = (n) => /^\d{2}$/.test(n);
  const sortDesc = (a, b) => Number(b) - Number(a);

  const years = [];
  for (const year of fs.readdirSync(root).filter(isYear).sort(sortDesc)) {
    const yearDir = path.join(root, year);
    if (!fs.statSync(yearDir).isDirectory()) continue;
    const months = [];
    for (const month of fs.readdirSync(yearDir).filter(isDayMonth).sort(sortDesc)) {
      const monthDir = path.join(yearDir, month);
      if (!fs.statSync(monthDir).isDirectory()) continue;
      const days = [];
      for (const day of fs.readdirSync(monthDir).filter(isDayMonth).sort(sortDesc)) {
        const dayDir = path.join(monthDir, day);
        if (!fs.statSync(dayDir).isDirectory()) continue;
        const snapshots = fs
          .readdirSync(dayDir)
          .filter((f) => f.toLowerCase().endsWith(".db"))
          .map((f) => buildSnapshotEntry(path.join(dayDir, f)))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (snapshots.length === 0) continue;
        days.push({ day, snapshots, latest: snapshots[0] });
      }
      if (days.length) months.push({ month, days });
    }
    if (months.length) years.push({ year, months });
  }

  return { root, years };
}

// ---------------------------------------------------------------------------
// Restore from a checkpoint (by server-side path)
// ---------------------------------------------------------------------------

function rebuildUploadsFromManifest(root, manifest) {
  const uploadsDir = getUploadsDir();
  const safeUploadsDir = path.resolve(uploadsDir);
  const expected = new Set(manifest.map((m) => m.name));

  // Materialize each manifest blob into uploads/.
  for (const entry of manifest) {
    const blob = blobAbsPath(root, entry.hash, entry.ext);
    if (!fs.existsSync(blob)) continue; // missing blob — skip rather than crash
    // Defense in depth: never let a manifest entry name escape uploads/.
    const target = path.resolve(safeUploadsDir, entry.name);
    const rel = path.relative(safeUploadsDir, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(blob, target);
  }

  // Remove any current upload not part of this checkpoint (exact restore).
  for (const file of walkUploads(uploadsDir)) {
    if (!expected.has(file.rel)) {
      fs.unlinkSync(file.abs);
    }
  }
}

function restoreBackup(options = {}) {
  const { path: snapshotPath } = options;
  if (!snapshotPath) {
    const err = new Error("لم يتم تحديد نسخة احتياطية");
    err.status = 400;
    throw err;
  }

  const db = getDb();
  const root = resolveBackupRoot(db);
  const resolved = assertInsideRoot(root, snapshotPath);

  if (!resolved.toLowerCase().endsWith(".db") || !fs.existsSync(resolved)) {
    const err = new Error("ملف النسخة الاحتياطية غير موجود");
    err.status = 400;
    throw err;
  }
  if (!isLikelySqliteFile(resolved)) {
    const err = new Error("ملف النسخة الاحتياطية غير صالح");
    err.status = 400;
    throw err;
  }

  const sidecar = readSidecarSafe(sidecarPathFor(resolved));
  const manifest = sidecar?.images?.manifest || null;

  // Safety net before overwriting the live database.
  const rollback = performBackup({ triggerType: "pre-restore", label: "auto safety before restore" });

  const dbPath = getDbPath();
  const staged = `${dbPath}.restore-staged`;
  fs.copyFileSync(resolved, staged);

  closeDb();
  try {
    fs.copyFileSync(staged, dbPath);
    if (manifest) rebuildUploadsFromManifest(root, manifest);
    initDb(dbPath);
    if (fs.existsSync(staged)) fs.unlinkSync(staged);
  } catch (restoreError) {
    try {
      fs.copyFileSync(rollback.dbPath, dbPath);
      initDb(dbPath);
    } catch {
      /* best-effort rollback */
    }
    if (fs.existsSync(staged)) fs.unlinkSync(staged);
    throw restoreError;
  }

  return {
    restored: true,
    legacy: !manifest,
    imagesRestored: manifest ? manifest.length : 0,
    rollbackBackup: rollback.dbPath,
  };
}

// ---------------------------------------------------------------------------
// Export a self-contained portable .zip for one checkpoint
// ---------------------------------------------------------------------------

function exportCheckpoint(options = {}) {
  const { path: snapshotPath, destPath } = options;
  if (!snapshotPath || !destPath) {
    const err = new Error("بيانات التصدير غير مكتملة");
    err.status = 400;
    throw err;
  }

  const db = getDb();
  const root = resolveBackupRoot(db);
  const resolved = assertInsideRoot(root, snapshotPath);
  if (!resolved.toLowerCase().endsWith(".db") || !fs.existsSync(resolved)) {
    const err = new Error("ملف النسخة الاحتياطية غير موجود");
    err.status = 400;
    throw err;
  }

  const liveDb = path.resolve(getDbPath());
  if (path.resolve(destPath) === liveDb) {
    const err = new Error("لا يمكن التصدير فوق قاعدة البيانات الحالية");
    err.status = 400;
    throw err;
  }

  const sidecar = readSidecarSafe(sidecarPathFor(resolved));
  const manifest = sidecar?.images?.manifest || [];

  const zip = new AdmZip();
  zip.addLocalFile(resolved, "", "retailer.db");
  for (const entry of manifest) {
    const blob = blobAbsPath(root, entry.hash, entry.ext);
    if (fs.existsSync(blob)) {
      zip.addFile(`uploads/${entry.name}`, fs.readFileSync(blob));
    }
  }
  zip.addFile(
    "info.json",
    Buffer.from(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          source: path.basename(resolved),
          appVersion: sidecar?.appVersion || readAppVersion(),
          recordCounts: sidecar?.recordCounts || null,
          imageCount: manifest.length,
        },
        null,
        2,
      ),
      "utf8",
    ),
  );

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  zip.writeZip(destPath);

  return { exported: true, destPath, bytes: fs.statSync(destPath).size, imageCount: manifest.length };
}

// ---------------------------------------------------------------------------
// Empty the database (keep-setup or factory-reset)
// ---------------------------------------------------------------------------

// Reset cached/derived columns on KEEP tables after a keep-setup wipe, so the
// surviving master rows match the now-empty transaction history. Opening
// balances and credit limits are intentional setup and are left untouched.
function resetDerivedBalances(db, existing) {
  const colExists = (table, col) => {
    if (!existing.has(table)) return false;
    try {
      return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
    } catch {
      return false;
    }
  };
  const resetCol = (table, col, value = 0) => {
    if (colExists(table, col)) db.prepare(`UPDATE ${table} SET ${col} = ?`).run(value);
  };

  resetCol("treasuries", "balance");
  resetCol("banks", "balance");
  resetCol("customers", "total_spent");
  resetCol("customers", "loyalty_points");
}

function emptyDatabase(options = {}) {
  const { mode, ownerPassword } = options;
  if (!["keep-setup", "factory-reset"].includes(mode)) {
    const err = new Error("نوع التفريغ غير صالح");
    err.status = 400;
    throw err;
  }
  if (!verifyOwnerPassword(getDb(), ownerPassword)) {
    const err = new Error("كلمة مرور المالك غير صحيحة");
    err.status = 403;
    throw err;
  }

  // Forced, non-skippable safety backup first.
  const preEmpty = performBackup({ triggerType: "pre-empty", label: `before empty (${mode})` });

  const db = getDb();
  const existing = new Set(listExistingTables(db));

  const targets =
    mode === "keep-setup"
      ? OPERATIONAL_TABLES.filter((t) => existing.has(t))
      : [...existing].filter((t) => t !== "_migrations");

  const fkPrev = db.pragma("foreign_keys", { simple: true });
  db.pragma("foreign_keys = OFF");
  try {
    const wipe = db.transaction(() => {
      for (const table of targets) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
      // keep-setup: master rows stay, but reset cached values that are derived
      // from the wiped transactions, otherwise the kept rows go inconsistent.
      if (mode === "keep-setup") {
        resetDerivedBalances(db, existing);
      }
    });
    wipe();
  } finally {
    db.pragma(`foreign_keys = ${fkPrev ? "ON" : "OFF"}`);
  }

  if (mode === "factory-reset") {
    // Reseed the minimum a blank install needs.
    ensureSystemOwnerAccount();
    try {
      db.prepare("INSERT OR IGNORE INTO settings (id) VALUES (1)").run();
    } catch {
      /* settings shape varies — non-fatal */
    }
  }

  db.exec("VACUUM");

  try {
    db.prepare(
      "INSERT INTO audit_logs (user_id, action, resource, payload_json) VALUES (?, ?, ?, ?)",
    ).run(null, "database_emptied", "backup", JSON.stringify({ mode }));
  } catch {
    /* audit_logs may have been wiped in factory-reset — non-fatal */
  }

  return { emptied: true, mode, preEmptyBackup: preEmpty.dbPath, clearedTables: targets.length };
}

module.exports = {
  performBackup,
  computeBackupPreview,
  listBackups,
  restoreBackup,
  exportCheckpoint,
  emptyDatabase,
  resolveCurrentDbPath,
  resolveBackupRoot,
  isLikelySqliteFile,
  sanitizePath,
  OPERATIONAL_TABLES,
};
