/**
 * WhatsApp engine — Baileys wrapper.
 * Runs in Electron main process. Exposes: link, unlink, sendText, sendImage, status.
 * Outbox drainer runs on a timer and respects throttle (8-20s between sends, ~200/day marketing cap).
 */
const path = require("path");
const fs = require("fs");

// Works in both Electron and plain Node (dev:web / browser mode)
function getAuthDir() {
  try {
    const { app } = require("electron");
    return path.join(app.getPath("userData"), "wa_auth");
  } catch (_) {
    return path.join(process.cwd(), "data", "wa_auth");
  }
}

// Baileys is ESM-only — load it lazily via dynamic import() so this CommonJS module loads cleanly.
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
        baileysLoading = null; // allow retry on next connect()
      });
  }
  await baileysLoading;
  return Boolean(makeWASocket);
}

const { toJid } = require("../../server/src/utils/phone");

let sock = null;
let qrCode = null;
let waStatus = "disconnected"; // disconnected | connecting | qr | connected
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
  });

  sock.ev.on("creds.update", saveCreds);

  // Inbound opt-out listener (flags both customers and leads)
  try { if (getDb) listenForOptOut(getDb()); } catch (_) {}

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
  await sock.sendMessage(jid, { text });
}

async function sendImage(jid, imageBuffer, caption) {
  if (!sock || waStatus !== "connected") throw new Error("WhatsApp not connected");
  await sock.sendMessage(jid, { image: imageBuffer, caption: caption || "" });
}

function normalizePhone(raw) {
  return toJid(raw);
}

// ─── Outbox drainer ───────────────────────────────────────────────────────────
let drainerTimer = null;
let getDb = null;

function setDbProvider(fn) { getDb = fn; }

function startOutboxDrainer() {
  if (drainerTimer) return;
  drainerTimer = setInterval(drainNext, 5000);
}

async function drainNext() {
  if (waStatus !== "connected" || !getDb) return;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyResetDate) { dailySentCount = 0; dailyResetDate = today; }

  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM wa_outbox
      WHERE status = 'pending'
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
      ORDER BY id ASC LIMIT 1
    `).get();
    if (!row) return;

    const isMarketing = ["birthday", "broadcast"].includes(row.kind);
    if (isMarketing && dailySentCount >= DAILY_MARKETING_CAP) return;

    const jid = normalizePhone(row.recipient_phone);
    if (!jid) {
      db.prepare("UPDATE wa_outbox SET status='failed', error='invalid phone' WHERE id=?").run(row.id);
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
    if (isMarketing) dailySentCount++;
  } catch (err) {
    try {
      const db = getDb();
      const row = db.prepare("SELECT * FROM wa_outbox WHERE status='pending' ORDER BY id ASC LIMIT 1").get();
      if (row) {
        const attempts = (row.attempts || 0) + 1;
        const status = attempts >= 3 ? "failed" : "pending";
        db.prepare("UPDATE wa_outbox SET status=?, attempts=?, error=? WHERE id=?")
          .run(status, attempts, String(err.message).slice(0, 200), row.id);
      }
    } catch (_) {}
  }
}

// Inbound opt-out listener
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

module.exports = { connect, disconnect, sendText, sendImage, normalizePhone, onStatusChange, setDbProvider, listenForOptOut, getStatus: () => ({ status: waStatus, qr: qrCode }) };
