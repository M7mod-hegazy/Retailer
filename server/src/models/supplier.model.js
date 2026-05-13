const { getDb } = require("../config/database");

const table = "suppliers";

function all() {
  return getDb().prepare(SELECT * FROM suppliers ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM suppliers WHERE id = ?).get(id);
}

module.exports = { all, findById };
