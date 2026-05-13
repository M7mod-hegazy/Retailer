const { getDb } = require("../config/database");

function all() {
  return getDb().prepare("SELECT * FROM installments ORDER BY id DESC").all();
}

module.exports = { all };
