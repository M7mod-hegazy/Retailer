const { getDb } = require("../config/database");

function auditMutation(req, _res, next) {
  req.audit = (action, resource, payload) => {
    const db = getDb();
    db.prepare("INSERT INTO audit_logs (user_id, action, resource, payload_json) VALUES (?, ?, ?, ?)").run(
      req.user?.id || null,
      action,
      resource,
      JSON.stringify(payload || {}),
    );
  };
  next();
}

module.exports = { auditMutation };
