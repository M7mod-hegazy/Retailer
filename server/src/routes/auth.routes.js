const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { issueToken, signToken, authRequired, requireRole } = require("../middleware/auth");
const { UserModel } = require("../models/user.model");
const { getDb } = require("../config/database");
const { SYSTEM_OWNER_USERNAME } = require("../services/systemOwner.service");

const { auditMutation } = require("../middleware/audit");
const { nowSql } = require("../utils/datetime");
const { notifyOwner, EVENT_TYPES: TG } = require("../services/telegramService");

const router = express.Router();
router.use(auditMutation);

const loginAttempts = new Map(); // GAP-03 Track failed logins

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += alphabet[Number.parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = String(input || "").replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const char of cleaned) {
    const index = alphabet.indexOf(char);
    if (index >= 0) bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30000);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
  return code;
}

// ---- First-run setup ---------------------------------------------------
// Unauthenticated by design. Lets the very first administrator be created when
// the app has no real (non-system) users yet — the system owner "m7mod" is a
// hidden system account and does not count. The POST is hard-gated: the moment
// any non-system user exists it refuses, so it cannot be abused afterwards.
function countRealUsers(db) {
  return Number(
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE COALESCE(is_system_account, 0) = 0").get()?.c || 0,
  );
}

router.get("/setup-status", (_req, res, next) => {
  try {
    res.json({ success: true, data: { needsSetup: countRealUsers(getDb()) === 0 } });
  } catch (error) {
    next(error);
  }
});

router.post("/setup", (req, res, next) => {
  try {
    const db = getDb();
    if (countRealUsers(db) > 0) {
      const err = new Error("الإعداد الأولي مكتمل بالفعل");
      err.status = 403;
      err.code = "setup_already_done";
      throw err;
    }

    const payload = req.body || {};
    const username = String(payload.username || "").trim();
    const password = String(payload.password || "").trim();
    const full_name = String(payload.full_name || username).trim();

    if (!username || !password) {
      const err = new Error("اسم المستخدم وكلمة المرور مطلوبان");
      err.status = 400;
      throw err;
    }
    if (username.toLowerCase() === String(SYSTEM_OWNER_USERNAME).toLowerCase()) {
      const err = new Error("System owner username is reserved");
      err.status = 400;
      throw err;
    }
    const conflict = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (conflict) {
      const err = new Error("Username already taken");
      err.status = 409;
      throw err;
    }

    // Plaintext password matches the rest of the local user accounts (admins
    // can view/manage them). role=admin grants full access automatically.
    const info = db
      .prepare("INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)")
      .run(full_name, username, password);

    req.user = { id: info.lastInsertRowid };
    req.audit("create", "user", { id: info.lastInsertRowid, username }, `👤 إنشاء أول مدير عبر الإعداد الأولي: ${username}`);
    res.status(201).json({ success: true, data: { id: info.lastInsertRowid, username } });
  } catch (error) {
    next(error);
  }
});

