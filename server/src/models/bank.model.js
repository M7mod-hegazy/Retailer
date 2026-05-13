const { getDb } = require("../config/database");

const table = "banks";

function all() {
  return getDb().prepare(SELECT * FROM banks ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM banks WHERE id = ?).get(id);
}

module.exports = { all, findById };
