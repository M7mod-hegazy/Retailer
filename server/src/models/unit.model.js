const { getDb } = require("../config/database");

const table = "units";

function all() {
  return getDb().prepare(SELECT * FROM units ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM units WHERE id = ?).get(id);
}

module.exports = { all, findById };
