const { getDb } = require("../config/database");

const table = "stock_levels";

function all() {
  return getDb().prepare(SELECT * FROM stock_levels ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM stock_levels WHERE id = ?).get(id);
}

module.exports = { all, findById };
