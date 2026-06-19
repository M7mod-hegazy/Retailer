const express = require("express");
const { getDb } = require("../config/database");
const { authRequired } = require("../middleware/auth");
const { today } = require("../utils/datetime");
const { requirePagePermission } = require("../middleware/permission");
const { auditMutation } = require("../middleware/audit");
const { featureGate } = require("../utils/features");

const router = express.Router();
router.use(authRequired);
router.use(featureGate("feature_gold"));
router.use(auditMutation);

// Get today's rates (or latest available)
router.get("/rates/today", requirePagePermission("pos", "view"), (req, res) => {
  const db = getDb();
  const today = today();
  const rows = db.prepare("SELECT * FROM gold_rates WHERE rate_date = ? ORDER BY karat").all(today);
  if (rows.length > 0) return res.json({ success: true, data: rows, date: today });

  // Fall back to most recent date
  const lastDate = db.prepare("SELECT MAX(rate_date) as d FROM gold_rates").get()?.d;
  if (!lastDate) return res.json({ success: true, data: [], date: today, note: "no_rates_yet" });
  const latestRows = db.prepare("SELECT * FROM gold_rates WHERE rate_date = ? ORDER BY karat").all(lastDate);
  res.json({ success: true, data: latestRows, date: lastDate, stale: lastDate !== today });
});

// Get rate history
router.get("/rates", requirePagePermission("settings", "view"), (req, res) => {
  const limit = Math.min(Number(req.query.limit || 30), 200);
  const offset = Number(req.query.offset || 0);
  const rows = getDb().prepare("SELECT * FROM gold_rates ORDER BY rate_date DESC, karat ASC LIMIT ? OFFSET ?").all(limit, offset);
  res.json({ success: true, data: rows });
});

// Add/update today's rates (bulk)
router.post("/rates", requirePagePermission("settings", "add"), (req, res) => {
  const db = getDb();
  const { rates, rate_date } = req.body || {};
  if (!Array.isArray(rates) || rates.length === 0) return res.status(400).json({ success: false, message: "rates array required" });

  const date = rate_date || today();
  const insert = db.prepare("INSERT OR REPLACE INTO gold_rates (rate_date, karat, price_per_gram, currency, source, created_by) VALUES (?,?,?,?,?,?)");

  const tx = db.transaction(() => {
    rates.forEach(r => {
      insert.run(date, Number(r.karat), Number(r.price_per_gram), r.currency || "EGP", r.source || null, req.user?.id || null);
    });
  });
  tx();

  req.audit("add", "gold_rates", { date, count: rates.length }, `تم تسجيل أسعار الذهب ليوم ${date}`);
  res.status(201).json({ success: true });
});

// Get rate for a specific karat and optional date
router.get("/rates/:karat", requirePagePermission("pos", "view"), (req, res) => {
  const db = getDb();
  const karat = Number(req.params.karat);
  const date = req.query.date || today();
  const row = db.prepare("SELECT * FROM gold_rates WHERE karat = ? AND rate_date <= ? ORDER BY rate_date DESC LIMIT 1").get(karat, date);
  if (!row) return res.status(404).json({ success: false, message: `No rate for ${karat}K` });
  res.json({ success: true, data: row });
});

// Compute price for a gold item
router.get("/price", requirePagePermission("pos", "view"), (req, res) => {
  const db = getDb();
  const { item_id, quantity } = req.query;
  if (!item_id) return res.status(400).json({ success: false, message: "item_id required" });

  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(Number(item_id));
  if (!item || !item.is_gold_item) return res.status(400).json({ success: false, message: "Not a gold item" });

  const karat = item.gold_karat || 21;
  const date = today();
  const rate = db.prepare("SELECT * FROM gold_rates WHERE karat = ? AND rate_date <= ? ORDER BY rate_date DESC LIMIT 1").get(karat, date);
  if (!rate) return res.status(404).json({ success: false, message: `No rate for ${karat}K` });

  const qty = Number(quantity || 1);
  const weight = Number(item.gold_weight_grams || 0);
  const makingCharge = Number(item.gold_making_charge || 0);
  const unitPrice = weight * rate.price_per_gram + makingCharge;
  const total = unitPrice * qty;

  res.json({
    success: true,
    data: {
      unit_price: unitPrice, total,
      weight_grams: weight, rate_per_gram: rate.price_per_gram,
      making_charge: makingCharge, karat, qty,
      rate_date: rate.rate_date,
    },
  });
});

module.exports = router;
