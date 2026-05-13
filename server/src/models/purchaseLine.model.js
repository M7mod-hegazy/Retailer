const { getDb } = require("../config/database");

function findByPurchaseId(purchaseId) {
  return getDb()
    .prepare("SELECT * FROM purchase_lines WHERE purchase_id = ? ORDER BY id ASC")
    .all(purchaseId);
}

module.exports = { findByPurchaseId };
