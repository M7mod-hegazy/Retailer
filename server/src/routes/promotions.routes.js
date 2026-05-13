const express = require("express");
const PromotionModel = require("../models/promotion.model");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

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
    res.status(201).json({ success: true, data: newRow });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requirePagePermission("promotions", "edit"), (req, res, next) => {
  try {
    const { name, rule_json, starts_at, ends_at, is_active } = req.body;
    const updatedRow = PromotionModel.update(req.params.id, { name, rule_json, starts_at, ends_at, is_active });
    res.json({ success: true, data: updatedRow });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePagePermission("promotions", "delete"), (req, res, next) => {
  try {
    PromotionModel.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/toggle", requirePagePermission("promotions", "edit"), (req, res, next) => {
  try {
    const updatedRow = PromotionModel.toggle(req.params.id);
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
