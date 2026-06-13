const { getDb } = require("../config/database");

function isFeatureEnabled(db, key) {
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  return row ? Boolean(row[key]) : false;
}

function featureGate(key) {
  return (req, res, next) => {
    try {
      const db = getDb();
      if (isFeatureEnabled(db, key)) return next();
      return res.status(403).json({ error: "feature_disabled", feature: key });
    } catch {
      return res.status(403).json({ error: "feature_disabled", feature: key });
    }
  };
}

module.exports = { isFeatureEnabled, featureGate };
