const request = require("supertest");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../src/app");
const { initDb, setDb, getDb, closeDb } = require("../src/config/database");
const { issueToken } = require("../src/middleware/auth");
const telegramService = require("../src/services/telegramService");
const { runDueDigests } = require("../src/jobs/telegramDigestJob");
const { periodKeyFor } = require("../src/services/telegramDigest");

describe("Telegram Routes & Service", () => {
  let app;
  let token;
  let userId;
  let fetchSpy;
  let tempDir;

  function seedSettings(db, overrides = {}) {
    db.prepare(`INSERT OR REPLACE INTO settings (
      id, company_name, currency_symbol, telegram_enabled, telegram_bot_token, telegram_chat_id,
      telegram_notify_new_invoice, telegram_notify_daily_close, telegram_notify_important_actions,
      telegram_notify_large_amounts, telegram_notify_returns_voids, telegram_notify_purchases_payments,
      telegram_notify_low_stock, telegram_notify_system, telegram_notify_weekly, telegram_notify_monthly, telegram_notify_yearly
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      overrides.company_name || "Test Store",
      overrides.currency_symbol || "ج",
      overrides.telegram_enabled ? 1 : 0,
      overrides.telegram_bot_token || "",
      overrides.telegram_chat_id || "",
      overrides.notify_new_invoice !== undefined ? (overrides.notify_new_invoice ? 1 : 0) : 1,
      overrides.notify_daily_close !== undefined ? (overrides.notify_daily_close ? 1 : 0) : 1,
      overrides.notify_important_actions !== undefined ? (overrides.notify_important_actions ? 1 : 0) : 1,
      overrides.notify_large_amounts !== undefined ? (overrides.notify_large_amounts ? 1 : 0) : 1,
      overrides.notify_returns_voids !== undefined ? (overrides.notify_returns_voids ? 1 : 0) : 1,
      overrides.notify_purchases_payments !== undefined ? (overrides.notify_purchases_payments ? 1 : 0) : 1,
      overrides.notify_low_stock !== undefined ? (overrides.notify_low_stock ? 1 : 0) : 1,
      overrides.notify_system !== undefined ? (overrides.notify_system ? 1 : 0) : 1,
      overrides.notify_weekly ? 1 : 0,
      overrides.notify_monthly ? 1 : 0,
      overrides.notify_yearly ? 1 : 0
    );
  }

  function insertRecipient(db, r = {}) {
    const result = db.prepare(`INSERT INTO telegram_recipients (
      name, chat_id, enabled,
      notify_new_invoice, notify_daily_close, notify_large_amounts,
      notify_returns_voids, notify_purchases_payments,
      notify_customer_created, notify_supplier_created, notify_expense_created, notify_return_payment,
      notify_low_stock, notify_system, notify_weekly, notify_monthly, notify_yearly
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      r.name || "Recipient",
      r.chat_id || "12345",
      r.enabled !== undefined ? (r.enabled ? 1 : 0) : 1,
      r.notify_new_invoice !== undefined ? (r.notify_new_invoice ? 1 : 0) : 1,
      r.notify_daily_close !== undefined ? (r.notify_daily_close ? 1 : 0) : 1,
      r.notify_large_amounts !== undefined ? (r.notify_large_amounts ? 1 : 0) : 1,
      r.notify_returns_voids !== undefined ? (r.notify_returns_voids ? 1 : 0) : 1,
      r.notify_purchases_payments !== undefined ? (r.notify_purchases_payments ? 1 : 0) : 1,
      r.notify_customer_created !== undefined ? (r.notify_customer_created ? 1 : 0) : 1,
      r.notify_supplier_created !== undefined ? (r.notify_supplier_created ? 1 : 0) : 1,
      r.notify_expense_created !== undefined ? (r.notify_expense_created ? 1 : 0) : 1,
      r.notify_return_payment !== undefined ? (r.notify_return_payment ? 1 : 0) : 1,
      r.notify_low_stock !== undefined ? (r.notify_low_stock ? 1 : 0) : 1,
      r.notify_system !== undefined ? (r.notify_system ? 1 : 0) : 1,
      r.notify_weekly ? 1 : 0,
      r.notify_monthly ? 1 : 0,
      r.notify_yearly ? 1 : 0
    );
    return Number(result.lastInsertRowid);
  }

  beforeEach(() => {
    setDb(null);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-telegram-"));
    initDb(path.join(tempDir, "telegram.db"));
    app = createApp();

    const db = getDb();
    const info = db
      .prepare("INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)")
      .run("telegram-user", "$2a$10$hash", "admin");
    userId = Number(info.lastInsertRowid);
    token = issueToken({ id: userId, role: "admin" });

    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
      text: async () => "{\"ok\":true}",
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    closeDb();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  });

  describe("GET /api/telegram/config", () => {
    it("reports not configured when token missing", async () => {
      seedSettings(getDb(), { telegram_enabled: 0 });
      const res = await request(app).get("/api/telegram/config").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.configured).toBe(false);
      expect(res.body.data.recipients_count).toBe(0);
    });

    it("reports configured with recipient counts", async () => {
      seedSettings(getDb(), { telegram_enabled: 1, telegram_bot_token: "tok" });
      insertRecipient(getDb(), { chat_id: "111", enabled: true });
      insertRecipient(getDb(), { chat_id: "222", enabled: false });
      const res = await request(app).get("/api/telegram/config").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.configured).toBe(true);
      expect(res.body.data.recipients_count).toBe(2);
      expect(res.body.data.recipients_enabled).toBe(1);
    });
  });

  describe("Recipients CRUD", () => {
    beforeEach(() => {
      seedSettings(getDb(), { telegram_enabled: 1, telegram_bot_token: "tok" });
    });

    it("lists recipients", async () => {
      insertRecipient(getDb(), { name: "A", chat_id: "111" });
      insertRecipient(getDb(), { name: "B", chat_id: "222", notify_new_invoice: false });
      const res = await request(app).get("/api/telegram/recipients").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe("A");
      expect(res.body.data[1].notifyNewInvoice).toBe(false);
    });

    it("creates a recipient", async () => {
      const res = await request(app)
        .post("/api/telegram/recipients")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Manager", chat_id: "999", notify_new_invoice: true, notify_low_stock: false });
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.chat_id).toBe("999");
      const row = getDb().prepare("SELECT * FROM telegram_recipients WHERE chat_id=?").get("999");
      expect(row.notify_low_stock).toBe(0);
    });

    it("rejects missing chat_id on create", async () => {
      const res = await request(app)
        .post("/api/telegram/recipients")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Bad" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("updates a recipient", async () => {
      const id = insertRecipient(getDb(), { chat_id: "111", notify_new_invoice: true });
      const res = await request(app)
        .put(`/api/telegram/recipients/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated", chat_id: "111", notify_new_invoice: false });
      expect(res.status).toBe(200);
      expect(res.body.data.notify_new_invoice).toBe(false);
      const row = getDb().prepare("SELECT notify_new_invoice FROM telegram_recipients WHERE id=?").get(id);
      expect(row.notify_new_invoice).toBe(0);
    });

    it("deletes a recipient", async () => {
      const id = insertRecipient(getDb(), { chat_id: "111" });
      const res = await request(app).delete(`/api/telegram/recipients/${id}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(getDb().prepare("SELECT COUNT(*) AS c FROM telegram_recipients").get().c).toBe(0);
    });

    it("upserts on POST when the chat_id already exists instead of duplicating", async () => {
      const id = insertRecipient(getDb(), { name: "Old", chat_id: "999", notify_new_invoice: true });
      const res = await request(app)
        .post("/api/telegram/recipients")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New Name", chat_id: "999", notify_new_invoice: false });
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(getDb().prepare("SELECT COUNT(*) AS c FROM telegram_recipients").get().c).toBe(1);
      const row = getDb().prepare("SELECT name, notify_new_invoice FROM telegram_recipients WHERE id=?").get(id);
      expect(row.name).toBe("New Name");
      expect(row.notify_new_invoice).toBe(0);
    });

    it("rejects PUT that would collide with another recipient's chat_id", async () => {
      insertRecipient(getDb(), { chat_id: "111" });
      const id2 = insertRecipient(getDb(), { chat_id: "222" });
      const res = await request(app)
        .put(`/api/telegram/recipients/${id2}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ chat_id: "111" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("persists event_presets JSON round-trip", async () => {
      const presets = { notifyNewInvoice: "مختصر — سريع" };
      const res = await request(app)
        .post("/api/telegram/recipients")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "P", chat_id: "777", event_presets: presets });
      expect(res.status).toBe(200);
      const list = await request(app).get("/api/telegram/recipients").set("Authorization", `Bearer ${token}`);
      expect(list.body.data[0].eventPresets).toEqual(presets);
    });

    it("auto-migrates legacy settings.telegram_chat_id when recipients table is empty", async () => {
      seedSettings(getDb(), {
        telegram_enabled: 1,
        telegram_bot_token: "tok",
        telegram_chat_id: "legacy-999",
        notify_new_invoice: true,
        notify_daily_close: false,
      });
      const res = await request(app).get("/api/telegram/recipients").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].chatId).toBe("legacy-999");
      expect(res.body.data[0].notifyNewInvoice).toBe(true);
      expect(res.body.data[0].notifyDailyClose).toBe(false);
      const row = getDb().prepare("SELECT chat_id FROM telegram_recipients").get();
      expect(row.chat_id).toBe("legacy-999");
    });
  });

  describe("detectChatId", () => {
    it("reads chat id from /start deep-link message", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: [{
            update_id: 1,
            message: {
              message_id: 1,
              from: { id: 42, first_name: "Owner" },
              chat: { id: 555001, first_name: "Owner", type: "private" },
              text: "/start connect",
            },
          }],
        }),
      });
      const chat = await telegramService.detectChatId("tok");
      expect(chat).toEqual({ chatId: "555001", chatName: "Owner", chatType: "private" });
    });

    it("reads chat id from callback_query updates", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: [{
            update_id: 2,
            callback_query: {
              id: "cb1",
              from: { id: 77, first_name: "Admin" },
              message: {
                message_id: 9,
                chat: { id: 777002, title: "Store Alerts", type: "group" },
              },
            },
          }],
        }),
      });
      const chat = await telegramService.detectChatId("tok");
      expect(chat).toEqual({ chatId: "777002", chatName: "Store Alerts", chatType: "group" });
    });
  });

  describe("POST /api/telegram/test", () => {
    beforeEach(() => {
      seedSettings(getDb(), { telegram_enabled: 1, telegram_bot_token: "tok" });
    });

    it("sends test to a specific chat_id", async () => {
      const res = await request(app)
        .post("/api/telegram/test")
        .set("Authorization", `Bearer ${token}`)
        .send({ chat_id: "specific" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toContain("/bot");
      expect(JSON.parse(fetchSpy.mock.calls[0][1].body).chat_id).toBe("specific");
    });

    it("sends test to all enabled recipients", async () => {
      insertRecipient(getDb(), { chat_id: "111", enabled: true });
      insertRecipient(getDb(), { chat_id: "222", enabled: false });
      insertRecipient(getDb(), { chat_id: "333", enabled: true });
      const res = await request(app).post("/api/telegram/test").set("Authorization", `Bearer ${token}`).send({});
      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const chatIds = fetchSpy.mock.calls.map((c) => JSON.parse(c[1].body).chat_id).sort();
      expect(chatIds).toEqual(["111", "333"]);
    });

    it("falls back to legacy chat_id when no recipients", async () => {
      seedSettings(getDb(), {
        telegram_enabled: 1,
        telegram_bot_token: "tok",
        telegram_chat_id: "legacy123",
      });
      const res = await request(app).post("/api/telegram/test").set("Authorization", `Bearer ${token}`).send({});
      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchSpy.mock.calls[0][1].body).chat_id).toBe("legacy123");
    });
  });

  describe("POST /api/telegram/disconnect", () => {
    it("clears token, recipients, and retry queue", async () => {
      seedSettings(getDb(), { telegram_enabled: 1, telegram_bot_token: "tok", telegram_chat_id: "x" });
      insertRecipient(getDb(), { chat_id: "111" });
      getDb().prepare("INSERT INTO pending_notifications (event_type, chat_id, text, status) VALUES (?, ?, ?, 'pending')")
        .run("new_invoice", "111", "text");

      const res = await request(app).post("/api/telegram/disconnect").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);

      const settings = getDb().prepare("SELECT telegram_enabled, telegram_bot_token, telegram_chat_id FROM settings WHERE id=1").get();
      expect(settings.telegram_enabled).toBe(0);
      expect(settings.telegram_bot_token).toBe("");
      expect(settings.telegram_chat_id).toBe("");
      expect(getDb().prepare("SELECT COUNT(*) AS c FROM telegram_recipients").get().c).toBe(0);
      expect(getDb().prepare("SELECT COUNT(*) AS c FROM pending_notifications").get().c).toBe(0);
    });
  });

  describe("notifyOwner multi-recipient routing", () => {
    beforeEach(() => {
      seedSettings(getDb(), { telegram_enabled: 1, telegram_bot_token: "tok" });
    });

    it("sends only to recipients with the event enabled", async () => {
      insertRecipient(getDb(), { chat_id: "111", notify_new_invoice: true });
      insertRecipient(getDb(), { chat_id: "222", notify_new_invoice: false });
      insertRecipient(getDb(), { chat_id: "333", notify_new_invoice: true, enabled: false });

      await telegramService.notifyOwner(telegramService.EVENT_TYPES.NEW_INVOICE, { invoiceNo: 99, total: 100 }, getDb());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchSpy.mock.calls[0][1].body).chat_id).toBe("111");
    });

    it("enqueues on send failure", async () => {
      fetchSpy.mockRejectedValue(new Error("network down"));
      insertRecipient(getDb(), { chat_id: "111", notify_new_invoice: true });

      await telegramService.notifyOwner(telegramService.EVENT_TYPES.NEW_INVOICE, { invoiceNo: 1, total: 50 }, getDb());

      const pending = getDb().prepare("SELECT * FROM pending_notifications WHERE status='pending'").all();
      expect(pending).toHaveLength(1);
      expect(pending[0].chat_id).toBe("111");
      expect(pending[0].event_type).toBe("new_invoice");
    });

    it("falls back to legacy config when no recipients exist", async () => {
      seedSettings(getDb(), {
        telegram_enabled: 1,
        telegram_bot_token: "tok",
        telegram_chat_id: "legacy123",
        notify_new_invoice: true,
      });

      await telegramService.notifyOwner(telegramService.EVENT_TYPES.NEW_INVOICE, { invoiceNo: 5, total: 200 }, getDb());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchSpy.mock.calls[0][1].body).chat_id).toBe("legacy123");
    });

    it("does not send when Telegram disabled", async () => {
      seedSettings(getDb(), { telegram_enabled: 0, telegram_bot_token: "tok" });
      insertRecipient(getDb(), { chat_id: "111", notify_new_invoice: true });

      await telegramService.notifyOwner(telegramService.EVENT_TYPES.NEW_INVOICE, { invoiceNo: 1 }, getDb());

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("renders each recipient's chosen preset variant", async () => {
      const db = getDb();
      db.prepare("DELETE FROM message_template_variants WHERE category='telegram_new_invoice'").run();
      db.prepare(`INSERT INTO message_template_variants (category, label, body, channel, is_active)
        VALUES ('telegram_new_invoice', 'قياسي — مفصل', 'DETAILED {invoice_no}', 'telegram', 1)`).run();
      db.prepare(`INSERT INTO message_template_variants (category, label, body, channel, is_active)
        VALUES ('telegram_new_invoice', 'مختصر — سريع', 'BRIEF {invoice_no}', 'telegram', 0)`).run();

      const idDetailed = insertRecipient(db, { chat_id: "111", notify_new_invoice: true });
      const idBrief = insertRecipient(db, { chat_id: "222", notify_new_invoice: true });
      db.prepare("UPDATE telegram_recipients SET event_presets=? WHERE id=?")
        .run(JSON.stringify({ notifyNewInvoice: "مختصر — سريع" }), idBrief);
      db.prepare("UPDATE telegram_recipients SET event_presets=? WHERE id=?")
        .run(JSON.stringify({ notifyNewInvoice: "قياسي — مفصل" }), idDetailed);

      await telegramService.notifyOwner(telegramService.EVENT_TYPES.NEW_INVOICE, { invoiceNo: 42, total: 100 }, db);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const byChat = Object.fromEntries(fetchSpy.mock.calls.map(([, opts]) => {
        const b = JSON.parse(opts.body);
        return [b.chat_id, b.text];
      }));
      expect(byChat["111"]).toContain("DETAILED 42");
      expect(byChat["222"]).toContain("BRIEF 42");
    });

    it("prefixes items with their SKU in items_table", () => {
      const db = getDb();
      db.prepare("DELETE FROM message_templates WHERE kind='telegram_new_invoice'").run();
      db.prepare("INSERT INTO message_templates (kind, body) VALUES ('telegram_new_invoice', '{items_table}')").run();
      const text = telegramService.buildMessage(
        telegramService.EVENT_TYPES.NEW_INVOICE,
        { invoiceNo: 1, total: 10, lines: [{ item_name: "سماعة", item_code: "SKU-1", quantity: 1, unit_price: 10, line_total: 10 }] },
        db
      );
      expect(text).toContain("[SKU-1] سماعة");
    });
  });

  describe("processQueue retry logic", () => {
    beforeEach(() => {
      seedSettings(getDb(), { telegram_enabled: 1, telegram_bot_token: "tok" });
    });

    it("sends pending notifications and marks them sent", async () => {
      getDb().prepare(`INSERT INTO pending_notifications (event_type, chat_id, text, status, next_retry_at)
        VALUES (?, ?, ?, 'pending', datetime('now'))`).run("new_invoice", "111", "hello");

      await telegramService.processQueue(getDb());

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const sent = getDb().prepare("SELECT status, sent_at FROM pending_notifications WHERE id=1").get();
      expect(sent.status).toBe("sent");
      expect(sent.sent_at).toBeTruthy();
    });

    it("increments retry count and keeps pending on failure", async () => {
      fetchSpy.mockRejectedValue(new Error("bad gateway"));
      getDb().prepare(`INSERT INTO pending_notifications (event_type, chat_id, text, status, retry_count, next_retry_at)
        VALUES (?, ?, ?, 'pending', 0, datetime('now'))`).run("new_invoice", "111", "hello");

      await telegramService.processQueue(getDb());

      const row = getDb().prepare("SELECT status, retry_count, error FROM pending_notifications WHERE id=1").get();
      expect(row.status).toBe("pending");
      expect(row.retry_count).toBe(1);
      expect(row.error).toContain("bad gateway");
    });

    it("marks rows without chat_id as failed", async () => {
      getDb().prepare(`INSERT INTO pending_notifications (event_type, chat_id, text, status, next_retry_at)
        VALUES (?, NULL, ?, 'pending', datetime('now'))`).run("new_invoice", "hello");

      await telegramService.processQueue(getDb());

      expect(fetchSpy).not.toHaveBeenCalled();
      const row = getDb().prepare("SELECT status, error FROM pending_notifications WHERE id=1").get();
      expect(row.status).toBe("failed");
      expect(row.error).toContain("Missing recipient chat_id");
    });
  });

  describe("isEventEnabledForRecipient", () => {
    it("maps event types to recipient flags correctly", () => {
      const r = {
        enabled: true,
        notifyNewInvoice: true,
        notifyDailyClose: false,
        notifyLargeAmounts: true,
        notifyReturnsVoids: false,
        notifyPurchasesPayments: true,
        notifyCustomerCreated: true,
        notifySupplierCreated: false,
        notifyExpenseCreated: true,
        notifyReturnPayment: false,
        notifyLowStock: true,
        notifySystem: false,
      };
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.NEW_INVOICE)).toBe(true);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.SHIFT_CLOSE)).toBe(false);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.LARGE_INVOICE)).toBe(true);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.SALES_RETURN)).toBe(false);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.CUSTOMER_CREATED)).toBe(true);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.SUPPLIER_CREATED)).toBe(false);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.EXPENSE_CREATED)).toBe(true);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.RETURN_PAYMENT)).toBe(false);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.LOW_STOCK)).toBe(true);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.FAILED_LOGIN)).toBe(false);
      expect(telegramService.isEventEnabledForRecipient(r, telegramService.EVENT_TYPES.TEST)).toBe(true);
    });

    it("returns false for disabled recipient", () => {
      expect(telegramService.isEventEnabledForRecipient({ enabled: false, notifyNewInvoice: true }, telegramService.EVENT_TYPES.NEW_INVOICE)).toBe(false);
    });
  });

  describe("runDueDigests", () => {
    function insertDigestLog(db, type, key) {
      db.prepare("INSERT OR IGNORE INTO telegram_digest_log (period_type, period_key) VALUES (?,?)").run(type, key);
    }

    beforeEach(() => {
      seedSettings(getDb(), { telegram_enabled: 1, telegram_bot_token: "tok" });
      // Minimal required data so buildDigest doesn't crash.
      getDb().prepare("INSERT INTO shifts (opened_at, opening_cash, status, user_id) VALUES (datetime('now'), 0, 'closed', ?)").run(userId);
      getDb().prepare("INSERT INTO invoices (invoice_no, total, created_at, shift_id) VALUES (?, ?, datetime('now'), ?)").run("INV-1", 100, 1);
    });

    it("sends digest to enabled recipients", async () => {
      insertRecipient(getDb(), { chat_id: "digest1", notify_weekly: true });
      insertRecipient(getDb(), { chat_id: "digest2", notify_weekly: false });

      fetchSpy.mockImplementation(async (url, opts) => {
        const body = opts?.body ? JSON.parse(opts.body) : {};
        if (body.text && body.text.includes("أسبوع")) return { ok: true, json: async () => ({ ok: true }), text: async () => "" };
        return { ok: true, json: async () => ({ ok: true }), text: async () => "" };
      });

      runDueDigests(getDb());
      await new Promise((r) => setTimeout(r, 100));

      const calls = fetchSpy.mock.calls.filter((c) => c[1] && JSON.parse(c[1].body).text?.includes("أسبوع"));
      expect(calls.length).toBeGreaterThanOrEqual(1);
      const chatIds = calls.map((c) => JSON.parse(c[1].body).chat_id);
      expect(chatIds).toContain("digest1");
      expect(chatIds).not.toContain("digest2");
    });

    it("skips already-sent periods", async () => {
      insertRecipient(getDb(), { chat_id: "digest1", notify_weekly: true });
      // Compute the key of the just-completed week that runDueDigests will use.
      const now = new Date();
      const day = (now.getDay() + 6) % 7; // Mon = 0
      const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
      insertDigestLog(getDb(), "weekly", periodKeyFor("weekly", lastMonday));

      runDueDigests(getDb());
      await new Promise((r) => setTimeout(r, 100));

      const digestCalls = fetchSpy.mock.calls.filter((c) => c[1] && JSON.parse(c[1].body).text?.includes("أسبوع"));
      expect(digestCalls).toHaveLength(0);
    });
  });
});
