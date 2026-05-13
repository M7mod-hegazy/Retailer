const { getDb } = require("../config/database");

const table = "warehouses";

function all() {
  return getDb().prepare(SELECT * FROM warehouses ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM warehouses WHERE id = ?).get(id);
}

module.exports = { all, findById };
