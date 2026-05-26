const express = require("express");
const { authRequired } = require("../middleware/auth");
const { auditMutation } = require("../middleware/audit");
const {
  computeOwnerStatement,
  saveOwnerStatement,
  listOwnerStatements,
  getOwnerStatement,
  lockOwnerStatement,
  compareOwnerStatements,
} = require("../services/ownerStatementService");

const router = express.Router();
router.use(authRequired);
router.use(auditMutation);

function parsePagePermissions(user) {
  if (!user?.page_permissions) return {};
  if (typeof user.page_permissions === "string") {
    try { return JSON.parse(user.page_permissions); } catch { return {}; }
  }
  return user.page_permissions || {};
}

function requireOwnerStatement(action) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (["dev", "admin", "system_owner"].includes(user.role)) return next();
    const perms = parsePagePermissions(user);
    if (perms.owner_statement?.includes(action)) return next();
    return res.status(403).json({ error: "permission_denied", page: "owner_statement", action });
  };
}

function requireDates(req, res, next) {
  const start = req.query.start_date || req.body?.period_start;
  const end = req.query.end_date || req.body?.period_end;
  if (!start || !end) return res.status(400).json({ success: false, message: "period_start and period_end are required" });
  next();
}

router.get("/current", requireOwnerStatement("view"), requireDates, (req, res, next) => {
  try {
    const data = computeOwnerStatement(req.query.start_date, req.query.end_date, req.query.cost_method || "wacc");
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireOwnerStatement("view"), (_req, res, next) => {
  try {
    res.json({ success: true, data: listOwnerStatements() });
  } catch (error) {
    next(error);
  }
});

router.get("/compare", requireOwnerStatement("view"), (req, res, next) => {
  try {
    const leftId = Number(req.query.left_id);
    const rightId = Number(req.query.right_id);
    if (!leftId || !rightId) return res.status(400).json({ success: false, message: "left_id and right_id are required" });
    res.json({ success: true, data: compareOwnerStatements(leftId, rightId) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requireOwnerStatement("view"), (req, res, next) => {
  try {
    const data = getOwnerStatement(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, message: "Statement not found" });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireOwnerStatement("save"), requireDates, (req, res, next) => {
  try {
    const data = saveOwnerStatement({
      id: req.body?.id,
      period_start: req.body.period_start,
      period_end: req.body.period_end,
      cost_method: req.body.cost_method || "wacc",
      notes: req.body.notes || null,
      user_id: req.user?.id || null,
    });
    req.audit("save", "owner_statement", { id: data.id }, `تم حفظ إقفال صاحب المحل #${data.id}`, `/owner-statement`);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/lock", requireOwnerStatement("lock"), (req, res, next) => {
  try {
    const data = lockOwnerStatement(Number(req.params.id), req.user?.id || null);
    req.audit("lock", "owner_statement", { id: data.id }, `تم إقفال نسخة صاحب المحل #${data.id}`, `/owner-statement`);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
