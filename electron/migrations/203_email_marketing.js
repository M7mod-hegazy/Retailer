/**
 * Migration 203 — Email Marketing
 * - settings: email provider config columns
 * - customers: add email column
 * - email_outbox: queued outbound emails
 * - email_events: delivery tracking (sent / opened / clicked / bounced)
 */
function up(db) {
  const addCol = (table, col, type) => {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
    if (!exists) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`).run();
  };

  // ── Settings: email provider config ──────────────────────────────────────
  addCol("settings", "email_enabled", "INTEGER NOT NULL DEFAULT 0");
  addCol("settings", "email_provider", "TEXT DEFAULT 'smtp'");
  addCol("settings", "email_host", "TEXT");
  addCol("settings", "email_port", "INTEGER DEFAULT 465");
  addCol("settings", "email_secure", "INTEGER DEFAULT 1");
  addCol("settings", "email_user", "TEXT");
  addCol("settings", "email_pass", "TEXT");
  addCol("settings", "email_api_key", "TEXT");
  addCol("settings", "email_domain", "TEXT");
  addCol("settings", "email_from_name", "TEXT");
  addCol("settings", "email_from_email", "TEXT");

  // ── Customers: add email column ──────────────────────────────────────────
  addCol("customers", "email", "TEXT DEFAULT NULL");

  // ── Campaigns: add subject column for email channel ──────────────────────
  addCol("campaigns", "email_subject", "TEXT");

  // ── email_outbox ─────────────────────────────────────────────────────────
  const hasOutbox = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_outbox'").get();
  if (!hasOutbox) {
    db.prepare(`
      CREATE TABLE email_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        subject TEXT NOT NULL,
        html_body TEXT,
        text_body TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
        error TEXT,
        campaign_id INTEGER,
        customer_id INTEGER,
        sent_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    db.prepare("CREATE INDEX idx_email_outbox_status ON email_outbox(status)").run();
    db.prepare("CREATE INDEX idx_email_outbox_campaign ON email_outbox(campaign_id)").run();
  }

  // ── email_events ─────────────────────────────────────────────────────────
  const hasEvents = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='email_events'").get();
  if (!hasEvents) {
    db.prepare(`
      CREATE TABLE email_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        recipient_email TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK(event_type IN ('sent','delivered','opened','clicked','bounced','unsubscribed')),
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
    db.prepare("CREATE INDEX idx_email_events_campaign ON email_events(campaign_id)").run();
  }
}

module.exports = { up };
