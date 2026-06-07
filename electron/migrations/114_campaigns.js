// Campaigns — guided one-at-a-time wa.me blasts. Recipients are materialized (snapshot) at
// create time so progress survives an app restart and audience changes don't shift the queue.
module.exports = {
  name: "114_campaigns",
  up(db) {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT,
        body          TEXT NOT NULL,                     -- template text with {name} etc.
        channel       TEXT NOT NULL DEFAULT 'whatsapp',  -- future: 'sms'
        audience_json TEXT NOT NULL DEFAULT '{}',        -- snapshot of filters used
        status        TEXT NOT NULL DEFAULT 'active',    -- active | paused | done
        total         INTEGER NOT NULL DEFAULT 0,
        sent_count    INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS campaign_recipients (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id   INTEGER NOT NULL,
        lead_id       INTEGER,
        customer_id   INTEGER,
        phone_normalized TEXT NOT NULL,
        name          TEXT,
        resolved_body TEXT NOT NULL,                     -- pre-rendered {name}-substituted text
        status        TEXT NOT NULL DEFAULT 'pending',   -- pending | sent | skipped
        sent_at       TEXT,
        ord           INTEGER NOT NULL DEFAULT 0
      )
    `).run();

    db.prepare(`CREATE INDEX IF NOT EXISTS idx_camprec_campaign ON campaign_recipients(campaign_id, status, ord)`).run();
  },
};