router.post("/login", (req, res, next) => {
  const { username, password } = req.body || {};
  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedUsername || !normalizedPassword) {
    const error = new Error("اسم المستخدم وكلمة المرور مطلوبان");
    error.status = 400;
    return next(error);
  }
  
  // Dev account bypass — checked before DB and before lockout logic.
  // Disabled in the packaged (customer) app: DEV_EMAIL/DEV_PASSWORD are env
  // vars, and anyone with local access could set them before launching the
  // .exe to mint themselves a full-access "dev" session.
  const { isPackagedApp } = require("../../../shared/licensing/runtime");
  const devEmail = process.env.DEV_EMAIL;
  const devPassword = process.env.DEV_PASSWORD;
  if (!isPackagedApp() && devEmail && devPassword && normalizedUsername === devEmail && normalizedPassword === devPassword) {
    const devToken = signToken({ sub: "__dev__", role: "dev", username: devEmail });
    return res.json({ success: true, data: { token: devToken, user: { id: "__dev__", username: devEmail, role: "dev", page_permissions: null, can_view_updates: true } } });
  }

  // GAP-03: Account Lockout Check
  const attemptData = loginAttempts.get(normalizedUsername) || { count: 0, lockedUntil: null };
  if (attemptData.lockedUntil && attemptData.lockedUntil > Date.now()) {
    const waitSeconds = Math.ceil((attemptData.lockedUntil - Date.now()) / 1000);
    const error = new Error(`الحساب مقفل. يرجى الانتظار ${waitSeconds} ثانية.`);
    error.status = 403;
    return next(error);
  }

  const user = UserModel.findByUsername(normalizedUsername);
  if (!user || !UserModel.verifyPassword(user, normalizedPassword)) {
    // Increment failed attempts
    attemptData.count += 1;
    if (attemptData.count >= 5) {
      const lockDuration = 15 * 60 * 1000;
      attemptData.lockedUntil = Date.now() + lockDuration;
      setTimeout(() => loginAttempts.delete(normalizedUsername), lockDuration);
    }
    loginAttempts.set(normalizedUsername, attemptData);
    try {
      notifyOwner(TG.FAILED_LOGIN, {
        username: normalizedUsername,
        time: new Date().toISOString(),
        ip: req.ip || req.socket?.remoteAddress || "unknown",
      });
    } catch (_) {}

    const err = new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    err.status = 401;
    return next(err);
  }

  // Reset on success
  loginAttempts.delete(normalizedUsername);

  // Temporarily set req.user so audit records the correct user_id
  req.user = { id: user.id };
  req.audit("login", "auth", { username: user.username }, `👤 تسجيل دخول: ${user.username}`);

  const token = issueToken(user);
  return res.json({ success: true, data: { token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, page_permissions: user.page_permissions, can_view_updates: Boolean(user.can_view_updates) } } });
});

