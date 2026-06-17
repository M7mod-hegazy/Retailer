const { getDb } = require("../config/database");
const logger = require("../config/logger");

function auditMutation(req, _res, next) {
  req.audit = (action, resource, payload, description, link) => {
    // An audit-log insert must never turn a successful mutation into a 500 (or crash
    // the request). If the DB is momentarily locked or the table is missing, log and
    // return null instead of throwing.
    try {
      const db = getDb();
      const info = db.prepare("INSERT INTO audit_logs (user_id, action, resource, payload_json, description, link) VALUES (?, ?, ?, ?, ?, ?)").run(
        Number.isInteger(req.user?.id) ? req.user.id : null,
        action,
        resource,
        JSON.stringify(payload || {}),
        description || null,
        link || null,
      );
      return info.lastInsertRowid;
    } catch (err) {
      logger.warn({ message: "Audit log insert failed", action, resource, error: err.message });
      return null;
    }
  };
  next();
}

module.exports = { auditMutation };
