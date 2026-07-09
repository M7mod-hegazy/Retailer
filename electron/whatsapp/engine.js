const path = require("path");
const fs = require("fs");

function getAuthDir() {
  try {
    const { app } = require("electron");
    return path.join(app.getPath("userData"), "wa_auth");
  } catch (_) {
    const root = process.env.RETAILER_DATA_DIR || process.env.UPLOADS_DIR || require("os").tmpdir();
    return path.join(root, "wa_auth");
  }
}

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion;
let baileysLoading = null;
async function loadBaileys() {
  if (makeWASocket) return true;
  if (!baileysLoading) {
    baileysLoading = import("@whiskeysockets/baileys")
      .then((baileys) => {
        const mod = baileys.default && typeof baileys.default !== "function" ? baileys.default : baileys;
        makeWASocket = mod.default || mod.makeWASocket || baileys.default;
        useMultiFileAuthState = mod.useMultiFileAuthState || baileys.useMultiFileAuthState;
        DisconnectReason = mod.DisconnectReason || baileys.DisconnectReason;
        fetchLatestBaileysVersion = mod.fetchLatestBaileysVersion || baileys.fetchLatestBaileysVersion;
      })
      .catch((e) => {
        console.warn("[WA] Baileys not available:", e.message);
        baileysLoading = null;
      });
  }
  await baileysLoading;
  return Boolean(makeWASocket);
}

const { toJid, normalizeDigits } = require("../../server/src/utils/phone");

let sock = null;
let qrCode = null;
let waStatus = "disconnected";
let statusListeners = [];
let dailySentCount = 0;
let dailyResetDate = new Date().toISOString().slice(0, 10);
const DAILY_MARKETING_CAP = 200;
const THROTTLE_MIN_MS = 8000;
const THROTTLE_MAX_MS = 20000;

function notifyStatus() {
  statusListeners.forEach(fn => fn({ status: waStatus, qr: qrCode }));
}

function setStatus(s) {
  waStatus = s;
  if (s !== "qr") qrCode = null;
  notifyStatus();
}

function onStatusChange(fn) {
  statusListeners.push(fn);
  return () => { statusListeners = statusListeners.filter(x => x !== fn); };
}

// ─── Contact cache helpers ────────────────────────────────────────────────
function cacheContact(db, jid, name, pushName) {
  if (!db || !jid) return;
  const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  const existing = db.prepare("SELECT id, name, push_name FROM wa_contact_cache WHERE phone_normalized=?").get(phone);
  if (existing) {
    const newName = name || existing.name;
    const newPush = pushName || existing.push_name;
    if (newName !== existing.name || newPush !== existing.push_name) {
      db.prepare("UPDATE wa_contact_cache SET name=?, push_name=?, verified_at=datetime('now') WHERE id=?").run(newName, newPush, existing.id);
    }
  } else {
    db.prepare("INSERT OR IGNORE INTO wa_contact_cache (phone_normalized, name, push_name, verified_at) VALUES (?,?,?,datetime('now'))").run(phone, name || null, pushName || null);
  }
}

function ensureConversation(db, jid, name) {
  if (!db || !jid) return null;
  const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  let conv = db.prepare("SELECT id FROM wa_conversations WHERE remote_jid=?").get(jid);
  if (!conv) {
    const r = db.prepare("INSERT OR IGNORE INTO wa_conversations (remote_jid, phone_normalized, contact_name) VALUES (?,?,?)").run(jid, phone, name || null);
    conv = { id: r.lastInsertRowid };
    if (!conv.id) conv = db.prepare("SELECT id FROM wa_conversations WHERE remote_jid=?").get(jid);
  } else if (name) {
    db.prepare("UPDATE wa_conversations SET contact_name=COALESCE(NULLIF(contact_name,''), ?) WHERE id=?").run(name, conv.id);
  }
  return conv ? conv.id : null;
}

