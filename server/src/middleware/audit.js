const { getDb } = require("../config/database");

function auditMutation(req, _res, next) {
  req.audit = (action, resource, payload, description) => {
    const db = getDb();
    db.prepare("INSERT INTO audit_logs (user_id, action, resource, payload_json, description) VALUES (?, ?, ?, ?, ?)").run(
      req.user?.id || null,
      action,
      resource,
      JSON.stringify(payload || {}),
      description || null,
    );
  };
  next();
}

module.exports = { auditMutation };
