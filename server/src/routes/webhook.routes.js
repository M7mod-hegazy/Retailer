const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { getDb } = require("../config/database");
const NotificationModel = require("../models/notification.model");
const { broadcast } = require("./sse.routes");
const { authRequired } = require("../middleware/auth");
const { requirePagePermission } = require("../middleware/permission");

function getSyncConfig(db) {
  return db.prepare("SELECT * FROM sync_config WHERE is_active = 1 LIMIT 1").get();
}

// HMAC over the payload minus its own `signature` field.
function verifySignature(payload, signature, secret) {
  if (!signature) return false;
  const { signature: _sig, ...data } = payload;
  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(data)).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

router.post("/ecom/order", (req, res) => {
  try {
    const db = getDb();
    const cfg = getSyncConfig(db);

    if (!cfg) {
      return res.status(400).json({ ok: false, error: "Sync not configured" });
    }

    const { orderId, customerName, customerPhone, total, itemsCount, items, storeId, signature } = req.body || {};

    if (!orderId || !customerName || total === undefined || total === null) {
      return res.status(400).json({ ok: false, error: "Missing required fields: orderId, customerName, total" });
    }

    if (storeId && cfg.store_id && String(storeId) !== String(cfg.store_id)) {
      return res.status(403).json({ ok: false, error: "Store ID mismatch" });
    }

    // Strict HMAC: when a webhook secret is configured, a valid signature is REQUIRED
    // (missing OR wrong signature is rejected — no silent bypass).
    if (cfg.webhook_secret) {
      if (!verifySignature(req.body, signature, cfg.webhook_secret)) {
        db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code, error_message) VALUES ('order', ?, 'failed', 403, 'Invalid or missing signature')")
          .run(JSON.stringify(req.body));
        return res.status(403).json({ ok: false, error: "Invalid or missing signature" });
      }
    }

    // Idempotency: the same online order delivered twice must not create duplicates
    // or double-count anything. Ack the retry and stop.
    const dup = db.prepare("SELECT id FROM online_orders WHERE ecom_order_id = ?").get(String(orderId));
    if (dup) {
      db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code, error_message) VALUES ('order', ?, 'success', 200, 'duplicate')")
        .run(JSON.stringify(req.body));
      return res.json({ ok: true, duplicate: true, id: dup.id });
    }

    const normItems = Array.isArray(items) ? items : [];
    const count = Number(itemsCount) || normItems.length;

    // Queue for review — NO stock/treasury effects here. Stock is applied only when
    // the user forwards the order into a POS invoice.
    const info = db.prepare(
      `INSERT INTO online_orders (ecom_order_id, store_id, customer_name, customer_phone, total, items_count, items_json, raw_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(
      String(orderId),
      storeId ? String(storeId) : null,
      String(customerName),
      customerPhone ? String(customerPhone) : null,
      Number(total) || 0,
      count,
      JSON.stringify(normItems),
      JSON.stringify(req.body),
    );

    const orderInfo = {
      id: info.lastInsertRowid,
      customer: customerName,
      phone: customerPhone || "",
      total: Number(total) || 0,
      itemsCount: count,
      orderId,
    };

    let notification = null;
    if (cfg.auto_receive_orders) {
      notification = NotificationModel.create({
        title: `🛒 طلب جديد #${orderId}`,
        body: `${customerName} — ${(Number(total) || 0).toFixed(2)} (${count})`,
        type: "order",
        link: "/sync",
      });
    }

    const pendingCount = db.prepare("SELECT COUNT(*) AS c FROM online_orders WHERE status = 'pending'").get().c;
    broadcast("order:new", { notification, order: orderInfo, pendingCount });

    db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code) VALUES ('order', ?, 'success', 200)")
      .run(JSON.stringify(req.body));

    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    try {
      const db = getDb();
      db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code, error_message) VALUES ('order', ?, 'error', 500, ?)")
        .run(JSON.stringify(req.body || {}), err.message);
    } catch {}
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
//  ONLINE ORDER REVIEW QUEUE
// ══════════════════════════════════════════════════════════════════