function storeMessage(db, jid, direction, msg, pushName) {
  if (!db || !jid) return;
  const convId = ensureConversation(db, jid, pushName || null);
  if (!convId) return;
  const msgId = msg.key?.id;
  if (msgId) {
    const exists = db.prepare("SELECT id FROM wa_messages WHERE message_id=?").get(msgId);
    if (exists) return;
  }
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
  const caption = msg.message?.imageMessage?.caption || "";
  const mimeType = msg.message?.imageMessage?.mimetype || msg.message?.documentMessage?.mimetype || null;
  let msgType = "text";
  if (msg.message?.imageMessage) msgType = "image";
  else if (msg.message?.documentMessage) msgType = "document";
  else if (msg.message?.videoMessage) msgType = "video";
  else if (msg.message?.audioMessage) msgType = "audio";
  const status = direction === "outbound" ? (msg.status || "sent") : "received";
  db.prepare(`
    INSERT OR IGNORE INTO wa_messages (conversation_id, remote_jid, message_id, direction, message_type, body, caption, mime_type, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
  `).run(convId, jid, msgId || null, direction, msgType, text, caption || null, mimeType, status);
  const preview = text.slice(0, 100) || (caption ? caption.slice(0, 100) : (msgType === "image" ? "📷 صورة" : ""));
  const updateUnread = direction === "inbound" ? "unread_count = unread_count + 1" : "unread_count = 0";
  db.prepare(`UPDATE wa_conversations SET last_message=?, last_message_at=datetime('now'), last_direction=?, ${updateUnread} WHERE id=?`).run(preview, direction, convId);
}

// ─── Connect ──────────────────────────────────────────────────────────────
async function connect() {
  if (waStatus === "connected" || waStatus === "connecting") return;
  const ready = await loadBaileys();
  if (!ready) return;
  setStatus("connecting");

  const authDir = getAuthDir();
  fs.mkdirSync(authDir, { recursive: true });

  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); }
  catch (_) { version = [2, 3000, 1015901307]; }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: { level: "silent", fatal() {}, error() {}, warn() {}, info() {}, debug() {}, trace() {}, child() { return this; } },
    syncFullHistory: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      (async () => {
        try {
          const QRCode = require("qrcode");
          qrCode = await QRCode.toDataURL(qr, { width: 256, margin: 1 });
        } catch (_) {
          qrCode = qr;
        }
        setStatus("qr");
      })();
    }
    if (connection === "open") { setStatus("connected"); startOutboxDrainer(); }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason?.loggedOut;
      if (loggedOut) {
        clearAuth();
        setStatus("disconnected");
      } else {
        setStatus("disconnected");
        setTimeout(connect, 5000);
      }
    }
  });

  // ─── Contact name caching ────────────────────────────────────────────
  sock.ev.on("contacts.upsert", (contacts) => {
    try {
      const db = getDb?.();
      if (!db) return;
      for (const c of contacts) {
        cacheContact(db, c.id, c.name, c.notify);
      }
    } catch (_) {}
  });

  // ─── Inbound message tracking + opt-out ──────────────────────────────
  sock.ev.on("messages.upsert", ({ messages }) => {
    try {
      const db = getDb?.();
      for (const msg of messages) {
        if (!msg.message) continue;
        const jid = msg.key.remoteJid;
        if (!jid) continue;
        if (msg.key.fromMe) {
          // Outbound — store sent messages with direction='outbound'
          if (db) storeMessage(db, jid, "outbound", msg);
        } else {
          // Inbound — store as inbound message
          if (db) storeMessage(db, jid, "inbound", msg, msg.pushName);
          // Opt-out detection
          const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim().toLowerCase();
          if (["stop", "إلغاء", "الغاء", "وقف"].includes(text)) {
            const phone = jid.replace("@s.whatsapp.net", "");
            if (phone && db) {
              const local = "0" + phone.replace(/^2/, "");
              try { db.prepare("UPDATE customers SET whatsapp_opt_out=1 WHERE phone=? OR phone=?").run(phone, local); } catch (_) {}
              try { db.prepare("UPDATE leads SET opted_out=1 WHERE phone_normalized=?").run(phone); } catch (_) {}
            }
          }
        }
      }
    } catch (_) {}
  });
}

