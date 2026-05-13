const { getDb } = require("../config/database");

const table = "customers";

function all() {
  return getDb().prepare(SELECT * FROM customers ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM customers WHERE id = ?).get(id);
}

module.exports = { all, findById };
