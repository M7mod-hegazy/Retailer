const { getDb } = require("../config/database");

const table = "treasuries";

function all() {
  return getDb().prepare(SELECT * FROM treasuries ORDER BY id DESC).all();
}

function findById(id) {
  return getDb().prepare(SELECT * FROM treasuries WHERE id = ?).get(id);
}

module.exports = { all, findById };
