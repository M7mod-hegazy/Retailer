const { getDb } = require("../config/database");

function getStateForUser(userId) {
  return getDb().prepare("SELECT page_key, completed FROM user_help_state WHERE user_id = ?").all(userId);
}

function markCompleted(userId, pageKey) {
  getDb()
    .prepare(
      "INSERT INTO user_help_state (user_id, page_key, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, page_key) DO UPDATE SET completed = 1",
    )
    .run(userId, pageKey);
}

function reset(userId) {
  getDb().prepare("DELETE FROM user_help_state WHERE user_id = ?").run(userId);
}

module.exports = { getStateForUser, markCompleted, reset };
