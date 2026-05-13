const { initDb, getDb } = require('./server/src/config/database');
initDb(process.env.DB_PATH || './data/retailer.db');
const db = getDb();

function test(q, customer_id, user_id, date_from, date_to) {
  try {
    const conditions = ["i.status != 'cancelled'"];
    const params = [];

    const searchTerm = `%${q.trim()}%`;
    conditions.push("(it.name LIKE ? OR it.code LIKE ? OR it.barcode LIKE ?)");
    params.push(searchTerm, searchTerm, searchTerm);

    if (customer_id) { conditions.push("i.customer_id = ?"); params.push(Number(customer_id)); }
    if (user_id) { conditions.push("i.user_id = ?"); params.push(Number(user_id)); }
    if (date_from && date_to) {
      conditions.push("date(i.created_at) BETWEEN date(?) AND date(?)");
      params.push(date_from, date_to);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const sql = `
      SELECT il.id AS line_id, il.invoice_id, i.invoice_no, i.created_at, i.status,
             i.customer_id, c.name AS customer_name,
             il.item_id, it.name AS item_name, it.code AS item_code, it.barcode, it.purchase_price,
             il.quantity, il.unit_price, il.line_total,
             COALESCE((SELECT SUM(srl.quantity) FROM sales_return_lines srl WHERE srl.invoice_line_id = il.id), 0) AS already_returned,
             (il.quantity - COALESCE((SELECT SUM(srl.quantity) FROM sales_return_lines srl WHERE srl.invoice_line_id = il.id), 0)) AS returnable_qty
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      JOIN items it ON it.id = il.item_id
      LEFT JOIN customers c ON c.id = i.customer_id
      ${where}
      ORDER BY i.created_at DESC
      LIMIT 100
    `;
    console.log("SQL params:", params);
    const rows = db.prepare(sql).all(...params);
    console.log(`Results (q="${q}", customer_id=${customer_id}, user_id=${user_id}):`, rows.length);
    if (rows.length > 0) {
      console.log("First row keys:", Object.keys(rows[0]));
    }
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}

// Test 1: item search only
console.log("\n--- Test 1: item search only ---");
test("2001", null, null, null, null);

// Test 2: item search + customer
console.log("\n--- Test 2: item search + customer_id=1 ---");
test("2001", "1", null, "2026-01-01", "2026-12-31");

// Test 3: item search + user
console.log("\n--- Test 3: item search + user_id=1 ---");
test("2001", null, "1", "2026-01-01", "2026-12-31");

// Test 4: item search + customer + user
console.log("\n--- Test 4: item search + customer_id=1 + user_id=1 ---");
test("2001", "1", "1", "2026-01-01", "2026-12-31");

// Test 5: Arabic item name
console.log("\n--- Test 5: Arabic item name ---");
test("كوكاكولا", null, null, "2026-01-01", "2026-12-31");

console.log("\nDone");
