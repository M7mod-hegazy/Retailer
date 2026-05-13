const { getDb } = require("../config/database");

function all() {
  return getDb().prepare("SELECT * FROM expenses ORDER BY id DESC").all();
}

module.exports = { all };
