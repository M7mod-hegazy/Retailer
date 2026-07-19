const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { UserModel } = require("../models/user.model");
const { isPackagedApp } = require("../../../shared/licensing/runtime");

// Resolve the signing secret ONCE at load time.
//  - Packaged app: ensurePackagedEnv() provisions a per-install random secret
//    before this module loads. If it is somehow missing, fall back to an
//    ephemeral random secret (users re-login after restart) — NEVER a constant
//    an attacker could use to forge admin tokens offline.
//  - Dev / tests: a stable constant so nodemon restarts don't log everyone out.
function resolveJwtSecret() {
  const fromEnv = String(process.env.JWT_SECRET || "").trim();
  if (fromEnv) return fromEnv;
  if (isPackagedApp() || process.env.NODE_ENV === "production") {
    return crypto.randomBytes(32).toString("hex");
  }
  return "super_secret_jwt_key_12345";
}

const JWT_SECRET = resolveJwtSecret();

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
}

// Sign an arbitrary payload with the SAME resolved secret as issueToken, so
// callers never re-derive the secret (and never re-introduce a fallback).
function signToken(payload, options = { expiresIn: "8h" }) {
  return jwt.sign(payload, JWT_SECRET, options);
}

function authRequired(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    const err = new Error("غير مصرح");
    err.status = 401;
    return next(err);
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Dev account bypass — skip DB lookup and license check entirely.
    // NEVER honored in the packaged (customer) app: there the dev login route
    // is disabled, so a "__dev__" token can only be a forgery attempt.
    if (payload.sub === "__dev__" && !isPackagedApp()) {
      req.user = { id: "__dev__", role: "dev", username: payload.username || payload.sub, is_active: 1 };
      return next();
    }

    const user = UserModel.findById(payload.sub);
    if (!user || !user.is_active) {
      const err = new Error("الحساب غير نشط");
      err.status = 401;
      return next(err);
    }

    req.user = user;
    return next();
  } catch (e) {
    console.error("[AUTH] Token verification failed:", e.message);
    const err = new Error("رمز دخول غير صالح");
    err.status = 401;
    return next(err);
  }
}

function requireRole(role) {
  return (req, _res, next) => {
    if (req.user?.role !== role && req.user?.role !== "admin" && req.user?.role !== "dev") {
      const err = new Error("غير مصرح: يتطلب صلاحيات أعلى");
      err.status = 403;
      err.code = "permission_denied";
      return next(err);
    }
    next();
  };
}

function verifyPin(req, _res, next) {
  const pin = req.headers["x-supervisor-pin"];
  if (!pin) {
    const err = new Error("يتطلب رمز مرور المشرف (PIN)");
    err.status = 403;
    err.code = "SUPERVISOR_PIN_REQUIRED";
    return next(err);
  }
  const db = require("../config/database").getDb();
  // PINs are stored either bcrypt-hashed (newer) or plaintext (legacy), so
  // compare both ways — a plaintext-only SQL match silently rejects hashed PINs.
  const rawPin = String(pin);
  const supervisor = db
    .prepare("SELECT id, pin_code FROM users WHERE role = 'admin' AND pin_code IS NOT NULL AND is_active = 1")
    .all()
    .find((u) => {
      const stored = String(u.pin_code || "");
      if (/^\$2[aby]\$/.test(stored)) {
        try { return bcrypt.compareSync(rawPin, stored); } catch (_e) { return false; }
      }
      return stored === rawPin;
    });
  if (!supervisor) {
    const err = new Error("رمز مرور المشرف غير صحيح");
    err.status = 403;
    return next(err);
  }
  req.supervisorContext = supervisor.id;
  next();
}

module.exports = { issueToken, signToken, authRequired, requireRole, verifyPin };
