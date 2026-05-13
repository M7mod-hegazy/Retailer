const { getDb } = require("../config/database");

const table = "invoices";

function all() {
  return getDb().prepare(SELECT * FROM invoices ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM invoices WHERE id = ?).get(id);
}

module.exports = { all, findById };
