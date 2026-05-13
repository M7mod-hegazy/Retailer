const { getDb } = require("../config/database");

const table = "item_categories";

function all() {
  return getDb().prepare(SELECT * FROM item_categories ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM item_categories WHERE id = ?).get(id);
}

module.exports = { all, findById };
