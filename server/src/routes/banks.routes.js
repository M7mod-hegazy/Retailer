const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission, userHasPagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, hasAnyRelated, buildImpact } = require("../utils/relatedRecords");
const { recordBankMovement, recomputeBankBalance, ensureBankTxColumns } = require("../services/bankService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

// Bank master data (list/create/edit/delete) is shared by both the Banks definition
// page (pageKey "banks") and the Bank Operations page (pageKey "bank_operations").
// Allow the action if the user holds it on either page.
function requireBankPermission(action) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (user.role === "dev" || user.role === "admin") return next();
    if (userHasPagePermission(user, "banks", action) || userHasPagePermission(user, "bank_operations", action)) {
      return next();
    }
    return res.status(403).json({ error: "permission_denied", page: "bank_operations", action });
  };
}

function ensureBankOperationColumns(db) {
  try { db.prepare("ALTER TABLE banks ADD COLUMN alert_threshold REAL NOT NULL DEFAULT 0").run(); } catch (_) {}
  try { db.prepare("ALTER TABLE bank_transactions ADD COLUMN reconciled INTEGER NOT NULL DEFAULT 0").run(); } catch (_) {}
  ensureBankTxColumns(db);
}

router.use((_req, _res, next) => {
  try {
    ensureBankOperationColumns(getDb());
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/", requireBankPermission("view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const query = showArchived
    ? "SELECT * FROM banks WHERE is_active = 0 ORDER BY name ASC"
    : "SELECT * FROM banks WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requireBankPermission("add"), (req, res) => {
  const db = getDb();
  const payload = req.body || {};
  const opening = Number(payload.balance || 0);
  // Insert with a zero balance, then book the opening balance as a transaction so the
  // bank's balance is always fully explained by its transaction history.
  const info = db
    .prepare("INSERT INTO banks (name, code, balance, alert_threshold) VALUES (?, ?, 0, ?)")
    .run(payload.name, payload.code || null, Number(payload.alert_threshold || 0));
  if (opening > 0) {
    recordBankMovement(db, {
      bankId: info.lastInsertRowid,
      type: "deposit",
      amount: opening,
      reference: "OPENING",
      notes: "رصيد افتتاحي",
      userId: req.user?.id || 1,
      source: "opening",
    });
  }
  req.audit("create", "banks", { id: info.lastInsertRowid }, `💰 تم إضافة بنك: ${payload.name || ''}`);
  res.status(201).json({ success: true, data: db.prepare("SELECT * FROM banks WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/:id", requireBankPermission("edit"), (req, res) => {
  const payload = req.body || {};
  getDb().prepare("UPDATE banks SET name = ?, code = ?, alert_threshold = ? WHERE id = ?")
    .run(payload.name, payload.code || null, Number(payload.alert_threshold || 0), req.params.id);
  req.audit("update", "banks", { id: req.params.id }, `💰 تم تعديل بنك: ${payload.name || ''}`);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM banks WHERE id = ?").get(req.params.id) });
});

// Linked records used by both the delete-impact preview and the delete decision.
function bankRelated(db, id) {
  return [
    { label: "حركات بنكية", count: countSafe(db, "SELECT COUNT(*) AS c FROM bank_transactions WHERE bank_id = ?", id) },
    { label: "طرق دفع", count: countSafe(db, "SELECT COUNT(*) AS c FROM payment_methods WHERE target_id = ? AND type = 'bank'", id) },
  ];
}

router.get("/:id/delete-impact", requireBankPermission("delete"), (req, res) => {
  res.json({ success: true, data: buildImpact(bankRelated(getDb(), req.params.id)) });
});

router.delete("/:id", requireBankPermission("delete"), (req, res) => {
  try {
    const db = getDb();

    if (hasAnyRelated(bankRelated(db, req.params.id))) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE banks SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "banks", { id: req.params.id }, `💰 تم أرشفة بنك`);
      return res.json({ success: true, archived: true, message: "تم أرشفة البنك لأنه مرتبط بعمليات مالية" });
    }

    // Hard delete if no records
    db.prepare("DELETE FROM banks WHERE id = ?").run(req.params.id);
    req.audit("delete", "banks", { id: req.params.id }, `💰 تم حذف بنك`);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف البنك لأنه مرتبط ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

// POST /api/banks/transfer — bank-to-bank transfer (Bank Operations only)
router.post("/transfer", requirePagePermission("bank_operations", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { from_id, to_id, amount, notes } = req.body || {};
    const transferAmount = Number(amount || 0);
    if (!from_id || !to_id || Number(from_id) === Number(to_id) || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: "بيانات التحويل غير صحيحة" });
    }

    const fromBank = db.prepare("SELECT * FROM banks WHERE id = ?").get(from_id);
    const toBank = db.prepare("SELECT * FROM banks WHERE id = ?").get(to_id);
    if (!fromBank) return res.status(404).json({ success: false, message: "الحساب المصدر غير موجود" });
    if (!toBank) return res.status(404).json({ success: false, message: "الحساب الوجهة غير موجود" });
    if (Number(fromBank.balance || 0) < transferAmount) {
      return res.status(400).json({ success: false, message: "رصيد الحساب غير كافٍ" });
    }

    const ref = `TRF-${Date.now()}`;
    const userId = req.user?.id || 1;
    db.transaction(() => {
      recordBankMovement(db, { bankId: from_id, type: "withdrawal", amount: transferAmount, reference: ref, notes: notes || "تحويل بين حسابات", userId, source: "transfer", refType: "bank", refId: Number(to_id) });
      recordBankMovement(db, { bankId: to_id, type: "deposit", amount: transferAmount, reference: ref, notes: notes || "تحويل بين حسابات", userId, source: "transfer", refType: "bank", refId: Number(from_id) });
    })();

    req.audit("create", "banks", { from_id, to_id }, `💰 تم تحويل بنكي بمبلغ: ${transferAmount}`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/banks/transactions/:id/reconcile
router.patch("/transactions/:id/reconcile", requirePagePermission("bank_operations", "edit"), (req, res) => {
  try {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM bank_transactions WHERE id = ?").get(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: "الحركة غير موجودة" });
    const next = req.body?.reconciled == null ? (tx.reconciled ? 0 : 1) : (req.body.reconciled ? 1 : 0);
    db.prepare("UPDATE bank_transactions SET reconciled = ? WHERE id = ?").run(next, req.params.id);
    req.audit("update", "banks", { id: req.params.id }, `💰 تم تسوية حركة بنكية`);
    res.json({ success: true, data: db.prepare("SELECT * FROM bank_transactions WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/banks/:id/recompute — rebuild balance from transaction history (repair)
router.post("/:id/recompute", requirePagePermission("bank_operations", "edit"), (req, res) => {
  try {
    const db = getDb();
    const bank = db.prepare("SELECT id FROM banks WHERE id = ?").get(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "البنك غير موجود" });
    const balance = recomputeBankBalance(db, req.params.id);
    req.audit("update", "banks", { id: req.params.id }, `💰 تم إعادة احتساب رصيد البنك: ${balance}`);
    res.json({ success: true, data: db.prepare("SELECT * FROM banks WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/banks/:id/balance
router.get("/:id/balance", requireBankPermission("view"), (req, res) => {
  try {
    const bank = getDb().prepare("SELECT id, name, balance FROM banks WHERE id = ?").get(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "البنك غير موجود" });
    res.json({ success: true, data: bank });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/banks/:id/transactions
router.get("/:id/transactions", requirePagePermission("bank_operations", "view"), (req, res) => {
  try {
    const db = getDb();
    const { from, to, limit = 100 } = req.query;
    const conds = ["bank_id = ?"];
    const params = [req.params.id];
    if (from) { conds.push("date(created_at) >= date(?)"); params.push(from); }
    if (to) { conds.push("date(created_at) <= date(?)"); params.push(to); }
    const rows = db.prepare(`
      SELECT * FROM bank_transactions WHERE ${conds.join(" AND ")}
      ORDER BY created_at DESC LIMIT ?
    `).all(...params, Number(limit));
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/banks/:id/deposit
router.post("/:id/deposit", requirePagePermission("bank_operations", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { amount, reference, notes } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "المبلغ مطلوب" });
    recordBankMovement(db, { bankId: req.params.id, type: "deposit", amount: Number(amount), reference: reference || null, notes: notes || null, userId: req.user?.id || 1, source: "manual" });
    req.audit("update", "banks", { id: req.params.id }, `💰 تم إيداع في البنك بمبلغ: ${amount}`);
    res.json({ success: true, data: db.prepare("SELECT * FROM banks WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/banks/:id/withdraw
router.post("/:id/withdraw", requirePagePermission("bank_operations", "edit"), (req, res) => {
  try {
    const db = getDb();
    const { amount, reference, notes } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "المبلغ مطلوب" });
    const bank = db.prepare("SELECT balance FROM banks WHERE id = ?").get(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "البنك غير موجود" });
    recordBankMovement(db, { bankId: req.params.id, type: "withdrawal", amount: Number(amount), reference: reference || null, notes: notes || null, userId: req.user?.id || 1, source: "manual" });
    req.audit("update", "banks", { id: req.params.id }, `💰 تم سحب من البنك بمبلغ: ${amount}`);
    res.json({ success: true, data: db.prepare("SELECT * FROM banks WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
