// WhatsApp CRM tables: contact name cache, conversations, and inbound messages.
// Enables full inbox, contact name resolution, and conversation history.
module.exports = {
  name: "158_whatsapp_crm",
  up(db) {
    const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);

    // Contact name cache — populated by Baileys contacts.upsert events
    if (!cols("wa_contact_cache").length) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS wa_contact_cache (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_normalized  TEXT NOT NULL UNIQUE,
          name              TEXT,
          push_name         TEXT,
          verified_at       TEXT,
          created_at        TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_wacc_phone ON wa_contact_cache(phone_normalized)`).run();
    }

    // Conversations — one row per unique remote JID
    if (!cols("wa_conversations").length) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS wa_conversations (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          remote_jid        TEXT NOT NULL UNIQUE,
          phone_normalized  TEXT NOT NULL,
          contact_name      TEXT,
          last_message      TEXT,
          last_message_at   TEXT,
          last_direction    TEXT,
          unread_count      INTEGER NOT NULL DEFAULT 0,
          status            TEXT NOT NULL DEFAULT 'active',
          created_at        TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_wacv_jid ON wa_conversations(remote_jid)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_wacv_lastmsg ON wa_conversations(last_message_at)`).run();
    }

    // Messages — individual inbound/outbound messages
    if (!cols("wa_messages").length) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS wa_messages (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id   INTEGER NOT NULL,
          remote_jid        TEXT NOT NULL,
          message_id        TEXT UNIQUE,
          direction         TEXT NOT NULL,
          message_type      TEXT NOT NULL DEFAULT 'text',
          body              TEXT,
          caption           TEXT,
          media_url         TEXT,
          mime_type         TEXT,
          status            TEXT NOT NULL DEFAULT 'sent',
          created_at        TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id)
        )
      `).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_wamsg_conv ON wa_messages(conversation_id)`).run();
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_wamsg_jid ON wa_messages(remote_jid)`).run();
    }

    // Add scheduled_at to campaigns if missing
    const campCols = cols("campaigns");
    if (!campCols.includes("scheduled_at")) {
      db.prepare("ALTER TABLE campaigns ADD COLUMN scheduled_at TEXT").run();
    }
  },
};
