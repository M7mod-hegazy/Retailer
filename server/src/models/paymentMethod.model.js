const { getDb } = require("../config/database");

function all() {
  return getDb().prepare("SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id DESC").all();
}

function create(data) {
  const { name, type, target_id } = data;
  return getDb()
    .prepare("INSERT INTO payment_methods (name, type, target_id) VALUES (?, ?, ?)")
    .run(name, type, target_id || null);
}

function remove(id) {
  return getDb().prepare("UPDATE payment_methods SET is_active = 0 WHERE id = ?").run(id);
}

module.exports = { all, create, remove };
