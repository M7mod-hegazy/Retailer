const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { countSafe, hasAnyRelated, buildImpact } = require("../utils/relatedRecords");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);
router.use(auditMutation);

// Treasury rows carry the cash balance itself, so any create/edit/delete here
// moves money on paper without a single invoice or expense being recorded —
// the most direct way to paper over a shortage. Always report it.
function notifyTreasury(req, db, actionLabel, data) {
  try {
    notifyOwner(TG.TREASURY_CHANGED, {
      actionLabel,
      userName: req.user?.full_name || req.user?.username,
      createdAt: new Date().toISOString(),
      ...data,
    }, db);
  } catch (_) { /* non-critical */ }
}

router.get("/", requirePagePermission("daily_treasury", "view"), (req, res) => {
  const showArchived = req.query.archived === 'true';
  const query = showArchived
    ? "SELECT * FROM treasuries WHERE is_active = 0 ORDER BY name ASC"
    : "SELECT * FROM treasuries WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC";
  const rows = getDb().prepare(query).all();
  res.json({ success: true, data: rows });
});

router.post("/", requirePagePermission("daily_treasury", "add"), (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare("INSERT INTO treasuries (name, code, balance) VALUES (?, ?, ?)")
    .run(payload.name, payload.code || null, Number(payload.balance || 0));
  req.audit("create", "treasuries", { id: info.lastInsertRowid }, `💰 تم إضافة خزينة: ${payload.name || ''}`);
  notifyTreasury(req, getDb(), "إضافة خزينة", {
    treasuryName: payload.name || "بدون اسم",
    newBalance: Number(payload.balance || 0),
    details: `الرصيد الافتتاحي: ${Number(payload.balance || 0)}`,
  });
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM treasuries WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", requirePagePermission("daily_treasury", "edit"), (req, res) => {
  const payload = req.body || {};
  const db = getDb();
  const existing = db.prepare("SELECT * FROM treasuries WHERE id = ?").get(req.params.id);
  const newBalance = Number(payload.balance || 0);
  db.prepare("UPDATE treasuries SET name = ?, code = ?, balance = ? WHERE id = ?")
    .run(payload.name, payload.code || null, newBalance, req.params.id);
  req.audit("update", "treasuries", { id: req.params.id }, `💰 تم تعديل خزينة: ${payload.name || ''}`);

  const oldBalance = existing ? Number(existing.balance || 0) : null;
  const diff = oldBalance === null ? null : newBalance - oldBalance;
  notifyTreasury(req, db, "تعديل خزينة", {
    treasuryName: payload.name || existing?.name || "غير محدد",
    oldBalance,
    newBalance,
    details: diff === null || diff === 0
      ? "بدون تغيير في الرصيد"
      : `⚠️ تعديل يدوي للرصيد بمقدار ${diff > 0 ? "+" : ""}${diff}`,
  });
  res.json({ success: true, data: db.prepare("SELECT * FROM treasuries WHERE id = ?").get(req.params.id) });
});

// Linked records used by both the delete-impact preview and the delete decision.
function treasuryRelated(db, id) {
  return [
    { label: "مدفوعات", count: countSafe(db, "SELECT COUNT(*) AS c FROM payments WHERE treasury_id = ?", id) },
    { label: "طرق دفع", count: countSafe(db, "SELECT COUNT(*) AS c FROM payment_methods WHERE target_id = ? AND type = 'cash'", id) },
  ];
}

router.get("/:id/delete-impact", requirePagePermission("daily_treasury", "delete"), (req, res) => {
  res.json({ success: true, data: buildImpact(treasuryRelated(getDb(), req.params.id)) });
});

router.delete("/:id", requirePagePermission("daily_treasury", "delete"), (req, res) => {
  try {
    const db = getDb();

    const existing = db.prepare("SELECT * FROM treasuries WHERE id = ?").get(req.params.id);

    if (hasAnyRelated(treasuryRelated(db, req.params.id))) {
      // Soft delete - mark as inactive
      db.prepare("UPDATE treasuries SET is_active = 0 WHERE id = ?").run(req.params.id);
      req.audit("delete", "treasuries", { id: req.params.id }, `💰 تم أرشفة خزينة`);
      notifyTreasury(req, db, "أرشفة خزينة", {
        treasuryName: existing?.name || "غير محدد",
        oldBalance: existing ? Number(existing.balance || 0) : null,
        details: "مرتبطة بعمليات مالية — تمت الأرشفة بدل الحذف",
      });
      return res.json({ success: true, archived: true, message: "تم أرشفة الخزينة لأنها مرتبطة بعمليات مالية" });
    }

    // Hard delete if no records
    db.prepare("DELETE FROM treasuries WHERE id = ?").run(req.params.id);
    req.audit("delete", "treasuries", { id: req.params.id }, `💰 تم حذف خزينة`);
    notifyTreasury(req, db, "حذف خزينة", {
      treasuryName: existing?.name || "غير محدد",
      oldBalance: existing ? Number(existing.balance || 0) : null,
      details: "حذف نهائي (بدون عمليات مرتبطة)",
    });
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الخزينة لأنها مرتبطة ببيانات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

module.exports = router;
