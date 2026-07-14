const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, hasAnyRelated, buildImpact } = require("../utils/relatedRecords");
const { partyTxnSum } = require("../services/partyBalanceService");
const { nowSql } = require("../utils/datetime");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

function base64ToBuffer(b64) {
  if (!b64) return null;
  return Buffer.from(b64, 'base64');
}

function ensureNotesSchema(db) {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS customer_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    )`);
  } catch (_) {}
  try { db.exec("ALTER TABLE customer_notes ADD COLUMN type TEXT DEFAULT 'note'"); } catch (_) {}
  try { db.exec("ALTER TABLE customer_notes ADD COLUMN amount REAL"); } catch (_) {}
}

router.get("/balance-summary", requirePagePermission("customers", "view"), (req, res) => {
  try {
    const row = getDb().prepare(
      "SELECT COALESCE(SUM(opening_balance), 0) AS net_balance FROM customers WHERE is_active = 1 OR is_active IS NULL"
    ).get();
    res.json({ success: true, data: { net_balance: row.net_balance } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/", requirePagePermission("customers", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const search = String(req.query.search || "").trim();
  const limit = req.query.limit ? Math.min(Math.max(Number(req.query.limit), 1), 500) : null;
  const offset = req.query.offset ? Math.max(Number(req.query.offset), 0) : 0;
  const params = [];
  const clauses = [showArchived ? "is_active = 0" : "(is_active = 1 OR is_active IS NULL)"];

  if (search) {
    clauses.push("(name LIKE ? OR phone LIKE ? OR code LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = `WHERE ${clauses.join(" AND ")}`;
  let query = `SELECT * FROM customers ${where} ORDER BY id DESC`;
  const total = limit
    ? getDb().prepare(`SELECT COUNT(*) AS total FROM customers ${where}`).get(...params).total
    : null;

  if (limit) {
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);
  }

  const rows = getDb().prepare(query).all(...params);
  res.json({ success: true, data: rows, meta: { offset, limit, count: rows.length, total: total ?? rows.length } });
});

router.post("/", requirePagePermission("customers", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare(
      `INSERT INTO customers
       (name, phone, additional_phones, addresses, notes, code, opening_balance, base_opening_balance, credit_limit, is_blacklisted, blacklist_reason, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.additional_phones || null,
      payload.addresses || null,
      payload.notes || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      Number(payload.opening_balance || 0), // base_opening_balance — frozen at creation, never mutated by transactions
      Number(payload.credit_limit || 0),
      payload.is_blacklisted ? 1 : 0,
      payload.blacklist_reason || null,
      payload.is_active === false ? 0 : 1,
    );
  req.audit("create", "customers", { id: info.lastInsertRowid }, `👤 تم إضافة عميل: ${payload.name || ''}`, `/definitions/customers/${info.lastInsertRowid}`);
  try {
    notifyOwner(TG.CUSTOMER_CREATED, {
      customerName: payload.name,
      name: payload.name,
      phone: payload.phone || null,
      city: payload.addresses || null,
      openingBalance: Number(payload.opening_balance || 0),
    });
  } catch (_) {}
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM customers WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("customers", "edit"), (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare(
      `UPDATE customers
       SET name = ?, phone = ?, additional_phones = ?, addresses = ?, notes = ?, code = ?, opening_balance = ?, credit_limit = ?, is_blacklisted = ?, blacklist_reason = ?, is_active = ?
       WHERE id = ?`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.additional_phones || null,
      payload.addresses || null,
      payload.notes || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      Number(payload.credit_limit || 0),
      payload.is_blacklisted ? 1 : 0,
      payload.blacklist_reason || null,
      payload.is_active === false ? 0 : 1,
      req.params.id,
    );
  req.audit("update", "customers", { id: req.params.id }, `👤 تم تعديل عميل: ${payload.name || ''}`, `/definitions/customers/${req.params.id}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id) });
});

// Linked records used by both the delete-impact preview and the delete decision.
function customerRelated(db, id) {
  return [
    { label: "فواتير", count: countSafe(db, "SELECT COUNT(*) AS c FROM invoices WHERE customer_id = ?", id) },
    { label: "عروض أسعار", count: countSafe(db, "SELECT COUNT(*) AS c FROM quotations WHERE customer_id = ?", id) },
    { label: "مدفوعات", count: countSafe(db, "SELECT COUNT(*) AS c FROM payments WHERE party_type = 'customer' AND party_id = ?", id) },
    { label: "مرتجعات مبيعات", count: countSafe(db, "SELECT COUNT(*) AS c FROM sales_returns WHERE customer_id = ?", id) },
  ];
}

router.get("/:id/delete-impact", requirePagePermission("customers", "delete"), (req, res) => {
  const db = getDb();
  const settings = db.prepare("SELECT walk_in_customer_id FROM settings WHERE id = 1").get();
  if (settings?.walk_in_customer_id && String(settings.walk_in_customer_id) === String(req.params.id)) {
    return res.json({ success: true, data: buildImpact([], { blocked: "لا يمكن حذف العميل الافتراضي للمبيعات النقدية" }) });
  }
  res.json({ success: true, data: buildImpact(customerRelated(db, req.params.id)) });
});

router.delete("/:id", requirePagePermission("customers", "delete"), (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare("SELECT walk_in_customer_id FROM settings WHERE id = 1").get();
    if (settings?.walk_in_customer_id && String(settings.walk_in_customer_id) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "لا يمكن حذف العميل الافتراضي للمبيعات النقدية" });
    }

    if (hasAnyRelated(customerRelated(db, req.params.id))) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE customers SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "customers", { id: req.params.id }, `👤 تم أرشفة عميل`, `/definitions/customers/${req.params.id}`);
      return res.json({ success: true, archived: true, message: "تم أرشفة العميل لأنه مرتبط بفواتير أو مدفوعات" });
    }

    // Hard delete if no transactions
    db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    req.audit("delete", "customers", { id: req.params.id }, `👤 تم حذف عميل`, `/definitions/customers`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) {
      return res.status(409).json({ success: false, message: "لا يمكن حذف العميل لأنه مرتبط ببيانات أخرى" });
    }
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

router.get("/:id/loyalty", requirePagePermission("customers", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const customer = db.prepare("SELECT loyalty_points, loyalty_tier, total_spent FROM customers WHERE id = ?").get(req.params.id);
    if (!customer) {
      const err = new Error("العميل غير موجود");
      err.status = 404;
      throw err;
    }
    const history = db.prepare("SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT 50").all(req.params.id);
    res.json({ success: true, data: { ...customer, history } });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requirePagePermission("customers", "view"), (req, res) => {
  const customer = getDb().prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: "العميل غير موجود" });
  res.json({ success: true, data: customer });
});

router.post("/:id/adjust", requirePagePermission("customers", "add"), (req, res) => {
  const { amount, reason, direction } = req.body || {};
  const delta = direction === 'subtract' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
  try {
    const db = getDb();
    ensureNotesSchema(db);
    db.transaction(() => {
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(delta, req.params.id);
      db.prepare("INSERT INTO customer_notes (customer_id, note, type, amount, created_by, created_at) VALUES (?, ?, 'adjustment', ?, ?, ?)")
        .run(req.params.id, `تسوية رصيد بقيمة ${delta > 0 ? '+' : ''}${delta}: ${reason || 'بدون سبب'}`, delta, req.user?.id || null, nowSql());
    })();
    res.json({ success: true, data: db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id) });
  } catch (e) {
    res.status(500).json({ success: false, message: "خطأ أثناء التسوية" });
  }
});

router.get("/:id/notes", requirePagePermission("customers", "view"), (req, res) => {
  try {
    const db = getDb();
    ensureNotesSchema(db);
    const { type } = req.query;
    const cond = type ? "WHERE n.customer_id = ? AND COALESCE(n.type,'note') = ?" : "WHERE n.customer_id = ?";
    const params = type ? [req.params.id, type] : [req.params.id];
    const notes = db.prepare(`SELECT n.*, u.username as user_name FROM customer_notes n LEFT JOIN users u ON u.id = n.created_by ${cond} ORDER BY n.created_at DESC`).all(...params);
    res.json({ success: true, data: notes });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/:id/notes", requirePagePermission("customers", "add"), (req, res) => {
  const { note } = req.body || {};
  if (!note) return res.status(400).json({ success: false, message: "الملاحظة مطلوبة" });
  const result = getDb().prepare("INSERT INTO customer_notes (customer_id, note, created_by, created_at) VALUES (?, ?, ?, ?)")
    .run(req.params.id, note, req.user?.id || null, nowSql());
  const newNote = getDb().prepare("SELECT n.*, u.username as user_name FROM customer_notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: newNote });
});

router.post("/import", requirePagePermission("customers", "add"), (req, res) => {
  const { rows, file_name, file_mime, file_base64 } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ success: false, message: "لا توجد صفوف للاستيراد" });
  }
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  const batchRows = [];

  try {
    db.transaction(() => {
      for (const row of rows) {
        const name = String(row.name || "").trim();
        if (!name) { skipped++; continue; }

        if (row.action === "insert") {
          const info = db.prepare(
            `INSERT INTO customers (name, phone, addresses, opening_balance, is_active) VALUES (?, ?, ?, ?, 1)`
          ).run(name, row.phone || null, row.address || null, Number(row.opening_balance || 0));
          batchRows.push({ entity_id: info.lastInsertRowid, action: "insert", prior_json: null });
          inserted++;
        } else if (row.action === "update" && row.existing_id) {
          const prior = db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(row.existing_id));
          if (!prior) { skipped++; continue; }
          // Treat the imported value as the TRUE opening and reconcile so existing
          // activity is preserved: live = importedOpening + Σ(transactions). For a
          // customer with no transactions this is a plain overwrite. Overwriting the
          // live balance directly would corrupt statements/aging/balance-summary.
          const importedOpening = Number(row.opening_balance || 0);
          const reconciledBalance = importedOpening + partyTxnSum(db, "customer", Number(row.existing_id));
          db.prepare(
            `UPDATE customers SET name=?, phone=?, addresses=?, opening_balance=? WHERE id=?`
          ).run(name, row.phone || null, row.address || null, reconciledBalance, Number(row.existing_id));
          batchRows.push({ entity_id: Number(row.existing_id), action: "update", prior_json: JSON.stringify(prior) });
          updated++;
        } else {
          skipped++;
        }
      }

      const fileBlob = base64ToBuffer(file_base64);
      const batchInfo = db.prepare(
        `INSERT INTO account_import_batches (entity_type, file_name, file_mime, file_blob, inserted, updated, skipped, created_by)
         VALUES ('customers', ?, ?, ?, ?, ?, ?, ?)`
      ).run(file_name || null, file_mime || null, fileBlob, inserted, updated, skipped, req.user?.id || null);

      const batchId = batchInfo.lastInsertRowid;
      const insertRow = db.prepare(
        `INSERT INTO account_import_batch_rows (batch_id, entity_id, action, prior_json) VALUES (?, ?, ?, ?)`
      );
      for (const r of batchRows) {
        insertRow.run(batchId, r.entity_id, r.action, r.prior_json);
      }

      req.audit("create", "customers", {}, `📥 استيراد ${inserted} عميل جديد، تحديث ${updated}`);
      res.status(201).json({ success: true, data: { batch_id: batchId, inserted, updated, skipped } });
    })();
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get("/import/batches", requirePagePermission("customers", "view"), (req, res) => {
  try {
    const batches = getDb().prepare(`
      SELECT b.id, b.file_name, b.inserted, b.updated, b.skipped, b.status, b.created_at, b.undone_at,
             COALESCE(NULLIF(u.full_name, ''), u.username) AS user_name
      FROM account_import_batches b
      LEFT JOIN users u ON u.id = b.created_by
      WHERE b.entity_type = 'customers'
      ORDER BY b.created_at DESC
      LIMIT 50
    `).all();
    res.json({ success: true, data: batches });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/import/batches/:id/file", requirePagePermission("customers", "view"), (req, res) => {
  try {
    const row = getDb().prepare("SELECT file_name, file_mime, file_blob FROM account_import_batches WHERE id = ? AND entity_type = 'customers'").get(Number(req.params.id));
    if (!row || !row.file_blob) return res.status(404).json({ success: false, message: "الملف غير متاح" });
    const fileName = encodeURIComponent(row.file_name || `import-${req.params.id}.xlsx`);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
    res.setHeader("Content-Type", row.file_mime || "application/octet-stream");
    res.send(row.file_blob);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/import/batches/:id/undo", requirePagePermission("customers", "import_undo"), (req, res) => {
  const db = getDb();
  try {
    const batchId = Number(req.params.id);
    const batch = db.prepare("SELECT * FROM account_import_batches WHERE id = ? AND entity_type = 'customers'").get(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "العملية غير موجودة" });
    if (batch.status !== "active") return res.status(409).json({ success: false, reason: "already_undone" });
    const ageHours = db.prepare("SELECT (julianday('now') - julianday(?)) * 24 AS h").get(batch.created_at)?.h;
    if (ageHours > 24) return res.status(409).json({ success: false, reason: "expired" });

    const snaps = db.prepare("SELECT * FROM account_import_batch_rows WHERE batch_id = ?").all(batchId);
    const insertedIds = snaps.filter(s => s.action === "insert").map(s => s.entity_id);

    // Block if any inserted customer has transactions
    for (const id of insertedIds) {
      const hasActivity =
        db.prepare("SELECT COUNT(*) AS c FROM invoices WHERE customer_id = ?").get(id)?.c > 0 ||
        db.prepare("SELECT COUNT(*) AS c FROM payments WHERE party_type = 'customer' AND party_id = ?").get(id)?.c > 0 ||
        db.prepare("SELECT COUNT(*) AS c FROM quotations WHERE customer_id = ?").get(id)?.c > 0 ||
        db.prepare("SELECT COUNT(*) AS c FROM sales_returns WHERE customer_id = ?").get(id)?.c > 0;
      if (hasActivity) return res.status(409).json({ success: false, reason: "activity", detail: `customer ${id} has transactions` });
    }

    db.transaction(() => {
      // Restore updated rows
      for (const s of snaps.filter(s => s.action === "update")) {
        const prior = JSON.parse(s.prior_json || "{}");
        db.prepare("UPDATE customers SET name=?, phone=?, addresses=?, opening_balance=? WHERE id=?")
          .run(prior.name, prior.phone, prior.addresses, prior.opening_balance, s.entity_id);
      }
      // Delete inserted rows
      for (const id of insertedIds) {
        db.prepare("DELETE FROM customers WHERE id = ?").run(id);
      }
      db.prepare("UPDATE account_import_batches SET status='undone', undone_at=?, undone_by=? WHERE id=?")
        .run(nowSql(), req.user?.id || null, batchId);
    })();

    res.json({ success: true, data: { batch_id: batchId, status: "undone" } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