function clearAuth() {
  try { fs.rmSync(getAuthDir(), { recursive: true, force: true }); } catch (_) {}
  sock = null;
}

async function disconnect() {
  try { await sock?.logout(); } catch (_) {}
  clearAuth();
  setStatus("disconnected");
}

async function sendText(jid, text) {
  if (!sock || waStatus !== "connected") throw new Error("WhatsApp not connected");
  const sent = await sock.sendMessage(jid, { text });
  try {
    const db = getDb?.();
    if (db) storeMessage(db, jid, "outbound", { key: { id: sent?.key?.id, remoteJid: jid, fromMe: true }, message: { conversation: text }, status: "sent" });
  } catch (_) {}
  return sent;
}

async function sendImage(jid, imageBuffer, caption) {
  if (!sock || waStatus !== "connected") throw new Error("WhatsApp not connected");
  await sock.sendMessage(jid, { image: imageBuffer, caption: caption || "" });
}

function normalizePhone(raw) {
  return toJid(raw);
}

// ─── Contact name resolution ──────────────────────────────────────────────
function resolveContactName(rawPhone) {
  try {
    const db = getDb?.();
    if (!db) return null;
    const norm = normalizeDigits(rawPhone);
    if (!norm) return null;
    const cached = db.prepare("SELECT name, push_name FROM wa_contact_cache WHERE phone_normalized=?").get(norm);
    if (cached) return cached.name || cached.push_name || null;
    return null;
  } catch (_) { return null; }
}

// ─── Outbox drainer ───────────────────────────────────────────────────────
const { markRecipient, isRecipientPaused } = require("../../server/src/services/campaignProgress");

let drainerTimer = null;
let draining = false;
let outboxCols = null;

// Default DB provider: the server's database module. Previously getDb was only
// set via the Electron IPC path (getWA()), so REST-only sessions had no DB —
// no message history and a dead outbox drainer.
let getDb = () => {
  try { return require("../../server/src/config/database").getDb(); } catch (_) { return null; }
};

function setDbProvider(fn) { getDb = fn; }

function getOutboxCols(db) {
  if (!outboxCols) {
    try { outboxCols = db.prepare("PRAGMA table_info(wa_outbox)").all().map(c => c.name); }
    catch (_) { outboxCols = []; }
  }
  return outboxCols;
}

function startOutboxDrainer() {
  if (drainerTimer) return;
  // Recover rows stuck in 'sending' after a crash/restart mid-throttle.
  // Channel-scoped so a reconnect never resets an SMS row mid-send.
  try {
    const db = getDb?.();
    if (db) {
      if (getOutboxCols(db).includes("channel")) {
        db.prepare("UPDATE wa_outbox SET status='pending' WHERE status='sending' AND (channel IS NULL OR channel='whatsapp')").run();
      } else {
        db.prepare("UPDATE wa_outbox SET status='pending' WHERE status='sending'").run();
      }
    }
  } catch (_) {}
  drainerTimer = setInterval(drainNext, 5000);
}

