// Grant the new whatsapp_receipt:send permission to the default user permission set
// and to existing non-admin/non-dev users that already have stored page_permissions.
function addActionToPermissions(jsonStr, page, action) {
  const obj = jsonStr ? JSON.parse(jsonStr) : {};
  if (!obj[page]) obj[page] = [];
  if (!obj[page].includes(action)) obj[page].push(action);
  return JSON.stringify(obj);
}

module.exports = {
  name: "173_whatsapp_receipt_permission",
  up(db) {
    // 1. Update default_user_permissions used for new users and any existing user
    //    whose page_permissions column is NULL.
    try {
      const defaultRow = db
        .prepare("SELECT value FROM settings_kv WHERE key = 'default_user_permissions'")
        .get();
      const updatedDefault = addActionToPermissions(
        defaultRow?.value || "{}",
        "whatsapp_receipt",
        "send"
      );
      db.prepare(
        "INSERT INTO settings_kv (key, value) VALUES ('default_user_permissions', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(updatedDefault);
    } catch (err) {
      // settings_kv may not exist on very old schemas; non-fatal.
      console.warn("[migration 173] could not update default_user_permissions:", err.message);
    }

    // 2. Backfill existing non-admin/non-dev users that already have stored permissions.
    try {
      const users = db
        .prepare(
          "SELECT id, page_permissions FROM users WHERE page_permissions IS NOT NULL AND role NOT IN ('admin','dev')"
        )
        .all();
      const update = db.prepare("UPDATE users SET page_permissions = ? WHERE id = ?");
      for (const u of users) {
        try {
          const updated = addActionToPermissions(u.page_permissions, "whatsapp_receipt", "send");
          update.run(updated, u.id);
        } catch {
          // Skip malformed JSON; leave as-is.
        }
      }
    } catch (err) {
      console.warn("[migration 173] could not backfill user permissions:", err.message);
    }
  },
};
