const { getDb } = require("../config/database");

const table = "invoice_lines";

function all() {
  return getDb().prepare(SELECT * FROM invoice_lines ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM invoice_lines WHERE id = ?).get(id);
}

module.exports = { all, findById };
