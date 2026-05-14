const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, setDb } = require("../src/config/database");
const PromotionModel = require("../src/models/promotion.model");

describe("promotion rules engine", () => {
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-promotions-"));
    initDb(path.join(dir, "promotions.db"));
  });

  test("caps stacked promotions at 30% of subtotal", () => {
    PromotionModel.create({
      name: "خصم 20%",
      rule_json: { type: "percentage_off_total", value: 20 },
      is_active: true,
    });
    PromotionModel.create({
      name: "خصم إضافي 15%",
      rule_json: { type: "percentage_off_total", value: 15 },
      is_active: true,
    });

    const result = PromotionModel.evaluateCart([{ item_id: 1, quantity: 1, unit_price: 1000 }], new Date("2026-04-20"));

    expect(result.subtotal).toBe(1000);
    expect(result.discount).toBe(300);
    expect(result.applied_promotions).toHaveLength(2);
  });

  test("skips inactive or out-of-range promotions", () => {
    PromotionModel.create({
      name: "منتهي",
      rule_json: { type: "percentage_off_total", value: 25 },
      starts_at: "2026-01-01",
      ends_at: "2026-01-31",
      is_active: true,
    });
    PromotionModel.create({
      name: "موقوف",
      rule_json: { type: "percentage_off_total", value: 10 },
      is_active: false,
    });

    const result = PromotionModel.evaluateCart([{ item_id: 1, quantity: 2, unit_price: 500 }], new Date("2026-04-20"));
    expect(result.discount).toBe(0);
    expect(result.applied_promotions).toEqual([]);
  });
});
