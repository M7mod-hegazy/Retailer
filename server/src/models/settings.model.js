const { getDb } = require("../config/database");

const table = "settings";

function all() {
  return getDb().prepare(SELECT * FROM settings ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM settings WHERE id = ?).get(id);
}

module.exports = { all, findById };
