const express = require("express");
const { getDb } = require("../config/database");
const { requirePagePermission } = require("../middleware/permission");
const {
  calculateDailySummary,
  closeDailySession,
  ensureDailySessionSchema,
  ensureSessionForDate,
  getSession,
  localDate,
  normalizeDate,
} = require("../services/dailySessionService");

const router = express.Router();
const { authRequired } = require('../middleware/auth');
router.use(authRequired);

router.use((_req, _res, next) => {
  try {
    ensureDailySessionSchema(getDb());
    next();
  } catch (err) {
    next(err);
  }
});

/** Get or auto-create today's session */
router.get("/today", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const today = localDate();
    const session = ensureSessionForDate(db, today);
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Check if a write is allowed for a given date */
router.get("/write-guard", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const targetDate = normalizeDate(req.query.date || localDate());
    const blocker = db.prepare(`
      SELECT *
      FROM daily_sessions
      WHERE status = 'open' AND date < ?
      ORDER BY date ASC
      LIMIT 1
    `).get(targetDate);
    const session = getSession(db, targetDate, targetDate === localDate());
    const closed = session?.status === "closed";

    res.json({
      success: true,
      data: {
        can_write: !blocker && !closed,
        requested_date: targetDate,
        blocker: blocker || (closed ? session : null),
        reason: blocker ? "previous_day_open" : closed ? "selected_day_closed" : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Check if yesterday's session is unclosed */
router.get("/yesterday/alert", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = localDate(yesterday);
    const sess = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(yDate);
    const unclosed = sess && sess.status === "open";
    res.json({ success: true, data: { unclosed, session: sess || null } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Today's full financial equation */
router.get("/today/summary", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const summary = calculateDailySummary(db, localDate(), { createIfMissing: true });
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Get transactions by type (supports date param for historical) */
router.get("/today/transactions", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const { type = "pos", page = 1, limit = 100, search = "", date: queryDate, show_cancelled = "0" } = req.query;
    const targetDate = normalizeDate(queryDate || localDate());
    const offset = (Number(page) - 1) * Number(limit);
    const like = `%${search}%`;
    const pageArgs = [Number(limit), offset];

    const unionParts = {
      pos: {
        sql: `
           SELECT i.id, i.invoice_no AS doc_no, i.total AS amount, i.payment_type,
                 i.created_at, c.name AS party, i.status, i.cancel_reason AS description,
                 CASE
                   WHEN i.payment_type = 'installments' THEN 'installment_invoice'
                   WHEN i.payment_type = 'credit' THEN 'credit_invoice'
                   ELSE 'pos_invoice'
                 END AS doc_type,
                 CASE
                   WHEN i.status = 'cancelled' THEN 'cancelled'
                   WHEN i.payment_type = 'cash' THEN 'in'
                   WHEN i.payment_type = 'installments' AND i.total > 0 THEN 'in'
                   WHEN i.payment_type = 'multi' THEN 'in'
                   WHEN i.payment_type = 'bank_transfer' THEN 'bank'
                   ELSE 'account'
                 END AS cash_direction,
                 CASE
                   WHEN i.status = 'cancelled' THEN 0
                   WHEN i.payment_type = 'cash' THEN i.total
                   WHEN i.payment_type = 'installments' THEN COALESCE(
                     (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.invoice_id = i.id),
                     0
                   )
                   WHEN i.payment_type = 'multi' THEN (
                     SELECT COALESCE(SUM(p.amount), 0)
                     FROM payments p
                     JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
                     WHERE p.method = 'cash'
                   )
                   ELSE 0
                 END AS cash_effect,
                 CASE WHEN i.status = 'cancelled' THEN 1 ELSE 0 END AS is_cancelled,
                 i.amended_by,
                 i.amendment_of,
                 (SELECT invoice_no FROM invoices WHERE id = i.amendment_of) AS amendment_of_no,
                 (SELECT invoice_no FROM invoices WHERE id = i.amended_by) AS amended_by_no,
                 e.name       AS seller_name,
                 u.username   AS cancelled_by_name,
                  CASE
                    WHEN i.payment_type = 'multi' THEN (
                      SELECT GROUP_CONCAT(p.method || ':' || CAST(ROUND(p.amount, 2) AS TEXT), '|||')
                      FROM payments p
                      JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
                    )
                    WHEN i.payment_type = 'installments' THEN (
                      SELECT 'cash:' || CAST(ROUND(COALESCE(SUM(pa.amount), 0), 2) AS TEXT) ||
                             CASE WHEN i.total > COALESCE(SUM(pa.amount), 0)
                               THEN '|||credit:' || CAST(ROUND(i.total - COALESCE(SUM(pa.amount), 0), 2) AS TEXT)
                               ELSE ''
                             END
                      FROM payment_allocations pa WHERE pa.invoice_id = i.id
                    )
                    ELSE NULL
                  END AS payment_splits
          FROM invoices i
          LEFT JOIN customers c ON c.id = i.customer_id
          LEFT JOIN employees e ON e.id = i.seller_id
          LEFT JOIN users     u ON u.id = i.cancelled_by
          WHERE date(i.created_at) = ?
            AND (? = '' OR i.invoice_no LIKE ? OR c.name LIKE ? OR CAST(i.total AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like],
      },
      expenses: {
        sql: `
          SELECT e.id, e.doc_no, e.amount, e.payment_method,
                 e.created_at, ec.name AS party, NULL AS status, COALESCE(e.description, e.notes) AS description,
                 'expense' AS doc_type,
                 CASE WHEN COALESCE(e.payment_method, 'cash') = 'cash' THEN 'out' ELSE 'account' END AS cash_direction,
                 CASE WHEN COALESCE(e.payment_method, 'cash') = 'cash' THEN -e.amount ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM expenses e
          LEFT JOIN expense_categories ec ON ec.id = e.category_id
          WHERE date(e.created_at) = ?
            AND (? = '' OR e.doc_no LIKE ? OR ec.name LIKE ? OR e.description LIKE ? OR e.notes LIKE ? OR CAST(e.amount AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like, like, like],
      },
      revenues: {
        sql: `
          SELECT r.id, r.doc_no, r.amount, r.payment_method,
                 r.created_at, rc.name AS party, NULL AS status, COALESCE(r.description, r.notes) AS description,
                 'revenue' AS doc_type,
                 CASE WHEN COALESCE(r.payment_method, 'cash') = 'cash' THEN 'in' ELSE 'account' END AS cash_direction,
                 CASE WHEN COALESCE(r.payment_method, 'cash') = 'cash' THEN r.amount ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM revenues r
          LEFT JOIN revenue_categories rc ON rc.id = r.category_id
          WHERE date(r.created_at) = ?
            AND (? = '' OR r.doc_no LIKE ? OR rc.name LIKE ? OR r.description LIKE ? OR r.notes LIKE ? OR CAST(r.amount AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like, like, like],
      },
      purchases: {
        sql: `
          SELECT p.id, p.doc_no, p.total AS amount, 'cash' AS payment_method,
                 p.created_at, s.name AS party, p.status, NULL AS description,
                 'purchase' AS doc_type, 'account' AS cash_direction, 0 AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM purchases p
          LEFT JOIN suppliers s ON s.id = p.supplier_id
          WHERE date(p.created_at) = ? AND COALESCE(p.status, '') != 'voided'
            AND (? = '' OR p.doc_no LIKE ? OR s.name LIKE ? OR CAST(p.total AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like],
      },
      customer_payments: {
        sql: `
          SELECT py.id, COALESCE(py.reference_number, '#' || py.id) AS doc_no, py.amount, py.method AS payment_method,
                 py.created_at, c.name AS party, NULL AS status, py.notes AS description,
                 'customer_payment' AS doc_type,
                 CASE WHEN py.method = 'cash' THEN 'in' ELSE 'account' END AS cash_direction,
                 CASE WHEN py.method = 'cash' THEN py.amount ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM payments py
          LEFT JOIN customers c ON c.id = py.party_id
          WHERE date(py.created_at) = ? AND py.party_type = 'customer' AND py.invoice_id IS NULL
            AND (? = '' OR c.name LIKE ? OR py.notes LIKE ? OR CAST(py.amount AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like],
      },
      supplier_payments: {
        sql: `
          SELECT py.id, COALESCE(py.reference_number, '#' || py.id) AS doc_no, py.amount, py.method AS payment_method,
                 py.created_at, s.name AS party, NULL AS status, py.notes AS description,
                 'supplier_payment' AS doc_type,
                 CASE WHEN py.method = 'cash' THEN 'out' ELSE 'account' END AS cash_direction,
                 CASE WHEN py.method = 'cash' THEN -py.amount ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM payments py
          LEFT JOIN suppliers s ON s.id = py.party_id
          WHERE date(py.created_at) = ? AND py.party_type = 'supplier'
            AND (? = '' OR s.name LIKE ? OR py.notes LIKE ? OR CAST(py.amount AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like],
      },
      sales_returns: {
        sql: `
          SELECT sr.id, sr.doc_no, sr.total AS amount, sr.refund_method AS payment_method,
                 sr.created_at, c.name AS party, NULL AS status, sr.reason AS description,
                 'sales_return' AS doc_type,
                 CASE WHEN COALESCE(sr.refund_method, 'cash_back') = 'cash_back' THEN 'out' ELSE 'account' END AS cash_direction,
                 CASE WHEN COALESCE(sr.refund_method, 'cash_back') = 'cash_back' THEN -sr.total ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM sales_returns sr
          LEFT JOIN customers c ON c.id = sr.customer_id
          WHERE date(sr.created_at) = ?
            AND (? = '' OR sr.doc_no LIKE ? OR c.name LIKE ? OR sr.reason LIKE ? OR CAST(sr.total AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like, like],
      },
      purchase_returns: {
        sql: `
          SELECT pr.id, pr.doc_no, pr.total AS amount, COALESCE(pr.settlement_type, 'account') AS payment_method,
                 pr.created_at, s.name AS party, NULL AS status, NULL AS description,
                 'purchase_return' AS doc_type,
                 CASE WHEN COALESCE(pr.settlement_type, 'account') = 'cash' THEN 'in' ELSE 'account' END AS cash_direction,
                 CASE WHEN COALESCE(pr.settlement_type, 'account') = 'cash' THEN pr.total ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM purchase_returns pr
          LEFT JOIN suppliers s ON s.id = pr.supplier_id
          WHERE date(pr.created_at) = ?
            AND (? = '' OR pr.doc_no LIKE ? OR s.name LIKE ? OR CAST(pr.total AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like],
      },
      ajal_payments: {
        sql: `
          SELECT ap.id, 'AJAL-' || ap.debt_id AS doc_no, ap.amount, pm.name AS payment_method,
                 COALESCE(ap.created_at, ap.payment_date) AS created_at, COALESCE(c.name, s.name) AS party, NULL AS status, ap.notes AS description,
                 'ajal_payment' AS doc_type,
                 CASE
                   WHEN COALESCE(pm.type, pm.category, pm.name, 'cash') != 'cash' THEN 'account'
                   WHEN COALESCE(d.party_type, 'customer') = 'supplier' THEN 'out'
                   ELSE 'in'
                 END AS cash_direction,
                 CASE
                   WHEN COALESCE(pm.type, pm.category, pm.name, 'cash') != 'cash' THEN 0
                   WHEN COALESCE(d.party_type, 'customer') = 'supplier' THEN -ap.amount
                   ELSE ap.amount
                 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM ajal_payments ap
          LEFT JOIN ajal_debts d ON d.id = ap.debt_id
          LEFT JOIN customers c ON c.id = d.customer_id
          LEFT JOIN suppliers s ON s.id = d.supplier_id
          LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
          WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
            AND (? = '' OR c.name LIKE ? OR s.name LIKE ? OR ap.notes LIKE ? OR CAST(ap.amount AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like, like],
      },
      customer_ajal_payments: {
        sql: `
          SELECT ap.id, 'AJAL-' || ap.debt_id AS doc_no, ap.amount, pm.name AS payment_method,
                 COALESCE(ap.created_at, ap.payment_date) AS created_at, c.name AS party, NULL AS status, ap.notes AS description,
                 'ajal_payment' AS doc_type,
                 CASE WHEN COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash' THEN 'in' ELSE 'account' END AS cash_direction,
                 CASE WHEN COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash' THEN ap.amount ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM ajal_payments ap
          LEFT JOIN ajal_debts d ON d.id = ap.debt_id
          LEFT JOIN customers c ON c.id = d.customer_id
          LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
          WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
            AND COALESCE(d.party_type, 'customer') = 'customer'
            AND (? = '' OR c.name LIKE ? OR ap.notes LIKE ? OR CAST(ap.amount AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like],
      },
      supplier_ajal_payments: {
        sql: `
          SELECT ap.id, 'AJAL-' || ap.debt_id AS doc_no, ap.amount, pm.name AS payment_method,
                 COALESCE(ap.created_at, ap.payment_date) AS created_at, s.name AS party, NULL AS status, ap.notes AS description,
                 'ajal_payment' AS doc_type,
                 CASE WHEN COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash' THEN 'out' ELSE 'account' END AS cash_direction,
                 CASE WHEN COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash' THEN -ap.amount ELSE 0 END AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM ajal_payments ap
          LEFT JOIN ajal_debts d ON d.id = ap.debt_id
          LEFT JOIN suppliers s ON s.id = d.supplier_id
          LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
          WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
            AND COALESCE(d.party_type, 'customer') = 'supplier'
            AND (? = '' OR s.name LIKE ? OR ap.notes LIKE ? OR CAST(ap.amount AS TEXT) LIKE ?)
        `,
        params: [targetDate, search, like, like, like],
      },
      withdrawals: {
        sql: `
          SELECT w.id, w.doc_no, w.amount, w.payment_method,
                 w.created_at, wc.name AS party, NULL AS status, w.note AS description,
                 'withdrawal' AS doc_type, 'out' AS cash_direction, -w.amount AS cash_effect,
                 0 AS is_cancelled, NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
                 NULL AS seller_name, NULL AS cancelled_by_name, NULL AS payment_splits
          FROM withdrawals w
          LEFT JOIN withdrawal_categories wc ON wc.id = w.category_id
          WHERE date(w.created_at) = ?
            AND (? = '' OR CAST(w.amount AS TEXT) LIKE ? OR w.note LIKE ? OR wc.name LIKE ? OR w.doc_no LIKE ?)
        `,
        params: [targetDate, search, like, like, like, like],
      },
    };

    const aliases = {
      customer_cash_collections: ["customer_payments", "customer_ajal_payments"],
      supplier_cash_payments: ["supplier_payments", "supplier_ajal_payments"],
    };
    // Cancellation reversals — appear on the cancellation date as negative entries
    const cancellationReversalSql = `
      SELECT i.id, i.invoice_no AS doc_no, -(i.total) AS amount, i.payment_type,
             i.cancelled_at AS created_at, c.name AS party, 'cancelled' AS status,
             i.cancel_reason AS description,
             'cancelled_invoice' AS doc_type, 'reversal' AS cash_direction,
             CASE
               WHEN i.payment_type = 'cash' THEN -(i.total)
               WHEN i.payment_type = 'installments' THEN -(
                 SELECT COALESCE(SUM(pa.amount), 0) FROM payment_allocations pa WHERE pa.invoice_id = i.id
               )
               WHEN i.payment_type = 'multi' THEN -(
                 SELECT COALESCE(SUM(p.amount), 0)
                 FROM payments p
                 JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
                 WHERE p.method = 'cash'
               )
               ELSE 0
             END AS cash_effect,
             0 AS is_cancelled,
             NULL AS amended_by, NULL AS amendment_of, NULL AS amendment_of_no, NULL AS amended_by_no,
             NULL AS seller_name, u.username AS cancelled_by_name,
              CASE
                WHEN i.payment_type = 'multi' THEN (
                  SELECT GROUP_CONCAT(p.method || ':' || CAST(ROUND(p.amount, 2) AS TEXT), '|||')
                  FROM payments p
                  JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.invoice_id = i.id
                )
                WHEN i.payment_type = 'installments' THEN (
                  SELECT 'cash:' || CAST(ROUND(COALESCE(SUM(pa.amount), 0), 2) AS TEXT) ||
                         CASE WHEN i.total > COALESCE(SUM(pa.amount), 0)
                           THEN '|||credit:' || CAST(ROUND(i.total - COALESCE(SUM(pa.amount), 0), 2) AS TEXT)
                           ELSE ''
                         END
                  FROM payment_allocations pa WHERE pa.invoice_id = i.id
                )
                ELSE NULL
              END AS payment_splits
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN users     u ON u.id = i.cancelled_by
      WHERE date(i.cancelled_at) = ?
        AND i.payment_type IN ('cash','multi','installments','credit')
        AND (? = '' OR i.invoice_no LIKE ? OR c.name LIKE ? OR i.cancel_reason LIKE ?)
    `;

    const requestedTypes = type === "all"
      ? Object.keys(unionParts).filter((key) => !["customer_ajal_payments", "supplier_ajal_payments"].includes(key))
      : (aliases[type] || [type]);
    let selectedTypes = requestedTypes.filter((key) => unionParts[key]);

    if (!selectedTypes.length && show_cancelled !== "1") return res.json({ success: true, data: [] });

    let sql = selectedTypes.map((key) => unionParts[key].sql).join("\nUNION ALL\n");
    let params = selectedTypes.flatMap((key) => unionParts[key].params);

    if (show_cancelled === "1" && (type === "all" || type === "pos")) {
      const cancellationParams = [targetDate, search, like, like, like];
      if (sql) {
        sql = sql + "\nUNION ALL\n" + cancellationReversalSql;
        params = [...params, ...cancellationParams];
      } else {
        sql = cancellationReversalSql;
        params = cancellationParams;
      }
    }

    if (!sql) return res.json({ success: true, data: [] });

    const rows = db.prepare(`
      SELECT *
      FROM (${sql})
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, ...pageArgs);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Add a withdrawal */
router.post("/today/withdrawals", requirePagePermission("daily_treasury", "add"), (req, res) => {
  try {
    const db = getDb();
    const today = localDate();
    const { amount, note } = req.body || {};
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "المبلغ مطلوب" });
    }

    const session = ensureSessionForDate(db, today);
    if (session.status === "closed") {
      return res.status(423).json({ success: false, code: "DAILY_SESSION_CLOSED", message: "يومية اليوم مغلقة" });
    }

    db.prepare(
      "INSERT INTO daily_withdrawals (session_id, amount, note, created_by) VALUES (?, ?, ?, ?)",
    ).run(session.id, Number(amount), note || null, req.user?.id || 1);

    db.prepare(
      "UPDATE daily_sessions SET total_withdrawals = total_withdrawals + ? WHERE id = ?",
    ).run(Number(amount), session.id);

    res.status(201).json({ success: true, data: { message: "تم تسجيل المسحوبات" } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Close today's session */
router.post("/today/close", requirePagePermission("daily_treasury", "add"), (req, res) => {
  try {
    const db = getDb();
    const { actual_cash, notes } = req.body || {};
    const session = closeDailySession(db, localDate(), actual_cash, notes, req.user?.id || 1);
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

/** Close any open session by date */
router.post("/:date/close", requirePagePermission("daily_treasury", "add"), (req, res) => {
  try {
    const db = getDb();
    const { actual_cash, notes } = req.body || {};
    const session = closeDailySession(db, req.params.date, actual_cash, notes, req.user?.id || 1);
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

/** Force-close yesterday with calculated expected balance */
router.post("/yesterday/force-close", requirePagePermission("daily_treasury", "add"), (req, res) => {
  try {
    const db = getDb();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = localDate(d);
    const summary = calculateDailySummary(db, yesterday);
    if (!summary?.session) return res.status(404).json({ success: false, message: "لا توجد جلسة بالأمس" });
    if (summary.session.status === "closed") return res.json({ success: true, data: summary.session });

    const session = closeDailySession(db, yesterday, summary.expected_cash, "إغلاق تلقائي حسب الرصيد المتوقع", req.user?.id || 1);
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

/** Reopen the latest closed day if it was closed by mistake */
router.post("/:date/reopen", requirePagePermission("daily_treasury", "add"), (req, res) => {
  try {
    const db = getDb();
    const targetDate = normalizeDate(req.params.date);
    const session = getSession(db, targetDate, false);
    if (!session) return res.status(404).json({ success: false, message: "لا توجد يومية لهذا التاريخ" });
    if (session.status !== "closed") return res.status(400).json({ success: false, message: "اليومية مفتوحة بالفعل" });

    const later = db.prepare("SELECT * FROM daily_sessions WHERE date > ? ORDER BY date ASC LIMIT 1").get(targetDate);
    if (later) {
      return res.status(409).json({
        success: false,
        message: `لا يمكن إعادة فتح ${targetDate} لأن يوم ${later.date} موجود بعده. افتح آخر يوم مغلق فقط حتى لا تختلط الأرصدة.`,
      });
    }

    db.prepare(`
      UPDATE daily_sessions
      SET status = 'open', closed_at = NULL, closed_by = NULL,
          closing_balance = NULL, actual_cash = NULL, discrepancy = NULL,
          reopened_at = datetime('now'), reopened_by = ?, reopen_reason = ?
      WHERE id = ?
    `).run(req.user?.id || 1, req.body?.reason || null, session.id);

    res.json({ success: true, data: db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(session.id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Edit opening balance on an open day */
router.patch("/:date/opening-balance", requirePagePermission("daily_treasury", "edit"), (req, res) => {
  try {
    const db = getDb();
    const targetDate = normalizeDate(req.params.date);
    const { opening_balance, reason } = req.body || {};
    const session = getSession(db, targetDate, false);
    if (!session) return res.status(404).json({ success: false, message: "لا توجد يومية لهذا التاريخ" });
    if (session.status === "closed") return res.status(423).json({ success: false, message: "لا يمكن تعديل الرصيد الافتتاحي بعد الإغلاق. أعد فتح اليوم أولاً." });
    if (opening_balance == null || Number(opening_balance) < 0) return res.status(400).json({ success: false, message: "الرصيد الافتتاحي غير صحيح" });
    if (!reason || String(reason).trim().length < 4) return res.status(400).json({ success: false, message: "سبب تعديل الرصيد الافتتاحي مطلوب" });

    db.prepare(`
      UPDATE daily_sessions
      SET opening_balance = ?, opening_adjusted_at = datetime('now'), opening_adjusted_by = ?, opening_adjust_reason = ?
      WHERE id = ?
    `).run(Number(opening_balance), req.user?.id || 1, String(reason).trim(), session.id);

    res.json({ success: true, data: db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(session.id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** List sessions */
router.get("/", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const { search = "", status = "", limit = 180 } = req.query;
    const conditions = ["1=1"];
    const params = [];
    if (status) { conditions.push("status = ?"); params.push(status); }
    if (search) { conditions.push("(date LIKE ? OR notes LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    const rows = db.prepare(`
      SELECT *
      FROM daily_sessions
      WHERE ${conditions.join(" AND ")}
      ORDER BY date DESC
      LIMIT ?
    `).all(...params, Number(limit));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Summary for a specific date */
router.get("/:date/summary", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const summary = calculateDailySummary(db, req.params.date);
    if (!summary) return res.status(404).json({ success: false, message: "لا توجد جلسة لهذا اليوم" });
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Single session by date */
router.get("/:date", requirePagePermission("daily_treasury", "view"), (req, res) => {
  try {
    const db = getDb();
    const session = getSession(db, req.params.date, false);
    if (!session) return res.status(404).json({ success: false, message: "لا توجد جلسة لهذا اليوم" });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
