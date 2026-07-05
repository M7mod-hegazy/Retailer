module.exports = {
  name: "165_store_type_and_pricing",
  up(db) {
    const cols = db.prepare("PRAGMA table_info(settings)").all().map(c => c.name);
    if (!cols.includes("store_type")) {
      db.prepare("ALTER TABLE settings ADD COLUMN store_type TEXT DEFAULT NULL").run();
    }
    db.prepare(
      "INSERT INTO settings_kv (key, value) VALUES ('feature_pricing', ?) ON CONFLICT(key) DO NOTHING"
    ).run(JSON.stringify({
      feature_multi_unit: { price_monthly: 0, price_yearly: 0, currency: "EGP" },
      feature_variants: { price_monthly: 0, price_yearly: 0, currency: "EGP" },
      feature_serials: { price_monthly: 150, price_yearly: 1500, currency: "EGP" },
      feature_scale_barcodes: { price_monthly: 0, price_yearly: 0, currency: "EGP" },
      feature_repair_orders: { price_monthly: 300, price_yearly: 3000, currency: "EGP" },
      feature_restaurant: { price_monthly: 500, price_yearly: 5000, currency: "EGP" },
      feature_gold: { price_monthly: 200, price_yearly: 2000, currency: "EGP" },
      feature_expiry: { price_monthly: 0, price_yearly: 0, currency: "EGP" },
      feature_promotions: { price_monthly: 0, price_yearly: 0, currency: "EGP" },
      feature_cheques: { price_monthly: 100, price_yearly: 1000, currency: "EGP" },
    }));
    db.prepare(
      "INSERT INTO settings_kv (key, value) VALUES ('activation_codes', ?) ON CONFLICT(key) DO NOTHING"
    ).run(JSON.stringify({}));
  },
};
