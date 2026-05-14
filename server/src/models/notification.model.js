const { getDb } = require("../config/database");

function list(limit = 50) {
  return getDb().prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?").all(limit);
}

function unreadCount() {
  return getDb().prepare("SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0").get().count;
}

function create(payload = {}) {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO notifications (title, body, type, is_read, link) VALUES (?, ?, ?, 0, ?)")
    .run(payload.title, payload.body, payload.type || "info", payload.link || null);
  return db.prepare("SELECT * FROM notifications WHERE id = ?").get(info.lastInsertRowid);
}

function markRead(id) {
  getDb().prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
}

function markAllRead() {
  getDb().prepare("UPDATE notifications SET is_read = 1 WHERE is_read = 0").run();
}

function remove(id) {
  getDb().prepare("DELETE FROM notifications WHERE id = ?").run(id);
}

module.exports = { list, unreadCount, create, markRead, markAllRead, remove };
