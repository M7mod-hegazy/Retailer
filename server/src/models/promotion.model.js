const { getDb } = require("../config/database");

function parseRule(rawRule) {
  if (!rawRule) return {};
  if (typeof rawRule === "object") return rawRule;
  try {
    return JSON.parse(rawRule);
  } catch {
    return {};
  }
}

function list() {
  return getDb().prepare("SELECT * FROM promotions ORDER BY id DESC").all();
}

function create(payload = {}) {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO promotions (name, rule_json, starts_at, ends_at, is_active) VALUES (?, ?, ?, ?, ?)")
    .run(
      payload.name,
      JSON.stringify(payload.rule_json || {}),
      payload.starts_at || null,
      payload.ends_at || null,
      payload.is_active === false ? 0 : 1,
    );
  return db.prepare("SELECT * FROM promotions WHERE id = ?").get(info.lastInsertRowid);
}

function update(id, payload = {}) {
  const db = getDb();
  db.prepare("UPDATE promotions SET name = ?, rule_json = ?, starts_at = ?, ends_at = ?, is_active = ? WHERE id = ?").run(
    payload.name,
    JSON.stringify(payload.rule_json || {}),
    payload.starts_at || null,
    payload.ends_at || null,
    payload.is_active === false ? 0 : 1,
    id,
  );
  return db.prepare("SELECT * FROM promotions WHERE id = ?").get(id);
}

function remove(id) {
  getDb().prepare("DELETE FROM promotions WHERE id = ?").run(id);
}

function toggle(id) {
  const db = getDb();
  db.prepare("UPDATE promotions SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?").run(id);
  return db.prepare("SELECT * FROM promotions WHERE id = ?").get(id);
}

function getActivePromotions(referenceDate = new Date()) {
  const date = require("../utils/datetime").today(referenceDate);
  return getDb()
    .prepare(
      "SELECT * FROM promotions WHERE is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?) ORDER BY id ASC",
    )
    .all(date, date);
}

function evaluateCart(lines = [], referenceDate = new Date()) {
  const activePromotions = getActivePromotions(referenceDate);
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0);
  const discounts = [];
  let totalDiscount = 0;

  for (const promotion of activePromotions) {
    const rule = parseRule(promotion.rule_json);
    let discount = 0;

    if (rule.type === "percentage_off_total" && typeof rule.value === "number") {
      discount = Math.floor(subtotal * (Number(rule.value) / 100));
    }

    if (rule.type === "buy_x_get_y" && rule.item_id) {
      const matchingLine = lines.find((line) => Number(line.item_id) === Number(rule.item_id));
      if (matchingLine) {
        const buyQty = Number(rule.buy_qty || 0);
        const getQty = Number(rule.get_qty || 0);
        if (buyQty > 0 && getQty > 0) {
          const cycles = Math.floor(Number(matchingLine.quantity || 0) / (buyQty + getQty));
          discount = cycles * getQty * Number(matchingLine.unit_price || 0);
        }
      }
    }

    if (discount > 0) {
      discounts.push({ promotion_id: promotion.id, name: promotion.name, discount });
      totalDiscount += discount;
    }
  }

  const maxDiscount = Math.floor(subtotal * 0.3);
  if (totalDiscount > maxDiscount) {
    totalDiscount = maxDiscount;
  }

  return {
    subtotal,
    discount: totalDiscount,
    applied_promotions: discounts,
  };
}

module.exports = {
  list,
  create,
  update,
  remove,
  toggle,
  evaluateCart,
  parseRule,
};
