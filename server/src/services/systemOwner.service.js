const { getDb } = require("../config/database");
const { nowSql } = require("../utils/datetime");

const SYSTEM_OWNER_USERNAME = process.env.SYSTEM_OWNER_USERNAME || "m7mod";
const SYSTEM_OWNER_FULL_NAME = process.env.SYSTEM_OWNER_FULL_NAME || "System Owner";
// Default hash is for password "275757". Use env override in production-local deployments.
const SYSTEM_OWNER_PASSWORD_HASH =
  process.env.SYSTEM_OWNER_PASSWORD_HASH || "$2b$10$c.EG6N8mlTBTLsTyTZdND.w4qNjsNFveototAWUVIX9VgAnceLFAW";

function ensureSystemOwnerAccount() {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(SYSTEM_OWNER_USERNAME);

  if (!existing) {
    db.prepare(
      "INSERT INTO users (full_name, username, password_hash, role, is_active, is_system_account) VALUES (?, ?, ?, 'dev', 1, 1)",
    ).run(SYSTEM_OWNER_FULL_NAME, SYSTEM_OWNER_USERNAME, SYSTEM_OWNER_PASSWORD_HASH);
    return;
  }

  db.prepare(
    "UPDATE users SET full_name = ?, password_hash = ?, role = 'dev', is_active = 1, is_system_account = 1, updated_at = ? WHERE id = ?",
  ).run(SYSTEM_OWNER_FULL_NAME, SYSTEM_OWNER_PASSWORD_HASH, nowSql(), existing.id);
}

module.exports = {
  ensureSystemOwnerAccount,
  SYSTEM_OWNER_USERNAME,
};
