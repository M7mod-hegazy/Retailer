const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { getDb } = require("../config/database");
const NotificationModel = require("../models/notification.model");
const { broadcast } = require("./sse.routes");

function getSyncConfig(db) {
  return db.prepare("SELECT * FROM sync_config WHERE is_active = 1 LIMIT 1").get();
}

function verifySignature(payload, signature, secret) {
  if (!secret) return true;
  const { signature: _, ...data } = payload;
  const hmac = crypto.createHmac("sha256", secret).update(JSON.stringify(data)).digest("hex");
  if (hmac.length !== Buffer.from(signature).length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

router.post("/ecom/order", (req, res) => {
  try {
    const db = getDb();
    const cfg = getSyncConfig(db);

    if (!cfg) {
      return res.status(400).json({ ok: false, error: "Sync not configured" });
    }

    const { orderId, customerName, customerPhone, total, itemsCount, items, storeId, timestamp, signature } = req.body;

    if (!orderId || !customerName || !total) {
      return res.status(400).json({ ok: false, error: "Missing required fields: orderId, customerName, total" });
    }

    if (storeId && storeId !== cfg.store_id) {
      return res.status(403).json({ ok: false, error: "Store ID mismatch" });
    }

    if (signature && cfg.webhook_secret) {
      if (!verifySignature(req.body, signature, cfg.webhook_secret)) {
        db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code, error_message) VALUES ('order', ?, 'failed', 403, 'Invalid signature')")
          .run(JSON.stringify(req.body));
        return res.status(403).json({ ok: false, error: "Invalid signature" });
      }
    }

    if (cfg.auto_receive_orders) {
      const orderInfo = {
        customer: customerName,
        phone: customerPhone || "",
        total: Number(total) || 0,
        itemsCount: Number(itemsCount) || (items ? items.length : 0),
        orderId,
      };

      const notification = NotificationModel.create({
        title: `🛒 طلب جديد #${orderId}`,
        body: `${customerName} — ${Number(total).toFixed(2)} ر.س (${orderInfo.itemsCount} منتجات)`,
        type: "order",
        link: null,
      });

      broadcast("order:new", { notification, order: orderInfo });
    }

    if (cfg.auto_update_stock && items && Array.isArray(items)) {
      for (const item of items) {
        if (item.sku && item.quantity) {
          const existing = db.prepare("SELECT id, stock FROM items WHERE code = ?").get(item.sku);
          if (existing) {
            const newStock = Math.max(0, (Number(existing.stock) || 0) - Number(item.quantity));
            db.prepare("UPDATE items SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(newStock, existing.id);
          }
        }
      }
    }

    db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code) VALUES ('order', ?, 'success', 200)")
      .run(JSON.stringify(req.body));

    broadcast("sync:completed", { type: "order", orderId });

    res.json({ ok: true });
  } catch (err) {
    try {
      const db = getDb();
      db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code, error_message) VALUES ('order', ?, 'error', 500, ?)")
        .run(JSON.stringify(req.body || {}), err.message);
    } catch {}
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/logs", (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const logs = db.prepare("SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT ?").all(limit);
    res.json({ ok: true, items: logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/test", (req, res) => {
  try {
    const db = getDb();
    const cfg = getSyncConfig(db);

    const orderInfo = {
      customer: "أحمد محمد",
      phone: "0512345678",
      total: 250,
      itemsCount: 3,
      orderId: `TEST-${Date.now()}`,
    };

    const notification = NotificationModel.create({
      title: `🛒 طلب اختبار #${orderInfo.orderId}`,
      body: `${orderInfo.customer} — ${orderInfo.total} ر.س (${orderInfo.itemsCount} منتجات)`,
      type: "order",
      link: null,
    });

    broadcast("order:new", { notification, order: orderInfo });
    broadcast("sync:completed", { type: "test", orderId: orderInfo.orderId });

    db.prepare("INSERT INTO webhook_log (event_type, payload, status, response_code) VALUES ('test', ?, 'success', 200)")
      .run(JSON.stringify(orderInfo));

    res.json({ ok: true, message: "Test webhook sent", order: orderInfo });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/status", (req, res) => {
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
router.put("/config", (req, res) => {
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
