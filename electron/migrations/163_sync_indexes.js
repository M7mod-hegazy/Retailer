module.exports = {
  up(db) {
    db.exec("CREATE INDEX IF NOT EXISTS idx_webhook_log_created_at ON webhook_log(created_at)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON sync_log(created_at)");
  },
};
