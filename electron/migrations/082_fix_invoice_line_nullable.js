module.exports = {
  up(db) {
    const cols = db.prepare("PRAGMA table_info(sales_return_lines)").all();
    const invoiceLineCol = cols.find(c => c.name === "invoice_line_id");
    if (!invoiceLineCol || invoiceLineCol.notnull === 0) return;

    // Build new schema: same columns but invoice_line_id nullable
    const fixedSchema = [
      "id INTEGER PRIMARY KEY AUTOINCREMENT",
      "sales_return_id INTEGER NOT NULL",
      "invoice_line_id INTEGER",
      "item_id INTEGER NOT NULL",
      "quantity REAL NOT NULL DEFAULT 1",
      "unit_price REAL NOT NULL DEFAULT 0",
      "line_total REAL NOT NULL DEFAULT 0",
      "warehouse_id INTEGER DEFAULT 1",
      "item_name_ar TEXT",
      "item_name_en TEXT",
      "cost_wacc REAL",
      "cost_last_purchase REAL",
    ];
    const fixedColNames = fixedSchema.map(def => def.split(" ")[0]);
    // Only copy columns that exist in both old and new tables
    const existingNames = cols.map(c => c.name);
    const copyColNames = fixedColNames.filter(n => existingNames.includes(n));
    const colList = copyColNames.join(", ");

    db.exec(`
      CREATE TABLE sales_return_lines_fix (
        ${fixedSchema.join(",\n        ")},
        FOREIGN KEY(sales_return_id) REFERENCES sales_returns(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
      );
      INSERT INTO sales_return_lines_fix (${colList})
        SELECT ${colList} FROM sales_return_lines;
      DROP TABLE sales_return_lines;
      ALTER TABLE sales_return_lines_fix RENAME TO sales_return_lines;
    `);
  },
};
