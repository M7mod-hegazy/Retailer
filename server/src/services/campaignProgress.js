// Reports outbox send results back to campaign_recipients / campaigns.
// Used by both the WhatsApp drainer (electron/whatsapp/engine.js) and the SMS
// drainer (services/smsService.js). All calls are best-effort: a progress
// update must never fail a send that already happened.

let hasLinkColumn = null;
function outboxHasLinkColumn(db) {
  if (hasLinkColumn === null) {
    try {
      hasLinkColumn = db.prepare("PRAGMA table_info(wa_outbox)").all().some(c => c.name === "campaign_recipient_id");
    } catch (_) { hasLinkColumn = false; }
  }
  return hasLinkColumn;
}

// Mark one campaign recipient sent/skipped and roll the campaign counters.
// status: 'sent' | 'skipped'
function markRecipient(db, recipientId, status) {
  if (!recipientId) return;
  try {
    const rec = db.prepare("SELECT campaign_id, status FROM campaign_recipients WHERE id=?").get(recipientId);
    if (!rec || rec.status !== "pending") return;
    db.prepare("UPDATE campaign_recipients SET status=?, sent_at=CASE WHEN ?='sent' THEN datetime('now') ELSE sent_at END WHERE id=?")
      .run(status, status, recipientId);
    if (status === "sent") {
      db.prepare("UPDATE campaigns SET sent_count = sent_count + 1 WHERE id=?").run(rec.campaign_id);
    }
    const remaining = db.prepare("SELECT COUNT(*) AS c FROM campaign_recipients WHERE campaign_id=? AND status='pending'").get(rec.campaign_id)?.c || 0;
    if (remaining === 0) {
      db.prepare("UPDATE campaigns SET status='done' WHERE id=? AND status='active'").run(rec.campaign_id);
    }
  } catch (_) { /* progress reporting must never break sending */ }
}

// True when the outbox row belongs to a paused campaign (drainers skip it).
function isRecipientPaused(db, recipientId) {
  if (!recipientId) return false;
  try {
    const row = db.prepare(`
      SELECT c.status FROM campaign_recipients cr
      JOIN campaigns c ON c.id = cr.campaign_id
      WHERE cr.id = ?
    `).get(recipientId);
    return row?.status === "paused";
  } catch (_) { return false; }
}

module.exports = { markRecipient, isRecipientPaused, outboxHasLinkColumn };
