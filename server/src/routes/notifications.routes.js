const express = require("express");
const NotificationModel = require("../models/notification.model");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

const router = express.Router();

router.use(authRequired);

router.get("/", requirePagePermission("reports", "view"), (req, res, next) => {
  try {
    res.json({ success: true, data: NotificationModel.list() });
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", requirePagePermission("reports", "view"), (_req, res, next) => {
  try {
    res.json({ success: true, data: { unread_count: NotificationModel.unreadCount() } });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/read", requirePagePermission("reports", "add"), (req, res, next) => {
  try {
    NotificationModel.markRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/read-all", requirePagePermission("reports", "add"), (req, res, next) => {
  try {
    NotificationModel.markAllRead();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePagePermission("reports", "delete"), (req, res, next) => {
  try {
    NotificationModel.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
