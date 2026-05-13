const { getDb } = require("../config/database");

function all() {
  return getDb().prepare("SELECT * FROM purchase_orders ORDER BY id DESC").all();
}

function findById(id) {
  return getDb().prepare("SELECT * FROM purchase_orders WHERE id = ?").get(id);
}

module.exports = { all, findById };
