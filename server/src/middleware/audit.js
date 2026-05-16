const { getDb } = require("../config/database");

function auditMutation(req, _res, next) {
  req.audit = (action, resource, payload, description, link) => {
    const db = getDb();
    db.prepare("INSERT INTO audit_logs (user_id, action, resource, payload_json, description, link) VALUES (?, ?, ?, ?, ?, ?)").run(
      Number.isInteger(req.user?.id) ? req.user.id : null,
      action,
      resource,
      JSON.stringify(payload || {}),
      description || null,
      link || null,
    );
  };
  next();
}

module.exports = { auditMutation };
