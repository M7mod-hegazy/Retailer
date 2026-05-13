const { getDb } = require("../config/database");

const table = "stock_movements";

function all() {
  return getDb().prepare(SELECT * FROM stock_movements ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM stock_movements WHERE id = ?).get(id);
}

module.exports = { all, findById };
