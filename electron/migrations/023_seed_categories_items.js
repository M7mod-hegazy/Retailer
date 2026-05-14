function up(db) {
  // Clear existing catalog data (stock_levels/movements cascade from items FK)
  // Disable FK checks temporarily so we can clear in any order
  db.pragma("foreign_keys = OFF");
  db.exec(`
    DELETE FROM item_images;
    DELETE FROM stock_levels;
    DELETE FROM stock_movements;
    DELETE FROM sales_return_lines;
    DELETE FROM sales_returns;
    DELETE FROM purchase_return_lines;
    DELETE FROM purchase_returns;
    DELETE FROM invoice_lines;
    DELETE FROM invoices;
    DELETE FROM purchase_lines;
    DELETE FROM purchases;
    DELETE FROM items;
    DELETE FROM item_categories;
  `);
  db.pragma("foreign_keys = ON");

  // Seed categories (sku_prefix = sequential integer starting at 1)
  const insertCat = db.prepare(
    "INSERT INTO item_categories (name, sku_prefix) VALUES (?, ?)",
  );
  insertCat.run("مواد غذائية", "1");
  insertCat.run("مشروبات", "2");
  insertCat.run("منظفات ومواد تنظيف", "3");
  insertCat.run("مستلزمات شخصية", "4");

  // Helper: get category id by prefix
  const getCatId = (prefix) =>
    db.prepare("SELECT id FROM item_categories WHERE sku_prefix = ?").get(prefix)?.id;

  // Seed items — sale_price = 0 (set later via invoices/POS), purchase_price = cost
  const insertItem = db.prepare(
    `INSERT INTO items (code, sku_sequence, name, barcode, category_id, sale_price, purchase_price, is_active)
     VALUES (?, ?, ?, ?, ?, 0, ?, 1)`,
  );

  const cat1 = getCatId("1");
  insertItem.run("1.1", 1, "أرز بسمتي 5 كيلو", "6001001001", cat1, 45);
  insertItem.run("1.2", 2, "سكر أبيض 2 كيلو", "6001001002", cat1, 18);
  insertItem.run("1.3", 3, "زيت ذرة 1.5 لتر", "6001001003", cat1, 22);
  insertItem.run("1.4", 4, "دقيق أبيض 2 كيلو", "6001001004", cat1, 15);

  const cat2 = getCatId("2");
  insertItem.run("2.1", 1, "مياه معدنية 1.5 لتر", "6002001001", cat2, 3);
  insertItem.run("2.2", 2, "عصير برتقال طبيعي", "6002001002", cat2, 12);
  insertItem.run("2.3", 3, "مشروب غازي كولا 330مل", "6002001003", cat2, 5);

  const cat3 = getCatId("3");
  insertItem.run("3.1", 1, "صابون غسيل ملابس 1 كيلو", "6003001001", cat3, 20);
  insertItem.run("3.2", 2, "منظف أرضيات 750 مل", "6003001002", cat3, 14);
  insertItem.run("3.3", 3, "سائل جلي أواني 500 مل", "6003001003", cat3, 10);

  const cat4 = getCatId("4");
  insertItem.run("4.1", 1, "شامبو للشعر 400 مل", "6004001001", cat4, 28);
  insertItem.run("4.2", 2, "صابون حمام", "6004001002", cat4, 8);
}

module.exports = { up };
