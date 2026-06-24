// Data layer for Phase 2 dev↔store communication: conversations, messages,
// reactions, attachments, and announcements. All synchronous (better-sqlite3).

const { getDb } = require("./db");

function now() {
  return new Date().toISOString();
}

// ── Conversations ─────────────────────────────────────────────────────
function ensureConversation(licenseId, storeName) {
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (license_id, store_name)
     VALUES (?, ?)
     ON CONFLICT(license_id) DO UPDATE SET
       store_name = COALESCE(excluded.store_name, conversations.store_name)`,
  ).run(licenseId, storeName || null);
  return db.prepare("SELECT * FROM conversations WHERE license_id = ?").get(licenseId);
}

function setConversationStatus(licenseId, status) {
  const db = getDb();
  db.prepare(
    "UPDATE conversations SET status = ?, updated_at = ? WHERE license_id = ?",
  ).run(status, now(), licenseId);
  return db.prepare("SELECT * FROM conversations WHERE license_id = ?").get(licenseId);
}

function listConversations() {
  const db = getDb();
  // Each conversation with its last message snippet and unread (dev-perspective)
  // count: store messages not yet seen by the dev.
  return db
    .prepare(
      `SELECT c.*,
        (SELECT body FROM messages m WHERE m.license_id = c.license_id AND m.deleted_at IS NULL
           ORDER BY m.id DESC LIMIT 1) AS last_body,
        (SELECT COUNT(1) FROM messages m WHERE m.license_id = c.license_id
           AND m.sender_type = 'store' AND m.seen_at IS NULL AND m.deleted_at IS NULL) AS unread
       FROM conversations c
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`,
    )
    .all();
}

// ── Messages ──────────────────────────────────────────────────────────
function addMessage({ licenseId, senderType, senderName, channel, body, appVersion, deviceId, storeName }) {
  const db = getDb();
  ensureConversation(licenseId, storeName);
  const info = db
    .prepare(
      `INSERT INTO messages (license_id, sender_type, sender_name, channel, body, app_version, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(licenseId, senderType, senderName || null, channel || "support", body || "", appVersion || null, deviceId || null);

  // Bump conversation; a new store message re-opens a resolved/seen thread.
  const reopen = senderType === "store";
  db.prepare(
    `UPDATE conversations SET last_message_at = ?, updated_at = ?
       ${reopen ? ", status = CASE WHEN status IN ('resolved','seen') THEN 'new' ELSE status END" : ""}
     WHERE license_id = ?`,
  ).run(now(), now(), licenseId);

  return getMessage(info.lastInsertRowid);
}

function hydrate(message) {
  if (!message) return null;
  const db = getDb();
  const reactions = db
    .prepare("SELECT actor, emoji FROM message_reactions WHERE message_id = ?")
    .all(message.id);
  const attachments = db
    .prepare("SELECT id, kind, filename, mime, size FROM message_attachments WHERE message_id = ?")
    .all(message.id);
  const out = { ...message, reactions, attachments };
  if (message.deleted_at) out.body = null; // never leak deleted content
  return out;
}

function getMessage(id) {
  const db = getDb();
  return hydrate(db.prepare("SELECT * FROM messages WHERE id = ?").get(id));
}

function listMessages(licenseId, sinceId = 0) {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM messages WHERE license_id = ? AND id > ? ORDER BY id ASC")
    .all(licenseId, Number(sinceId) || 0);
  return rows.map(hydrate);
}

// `licenseId` scopes the action to one store (cross-tenant guard). Pass it for
// store-side calls; pass null for dev (owner) calls, which may act on any store.
function assertOwned(msg, licenseId) {
  if (!msg || (licenseId && msg.license_id !== licenseId)) {
    const err = new Error("Message not found");
    err.status = 404; // 404 (not 403) so ids of other tenants aren't probeable
    throw err;
  }
}

function editMessage(id, actorType, body, licenseId = null) {
  const db = getDb();
  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  assertOwned(msg, licenseId);
  if (msg.deleted_at) return getMessage(id);
  if (msg.sender_type !== actorType) {
    const err = new Error("Cannot edit another sender's message");
    err.status = 403;
    throw err;
  }
  db.prepare("UPDATE messages SET body = ?, edited_at = ? WHERE id = ?").run(body || "", now(), id);
  return getMessage(id);
}

function deleteMessage(id, actorType, licenseId = null) {
  const db = getDb();
  const msg = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  assertOwned(msg, licenseId);
  // Store may delete only its own; dev may delete any.
  if (actorType !== "dev" && msg.sender_type !== actorType) {
    const err = new Error("Cannot delete another sender's message");
    err.status = 403;
    throw err;
  }
  db.prepare("UPDATE messages SET deleted_at = ? WHERE id = ?").run(now(), id);
  return getMessage(id);
}

function toggleReaction(id, actor, emoji, licenseId = null) {
  const db = getDb();
  const owner = db.prepare("SELECT license_id FROM messages WHERE id = ?").get(id);
  assertOwned(owner, licenseId);
  const existing = db
    .prepare("SELECT 1 FROM message_reactions WHERE message_id = ? AND actor = ? AND emoji = ?")
    .get(id, actor, emoji);
  if (existing) {
    db.prepare("DELETE FROM message_reactions WHERE message_id = ? AND actor = ? AND emoji = ?").run(id, actor, emoji);
  } else {
    db.prepare("INSERT INTO message_reactions (message_id, actor, emoji) VALUES (?, ?, ?)").run(id, actor, emoji);
  }
  return getMessage(id);
}

// Mark messages from the OTHER side as seen by `readerType`, up to `uptoId`.
function markSeen(licenseId, readerType, uptoId) {
  const db = getDb();
  const otherSide = readerType === "dev" ? "store" : "dev";
  db.prepare(
    `UPDATE messages SET seen_at = COALESCE(seen_at, ?)
     WHERE license_id = ? AND sender_type = ? AND seen_at IS NULL AND id <= ?`,
  ).run(now(), licenseId, otherSide, Number(uptoId) || 0);
}

function getAttachment(id) {
  return getDb().prepare("SELECT * FROM message_attachments WHERE id = ?").get(id);
}

// License-scoped attachment lookup (cross-tenant guard for store access).
function getAttachmentForLicense(id, licenseId) {
  return getDb()
    .prepare(
      `SELECT a.* FROM message_attachments a
       JOIN messages m ON a.message_id = m.id
       WHERE a.id = ? AND m.license_id = ?`,
    )
    .get(id, licenseId);
}

function addAttachment(messageId, { kind, filename, mime, size, path }) {
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO message_attachments (message_id, kind, filename, mime, size, path) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(messageId, kind, filename || null, mime || null, size || null, path);
  return db.prepare("SELECT id, kind, filename, mime, size FROM message_attachments WHERE id = ?").get(info.lastInsertRowid);
}

// ── Announcements ─────────────────────────────────────────────────────
function parseVersion(v) {
  return String(v || "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}
function cmpVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function createAnnouncement({ title, body, type, targetKind, targetLicenseId, versionMin, versionMax }) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO announcements (title, body, type, target_kind, target_license_id, version_min, version_max)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title || null,
      body,
      type || "info",
      targetKind || "all",
      targetLicenseId || null,
      versionMin || null,
      versionMax || null,
    );
  return db.prepare("SELECT * FROM announcements WHERE id = ?").get(info.lastInsertRowid);
}

function announcementTargetsStore(a, licenseId, appVersion) {
  if (a.target_kind === "all") return true;
  if (a.target_kind === "license") return a.target_license_id === licenseId;
  if (a.target_kind === "version_range") {
    if (a.version_min && cmpVersion(appVersion, a.version_min) < 0) return false;
    if (a.version_max && cmpVersion(appVersion, a.version_max) > 0) return false;
    return true;
  }
  return false;
}

function listAnnouncementsForStore(licenseId, appVersion, sinceId = 0) {
  const db = getDb();
  const all = db
    .prepare("SELECT * FROM announcements WHERE id > ? ORDER BY id ASC")
    .all(Number(sinceId) || 0);
  const readRows = db
    .prepare("SELECT announcement_id FROM announcement_reads WHERE license_id = ?")
    .all(licenseId);
  const readSet = new Set(readRows.map((r) => r.announcement_id));
  return all
    .filter((a) => announcementTargetsStore(a, licenseId, appVersion))
    .map((a) => ({ ...a, read: readSet.has(a.id) }));
}

function listAnnouncements() {
  return getDb().prepare("SELECT * FROM announcements ORDER BY id DESC").all();
}

function markAnnouncementRead(announcementId, licenseId) {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO announcement_reads (announcement_id, license_id) VALUES (?, ?)",
    )
    .run(announcementId, licenseId);
}

module.exports = {
  ensureConversation,
  setConversationStatus,
  listConversations,
  addMessage,
  getMessage,
  listMessages,
  editMessage,
  deleteMessage,
  toggleReaction,
  markSeen,
  addAttachment,
  getAttachment,
  getAttachmentForLicense,
  createAnnouncement,
  listAnnouncementsForStore,
  listAnnouncements,
  markAnnouncementRead,
  cmpVersion,
};
