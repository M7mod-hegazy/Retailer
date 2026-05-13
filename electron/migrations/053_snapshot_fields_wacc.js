module.exports = {
  name: '053_snapshot_fields_wacc',
  up(db) {
    // stock_levels: WACC storage
    const slCols = db.prepare("PRAGMA table_info(stock_levels)").all().map(c => c.name);
    if (!slCols.includes('wacc'))
      db.prepare("ALTER TABLE stock_levels ADD COLUMN wacc REAL DEFAULT 0").run();
    if (!slCols.includes('last_purchase_cost'))
      db.prepare("ALTER TABLE stock_levels ADD COLUMN last_purchase_cost REAL DEFAULT 0").run();

    // invoice_lines: snapshot fields
    const ilCols = db.prepare("PRAGMA table_info(invoice_lines)").all().map(c => c.name);
    if (!ilCols.includes('item_name_ar'))
      db.prepare("ALTER TABLE invoice_lines ADD COLUMN item_name_ar TEXT").run();
    if (!ilCols.includes('item_name_en'))
      db.prepare("ALTER TABLE invoice_lines ADD COLUMN item_name_en TEXT").run();
    if (!ilCols.includes('barcode'))
      db.prepare("ALTER TABLE invoice_lines ADD COLUMN barcode TEXT").run();
    if (!ilCols.includes('cost_wacc'))
      db.prepare("ALTER TABLE invoice_lines ADD COLUMN cost_wacc REAL").run();
    if (!ilCols.includes('cost_last_purchase'))
      db.prepare("ALTER TABLE invoice_lines ADD COLUMN cost_last_purchase REAL").run();
    if (!ilCols.includes('cost_fifo'))
      db.prepare("ALTER TABLE invoice_lines ADD COLUMN cost_fifo REAL").run();

    // purchase_lines: snapshot fields
    const plCols = db.prepare("PRAGMA table_info(purchase_lines)").all().map(c => c.name);
    if (!plCols.includes('item_name_ar'))
      db.prepare("ALTER TABLE purchase_lines ADD COLUMN item_name_ar TEXT").run();
    if (!plCols.includes('item_name_en'))
      db.prepare("ALTER TABLE purchase_lines ADD COLUMN item_name_en TEXT").run();
    if (!plCols.includes('barcode'))
      db.prepare("ALTER TABLE purchase_lines ADD COLUMN barcode TEXT").run();
    if (!plCols.includes('supplier_name'))
      db.prepare("ALTER TABLE purchase_lines ADD COLUMN supplier_name TEXT").run();

    // sales_return_lines: snapshot fields + warehouse
    const srlCols = db.prepare("PRAGMA table_info(sales_return_lines)").all().map(c => c.name);
    if (!srlCols.includes('item_name_ar'))
      db.prepare("ALTER TABLE sales_return_lines ADD COLUMN item_name_ar TEXT").run();
    if (!srlCols.includes('item_name_en'))
      db.prepare("ALTER TABLE sales_return_lines ADD COLUMN item_name_en TEXT").run();
    if (!srlCols.includes('warehouse_id'))
      db.prepare("ALTER TABLE sales_return_lines ADD COLUMN warehouse_id INTEGER DEFAULT 1").run();
    if (!srlCols.includes('cost_wacc'))
      db.prepare("ALTER TABLE sales_return_lines ADD COLUMN cost_wacc REAL").run();
    if (!srlCols.includes('cost_last_purchase'))
      db.prepare("ALTER TABLE sales_return_lines ADD COLUMN cost_last_purchase REAL").run();

    // purchase_return_lines: snapshot fields + warehouse
    const prlCols = db.prepare("PRAGMA table_info(purchase_return_lines)").all().map(c => c.name);
    if (!prlCols.includes('item_name_ar'))
      db.prepare("ALTER TABLE purchase_return_lines ADD COLUMN item_name_ar TEXT").run();
    if (!prlCols.includes('item_name_en'))
      db.prepare("ALTER TABLE purchase_return_lines ADD COLUMN item_name_en TEXT").run();
    if (!prlCols.includes('warehouse_id'))
      db.prepare("ALTER TABLE purchase_return_lines ADD COLUMN warehouse_id INTEGER DEFAULT 1").run();
  },
};
