const { getDb } = require("../config/database");

function all() {
  return getDb().prepare("SELECT * FROM items ORDER BY id DESC").all();
}

function findById(id) {
  return getDb().prepare("SELECT * FROM items WHERE id = ?").get(id);
}

module.exports = { all, findById };
