const express = require('express');
const { requirePagePermission } = require("../middleware/permission");
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { getDb } = require('../config/database');

const TOUR_DISABLE_KEY = '__disable_tours__';
const TOOLTIP_DISABLE_KEY = '__disable_tooltips__';

router.use(authRequired);
router.get('/state', authRequired, requirePagePermission("settings", "view"), (req, res, next) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const states = db.prepare('SELECT page_key FROM user_help_state WHERE user_id = ? AND completed = 1').all(userId);

    const toured_pages = {};
    let tours_disabled_globally = false;
    let tooltips_disabled_globally = false;

    states.forEach((state) => {
      if (state.page_key === TOUR_DISABLE_KEY) {
        tours_disabled_globally = true;
        return;
      }
      if (state.page_key === TOOLTIP_DISABLE_KEY) {
        tooltips_disabled_globally = true;
        return;
      }
      toured_pages[state.page_key] = true;
    });

    res.json({ success: true, data: { toured_pages, tours_disabled_globally, tooltips_disabled_globally } });
  } catch (err) {
    next(err);
  }
});

router.patch('/state/tour/:page_key', authRequired, requirePagePermission("settings", "edit"), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('INSERT INTO user_help_state (user_id, page_key, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, page_key) DO UPDATE SET completed=1').run(req.user.id, req.params.page_key);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/state/disable-tours', authRequired, requirePagePermission("settings", "edit"), (req, res, next) => {
  try {
    getDb()
      .prepare('INSERT INTO user_help_state (user_id, page_key, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, page_key) DO UPDATE SET completed=1')
      .run(req.user.id, TOUR_DISABLE_KEY);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/state/disable-tooltips', authRequired, requirePagePermission("settings", "edit"), (req, res, next) => {
  try {
    getDb()
      .prepare('INSERT INTO user_help_state (user_id, page_key, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, page_key) DO UPDATE SET completed=1')
      .run(req.user.id, TOOLTIP_DISABLE_KEY);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/state/reset', authRequired, requirePagePermission("settings", "edit"), (req, res, next) => {
  try {
    const targetUserId = req.user.role === 'admin' && req.body?.user_id ? Number(req.body.user_id) : req.user.id;
    getDb().prepare('DELETE FROM user_help_state WHERE user_id = ?').run(targetUserId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
