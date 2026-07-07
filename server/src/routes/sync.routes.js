const express = require("express");
const router = express.Router();
const { getDb } = require("../config/database");
const https = require("https");
const http = require("http");
const { createSnapshot } = require("./syncHelpers");

function getConfig(db) {
  return db.prepare("SELECT * FROM sync_config WHERE is_active = 1 LIMIT 1").get();
}

function apiFetch(baseUrl, path, options = {}) {
  const url = new URL(path, baseUrl.replace(/\/+$/, ""));
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : null;
    const req = lib.request(
      url,
      {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "x-store-id": options.storeId || "",
          "x-api-key": options.apiKey || "",
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
          ...(options.headers || {}),
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data: { ok: false, error: data.slice(0, 200) } });
          }
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

// ── GET /api/sync/config — return current sync config (masked) ──
router.get("/config", (req, res) => {
  try {
    const db = getDb();
    const cfg = db.prepare("SELECT * FROM sync_config WHERE is_active = 1 LIMIT 1").get();
    if (!cfg) return res.json({ ok: true, configured: false });

    res.json({
      ok: true,
      configured: true,
      config: {
        id: cfg.id,
        ecom_url: cfg.ecom_url,
        store_id: cfg.store_id,
        api_key: cfg.api_key ? `${cfg.api_key.slice(0, 8)}...${cfg.api_key.slice(-4)}` : null,
        last_sync_at: cfg.last_sync_at,
        is_active: cfg.is_active,
        auto_sync_enabled: !!cfg.auto_sync_enabled,
        sync_interval_minutes: cfg.sync_interval_minutes || 30,
        last_auto_sync_at: cfg.last_auto_sync_at,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── PUT /api/sync/config — save/update sync config ──
router.put("/config", (req, res) => {
  try {
    const db = getDb();
    const { ecom_url, store_id, api_key, auto_sync_enabled, sync_interval_minutes } = req.body;

    if (!ecom_url || !store_id || !api_key) {
      return res.status(400).json({ ok: false, error: "ecom_url, store_id, and api_key are required" });
    }

    const existing = db.prepare("SELECT id FROM sync_config WHERE is_active = 1 LIMIT 1").get();
    if (existing) {
      db.prepare("UPDATE sync_config SET ecom_url = ?, store_id = ?, api_key = ?, auto_sync_enabled = ?, sync_interval_minutes = ?, updated_at = datetime('now') WHERE id = ?")
        .run(ecom_url, store_id, api_key, auto_sync_enabled ? 1 : 0, sync_interval_minutes || 30, existing.id);
    } else {
      db.prepare("INSERT INTO sync_config (ecom_url, store_id, api_key, auto_sync_enabled, sync_interval_minutes) VALUES (?, ?, ?, ?, ?)")
        .run(ecom_url, store_id, api_key, auto_sync_enabled ? 1 : 0, sync_interval_minutes || 30);
    }

    res.json({ ok: true, message: "Sync config saved" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/register-webhook — register POS webhook URL with E-com admin ──
router.post("/register-webhook", async (req, res) => {
  try {
    const db = getDb();
    const cfg = db.prepare("SELECT * FROM sync_config WHERE is_active = 1 LIMIT 1").get();
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const webhookUrl = `${req.protocol}://${req.get("host")}/api/webhooks/ecom/order`;
    const webhookSecret = cfg.webhook_secret || "";

    const apiRes = await apiFetch(cfg.ecom_url, `/api/sync/admin/stores/${cfg.store_id}/webhook`, {
      method: "PUT",
      body: { webhookUrl, isActive: true, webhookSecret },
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    if (apiRes.status !== 200) {
      return res.status(502).json({ ok: false, error: apiRes.data?.error || "Registration failed" });
    }

    res.json({ ok: true, webhookUrl, message: "Webhook registered with E-com" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/status — test connection + get summary ──
router.get("/status", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.json({ ok: false, error: "Sync not configured", configured: false });

    const apiRes = await apiFetch(cfg.ecom_url, "/api/sync/status", {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    if (apiRes.status !== 200) {
      return res.json({ ok: false, error: apiRes.data?.error || "Connection failed" });
    }

    const pendingCount = db.prepare("SELECT COUNT(*) as count FROM sync_changes WHERE status = 'pending'").get();

    res.json({
      ok: true,
      connected: true,
      lastSyncAt: cfg.last_sync_at,
      pendingChanges: pendingCount.count,
      ecomStatus: apiRes.data.status,
    });
  } catch (err) {
    res.json({ ok: false, error: err.message, configured: true });
  }
});

// ── GET /api/sync/verify — staged connection verification ──
// Accepts optional overrides (ecom_url / store_id / api_key) via query or body so the
// setup wizard can test the values being entered BEFORE they are saved.
const verifyHandler = async (req, res) => {
  try {
    const db = getDb();
    const src = { ...(req.query || {}), ...(req.body || {}) };
    const saved = getConfig(db) || {};
    const cfg = {
      ...saved,
      ...(src.ecom_url ? { ecom_url: src.ecom_url } : {}),
      ...(src.store_id ? { store_id: src.store_id } : {}),
      ...(src.api_key ? { api_key: src.api_key } : {}),
    };
    if (!cfg.ecom_url || !cfg.store_id || !cfg.api_key) return res.json({ ok: false, steps: [
      { key: "domain", status: "error", message: "Sync not configured" },
      { key: "server", status: "skip" },
      { key: "auth", status: "skip" },
      { key: "data", status: "skip" },
    ]});

    const steps = [];
    // 1. Domain — validate URL format
    try {
      new URL(cfg.ecom_url);
      steps.push({ key: "domain", status: "success", message: cfg.ecom_url });
    } catch {
      steps.push({ key: "domain", status: "error", message: "Invalid URL" });
    }

    // 2. Server — HEAD request to ecom base
    if (steps[0].status === "success") {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const headRes = await fetch(cfg.ecom_url, { method: "HEAD", signal: ctrl.signal });
        clearTimeout(timeout);
        steps.push({ key: "server", status: headRes.ok ? "success" : "error", message: `${headRes.status} ${headRes.statusText}` });
      } catch {
        steps.push({ key: "server", status: "error", message: "Unreachable" });
      }
    } else {
      steps.push({ key: "server", status: "skip" });
    }

    // 3. Auth — hit sync status on ecom with credentials
    if (steps.every(s => s.status === "success")) {
      try {
        const apiRes = await apiFetch(cfg.ecom_url, "/api/sync/status", {
          storeId: cfg.store_id,
          apiKey: cfg.api_key,
        });
        if (apiRes.status === 200) {
          steps.push({ key: "auth", status: "success", message: "Authenticated" });
        } else if (apiRes.status === 401 || apiRes.status === 403) {
          steps.push({ key: "auth", status: "error", message: "Invalid credentials" });
        } else {
          steps.push({ key: "auth", status: "error", message: apiRes.data?.error || `HTTP ${apiRes.status}` });
        }
      } catch {
        steps.push({ key: "auth", status: "error", message: "Auth request failed" });
      }
    } else {
      steps.push({ key: "auth", status: "skip" });
    }

    // 4. Data — fetch pending products
    if (steps.every(s => s.status === "success")) {
      try {
        const since = cfg.last_sync_at || new Date(0).toISOString();
        const apiRes = await apiFetch(cfg.ecom_url, `/api/sync/available/products?since=${encodeURIComponent(since)}&limit=1`, {
          storeId: cfg.store_id,
          apiKey: cfg.api_key,
        });
        if (apiRes.status === 200) {
          const count = apiRes.data?.total || apiRes.data?.items?.length || 0;
          steps.push({ key: "data", status: "success", message: `${count} products available` });
        } else {
          steps.push({ key: "data", status: "error", message: apiRes.data?.error || `HTTP ${apiRes.status}` });
        }
      } catch {
        steps.push({ key: "data", status: "error", message: "Data fetch failed" });
      }
    } else {
      steps.push({ key: "data", status: "skip" });
    }

    res.json({ ok: true, steps });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
router.get("/verify", verifyHandler);
router.post("/verify", verifyHandler);

// ── GET /api/sync/check — get changes available from E-com ──
router.get("/check", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.json({ ok: true, products: [], categories: [], stockChanges: [], totalProducts: 0, pages: 0 });

    const since = req.query.since || cfg.last_sync_at || new Date(0).toISOString();
    const search = req.query.search || "";

    let path = `/api/sync/available/products?since=${encodeURIComponent(since)}`;
    if (search) path += `&search=${encodeURIComponent(search)}`;
    if (req.query.page) path += `&page=${req.query.page}`;

    const apiRes = await apiFetch(cfg.ecom_url, path, {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    if (apiRes.status !== 200) {
      return res.status(502).json({ ok: false, error: apiRes.data?.error || "E-com API error" });
    }

    // Also fetch categories
    const catRes = await apiFetch(cfg.ecom_url, `/api/sync/available/categories?since=${encodeURIComponent(since)}`, {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    // Also fetch stock changes
    const stockRes = await apiFetch(cfg.ecom_url, `/api/sync/available/stock?since=${encodeURIComponent(since)}`, {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    res.json({
      ok: true,
      products: apiRes.data.items || [],
      categories: catRes.data?.items || [],
      stockChanges: stockRes.data?.items || [],
      totalProducts: apiRes.data.total || 0,
      pages: apiRes.data.pages || 0,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/search — search E-com catalog ──
router.get("/search", async (req, res) => {
  try {
    const cfg = getConfig(getDb());
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const q = req.query.q || "";
    if (q.length < 2) return res.json({ ok: true, items: [] });

    const apiRes = await apiFetch(cfg.ecom_url, `/api/sync/search?q=${encodeURIComponent(q)}&page=${req.query.page || 1}`, {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    res.json(apiRes.data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/apply — push selected changes to E-com ──
router.post("/apply", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const { items = [], categories = [] } = req.body;

    // Snapshot: capture sync_changes about to be pushed
    const skusToPush = items.map(i => i.sku).filter(Boolean);
    let snapshotId = null;
    if (skusToPush.length > 0) {
      const beingPushed = db.prepare(`
        SELECT sc.* FROM sync_changes sc
        INNER JOIN items i ON sc.entity_type = 'item' AND sc.entity_id = i.id
        WHERE i.code IN (${skusToPush.map(() => '?').join(',')}) AND sc.status = 'pending'
      `).all(...skusToPush);
      if (beingPushed.length > 0) {
        const snapRes = createSnapshot("push", "product", { changes: beingPushed }, null, db);
        snapshotId = snapRes.lastInsertRowid;
      }
    }

    const apiRes = await apiFetch(cfg.ecom_url, "/api/sync/apply", {
      method: "POST",
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
      body: { items, categories },
    });

    if (apiRes.status !== 200) {
      return res.status(502).json({ ok: false, error: apiRes.data?.error || "Apply failed" });
    }

    // Log the sync
    db.prepare(`
      INSERT INTO sync_log (direction, status, items_total, items_succeeded, items_failed, error_details, started_at, completed_at, snapshot_id)
      VALUES ('push', ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).run(
      apiRes.data.failed?.length ? "partial" : "success",
      apiRes.data.total || 0,
      apiRes.data.succeeded?.length || 0,
      apiRes.data.failed?.length || 0,
      JSON.stringify(apiRes.data.failed || []),
      snapshotId
    );

    // Update last_sync_at
    db.prepare("UPDATE sync_config SET last_sync_at = datetime('now') WHERE id = ?").run(cfg.id);

    // Link snapshot to log
    if (snapshotId) {
      const logEntry = db.prepare("SELECT id FROM sync_log WHERE snapshot_id = ?").get(snapshotId);
      if (logEntry) {
        db.prepare("UPDATE sync_snapshots SET sync_log_id = ? WHERE id = ?").run(logEntry.id, snapshotId);
      }
    }

    // Clear applied sync_changes
    for (const item of (apiRes.data.succeeded || [])) {
      db.prepare("UPDATE sync_changes SET status = 'applied' WHERE entity_type = 'item' AND entity_id IN (SELECT id FROM items WHERE code = ?)").run(item.sku);
    }

    res.json(apiRes.data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/pull — pull selected products from E-com ──
router.post("/pull", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const { skus = [], fields = {} } = req.body;
    if (!skus.length) return res.status(400).json({ ok: false, error: "No SKUs provided" });

    const apiRes = await apiFetch(cfg.ecom_url, "/api/sync/pull/products", {
      method: "POST",
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
      body: { skus },
    });

    if (apiRes.status !== 200) {
      return res.status(502).json({ ok: false, error: apiRes.data?.error || "Pull failed" });
    }

    const results = { imported: [], skipped: [], failed: [] };

    // Snapshot: capture current state of affected items before pull
    const snapshotItems = [];
    const skuFieldsMap = {};
    for (const product of (apiRes.data.items || [])) {
      const existing = db.prepare("SELECT id, name, name_en, sale_price, stock, description FROM items WHERE code = ?").get(product.sku);
      const skuFields = fields[product.sku] || {};
      skuFieldsMap[product.sku] = skuFields;
      if (existing) {
        snapshotItems.push({
          sku: product.sku,
          action: "update",
          oldValues: {
            name: existing.name,
            name_en: existing.name_en,
            sale_price: existing.sale_price,
            stock: existing.stock,
            description: existing.description,
          },
        });
      } else {
        snapshotItems.push({ sku: product.sku, action: "create", oldValues: null });
      }
    }

    let snapshotId = null;
    if (snapshotItems.length > 0) {
      const snapRes = createSnapshot("pull", "product", { items: snapshotItems }, null, db);
      snapshotId = snapRes.lastInsertRowid;
    }

    for (const product of (apiRes.data.items || [])) {
      try {
        const existing = db.prepare("SELECT id FROM items WHERE code = ?").get(product.sku);
        const skuFields = skuFieldsMap[product.sku] || {};

        if (existing) {
          const updateParts = [];
          const updateParams = [];

          if (skuFields.name !== false) {
            updateParts.push("name = ?", "name_en = ?");
            updateParams.push(product.nameAr || product.name, product.name);
          }
          if (skuFields.price !== false) {
            updateParts.push("sale_price = ?");
            updateParams.push(product.price ?? null);
          }
          if (skuFields.stock !== false) {
            updateParts.push("stock = ?");
            updateParams.push(product.stock ?? null);
          }
          if (skuFields.description !== false) {
            updateParts.push("description = ?");
            updateParams.push(product.description || null);
          }

          updateParts.push("ecom_id = ?", "last_synced_at = datetime('now')", "sync_status = 'synced'");
          updateParams.push(product._id || null, existing.id);

          if (updateParts.length > 3) {
            db.prepare(`UPDATE items SET ${updateParts.join(", ")} WHERE id = ?`).run(...updateParams);
          }
          results.imported.push({ sku: product.sku, action: "updated", fields: Object.keys(skuFields).filter((k) => skuFields[k] !== false) });
        } else {
          // Create new — always import all fields for new products
          const info = db.prepare(`
            INSERT INTO items (name, name_en, code, sale_price, stock, description, ecom_id, sync_status, last_synced_at, is_active, item_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', datetime('now'), 1, 'product')
          `).run(
            product.nameAr || product.name || "Unknown",
            product.name || "",
            product.sku || "",
            product.price || 0,
            product.stock || 0,
            product.description || "",
            product._id || null,
          );
          results.imported.push({ sku: product.sku, action: "created", id: info.lastInsertRowid });
        }
      } catch (err) {
        results.failed.push({ sku: product.sku, error: err.message });
      }
    }

    db.prepare(`
      INSERT INTO sync_log (direction, status, items_total, items_succeeded, items_failed, error_details, started_at, completed_at, snapshot_id)
      VALUES ('pull', ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).run(
      results.failed.length ? "partial" : "success",
      results.imported.length + results.failed.length,
      results.imported.length,
      results.failed.length,
      JSON.stringify(results.failed),
      snapshotId
    );

    // Link snapshot to log
    if (snapshotId) {
      const logEntry = db.prepare("SELECT id FROM sync_log WHERE snapshot_id = ?").get(snapshotId);
      if (logEntry) {
        db.prepare("UPDATE sync_snapshots SET sync_log_id = ? WHERE id = ?").run(logEntry.id, snapshotId);
      }
    }

    db.prepare("UPDATE sync_config SET last_sync_at = datetime('now') WHERE id = ?").run(cfg.id);

    res.json({ ok: true, ...results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/preview-pull — preview changes without importing ──
router.post("/preview-pull", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const { skus = [], fields = {} } = req.body;
    if (!skus.length) return res.status(400).json({ ok: false, error: "No SKUs provided" });

    const apiRes = await apiFetch(cfg.ecom_url, "/api/sync/pull/products", {
      method: "POST",
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
      body: { skus },
    });

    if (apiRes.status !== 200) {
      return res.status(502).json({ ok: false, error: apiRes.data?.error || "Preview failed" });
    }

    const previews = [];

    for (const product of (apiRes.data.items || [])) {
      const existing = db.prepare("SELECT id, name, name_en, sale_price as price, stock, description FROM items WHERE code = ?").get(product.sku);
      const skuFields = fields[product.sku] || { name: true, price: true, stock: true, description: true, images: true };

      const current = existing ? {
        name: existing.name,
        price: existing.price,
        stock: existing.stock,
        description: existing.description,
      } : null;

      const incoming = {
        name: product.nameAr || product.name || "",
        price: product.price ?? 0,
        stock: product.stock ?? 0,
        description: product.description || "",
      };

      const diff = {};
      for (const f of ["name", "price", "stock", "description"]) {
        if (skuFields[f] === false) {
          diff[f] = false;
        } else if (!current) {
          diff[f] = true;
        } else {
          const oldVal = String(current[f] ?? "");
          const newVal = String(incoming[f] ?? "");
          diff[f] = oldVal !== newVal;
        }
      }

      previews.push({
        sku: product.sku,
        name: product.nameAr || product.name || product.sku,
        isNew: !existing,
        current,
        incoming,
        diff,
        fields: skuFields,
        hasImages: !!(product.images?.length || product.image),
        imageCount: (product.images ? product.images.length : 0) + (product.image ? 1 : 0),
      });
    }

    res.json({ ok: true, previews, total: previews.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/impact-summary — categorized change impact from E-com ──
router.get("/impact-summary", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const since = cfg.last_sync_at || new Date(0).toISOString();
    const limit = Math.min(200, Number(req.query.limit) || 100);
    const filterSkus = req.query.skus ? req.query.skus.split(",") : null;

    const summary = {
      totalChanges: 0,
      newProducts: 0,
      pricesUp: { count: 0, totalIncrease: 0 },
      pricesDown: { count: 0, totalDecrease: 0 },
      stockToZero: { count: 0 },
      imageChanges: { count: 0 },
      productsToInactive: { count: 0 },
      fieldChanges: { count: 0 },
    };

    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && summary.totalChanges < 1000) {
      const apiRes = await apiFetch(
        cfg.ecom_url,
        `/api/sync/available/products?since=${encodeURIComponent(since)}&page=${page}&limit=${limit}`,
        { storeId: cfg.store_id, apiKey: cfg.api_key }
      );

      if (apiRes.status !== 200) {
        return res.status(502).json({ ok: false, error: apiRes.data?.error || "E-com API error" });
      }

      const items = apiRes.data?.items || [];
      totalPages = apiRes.data?.pages || 1;

      for (const product of items) {
        if (filterSkus && !filterSkus.includes(product.sku)) continue;
        const existing = db.prepare(
          "SELECT id, name, name_en, sale_price as price, stock, description, is_active FROM items WHERE code = ?"
        ).get(product.sku);

        // New product
        if (!existing) {
          summary.newProducts++;
          summary.totalChanges++;
          if (product.images?.length || product.image) summary.imageChanges.count++;
          summary.fieldChanges.count += 4;
          if (product.active === false) summary.productsToInactive.count++;
          continue;
        }

        // Price comparison
        const oldPrice = Number(existing.price) || 0;
        const newPrice = product.price ?? 0;
        if (newPrice > oldPrice) {
          summary.pricesUp.count++;
          summary.pricesUp.totalIncrease += +((newPrice - oldPrice).toFixed(2));
          summary.totalChanges++;
        } else if (newPrice < oldPrice) {
          summary.pricesDown.count++;
          summary.pricesDown.totalDecrease += +((oldPrice - newPrice).toFixed(2));
          summary.totalChanges++;
        }

        // Stock to zero
        const oldStock = Number(existing.stock) || 0;
        const newStock = product.stock ?? 0;
        if (oldStock > 0 && newStock === 0) {
          summary.stockToZero.count++;
          summary.totalChanges++;
        }

        // Image changes
        if (product.images?.length || product.image) {
          summary.imageChanges.count++;
        }

        // Product inactive
        if (product.active === false && existing.is_active !== 0) {
          summary.productsToInactive.count++;
          summary.totalChanges++;
        }

        // Count individual field changes
        const incoming = {
          name: product.nameAr || product.name || "",
          price: product.price ?? 0,
          stock: product.stock ?? 0,
          description: product.description || "",
        };
        for (const f of ["name", "price", "stock", "description"]) {
          if (String(existing[f] ?? "") !== String(incoming[f] ?? "")) {
            summary.fieldChanges.count++;
          }
        }
      }

      page++;
      if (items.length < limit) break;
    }

    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/images/:sku — download image metadata from E-com ──
router.get("/images/:sku", async (req, res) => {
  try {
    const cfg = getConfig(getDb());
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const apiRes = await apiFetch(cfg.ecom_url, `/api/sync/images/${encodeURIComponent(req.params.sku)}`, {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    if (apiRes.status !== 200) {
      return res.status(502).json({ ok: false, error: apiRes.data?.error || "Failed to get images" });
    }

    res.json(apiRes.data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/images/upload/:sku — upload image to E-com ──
router.post("/images/upload/:sku", async (req, res) => {
  try {
    const cfg = getConfig(getDb());
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ ok: false, error: "image_url is required" });

    // Download image from local POS, forward to E-com
    const fs = require("fs");
    const path = require("path");
    const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "../../../uploads");

    // image_url is client-supplied: resolve it and refuse anything that escapes
    // the uploads directory (path traversal / absolute paths / NUL bytes).
    const rel = String(image_url).replace(/^\/uploads\//, "");
    if (rel.includes("\0") || path.isAbsolute(rel)) {
      return res.status(400).json({ ok: false, error: "Invalid image_url" });
    }
    const resolvedUploads = path.resolve(uploadsDir);
    const localPath = path.resolve(resolvedUploads, rel);
    if (!localPath.startsWith(resolvedUploads + path.sep)) {
      return res.status(400).json({ ok: false, error: "Invalid image_url" });
    }
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
      return res.status(404).json({ ok: false, error: "Image file not found locally" });
    }

    const imageBuffer = fs.readFileSync(localPath);
    const boundary = "----SyncBoundary" + Date.now();
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${encodeURIComponent(path.basename(localPath))}"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const bodyBuffer = Buffer.concat([
      Buffer.from(header, "utf-8"),
      imageBuffer,
      Buffer.from(footer, "utf-8"),
    ]);

    const url = new URL(`/api/sync/images/upload/${encodeURIComponent(req.params.sku)}`, cfg.ecom_url);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;

    const uploadResult = await new Promise((resolve, reject) => {
      const req2 = lib.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
            "Content-Length": bodyBuffer.length,
            "x-store-id": cfg.store_id,
            "x-api-key": cfg.api_key,
          },
          timeout: 60000,
        },
        (res2) => {
          let data = "";
          res2.on("data", (chunk) => (data += chunk));
          res2.on("end", () => {
            try { resolve({ status: res2.statusCode, data: JSON.parse(data) }); }
            catch { resolve({ status: res2.statusCode, data: { ok: false, error: data.slice(0, 200) } }); }
          });
        }
      );
      req2.on("error", reject);
      req2.on("timeout", () => { req2.destroy(); reject(new Error("Upload timeout")); });
      req2.write(bodyBuffer);
      req2.end();
    });

    res.json(uploadResult.data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/logs — sync history ──
router.get("/logs", (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const logs = db.prepare("SELECT * FROM sync_log ORDER BY created_at DESC LIMIT ?").all(limit);
    res.json({ ok: true, items: logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/pending — pending changes in POS ──
router.get("/pending", (req, res) => {
  try {
    const db = getDb();
    const search = String(req.query.search || "").trim();
    let changes;

    if (search) {
      const esc = search.replace(/'/g, "''");
      changes = db.prepare(`
        SELECT sc.*, i.name as item_name, i.code as item_code
        FROM sync_changes sc
        LEFT JOIN items i ON sc.entity_type = 'item' AND sc.entity_id = i.id
        WHERE sc.status = 'pending'
          AND (i.name LIKE ? OR i.code LIKE ? OR i.name_en LIKE ?)
        ORDER BY sc.created_at DESC
      `).all(`%${esc}%`, `%${esc}%`, `%${esc}%`);
    } else {
      changes = db.prepare(`
        SELECT sc.*, i.name as item_name, i.code as item_code
        FROM sync_changes sc
        LEFT JOIN items i ON sc.entity_type = 'item' AND sc.entity_id = i.id
        WHERE sc.status = 'pending'
        ORDER BY sc.created_at DESC
      `).all();
    }

    res.json({ ok: true, items: changes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/conflicts — detect SKUs changed on both sides ──
router.get("/conflicts", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.json({ ok: true, conflicts: [], total: 0 });

    const since = cfg.last_sync_at || new Date(0).toISOString();

    // Fetch E-com available products
    const apiRes = await apiFetch(cfg.ecom_url, `/api/sync/available/products?since=${encodeURIComponent(since)}&limit=100`, {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });

    const ecomProducts = apiRes.data?.items || [];
    if (ecomProducts.length === 0) return res.json({ ok: true, conflicts: [], total: 0 });

    // Get local SKUs with pending changes
    const localChanged = db.prepare(`
      SELECT DISTINCT i.id, i.code, i.name, i.name_en, i.sale_price as price, i.stock, i.description, i.updated_at
      FROM items i
      INNER JOIN sync_changes sc ON sc.entity_type = 'item' AND sc.entity_id = i.id
      WHERE sc.status = 'pending' AND i.code IS NOT NULL AND i.code != ''
    `).all();

    const localBySku = {};
    for (const item of localChanged) localBySku[item.code] = item;

    // Find intersection
    const conflicts = [];
    for (const prod of ecomProducts) {
      const local = localBySku[prod.sku];
      if (!local) continue;

      conflicts.push({
        sku: prod.sku,
        name: prod.nameAr || prod.name || prod.sku,
        pos: {
          name: local.name,
          price: local.price,
          stock: local.stock,
          description: local.description,
          updatedAt: local.updated_at,
        },
        ecom: {
          name: prod.nameAr || prod.name,
          price: prod.price ?? 0,
          stock: prod.stock ?? 0,
          description: prod.description || "",
          updatedAt: prod.updatedAt,
        },
        hasImages: !!(prod.images?.length || prod.image),
      });
    }

    res.json({ ok: true, conflicts, total: conflicts.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/resolve-conflict — resolve a SKU conflict ──
router.post("/resolve-conflict", async (req, res) => {
  try {
    const db = getDb();
    const cfg = getConfig(db);
    if (!cfg) return res.status(400).json({ ok: false, error: "Sync not configured" });

    const { sku, resolution } = req.body;
    if (!sku || !resolution) {
      return res.status(400).json({ ok: false, error: "sku and resolution are required" });
    }
    if (!["keep_pos", "keep_ecom", "skip"].includes(resolution)) {
      return res.status(400).json({ ok: false, error: "resolution must be keep_pos, keep_ecom, or skip" });
    }

    const result = { sku, resolution };

    if (resolution === "keep_ecom") {
      // Pull E-com version — fetch product data from E-com and update POS
      const apiRes = await apiFetch(cfg.ecom_url, "/api/sync/pull/products", {
        method: "POST",
        storeId: cfg.store_id,
        apiKey: cfg.api_key,
        body: { skus: [sku] },
      });

      if (apiRes.status === 200 && apiRes.data?.items?.length) {
        const product = apiRes.data.items[0];
        const existing = db.prepare("SELECT id FROM items WHERE code = ?").get(sku);
        if (existing) {
          db.prepare(`
            UPDATE items SET name = ?, name_en = ?, sale_price = ?, stock = ?, description = ?, ecom_id = ?, last_synced_at = datetime('now'), sync_status = 'synced' WHERE id = ?
          `).run(
            product.nameAr || product.name,
            product.name || "",
            product.price ?? 0,
            product.stock ?? 0,
            product.description || "",
            product._id || null,
            existing.id
          );
        }
        // Clear pending changes for this SKU
        db.prepare("UPDATE sync_changes SET status = 'resolved' WHERE entity_id IN (SELECT id FROM items WHERE code = ?) AND status = 'pending'").run(sku);
        result.action = "pulled_ecom_version";
      } else {
        result.action = "ecom_fetch_failed";
        result.warning = "Could not fetch product from E-com";
      }
    } else if (resolution === "keep_pos") {
      // Push POS version to E-com
      const item = db.prepare("SELECT id, name, name_en, sale_price, stock, description FROM items WHERE code = ?").get(sku);
      if (item) {
        const changes = db.prepare("SELECT field_name, new_value FROM sync_changes WHERE entity_type = 'item' AND entity_id = ? AND status = 'pending'").all(item.id);
        const items = changes.map((c) => ({ sku, fields: { [c.field_name]: c.new_value } }));

        const apiRes = await apiFetch(cfg.ecom_url, "/api/sync/apply", {
          method: "POST",
          storeId: cfg.store_id,
          apiKey: cfg.api_key,
          body: { items },
        });

        if (apiRes.status === 200) {
          db.prepare("UPDATE sync_changes SET status = 'applied' WHERE entity_type = 'item' AND entity_id = ? AND status = 'pending'").run(item.id);
          db.prepare("UPDATE items SET last_synced_at = datetime('now'), sync_status = 'synced' WHERE id = ?").run(item.id);
          result.action = "pushed_pos_version";
        } else {
          result.action = "push_failed";
          result.error = apiRes.data?.error || "Push failed";
        }
      } else {
        result.action = "item_not_found";
        result.warning = "SKU not found in POS";
      }
    } else {
      // skip — just clear pending changes
      db.prepare("UPDATE sync_changes SET status = 'skipped' WHERE entity_id IN (SELECT id FROM items WHERE code = ?) AND status = 'pending'").run(sku);
      result.action = "skipped";
    }

    db.prepare("INSERT INTO sync_log (direction, status, items_total, items_succeeded, items_failed, error_details, started_at, completed_at) VALUES ('resolve', 'success', 1, 1, 0, ?, datetime('now'), datetime('now'))").run(JSON.stringify(result));

    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/snapshots — list recent snapshots (paginated) ──
router.get("/snapshots", (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const total = db.prepare("SELECT COUNT(*) as count FROM sync_snapshots").get().count;
    const items = db.prepare(`
      SELECT id, sync_log_id, direction, entity_type, items_count, size_bytes, metadata, created_at
      FROM sync_snapshots
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({ ok: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/snapshots/:id — get full snapshot data ──
router.get("/snapshots/:id", (req, res) => {
  try {
    const db = getDb();
    const snap = db.prepare("SELECT * FROM sync_snapshots WHERE id = ?").get(req.params.id);
    if (!snap) return res.status(404).json({ ok: false, error: "Snapshot not found" });

    snap.snapshot_data = JSON.parse(snap.snapshot_data);
    snap.metadata = snap.metadata ? JSON.parse(snap.metadata) : null;

    res.json({ ok: true, item: snap });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/snapshots/:id/rollback-preview — what would be restored ──
router.post("/snapshots/:id/rollback-preview", (req, res) => {
  try {
    const db = getDb();
    const snap = db.prepare("SELECT * FROM sync_snapshots WHERE id = ?").get(req.params.id);
    if (!snap) return res.status(404).json({ ok: false, error: "Snapshot not found" });

    const data = JSON.parse(snap.snapshot_data);
    let itemsToDelete = 0;
    let itemsToRestore = 0;
    let pricesToRevert = 0;
    let stockToRevert = 0;

    if (snap.direction === "pull" && data.items) {
      for (const item of data.items) {
        if (item.action === "create") {
          itemsToDelete++;
        } else if (item.action === "update" && item.oldValues) {
          itemsToRestore++;
          if (item.oldValues.sale_price !== undefined) pricesToRevert++;
          if (item.oldValues.stock !== undefined) stockToRevert++;
        }
      }
    } else if (snap.direction === "push" && data.changes) {
      itemsToRestore = data.changes.length;
      for (const ch of data.changes) {
        if (ch.field_name === "sale_price") pricesToRevert++;
        else if (ch.field_name === "stock") stockToRevert++;
      }
    }

    res.json({ ok: true, itemsToDelete, itemsToRestore, pricesToRevert, stockToRevert });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/sync/snapshots/:id/rollback — execute rollback ──
router.post("/snapshots/:id/rollback", (req, res) => {
  try {
    const db = getDb();
    const snap = db.prepare("SELECT * FROM sync_snapshots WHERE id = ?").get(req.params.id);
    if (!snap) return res.status(404).json({ ok: false, error: "Snapshot not found" });

    const data = JSON.parse(snap.snapshot_data);
    let restoredCount = 0;

    if (snap.direction === "pull" && data.items) {
      for (const item of data.items) {
        if (item.action === "create") {
          const existing = db.prepare("SELECT id FROM items WHERE code = ?").get(item.sku);
          if (existing) {
            db.prepare("DELETE FROM items WHERE id = ?").run(existing.id);
            restoredCount++;
          }
        } else if (item.action === "update" && item.oldValues) {
          const existing = db.prepare("SELECT id FROM items WHERE code = ?").get(item.sku);
          if (existing) {
            const sets = [];
            const vals = [];
            if (item.oldValues.name !== undefined) { sets.push("name = ?"); vals.push(item.oldValues.name); }
            if (item.oldValues.name_en !== undefined) { sets.push("name_en = ?"); vals.push(item.oldValues.name_en); }
            if (item.oldValues.sale_price !== undefined) { sets.push("sale_price = ?"); vals.push(item.oldValues.sale_price); }
            if (item.oldValues.stock !== undefined) { sets.push("stock = ?"); vals.push(item.oldValues.stock); }
            if (item.oldValues.description !== undefined) { sets.push("description = ?"); vals.push(item.oldValues.description); }
            if (sets.length > 0) {
              vals.push(existing.id);
              db.prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
              restoredCount++;
            }
          }
        }
      }
    } else if (snap.direction === "push" && data.changes) {
      for (const ch of data.changes) {
        const existing = db.prepare("SELECT id FROM sync_changes WHERE id = ?").get(ch.id);
        if (existing) {
          db.prepare("UPDATE sync_changes SET status = 'pending' WHERE id = ?").run(ch.id);
          restoredCount++;
        }
      }
    }

    // Record the rollback in sync_log
    db.prepare(`
      INSERT INTO sync_log (direction, status, items_total, items_succeeded, items_failed, error_details, started_at, completed_at)
      VALUES ('rollback', 'success', ?, ?, 0, ?, datetime('now'), datetime('now'))
    `).run(restoredCount, restoredCount, JSON.stringify({ snapshot_id: snap.id }));

    res.json({ ok: true, restored_count: restoredCount });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Auto-sync: pull ALL products changed on the store since last_sync_at ──
// Used by the scheduler (server/src/jobs/syncScheduler.js). Pages through the
// store's /available/products (sorted updatedAt desc) and upserts every change.
async function autoPullAll(db) {
  const cfg = getConfig(db);
  if (!cfg || !cfg.ecom_url || !cfg.store_id || !cfg.api_key) return { skipped: "not_configured" };

  const runStart = new Date().toISOString();
  const since = cfg.last_sync_at || new Date(0).toISOString();
  const MAX_PAGES = 50;
  const LIMIT = 100;

  const collected = [];
  let page = 1;
  let pages = 1;
  do {
    const qs = `?since=${encodeURIComponent(since)}&limit=${LIMIT}&page=${page}`;
    const apiRes = await apiFetch(cfg.ecom_url, `/api/sync/available/products${qs}`, {
      storeId: cfg.store_id,
      apiKey: cfg.api_key,
    });
    if (apiRes.status !== 200) {
      if (page === 1) return { ok: false, error: apiRes.data?.error || `HTTP ${apiRes.status}` };
      break;
    }
    const items = apiRes.data?.items || [];
    collected.push(...items);
    pages = apiRes.data?.pages || 1;
    page += 1;
  } while (page <= pages && page <= MAX_PAGES);

  const results = { imported: 0, failed: 0 };
  const applyOne = db.transaction((product) => {
    const existing = db.prepare("SELECT id FROM items WHERE code = ?").get(product.sku);
    if (existing) {
      db.prepare(
        "UPDATE items SET name = ?, name_en = ?, sale_price = ?, stock = ?, description = ?, ecom_id = ?, last_synced_at = datetime('now'), sync_status = 'synced' WHERE id = ?"
      ).run(
        product.nameAr || product.name,
        product.name || "",
        product.price ?? null,
        product.stock ?? null,
        product.description || null,
        product._id || null,
        existing.id,
      );
    } else {
      db.prepare(
        "INSERT INTO items (name, name_en, code, sale_price, stock, description, ecom_id, sync_status, last_synced_at, is_active, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', datetime('now'), 1, 'product')"
      ).run(
        product.nameAr || product.name || "Unknown",
        product.name || "",
        product.sku || "",
        product.price || 0,
        product.stock || 0,
        product.description || "",
        product._id || null,
      );
    }
  });

  for (const product of collected) {
    try { applyOne(product); results.imported++; }
    catch { results.failed++; }
  }

  db.prepare(
    "INSERT INTO sync_log (direction, status, items_total, items_succeeded, items_failed, error_details, started_at, completed_at) VALUES ('pull', ?, ?, ?, ?, ?, ?, datetime('now'))"
  ).run(
    results.failed ? "partial" : "success",
    collected.length,
    results.imported,
    results.failed,
    JSON.stringify({ auto: true }),
    runStart,
  );

  // Advance the cursor to the start of this run so nothing is missed.
  db.prepare("UPDATE sync_config SET last_sync_at = ? WHERE id = ?").run(runStart, cfg.id);

  return { ok: true, ...results, total: collected.length };
}

router.autoPullAll = autoPullAll;

module.exports = router;