// ── GET /api/webhooks/orders — list queued online orders ──
router.get("/orders", authRequired, requirePagePermission("sync", "view"), (req, res) => {
  try {
    const db = getDb();
    const status = req.query.status || "pending";
    const limit = Math.min(200, Number(req.query.limit) || 50);
    let rows;
    if (status === "all") {
      rows = db.prepare("SELECT * FROM online_orders ORDER BY received_at DESC LIMIT ?").all(limit);
    } else {
      rows = db.prepare("SELECT * FROM online_orders WHERE status = ? ORDER BY received_at DESC LIMIT ?").all(status, limit);
    }
    const items = rows.map((r) => ({ ...r, items: safeParse(r.items_json, []) }));
    const pendingCount = db.prepare("SELECT COUNT(*) AS c FROM online_orders WHERE status = 'pending'").get().c;
    res.json({ ok: true, items, pendingCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/webhooks/orders/:id — one order ──
router.get("/orders/:id", authRequired, requirePagePermission("sync", "view"), (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM online_orders WHERE id = ?").get(Number(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: "Order not found" });
    res.json({ ok: true, item: { ...row, items: safeParse(row.items_json, []) } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/webhooks/orders/:id/prepare — match SKUs → POS items + customer ──
// Returns a prefill payload the POS cart can consume (mirrors the quotation-convert flow).
router.get("/orders/:id/prepare", authRequired, requirePagePermission("sync", "edit"), (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM online_orders WHERE id = ?").get(Number(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: "Order not found" });

    const orderItems = safeParse(row.items_json, []);
    const lines = [];
    const unmatched = [];
    for (const it of orderItems) {
      const sku = it.sku || it.code || null;
      const qty = Number(it.quantity || it.qty || 1) || 1;
      const priceIn = it.price !== undefined ? Number(it.price) : null;
      const posItem = sku ? db.prepare("SELECT id, name, code, sale_price FROM items WHERE code = ?").get(String(sku)) : null;
      if (posItem) {
        lines.push({
          item_id: posItem.id,
          item_name: posItem.name,
          code: posItem.code || "",
          quantity: qty,
          unit_price: priceIn != null ? priceIn : Number(posItem.sale_price || 0),
          warehouse_id: null,
        });
      } else {
        unmatched.push({ sku: sku || "", name: it.name || "", quantity: qty });
      }
    }

    // Match customer by phone; return existing id or the raw name/phone for creation.
    let customer = { customer_id: null, customer_name: row.customer_name || "", customer_phone: row.customer_phone || "" };
    if (row.customer_phone) {
      const digits = String(row.customer_phone).replace(/\D/g, "");
      const found = digits
        ? db.prepare("SELECT id, name FROM customers WHERE REPLACE(REPLACE(phone,'+',''),' ','') LIKE ? AND is_active = 1 LIMIT 1").get(`%${digits}%`)
        : null;
      if (found) { customer.customer_id = found.id; customer.customer_name = found.name; }
    }

    res.json({ ok: true, prefill: { lines, customer, from_online_order_id: row.id }, unmatched, order: { ...row, items: orderItems } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/webhooks/orders/:id/forward — mark forwarded + link invoice ──
router.post("/orders/:id/forward", authRequired, requirePagePermission("sync", "edit"), (req, res) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const invoiceId = req.body?.invoice_id ? Number(req.body.invoice_id) : null;
    const row = db.prepare("SELECT id, status FROM online_orders WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ ok: false, error: "Order not found" });
    db.prepare("UPDATE online_orders SET status = 'forwarded', invoice_id = ?, forwarded_at = datetime('now') WHERE id = ?").run(invoiceId, id);
    const pendingCount = db.prepare("SELECT COUNT(*) AS c FROM online_orders WHERE status = 'pending'").get().c;
    broadcast("orders:updated", { pendingCount });
    res.json({ ok: true, pendingCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/webhooks/orders/:id/ignore — dismiss without invoicing ──
router.post("/orders/:id/ignore", authRequired, requirePagePermission("sync", "edit"), (req, res) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const row = db.prepare("SELECT id FROM online_orders WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ ok: false, error: "Order not found" });
    db.prepare("UPDATE online_orders SET status = 'ignored' WHERE id = ?").run(id);
    const pendingCount = db.prepare("SELECT COUNT(*) AS c FROM online_orders WHERE status = 'pending'").get().c;
    broadcast("orders:updated", { pendingCount });
    res.json({ ok: true, pendingCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

router.get("/logs", authRequired, requirePagePermission("sync", "view"), (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const logs = db.prepare("SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT ?").all(limit);
    res.json({ ok: true, items: logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/test", authRequired, requirePagePermission("sync", "edit"), (req, res) => {
  try {
    const db = getDb();

    const orderId = `TEST-${Date.now()}`;
    const testItems = [{ sku: "TEST-SKU", name: "منتج تجريبي", quantity: 1, price: 250 }];
    const info = db.prepare(
      `INSERT INTO online_orders (ecom_order_id, store_id, customer_name, customer_phone, total, items_count, items_json, raw_json, status)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(orderId, "أحمد محمد", "0512345678", 250, testItems.length, JSON.stringify(testItems), JSON.stringify({ test: true }));

    const orderInfo = {
      id: info.lastInsertRowid,
      customer: "أحمد محمد",
      phone: "0512345678",
      total: 250,
      itemsCount: testItems.length,
      orderId,
    };

    const notification = NotificationModel.create({
      title: `🛒 طلب اختبار #${orderInfo.orderId}`,
      body: `${orderInfo.customer} — ${orderInfo.total} (${orderInfo.itemsCount})`,
      type: "order",
      link: "/sync",
    });

    const pendingCount = db.prepare("SELECT COUNT(*) AS c FROM online_orders WHERE status = 'pending'").get().c;
    broadcast("order:new", { notification, order: orderInfo, pendingCount });

    db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code) VALUES ('test', ?, 'success', 200)")
      .run(JSON.stringify(orderInfo));

    res.json({ ok: true, message: "Test webhook sent", order: orderInfo });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/status", authRequired, requirePagePermission("sync", "view"), (req, res) => {
  try {
    const db = getDb();
    const cfg = getSyncConfig(db);
    if (!cfg) {
      return res.json({ ok: true, configured: false });
    }

    const lastDelivery = db.prepare("SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT 1").get();
    const recentDeliveries = db.prepare("SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT 5").all();

    res.json({
      ok: true,
      configured: true,
      webhookUrl: `${req.protocol}://${req.get("host")}/api/webhooks/ecom/order`,
      webhookSecret: cfg.webhook_secret ? `${cfg.webhook_secret.slice(0, 8)}...${cfg.webhook_secret.slice(-4)}` : null,
      autoReceiveOrders: !!cfg.auto_receive_orders,
      autoUpdateStock: !!cfg.auto_update_stock,
      lastDelivery,
      recentDeliveries,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/webhooks/config — update webhook settings ──
router.put("/config", authRequired, requirePagePermission("settings", "edit"), (req, res) => {
  try {
    const db = getDb();
    const cfg = getSyncConfig(db);
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const { autoReceiveOrders, autoUpdateStock, webhookSecret } = req.body;
    const updates = [];
    const params = [];

    if (autoReceiveOrders !== undefined) {
      updates.push("auto_receive_orders = ?");
      params.push(autoReceiveOrders ? 1 : 0);
    }
    if (autoUpdateStock !== undefined) {
      updates.push("auto_update_stock = ?");
      params.push(autoUpdateStock ? 1 : 0);
    }
    if (webhookSecret !== undefined) {
      updates.push("webhook_secret = ?");
      params.push(webhookSecret);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: "No fields to update" });
    }

    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE sync_config SET ${updates.join(", ")} WHERE id = ?`).run(...params, cfg.id);

    res.json({ ok: true, message: "Webhook config updated" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
