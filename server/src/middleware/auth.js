const jwt = require("jsonwebtoken");
const { UserModel } = require("../models/user.model");

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "8h" });
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
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");

    // Dev account bypass — skip DB lookup and license check entirely
    if (payload.sub === "__dev__") {
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
  } catch (_e) {
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
  const supervisor = db.prepare("SELECT id FROM users WHERE role = 'admin' AND pin_code = ? AND is_active = 1").get(pin);
  if (!supervisor) {
    const err = new Error("رمز مرور المشرف غير صحيح");
    err.status = 403;
    return next(err);
  }
  req.supervisorContext = supervisor.id;
  next();
}

module.exports = { issueToken, authRequired, requireRole, verifyPin };
