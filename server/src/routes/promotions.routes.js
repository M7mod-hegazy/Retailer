const express = require("express");
const PromotionModel = require("../models/promotion.model");
const { requirePagePermission } = require("../middleware/permission");

const { getDb } = require("../config/database");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

// A promotion is a standing discount rule — creating or silently re-enabling
// one lets margin walk out the door on every sale, with no per-invoice trace.
function notifyPromotion(req, actionLabel, promotionName, details) {
  try {
    notifyOwner(TG.PROMOTION_CHANGED, {
      actionLabel,
      promotionName: promotionName || "غير محدد",
      details: details || "—",
      userName: req.user?.full_name || req.user?.username,
      createdAt: new Date().toISOString(),
    }, getDb());
  } catch (_) { /* non-critical */ }
}

// Promotion rules are stored as JSON; summarise the parts that cost money.
function summarizeRule(ruleJson) {
  try {
    const rule = typeof ruleJson === "string" ? JSON.parse(ruleJson) : ruleJson;
    if (!rule || typeof rule !== "object") return "—";
    const bits = [];
    if (rule.type) bits.push(`النوع: ${rule.type}`);
    if (rule.discount_percent != null) bits.push(`خصم ${rule.discount_percent}%`);
    if (rule.discount_amount != null) bits.push(`خصم ${rule.discount_amount}`);
    if (rule.buy_qty != null && rule.get_qty != null) bits.push(`اشترِ ${rule.buy_qty} واحصل على ${rule.get_qty}`);
    return bits.join(" | ") || "—";
  } catch (_) {
    return "—";
  }
}

router.get("/", requirePagePermission("promotions", "view"), (req, res, next) => {
  try {
    res.json({ success: true, data: PromotionModel.list() });
  } catch (err) {
    next(err);
  }
});

router.post("/", requirePagePermission("promotions", "add"), (req, res, next) => {
  try {
    const { name, rule_json, starts_at, ends_at, is_active } = req.body;
    
    if (!name || !rule_json) {
      return res.status(400).json({ success: false, message: "الاسم وقاعدة العرض مطلوبة" });
    }

    const newRow = PromotionModel.create({ name, rule_json, starts_at, ends_at, is_active });
    notifyPromotion(req, "إضافة عرض", name,
      `${summarizeRule(rule_json)} | الحالة: ${is_active ? "مفعّل" : "موقوف"}`);
    res.status(201).json({ success: true, data: newRow });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePagePermission("promotions", "edit"), (req, res, next) => {
  try {
    const { name, rule_json, starts_at, ends_at, is_active } = req.body;
    const updatedRow = PromotionModel.update(req.params.id, { name, rule_json, starts_at, ends_at, is_active });
    notifyPromotion(req, "تعديل عرض", name || updatedRow?.name,
      `${summarizeRule(rule_json)} | الحالة: ${is_active ? "مفعّل" : "موقوف"}`);
    res.json({ success: true, data: updatedRow });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePagePermission("promotions", "delete"), (req, res, next) => {
  try {
    const existing = PromotionModel.list().find((p) => String(p.id) === String(req.params.id));
    PromotionModel.remove(req.params.id);
    notifyPromotion(req, "حذف عرض", existing?.name, "حذف نهائي");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/toggle", requirePagePermission("promotions", "edit"), (req, res, next) => {
  try {
    const updatedRow = PromotionModel.toggle(req.params.id);
    notifyPromotion(req, updatedRow?.is_active ? "تفعيل عرض" : "إيقاف عرض", updatedRow?.name,
      summarizeRule(updatedRow?.rule_json));
    res.json({ success: true, data: updatedRow });
  } catch (err) {
    next(err);
  }
});

// A utility endpoint to match promotions against a given cart
router.post("/evaluate", requirePagePermission("promotions", "add"), (req, res, next) => {
  try {
    const { lines } = req.body; // e.g. [{ item_id, quantity, unit_price }]
    res.json({ success: true, data: PromotionModel.evaluateCart(Array.isArray(lines) ? lines : []) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
