const { getDb } = require("../config/database");

const table = "employees";

function all() {
  return getDb().prepare(SELECT * FROM employees ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM employees WHERE id = ?).get(id);
}

module.exports = { all, findById };
