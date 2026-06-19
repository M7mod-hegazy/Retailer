const bcrypt = require("bcryptjs");
const { getDb } = require("../config/database");

class UserModel {
  static findByUsername(username) {
    return getDb().prepare("SELECT * FROM users WHERE username = ?").get(username);
  }

  static findById(id) {
    return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  static create({ username, password, role = "admin", full_name = null }) {
    const passwordHash = bcrypt.hashSync(password, 10);
    const info = getDb()
      .prepare("INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(full_name, username, passwordHash, role);
    return this.findById(info.lastInsertRowid);
  }

  static update(id, patch) {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return null;

    const username = patch.username ?? existing.username;
    const role = patch.role ?? existing.role;
    const isActive = patch.is_active ?? existing.is_active;

    db.prepare("UPDATE users SET username = ?, role = ?, is_active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(username, role, isActive, id);

    return this.findById(id);
  }

  static verifyPassword(user, rawPassword) {
    const stored = user.password_hash || "";
    // Existing bcrypt hashes (admin/system accounts) — compare with bcrypt
    if (stored.startsWith("$2b$") || stored.startsWith("$2a$") || stored.startsWith("$2y$")) {
      return bcrypt.compareSync(rawPassword, stored);
    }
    // New users — plaintext comparison
    return stored === String(rawPassword);
  }
}

module.exports = { UserModel };
