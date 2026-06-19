/**
 * Serial/IMEI validation helpers.
 * All functions are synchronous (better-sqlite3 API).
 * Guards are only active when feature_serials = 1 in settings.
 */

function isFeatureOn(db) {
  try { return Boolean(db.prepare("SELECT feature_serials FROM settings WHERE id = 1").get()?.feature_serials); } catch { return false; }
}

function isStrictMode(db) {
  try { return Boolean(db.prepare("SELECT serials_strict_mode FROM settings WHERE id = 1").get()?.serials_strict_mode ?? 1); } catch { return true; }
}

function tableExists(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='item_serials'").get() !== undefined;
}

/**
 * Validate and mark serials as sold inside an existing transaction.
 * Call this for each line that has track_serials=1.
 * @param {object} db - better-sqlite3 database instance
 * @param {object} line - { item_id, quantity, serials: string[] }
 * @param {number} invoiceId
 * @param {number} invoiceLineId
 * @returns {{ warnings: string[] }} (empty in strict mode — throws instead)
 */
function validateAndSellSerials(db, line, invoiceId, invoiceLineId) {
  if (!isFeatureOn(db) || !tableExists(db)) return { warnings: [] };
  const item = db.prepare("SELECT track_serials FROM items WHERE id = ?").get(line.item_id);
  if (!item?.track_serials) return { warnings: [] };

  const strict = isStrictMode(db);
  const serials = Array.isArray(line.serials) ? line.serials.map(s => String(s).trim()).filter(Boolean) : [];
  const qty = Number(line.quantity);
  const warnings = [];

  if (strict && serials.length !== qty) {
    const err = new Error(`يجب مسح ${qty} سيريال للصنف (تم تقديم ${serials.length})`);
    err.status = 400;
    throw err;
  }

  if (serials.length !== new Set(serials).size) {
    const err = new Error("أرقام السيريال متكررة في السطر الواحد");
    err.status = 400;
    throw err;
  }

  for (const serial of serials) {
    const row = db.prepare("SELECT id, status FROM item_serials WHERE item_id = ? AND serial = ?").get(line.item_id, serial);
    if (!row) {
      if (strict) {
        const err = new Error(`السيريال ${serial} غير موجود في المخزون`);
        err.status = 400;
        throw err;
      }
      warnings.push(`السيريال ${serial} غير موجود — تم تسجيله كبيع دون مخزون`);
      db.prepare("INSERT OR IGNORE INTO item_serials (item_id, serial, status, invoice_id, invoice_line_id, sold_at) VALUES (?, ?, 'sold', ?, ?, datetime('now', 'localtime'))").run(line.item_id, serial, invoiceId, invoiceLineId);
      continue;
    }
    if (row.status !== "in_stock") {
      const err = new Error(`السيريال ${serial} ليس متاحاً للبيع (الحالة: ${row.status})`);
      err.status = 400;
      throw err;
    }
    const warranty = db.prepare("SELECT default_warranty_months FROM items WHERE id = ?").get(line.item_id)?.default_warranty_months || null;
    db.prepare("UPDATE item_serials SET status='sold', invoice_id=?, invoice_line_id=?, sold_at=datetime('now', 'localtime'), warranty_months=? WHERE id=?").run(invoiceId, invoiceLineId, warranty, row.id);
  }
  return { warnings };
}

/**
 * Validate and return serials to in_stock inside an existing transaction.
 */
function validateAndReturnSerials(db, line, invoiceId) {
  if (!isFeatureOn(db) || !tableExists(db)) return;
  const item = db.prepare("SELECT track_serials FROM items WHERE id = ?").get(line.item_id);
  if (!item?.track_serials) return;
  const serials = Array.isArray(line.serials) ? line.serials.map(s => String(s).trim()).filter(Boolean) : [];
  for (const serial of serials) {
    const row = db.prepare("SELECT id, status, invoice_id FROM item_serials WHERE item_id = ? AND serial = ?").get(line.item_id, serial);
    if (!row) continue;
    if (row.invoice_id !== invoiceId && row.invoice_id != null) {
      const err = new Error(`السيريال ${serial} لم يُباع في هذه الفاتورة`);
      err.status = 400;
      throw err;
    }
    db.prepare("UPDATE item_serials SET status='returned', returned_at=datetime('now', 'localtime') WHERE id=?").run(row.id);
  }
}

/**
 * Register serials on purchase receive.
 * Returns array of skipped serials (duplicates).
 */
function receiveSerialsOnPurchase(db, line, purchaseId, purchaseLineId) {
  if (!isFeatureOn(db) || !tableExists(db)) return [];
  const item = db.prepare("SELECT track_serials, default_warranty_months FROM items WHERE id = ?").get(line.item_id);
  if (!item?.track_serials) return [];
  const strict = isStrictMode(db);
  const serials = Array.isArray(line.serials) ? line.serials.map(s => String(s).trim()).filter(Boolean) : [];
  const qty = Number(line.quantity || 0);
  if (strict && serials.length !== qty) {
    const err = new Error(`يجب إدخال ${qty} سيريال عند الاستلام (تم إدخال ${serials.length})`);
    err.status = 400;
    throw err;
  }
  const skipped = [];
  for (const serial of serials) {
    const existing = db.prepare("SELECT id FROM item_serials WHERE item_id = ? AND serial = ?").get(line.item_id, serial);
    if (existing) { skipped.push(serial); continue; }
    db.prepare("INSERT INTO item_serials (item_id, serial, status, warehouse_id, purchase_id, purchase_line_id) VALUES (?, ?, 'in_stock', ?, ?, ?)").run(line.item_id, serial, line.warehouse_id || 1, purchaseId, purchaseLineId);
  }
  return skipped;
}

module.exports = { validateAndSellSerials, validateAndReturnSerials, receiveSerialsOnPurchase };