router.post("/logout", authRequired, async (req, res) => {
  try {
    const userRow = getDb().prepare(
      "SELECT COALESCE(NULLIF(full_name, ''), username) AS name FROM users WHERE id = ?"
    ).get(req.user.id);
    await Promise.race([
      notifyOwner(TG.USER_LOGOUT, {
        userName: userRow?.name || req.user?.username || `#${req.user?.id}`,
        reason: req.body?.reason || "تسجيل خروج",
        createdAt: new Date().toISOString(),
      }),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  } catch (err) {
    console.error("Telegram USER_LOGOUT notification failed:", err?.message || err);
  }
  return res.json({ success: true });
});

router.post("/change-password", authRequired, (req, res, next) => {
  if (req.user?.is_system_account) {
    const err = new Error("Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ¹Ø¯ÙŠÙ„ ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø­Ø³Ø§Ø¨ Ø§Ù„Ù†Ø¸Ø§Ù…");
    err.status = 403;
    return next(err);
  }

  const { oldPassword, newPassword } = req.body || {};
  const user = UserModel.findById(req.user.id);
  if (!UserModel.verifyPassword(user, oldPassword)) {
    const err = new Error("كلمة المرور الحالية غير صحيحة");
    err.status = 400;
    return next(err);
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  getDb().prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(hash, nowSql(), req.user.id);
  req.audit("change_password", "auth", { user_id: req.user.id }, `👤 تم تغيير كلمة المرور للمستخدم #${req.user.id}`);
  try {
    notifyOwner(TG.PASSWORD_CHANGED, {
      userName: user?.full_name || user?.username || `#${req.user.id}`,
      ipAddress: req.ip,
      createdAt: nowSql(),
    });
  } catch (_) {}
  return res.json({ success: true, data: { changed: true } });
});

router.post("/verify-password", authRequired, (req, res, next) => {
  const { password } = req.body || {};
  const rawPassword = String(password || "");
  if (!rawPassword) {
    const err = new Error("ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù…Ø·Ù„ÙˆØ¨Ø©");
    err.status = 400;
    return next(err);
  }

  const user = UserModel.findById(req.user.id);
  if (!user || !UserModel.verifyPassword(user, rawPassword)) {
    const err = new Error("ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± ØµØ­ÙŠØ­Ø©");
    err.status = 401;
    return next(err);
  }

  return res.json({ success: true, data: { verified: true } });
});

router.post("/unlock", authRequired, requireRole("admin"), (req, res) => {
  const username = String(req.body?.username || "").trim();
  if (username) {
    loginAttempts.delete(username);
  } else {
    loginAttempts.clear();
  }
  return res.json({ success: true, data: { unlocked: true, username: username || null, reason: req.body?.reason || null } });
});

router.post("/supervisor-override", authRequired, (req, res, next) => {
  const { pin, supervisor_pin: supervisorPin, action, details } = req.body || {};
  const approvalPin = String(pin || supervisorPin || "").trim();
  if (!approvalPin) {
    const err = new Error("رمز الإشراف مطلوب");
    err.status = 400;
    return next(err);
  }

  // Look for any admin or branch_manager with this pin hash (pin_code column).
  const supervisor = getDb()
    .prepare(
      "SELECT id, pin_code, role FROM users WHERE role IN ('admin', 'branch_manager') AND pin_code IS NOT NULL",
    )
    .all()
    .find((u) => {
      try {
        return bcrypt.compareSync(approvalPin, u.pin_code);
      } catch (_err) {
        return false;
      }
    });

  if (!supervisor) {
    const err = new Error("رمز الإشراف غير صحيح");
    err.status = 401;
    return next(err);
  }

  // Log the override
  try {
    getDb().prepare("INSERT INTO audit_logs (user_id, resource, action, payload_json) VALUES (?, ?, ?, ?)").run(
      supervisor.id, 'supervisor_override', action || 'override', JSON.stringify({ overridden_for: req.user.id, details })
    );
  } catch (e) {}

  try {
    const supervisorRow = getDb().prepare("SELECT full_name, username FROM users WHERE id = ?").get(supervisor.id);
    notifyOwner(TG.SUPERVISOR_OVERRIDE, {
      userName: req.user?.full_name || req.user?.username || `#${req.user?.id}`,
      action: action || "override",
      details: typeof details === "string" ? details : details ? JSON.stringify(details) : undefined,
      supervisor: supervisorRow?.full_name || supervisorRow?.username || `#${supervisor.id}`,
      createdAt: nowSql(),
    });
  } catch (_) {}

  return res.json({ success: true, data: { approved: true, supervisor_id: supervisor.id } });
});

router.post("/mfa/setup", authRequired, (req, res, next) => {
  try {
    const secret = base32Encode(crypto.randomBytes(20));
    const issuer = encodeURIComponent("ElHegazi Retailer");
    const label = encodeURIComponent(req.user.username || `user-${req.user.id}`);
    const otpauth = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    getDb().prepare("UPDATE users SET mfa_secret = ?, mfa_enabled = 0 WHERE id = ?").run(secret, req.user.id);
    res.json({ success: true, data: { secret, otpauth_url: otpauth, qr_code_data_url: null } });
  } catch (error) {
    next(error);
  }
});

router.post("/mfa/verify", authRequired, (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    const user = getDb().prepare("SELECT id, mfa_secret FROM users WHERE id = ?").get(req.user.id);
    if (!user?.mfa_secret) {
      const error = new Error("لم يتم إعداد المصادقة الثنائية");
      error.status = 400;
      throw error;
    }
    if (!token || generateTotp(user.mfa_secret) !== token) {
      const error = new Error("رمز المصادقة الثنائية غير صحيح");
      error.status = 401;
      throw error;
    }

    getDb().prepare("UPDATE users SET mfa_enabled = 1 WHERE id = ?").run(req.user.id);
    res.json({ success: true, data: { verified: true } });
  } catch (error) {
    next(error);
  }
});

router.post("/mfa/disable", authRequired, (req, res, next) => {
  try {
    getDb().prepare("UPDATE users SET mfa_secret = NULL, mfa_enabled = 0 WHERE id = ?").run(req.user.id);
    res.json({ success: true, data: { disabled: true } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
