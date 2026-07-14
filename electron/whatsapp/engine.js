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

let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadContentFromMessage;
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
        makeCacheableSignalKeyStore = mod.makeCacheableSignalKeyStore || baileys.makeCacheableSignalKeyStore;
        downloadContentFromMessage = mod.downloadContentFromMessage || baileys.downloadContentFromMessage;
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
let waLastError = null;
let statusListeners = [];
let dailySentCount = 0;
let dailyResetDate = new Date().toISOString().slice(0, 10);
const DAILY_MARKETING_CAP = 200;
const THROTTLE_MIN_MS = 8000;
const THROTTLE_MAX_MS = 20000;

// ─── Connection state machine ────────────────────────────────────────────
let connecting = false;
let reconnectTimer = null;
let healthTimer = null;
let reconnectAttemptsByReason = {};

function notifyStatus() {
  statusListeners.forEach(fn => fn({ status: waStatus, qr: qrCode, error: waLastError }));
}

function normalizeError(msg) {
  if (!msg) return null;
  if (msg.includes("Stream Errored")) return "انقطع اتصال الواتساب، جاري إعادة المحاولة تلقائياً...";
  if (msg.includes("restart required")) return "الواتساب يطلب إعادة الاتصال، جاري المحاولة...";
  if (msg.includes("Connection Closed")) return "تم إغلاق اتصال الواتساب";
  if (msg.includes("timed out") || msg.includes("timeout")) return "انتهت مهلة الاتصال بالواتساب";
  if (msg.includes("not connected")) return "الواتساب غير متصل";
  if (msg.includes("conflict")) return "تعارض في الجلسة — جهاز آخر متصل بنفس الحساب";
  if (msg.includes("logged out")) return "تم تسجيل الخروج من الواتساب";
  if (msg.includes("badSession")) return "الجلسة تالفة، يرجى مسح الجلسة وإعادة الربط";
  if (msg.includes("replaced") || msg.includes("Connection Failure")) return "تم فتح واتساب ويب من جهاز آخر — أعد الربط من هنا";
  if (msg.includes("QR refs attempts ended")) return "انتهت مهلة رمز QR — اضغط ربط لتوليد رمز جديد";
  return msg;
}