async function drainNext() {
  // The throttle sleep below (8–20s) outlives the 5s interval — without this
  // guard, overlapping ticks pick up the same pending row and send duplicates.
  if (draining) return;
  if (waStatus !== "connected") return;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyResetDate) { dailySentCount = 0; dailyResetDate = today; }

  draining = true;
  let claimed = null;
  try {
    const db = getDb?.();
    if (!db) return;
    const cols = getOutboxCols(db);
    const hasChannel = cols.includes("channel");
    const hasLink = cols.includes("campaign_recipient_id");
    const channelFilter = hasChannel ? "AND (channel IS NULL OR channel = 'whatsapp')" : "";
    const candidates = db.prepare(`
      SELECT * FROM wa_outbox
      WHERE status = 'pending'
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
        ${channelFilter}
      ORDER BY id ASC LIMIT 10
    `).all();
    const row = candidates.find(r => !(hasLink && r.campaign_recipient_id && isRecipientPaused(db, r.campaign_recipient_id)));
    if (!row) return;

    const isMarketing = ["birthday", "broadcast"].includes(row.kind);
    if (isMarketing && dailySentCount >= DAILY_MARKETING_CAP) return;

    // Claim atomically so no other tick (or future worker) can double-send it.
    const res = db.prepare("UPDATE wa_outbox SET status='sending' WHERE id=? AND status='pending'").run(row.id);
    if (res.changes !== 1) return;
    claimed = row;

    const jid = normalizePhone(row.recipient_phone);
    if (!jid) {
      db.prepare("UPDATE wa_outbox SET status='failed', error='invalid phone' WHERE id=?").run(row.id);
      if (hasLink) markRecipient(db, row.campaign_recipient_id, "skipped");
      claimed = null;
      return;
    }

    const payload = JSON.parse(row.payload || "{}");
    const delay = THROTTLE_MIN_MS + Math.random() * (THROTTLE_MAX_MS - THROTTLE_MIN_MS);
    await new Promise(r => setTimeout(r, delay));

    if (payload.image) {
      const buf = Buffer.from(payload.image, "base64");
      await sendImage(jid, buf, payload.caption || "");
    } else {
      await sendText(jid, payload.text || "");
    }

    db.prepare("UPDATE wa_outbox SET status='sent', sent_at=datetime('now'), attempts=attempts+1 WHERE id=?").run(row.id);
    if (hasLink) markRecipient(db, row.campaign_recipient_id, "sent");
    if (isMarketing) dailySentCount++;
    claimed = null;
  } catch (err) {
    try {
      if (claimed) {
        const db = getDb();
        const attempts = (claimed.attempts || 0) + 1;
        const status = attempts >= 3 ? "failed" : "pending";
        db.prepare("UPDATE wa_outbox SET status=?, attempts=?, error=? WHERE id=?")
          .run(status, attempts, String(err.message).slice(0, 200), claimed.id);
        if (status === "failed") markRecipient(db, claimed.campaign_recipient_id, "skipped");
      }
    } catch (_) {}
  } finally { draining = false; }
}

// ─── Inbound opt-out listener (legacy, kept for the Express route) ────────
function listenForOptOut(db) {
  if (!sock) return;
  sock.ev.on("messages.upsert", ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (["stop", "إلغاء", "الغاء", "وقف"].includes(text)) {
        const phone = msg.key.remoteJid?.replace("@s.whatsapp.net", "");
        if (phone) {
          const local = "0" + phone.replace(/^2/, "");
          try {
            db.prepare("UPDATE customers SET whatsapp_opt_out=1 WHERE phone=? OR phone=?")
              .run(phone, local);
          } catch (_) {}
          try {
            db.prepare("UPDATE leads SET opted_out=1 WHERE phone_normalized=?").run(phone);
          } catch (_) {}
        }
      }
    }
  });
}

// ─── Auto-reconnect on boot ───────────────────────────────────────────────
// A saved Baileys session survives restarts, but nothing re-opened it — the UI
// showed "غير متصل" after every reload/restart until the user clicked connect
// (which then linked instantly). Restore the session automatically instead.
function hasSavedSession() {
  try { return fs.existsSync(path.join(getAuthDir(), "creds.json")); } catch (_) { return false; }
}

setTimeout(() => {
  if (hasSavedSession() && waStatus === "disconnected") {
    connect().catch(() => {});
  }
}, 3000); // let the app/db finish booting first

module.exports = { connect, disconnect, sendText, sendImage, normalizePhone, onStatusChange, setDbProvider, listenForOptOut, resolveContactName, hasSavedSession, getStatus: () => ({ status: waStatus, qr: qrCode, phone: waStatus === "connected" && sock ? sock.user?.id?.split(":")[0]?.replace(/[^0-9]/g, "") : null }) };