function setStatus(s, err) {
  waStatus = s;
  if (err) {
    waLastError = normalizeError(err);
  } else if (s === "connecting" || s === "connected" || s === "qr") {
    waLastError = null;
  }
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

// ─── Media directory ────────────────────────────────────────────────────
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.join(process.env.UPLOADS_DIR, "uploads", "whatsapp")
  : path.join(__dirname, "../../uploads/whatsapp");

function ensureMediaDir() {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (_) {}
}

const MEDIA_EXT = {
  imageMessage: ".jpg",
  videoMessage: ".mp4",
  audioMessage: ".ogg",
  documentMessage: ".bin",
};

async function downloadAndStoreMedia(msg, db, msgDbId, msgId) {
  if (!downloadContentFromMessage) return null;
  const mediaType = msg.message?.imageMessage ? "image"
    : msg.message?.videoMessage ? "video"
    : msg.message?.audioMessage ? "audio"
    : msg.message?.documentMessage ? "document"
    : null;
  if (!mediaType) return null;
  const msgBody = msg.message?.imageMessage || msg.message?.videoMessage
    || msg.message?.audioMessage || msg.message?.documentMessage;
  if (!msgBody) return null;
  const baileysKey = mediaType === "image" ? "image"
    : mediaType === "video" ? "video"
    : mediaType === "audio" ? "audio"
    : "document";
  try {
    ensureMediaDir();
    const stream = await downloadContentFromMessage(msgBody, baileysKey);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const ext = MEDIA_EXT[Object.keys(msg.message).find(k => k.includes("Message"))] || ".bin";
    const filename = `${msgId || Date.now()}_${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    const mediaUrl = `/uploads/whatsapp/${filename}`;
    db.prepare("UPDATE wa_messages SET media_url=?, mime_type=? WHERE id=?").run(mediaUrl, msgBody.mimetype || null, msgDbId);
    return mediaUrl;
  } catch (_) { return null; }
}

function ensureConversation(db, jid, name) {
  if (!db || !jid) return null;
  const phone = jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  let conv = db.prepare("SELECT id, branch_id FROM wa_conversations WHERE remote_jid=?").get(jid);
  if (!conv) {
    let branchId = null;
    try {
      const c = db.prepare("SELECT branch_id FROM customers WHERE REPLACE(REPLACE(phone,' ',''),'-','')=? LIMIT 1").get(phone);
      if (c?.branch_id) branchId = c.branch_id;
    } catch (_) {}
    if (!branchId) {
      try {
        const l = db.prepare("SELECT branch_id FROM leads WHERE phone_normalized=? LIMIT 1").get(phone);
        if (l?.branch_id) branchId = l.branch_id;
      } catch (_) {}
    }
    const r = db.prepare("INSERT OR IGNORE INTO wa_conversations (remote_jid, phone_normalized, contact_name, branch_id) VALUES (?,?,?,?)").run(jid, phone, name || null, branchId);
    conv = { id: r.lastInsertRowid, branch_id: branchId };
    if (!conv.id) conv = db.prepare("SELECT id, branch_id FROM wa_conversations WHERE remote_jid=?").get(jid);
  } else if (name) {
    db.prepare("UPDATE wa_conversations SET contact_name=COALESCE(NULLIF(contact_name,''), ?) WHERE id=?").run(name, conv.id);
    if (!conv.branch_id) {
      let branchId = null;
      try {
        const c = db.prepare("SELECT branch_id FROM customers WHERE REPLACE(REPLACE(phone,' ',''),'-','')=? LIMIT 1").get(phone);
        if (c?.branch_id) branchId = c.branch_id;
      } catch (_) {}
      if (branchId) db.prepare("UPDATE wa_conversations SET branch_id=? WHERE id=?").run(branchId, conv.id);
    }
  }
  return conv ? conv.id : null;
}

function saveMediaBuffer(buffer, ext) {
  ensureMediaDir();
  const filename = `${Date.now()}_${Date.now()}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/whatsapp/${filename}`;
}

function storeMessage(db, jid, direction, msg, pushName, mediaUrl) {
  if (!db || !jid) return;
  const convId = ensureConversation(db, jid, pushName || null);
  if (!convId) return;
  const msgId = msg.key?.id;
  if (msgId) {
    const exists = db.prepare("SELECT id FROM wa_messages WHERE message_id=?").get(msgId);
    if (exists) {
      if (mediaUrl) db.prepare("UPDATE wa_messages SET media_url=? WHERE message_id=?").run(mediaUrl, msgId);
      return;
    }
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
  const result = db.prepare(`
    INSERT OR IGNORE INTO wa_messages (conversation_id, remote_jid, message_id, direction, message_type, body, caption, mime_type, media_url, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
  `).run(convId, jid, msgId || null, direction, msgType, text, caption || null, mimeType, mediaUrl || null, status);
  const insertedId = result?.lastInsertRowid;
  if (insertedId && msgType !== "text" && !mediaUrl) {
    downloadAndStoreMedia(msg, db, insertedId, msgId).catch(() => {});
  }
  if (insertedId && mediaUrl && mimeType) {
    db.prepare("UPDATE wa_messages SET mime_type=? WHERE id=?").run(mimeType, insertedId);
  }
  const preview = text.slice(0, 100) || (caption ? caption.slice(0, 100) : (msgType === "image" ? "📷 صورة" : ""));
  const updateUnread = direction === "inbound" ? "unread_count = unread_count + 1" : "unread_count = 0";
  db.prepare(`UPDATE wa_conversations SET last_message=?, last_message_at=datetime('now'), last_direction=?, ${updateUnread} WHERE id=?`).run(preview, direction, convId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function disposeSocket() {
  if (!sock) return;
  try {
    const s = sock;
    sock = null;
    if (s.ev) {
      try { s.ev.removeAllListeners("connection.update"); } catch (_) {}
      try { s.ev.removeAllListeners("creds.update"); } catch (_) {}
      try { s.ev.removeAllListeners("contacts.upsert"); } catch (_) {}
      try { s.ev.removeAllListeners("messages.upsert"); } catch (_) {}
      try { s.ev.removeAllListeners("messaging-history.set"); } catch (_) {}
    }
    if (s.ws && typeof s.ws.close === "function") {
      withTimeout(
        new Promise(resolve => {
          try {
            s.ws.removeAllListeners();
            s.ws.close();
            setTimeout(resolve, 1000);
          } catch (_) { resolve(); }
        }),
        5000,
        "ws.close timed out"
      ).catch(() => {});
    }
    try { s.end?.({ logout: false }); } catch (_) {}
    try { s.logout?.().catch(() => {}); } catch (_) {}
  } catch (_) {}
}

function clearAuth() {
  disposeSocket();
  try { fs.rmSync(getAuthDir(), { recursive: true, force: true }); } catch (_) {}
}

// ─── Backoff per reason ──────────────────────────────────────────────────
function getBackoff(code) {
  const key = String(code || "unknown");
  const count = (reconnectAttemptsByReason[key] || 0) + 1;
  reconnectAttemptsByReason[key] = count;

  // 408 timeout — fast retry, WhatsApp likely to accept quickly
  if (code === 408) {
    const delay = Math.min(2000 * Math.pow(2, count - 1), 30000);
    const jitter = Math.floor(Math.random() * 2000);
    return delay + jitter;
  }
  // 428 too many reconnect attempts — graduated, start slow
  if (code === 428) {
    const delay = Math.min(5000 * Math.pow(2, count), 120000);
    const jitter = Math.floor(Math.random() * 5000);
    return delay + jitter;
  }
  // 515 restart required — immediate first retry
  if (code === 515) {
    if (count === 1) return 1000 + Math.floor(Math.random() * 1000);
    return Math.min(5000 * Math.pow(2, count - 2), 60000) + Math.floor(Math.random() * 3000);
  }
  // 500 badSession — no reconnect
  if (code === 500) return -1;
  // Default exponential: 3s, 6s, 12s, 24s, 48s
  return Math.min(3000 * Math.pow(2, count - 1), 60000) + Math.floor(Math.random() * 3000);
}

function scheduleReconnect(code) {
  const delay = getBackoff(code);
  if (delay < 0) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    doConnect().catch(() => {});
  }, delay);
}

function stopHealthProbe() {
  if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
}

function startHealthProbe() {
  stopHealthProbe();
  healthTimer = setInterval(async () => {
    if (waStatus !== "connected" || !sock) return;
    try {
      const myJid = sock.user?.id;
      if (myJid && typeof sock.onWhatsApp === "function") {
        await withTimeout(sock.onWhatsApp(myJid.split(":")[0]), 15000, "health probe timed out");
      }
    } catch (_) {
      // Health probe failed — connection may be stale
      if (waStatus === "connected") {
        setStatus("disconnected", "انقطع الاتصال بالواتساب، جاري إعادة المحاولة...");
        scheduleReconnect(408);
      }
    }
  }, 60000);
}

// ─── Core connect ─────────────────────────────────────────────────────────
async function doConnect() {
  if (connecting) return;
  if (waStatus === "connected") return;
  connecting = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  stopHealthProbe();
  disposeSocket();
  try {
    setStatus("connecting");
    const ready = await withTimeout(loadBaileys(), 30000, "انتهت مهلة تحميل محرك الواتساب");
    if (!ready) {
      setStatus("error", "محرك الواتساب (Baileys) غير متوفر");
      scheduleReconnect();
      return;
    }

    const authDir = getAuthDir();
    fs.mkdirSync(authDir, { recursive: true });

    let version;
    try {
      ({ version } = await withTimeout(fetchLatestBaileysVersion(), 15000, "تعذر الحصول على إصدار الواتساب"));
    } catch (_) {
      version = [2, 3000, 1015901307];
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: { level: "silent", fatal() {}, error() {}, warn() {}, info() {}, debug() {}, trace() {}, child() { return this; } },
      syncFullHistory: true,
      defaultQueryTimeoutMs: 30000,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 20000,
      retryRequestDelayMs: 1000,
      maxMsgRetryCount: 3,
      markOnlineOnConnect: true,
      fireInitQueries: true,
      shouldIgnoreJid: jid => {
        if (!jid) return true;
        const s = jid.toString();
        return s.includes("@broadcast") || s.includes("@newsletter") || s.includes("@g.us");
      },
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

      if (connection === "open") {
        reconnectAttemptsByReason = {};
        setStatus("connected");
        startOutboxDrainer();
        startHealthProbe();
        return;
      }

      if (connection === "close") {
        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || "WhatsApp connection closed";
        const loggedOut = code === DisconnectReason?.loggedOut;
        const badSession = code === DisconnectReason?.badSession;
        const connectionReplaced = code === DisconnectReason?.connectionReplaced;

        if (loggedOut || badSession || connectionReplaced) {
          clearAuth();
          setStatus("disconnected");
          if (loggedOut) waLastError = "تم تسجيل الخروج من الواتساب";
          else if (badSession) waLastError = "الجلسة تالفة، يرجى مسح الجلسة وإعادة الربط";
          else waLastError = "تم فتح جلسة جديدة من جهاز آخر";
          notifyStatus();
          return;
        }

        setStatus("disconnected", reason);
        scheduleReconnect(code);
      }
    });

    // ─── Contact name caching ──────────────────────────────────────────
    sock.ev.on("contacts.upsert", (contacts) => {
      try {
        const db = getDb?.();
        if (!db) return;
        for (const c of contacts) {
          cacheContact(db, c.id, c.name, c.notify);
        }
      } catch (_) {}
    });

    // ─── Read receipts (messages.update) ──────────────────────────────
    sock.ev.on("messages.update", ({ updates }) => {
      try {
        const db = getDb?.();
        if (!db) return;
        for (const { key, update } of updates) {
          if (!key?.id || !key?.remoteJid) continue;
          if (update.status === undefined) continue;
          const statusMap = { 1: "delivered", 2: "delivered", 3: "delivered", 4: "read", 5: "played" };
          const s = statusMap[update.status];
          if (s) {
            db.prepare("UPDATE wa_messages SET status=? WHERE message_id=?").run(s, key.id);
          }
        }
      } catch (_) {}
    });

    // ─── Inbound message tracking + opt-out ────────────────────────────
    sock.ev.on("messages.upsert", ({ messages }) => {
      try {
        const db = getDb?.();
        for (const msg of messages) {
          if (!msg.message) continue;
          const jid = msg.key.remoteJid;
          if (!jid) continue;
          if (msg.key.fromMe) {
            if (db) storeMessage(db, jid, "outbound", msg);
          } else {
            if (db) storeMessage(db, jid, "inbound", msg, msg.pushName);
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
  } catch (err) {
    const msg = err?.message || "WhatsApp connect failed";
    setStatus("error", msg);
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

async function connect() {
  return doConnect();
}

async function disconnect() {
  stopHealthProbe();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  reconnectAttemptsByReason = {};
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
  const sent = await sock.sendMessage(jid, { image: imageBuffer, caption: caption || "" });
  try {
    const db = getDb?.();
    if (db) {
      const msgId = sent?.key?.id;
      const mediaUrl = saveMediaBuffer(imageBuffer, ".jpg");
      const mimeType = "image/jpeg";
      const imgMsg = {
        key: { id: msgId, remoteJid: jid, fromMe: true },
        message: { imageMessage: { caption: caption || "", mimetype: mimeType } },
        status: "sent",
      };
      storeMessage(db, jid, "outbound", imgMsg, null, mediaUrl);
    }
  } catch (_) {}
  return sent;
}

async function sendDocument(jid, fileBuffer, fileName, caption) {
  if (!sock || waStatus !== "connected") throw new Error("WhatsApp not connected");
  const sent = await sock.sendMessage(jid, {
    document: fileBuffer,
    fileName: fileName || "document",
    caption: caption || "",
    mimetype: "application/octet-stream",
  });
  try {
    const db = getDb?.();
    if (db) {
      const msgId = sent?.key?.id;
      const ext = fileName ? path.extname(fileName) || ".bin" : ".bin";
      const mediaUrl = saveMediaBuffer(fileBuffer, ext);
      const mimeType = "application/octet-stream";
      const docMsg = {
        key: { id: msgId, remoteJid: jid, fromMe: true },
        message: { documentMessage: { caption: caption || "", fileName: fileName || "document", mimetype: mimeType } },
        status: "sent",
      };
      storeMessage(db, jid, "outbound", docMsg, null, mediaUrl);
    }
  } catch (_) {}
  return sent;
}

async function sendAudio(jid, audioBuffer, ptt = true) {
  if (!sock || waStatus !== "connected") throw new Error("WhatsApp not connected");
  const sent = await sock.sendMessage(jid, { audio: audioBuffer, mimetype: "audio/ogg; codecs=opus", ptt });
  try {
    const db = getDb?.();
    if (db) {
      const msgId = sent?.key?.id;
      const mediaUrl = saveMediaBuffer(audioBuffer, ".ogg");
      const mimeType = "audio/ogg; codecs=opus";
      const audioMsg = {
        key: { id: msgId, remoteJid: jid, fromMe: true },
        message: { audioMessage: { mimetype: mimeType, seconds: 0, ptt } },
        status: "sent",
      };
      storeMessage(db, jid, "outbound", audioMsg, null, mediaUrl);
    }
  } catch (_) {}
  return sent;
}

async function checkExists(phone) {
  if (!sock || waStatus !== "connected") throw new Error("WhatsApp not connected");
  const jid = normalizePhone(phone);
  if (!jid) throw new Error("invalid phone");
  const number = jid.replace("@s.whatsapp.net", "");
  const result = await withTimeout(
    sock.onWhatsApp(number),
    10000, "check-exists timed out"
  );
  return result?.[0]?.exists ?? false;
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
    } else if (payload.image_url) {
      // Contain the read to the uploads tree — the payload comes from the DB
      // and a traversal path here would exfiltrate arbitrary files to the
      // recipient. Also honors UPLOADS_DIR so packaged builds read the real
      // per-user uploads folder instead of the read-only install dir.
      const uploadsRoot = path.resolve(
        process.env.UPLOADS_DIR
          ? path.join(process.env.UPLOADS_DIR, "uploads")
          : path.join(__dirname, "../../uploads")
      );
      const rel = String(payload.image_url).replace(/^[/\\]+uploads[/\\]+/i, "");
      const filePath = path.resolve(uploadsRoot, rel);
      if (!filePath.startsWith(uploadsRoot + path.sep) || !/\.(jpe?g|png|webp|gif)$/i.test(filePath)) {
        throw new Error(`invalid image path: ${payload.image_url}`);
      }
      const buf = fs.readFileSync(filePath);
      await sendImage(jid, buf, payload.text || "");
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

// ─── Inbound opt-out listener ─────────────────────────────────────────────
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
          try { db.prepare("UPDATE customers SET whatsapp_opt_out=1 WHERE phone=? OR phone=?").run(phone, local); } catch (_) {}
          try { db.prepare("UPDATE leads SET opted_out=1 WHERE phone_normalized=?").run(phone); } catch (_) {}
        }
      }
    }
  });
}

// ─── Auto-reconnect on boot ──────────────────────────────────────────────
function hasSavedSession() {
  try { return fs.existsSync(path.join(getAuthDir(), "creds.json")); } catch (_) { return false; }
}

setTimeout(() => {
  if (hasSavedSession()) {
    doConnect().catch(() => {});
  }
}, 3000);

module.exports = {
  connect, disconnect, sendText, sendImage, sendDocument, sendAudio, normalizePhone,
  checkExists, onStatusChange, setDbProvider, listenForOptOut, resolveContactName,
  hasSavedSession,
  getStatus: () => ({
    status: waStatus,
    qr: qrCode,
    error: waLastError,
    phone: waStatus === "connected" && sock
      ? sock.user?.id?.split(":")[0]?.replace(/[^0-9]/g, "")
      : null,
  }),
};
