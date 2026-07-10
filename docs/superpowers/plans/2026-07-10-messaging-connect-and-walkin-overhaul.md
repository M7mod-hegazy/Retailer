# Messaging Connect + Sales-Return Walk-in Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the WhatsApp connect status-desync bug, rebuild the Telegram connect UX as a per-store own-bot QR flow, add sales-return walk-in customer parity, and expand Telegram into scheduled analytics digests with refined message presets.

**Architecture:** Four independent, sequentially-shipped phases with a review checkpoint after each. Phase 1 fixes a client polling bug (no engine rewrite). Phase 2 reuses the existing `telegramService.detectChatId` + owner-notification pipeline, adding a QR/guide connect UX. Phase 3 mirrors the existing POS walk-in feature (`WalkInCustomer.jsx`, `walk_in_*` invoice columns) onto `sales_returns`. Phase 4 adds a scheduler-driven digest job on top of the existing `telegramService` with catch-up-on-launch semantics.

**Tech Stack:** React 18 + Vite + TailwindCSS (RTL) + i18next; Express + better-sqlite3 (synchronous); Electron; Baileys (WhatsApp); Jest (server tests); Telegram Bot API (`getUpdates`, no webhook).

## Global Constraints

- **RTL-first Arabic UI.** Every new string added to BOTH `client/src/locales/ar.json` and `client/src/locales/en.json`. Use Tailwind `rtl:`/`ltr:` variants, never hardcoded `left`/`right`.
- **Theme tokens only.** Use `--danger`/`--warning`/`--success`/`--text-*`/`--bg-*` CSS-var Tailwind classes (`text-danger`, `bg-success-bg`, etc.), never raw Tailwind palette colors. See memory `theme-tokens-not-hardcoded-colors`.
- **Synchronous DB.** better-sqlite3 is synchronous — no `async/await`/`.then()` for DB calls in server code.
- **SQLite migrations:** live in `electron/migrations/`, named `NNN_description.js`, export `up(db)`, discovered by filename sort. Adding NOT NULL columns requires `DEFAULT`. Use the `addColumnIfMissing`/PRAGMA-check idempotent pattern. Next free number is the highest existing +1 (verify with `ls electron/migrations | sort | tail -1`).
- **Do NOT append to an already-applied migration** — always a new number (see memory `messaging-center-overhaul`).
- **Arabic file edits:** never use PowerShell `-replace` on Arabic-containing files (corrupts encoding); use the Edit tool.
- **Client API calls** go through `client/src/services/api.js`, never bare `fetch`.
- **Branch:** all work on `sync-system-overhaul` (already checked out).
- **Do NOT rewrite `electron/whatsapp/engine.js`** connection state machine — it is intentionally robust (per-code backoff, health probe, auth recovery).

---

## PHASE 1 — WhatsApp Connect Status-Desync Fix

**Root cause (verified):** `client/src/pages/whatsapp/WhatsAppCrmPage.jsx:390-401` only starts the status poll when `engine.status ∈ ["connecting","qr","error"]`. In the steady states `disconnected` and `connected` there is NO poll. Since the engine auto-connects on boot, the UI freezes on a stale `disconnected` until a manual page reload. Fix = poll in every state.

### Task 1.1: Always-on status polling

**Files:**
- Modify: `client/src/pages/whatsapp/WhatsAppCrmPage.jsx:388-401` (the `ConnectCard`/channels component's poll `useEffect`)

**Interfaces:**
- Consumes: `GET /api/whatsapp/engine-status` → `{ success, data: { status, qr, error, phone } }` (unchanged).
- Produces: continuous `engine` state that reflects the live engine within ≤3s in all states.

- [ ] **Step 1: Replace the gated poll effect.** Change the effect at `WhatsAppCrmPage.jsx:390-401` from the state-gated interval to an always-on interval that adapts cadence (fast while transient, slow while steady) but never stops:

```jsx
useEffect(() => {
  clearInterval(pollRef.current);
  // Poll in EVERY state so the UI never desyncs from the engine (the engine
  // auto-connects on boot; the old gated poll froze on stale `disconnected`).
  const transient = ["connecting", "qr", "error"].includes(engine.status);
  const intervalMs = transient ? 3000 : 6000;
  pollRef.current = setInterval(async () => {
    try {
      const r = await api.get("/api/whatsapp/engine-status");
      setEngine(r.data?.data || { status: "unavailable" });
    } catch { /* keep last known state on transient network blips */ }
  }, intervalMs);
  return () => clearInterval(pollRef.current);
}, [engine.status]);
```

- [ ] **Step 2: Manual verification — the reported bug.** Run `npm run dev`. In the app: disconnect WhatsApp, close and reopen the app so the engine auto-connects on boot, and navigate to the messaging center WITHOUT reloading.
Expected: within ~6s the WhatsApp card flips to "متصل" on its own — no page reload needed. Then, from the phone, unlink the device; within ~6s the card flips to "غير متصل".

- [ ] **Step 3: Commit.**

```bash
git add client/src/pages/whatsapp/WhatsAppCrmPage.jsx
git commit -m "fix(whatsapp): poll engine status in every state to stop connect desync"
```

### Task 1.2: Human Arabic error mapping + QR-refresh indicator

**Files:**
- Modify: `electron/whatsapp/engine.js` (the `normalizeError` map, ~lines 63-77) — add missing codes.
- Modify: `client/src/pages/whatsapp/WhatsAppCrmPage.jsx` (QR block ~531-539) — add a "refreshing" hint.
- Modify: `client/src/locales/ar.json` + `en.json` — add `whatsapp.qrRefreshing`.

**Interfaces:**
- Consumes: `engine.qr`, `engine.status`, `engine.error` from Task 1.1.
- Produces: clearer error copy + a visible cue when the QR rotates.

- [ ] **Step 1: Extend `normalizeError`** in `electron/whatsapp/engine.js` to cover the "another device" / replaced cases explicitly (append before the final `return msg;`):

```js
  if (msg.includes("replaced") || msg.includes("Connection Failure")) return "تم فتح واتساب ويب من جهاز آخر — أعد الربط من هنا";
  if (msg.includes("QR refs attempts ended")) return "انتهت مهلة رمز QR — اضغط ربط لتوليد رمز جديد";
```

- [ ] **Step 2: Add a QR-refreshing hint** under the QR image in `WhatsAppCrmPage.jsx` (inside the `state === "qr"` block, after the existing hint `<p>`):

```jsx
<p className="text-[10px] font-bold text-text-muted text-center">{t("whatsapp.qrRefreshing")}</p>
```

- [ ] **Step 3: Add translations.** In `client/src/locales/ar.json` under the `whatsapp` object add `"qrRefreshing": "يتجدد الرمز تلقائياً كل عدة ثوانٍ — إن انتهت صلاحيته سيظهر رمز جديد"`. In `en.json`: `"qrRefreshing": "The code refreshes automatically every few seconds."`.

- [ ] **Step 4: Manual verification.** Trigger a connect, let the QR sit unscanned ~60s.
Expected: QR visibly regenerates and the app shows the refreshing hint rather than a blank flash; if refs end, the error card shows the new Arabic message with a working "مسح الجلسة وإعادة الربط" button.

- [ ] **Step 5: Commit.**

```bash
git add electron/whatsapp/engine.js client/src/pages/whatsapp/WhatsAppCrmPage.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(whatsapp): clearer connect error copy + QR refresh cue"
```

**✅ PHASE 1 CHECKPOINT — review before Phase 2.**

---

## PHASE 2 — Telegram Option B Connect (own bot, no server)

**Design:** Each store creates its own bot (BotFather), pastes the token; the app shows a QR deep-link to *their* bot; owner scans with phone, taps Start; app auto-captures `chat_id` via the existing `telegramService.detectChatId` (`getUpdates`); live status via polling. Personal chat + staff group both supported. No webhook, no central server. Reuses the existing owner-notification send pipeline unchanged.

### Task 2.1: Deep-link + QR helper endpoint

**Files:**
- Modify: `server/src/routes/telegram.routes.js` — add `GET /deep-link` and `POST /detect-and-save`.
- Test: `server/tests/telegram.routes.test.js` (create)

**Interfaces:**
- Consumes: `telegramService.detectChatId(botToken, apiBase)` → `{ chatId, chatName, chatType } | null` (existing).
- Produces:
  - `GET /api/telegram/deep-link?bot_username=<u>` → `{ success, data: { url, qr } }` where `url = https://t.me/<u>?start=connect` and `qr` is a data-URL PNG.
  - `POST /api/telegram/detect-and-save` body `{ bot_token, bot_username, api_base? }` → detects chat_id, persists `settings.telegram_bot_token/telegram_chat_id/telegram_bot_username/telegram_enabled=1`, returns `{ success, data: { chatId, chatName, chatType } }` or 404 if no message yet.

- [ ] **Step 1: Write failing test** in `server/tests/telegram.routes.test.js`:

```js
const request = require("supertest");
// Follow the existing server test harness pattern (see server/tests/*.test.js for app/auth setup).
describe("telegram connect", () => {
  it("builds a deep-link + QR for a bot username", async () => {
    const res = await authedGet("/api/telegram/deep-link?bot_username=MyStoreBot");
    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe("https://t.me/MyStoreBot?start=connect");
    expect(res.body.data.qr).toMatch(/^data:image\/png;base64,/);
  });
});
```

- [ ] **Step 2: Run it, verify it fails.** `npm test --prefix server -- telegram.routes` → FAIL (route 404).

- [ ] **Step 3: Implement the endpoints** in `server/src/routes/telegram.routes.js`:

```js
const QRCode = require("qrcode");

router.get("/deep-link", requireAnyPagePermission(["settings", "whatsapp_crm"], "view"), async (req, res) => {
  try {
    const username = String(req.query.bot_username || "").replace(/^@/, "").trim();
    if (!username) return res.status(400).json({ success: false, message: "أدخل اسم المستخدم الخاص بالبوت أولاً" });
    const url = `https://t.me/${username}?start=connect`;
    const qr = await QRCode.toDataURL(url, { width: 256, margin: 1 });
    res.json({ success: true, data: { url, qr } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/detect-and-save", requireAnyPagePermission(["settings", "whatsapp_crm"], "edit"), async (req, res) => {
  try {
    const db = getDb();
    const { bot_token, bot_username, api_base } = req.body || {};
    if (!bot_token || !bot_token.trim()) return res.status(400).json({ success: false, message: "أدخل Bot Token أولاً" });
    const chat = await detectChatId(bot_token.trim(), api_base?.trim() || undefined);
    if (!chat) return res.status(404).json({ success: false, message: "لسه مفيش رسائل — امسح رمز QR وابدأ محادثة مع البوت بدوسة Start" });
    db.prepare(`UPDATE settings SET telegram_bot_token=?, telegram_chat_id=?, telegram_bot_username=?, telegram_enabled=1 WHERE id=1`)
      .run(bot_token.trim(), chat.chatId, String(bot_username || "").replace(/^@/, "").trim() || null);
    res.json({ success: true, data: chat });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
```

- [ ] **Step 4: Add the `telegram_bot_username` column** if missing — create migration `electron/migrations/NNN_telegram_bot_username.js` (verify NNN):

```js
module.exports.up = (db) => {
  const cols = db.prepare("PRAGMA table_info(settings)").all().map((c) => c.name);
  if (!cols.includes("telegram_bot_username")) {
    db.exec("ALTER TABLE settings ADD COLUMN telegram_bot_username TEXT");
  }
};
```

- [ ] **Step 5: Run tests, verify pass.** `npm test --prefix server -- telegram.routes` → PASS.

- [ ] **Step 6: Commit.**

```bash
git add server/src/routes/telegram.routes.js server/tests/telegram.routes.test.js electron/migrations/
git commit -m "feat(telegram): deep-link QR + detect-and-save connect endpoints"
```

### Task 2.2: Telegram connect card UI (QR flow + guided BotFather steps)

**Files:**
- Modify: `client/src/pages/whatsapp/WhatsAppCrmPage.jsx` — replace the Telegram channel card (currently the third card in the `lg:grid-cols-3` channels grid) with a guided connect card.
- Modify: `client/src/locales/ar.json` + `en.json` — add a `telegram.*` block (title, desc, steps, states, botFatherGuide, scanHint, connected, groupHint).

**Interfaces:**
- Consumes: `GET /api/telegram/config` (existing, returns `{ configured, enabled, ... }`), `GET /api/telegram/deep-link`, `POST /api/telegram/detect-and-save`, `POST /api/telegram/test`.
- Produces: a self-contained connect card with states `idle → token entered → qr shown → detecting → connected/error`, polling `detect-and-save` (or a status GET) every ~3s while awaiting scan.

- [ ] **Step 1: Add the connect-card component** in `WhatsAppCrmPage.jsx`. Key structure (RTL, theme tokens, icon steps). Include: a Bot Token input, a "توليد رمز الربط" button that calls `/deep-link` (needs `bot_username`), the QR image + fallback tappable `url` link, a phone-scan cue, a states banner, and the guided BotFather step list rendered from `t("telegram.steps").split("|")` with numbered badges (mirror the WhatsApp `steps` `<ol>` at `WhatsAppCrmPage.jsx:582-589`). While the QR is shown, poll `POST /api/telegram/detect-and-save` every 3s; on success show "متصل ✅" + a "إرسال رسالة تجريبية" button (`/api/telegram/test`).

```jsx
// Poll for the scan while QR is visible:
useEffect(() => {
  if (tgState !== "qr") return;
  const id = setInterval(async () => {
    try {
      const r = await api.post("/api/telegram/detect-and-save", { bot_token: tgToken, bot_username: tgUsername });
      if (r.data?.success) { setTgChat(r.data.data); setTgState("connected"); }
    } catch { /* 404 = not scanned yet; keep waiting */ }
  }, 3000);
  return () => clearInterval(id);
}, [tgState, tgToken, tgUsername]);
```

- [ ] **Step 2: Add translations** in both locale files. `ar.json` `telegram` block (verbatim keys):

```json
"telegram": {
  "title": "تليجرام",
  "desc": "استقبل إشعارات متجرك على تليجرام — على هاتفك أو في مجموعة الموظفين",
  "steps": "افتح تطبيق تليجرام وابحث عن @BotFather|أرسل له /newbot واتبع التعليمات لإنشاء بوت جديد|انسخ التوكن (Token) الذي سيعطيه لك والصقه هنا|اكتب اسم مستخدم البوت ثم اضغط توليد رمز الربط|امسح الرمز بكاميرا هاتفك واضغط Start داخل البوت",
  "botTokenLabel": "توكن البوت (Bot Token)",
  "botUsernameLabel": "اسم مستخدم البوت (بدون @)",
  "generateQr": "توليد رمز الربط",
  "scanHint": "امسح الرمز بكاميرا هاتفك — سيفتح البوت، اضغط Start",
  "waiting": "في انتظار الربط…",
  "connected": "متصل",
  "groupHint": "للمجموعات: أضف البوت إلى المجموعة، أرسل أي رسالة، ثم اضغط توليد الربط",
  "fallbackLink": "أو اضغط هنا من نفس الجهاز",
  "testSend": "إرسال رسالة تجريبية"
}
```

`en.json` — mirror the same keys with English values.

- [ ] **Step 3: Manual verification.** Create a real bot via BotFather, paste token + username, generate QR, scan from phone, tap Start.
Expected: card auto-flips to "متصل ✅" within ~3s without reload; "إرسال رسالة تجريبية" delivers a message. Repeat with a group (add bot to group, send a message, generate link) — group chat is captured.

- [ ] **Step 4: Commit.**

```bash
git add client/src/pages/whatsapp/WhatsAppCrmPage.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(telegram): guided own-bot QR connect card"
```

### Task 2.3: Visual setup guide assets (both channels)

**Files:**
- Create: `client/src/components/whatsapp/ConnectGuide.jsx` — a shared, theme-aware, RTL step-illustration component used by both connect cards.
- Possibly add: `client/public/guides/` images (web-sourced) IF suitable reusable assets are found.

**Interfaces:**
- Consumes: a `steps` array (label + optional image src) and a `channel` prop.
- Produces: `<ConnectGuide channel="telegram" />` / `<ConnectGuide channel="whatsapp" />` rendering numbered animated step cards with a phone-scan cue.

- [ ] **Step 1: Web-search current setup steps.** Use WebSearch for the *current* BotFather `/newbot` flow and the WhatsApp "link a device" flow; capture the exact current step wording. Attempt to find openly-usable reference images; only download to `client/public/guides/` if licensing is clearly permissive. If not, proceed with coded illustrations.

- [ ] **Step 2: Build `ConnectGuide.jsx`** — numbered step cards (reuse the numbered-badge pattern), a subtle "scan from your phone while the POS stays on the computer" illustration (phone + monitor icons from lucide-react, arrow between them), theme-token colors, RTL. No external asset dependency required for it to render.

- [ ] **Step 3: Mount it** in both the WhatsApp and Telegram cards behind the existing `<details>كيف أبدأ الربط؟</details>` disclosures.

- [ ] **Step 4: Manual verification.** Open both disclosures in light and dark themes.
Expected: guides render clearly, RTL, theme-correct, no broken images, no horizontal scroll.

- [ ] **Step 5: Commit.**

```bash
git add client/src/components/whatsapp/ConnectGuide.jsx client/src/pages/whatsapp/WhatsAppCrmPage.jsx client/public/guides/ 2>/dev/null
git commit -m "feat(messaging): shared visual connect guide for WhatsApp + Telegram"
```

**✅ PHASE 2 CHECKPOINT — review before Phase 3.**

---

## PHASE 3 — Sales-Return Walk-in Customer Parity

**Design:** `sales_returns` currently has only `customer_id`. Add `walk_in_name`/`walk_in_phone`. Direct returns (`createGeneralReturn`) get the full POS `WalkInCustomer` create UI. From-invoice returns (`createReturn`) inherit the source invoice's `customer_id`/`walk_in_*`, displayed read-only, but allow adding a walk-in when the invoice had no customer. Display everywhere via `InvoiceCustomer`/`invoiceCustomerText`.

### Task 3.1: Migration — walk_in columns on sales_returns

**Files:**
- Create: `electron/migrations/NNN_sales_returns_walk_in.js` (verify NNN = highest +1)

- [ ] **Step 1: Write the migration:**

```js
module.exports.up = (db) => {
  const cols = db.prepare("PRAGMA table_info(sales_returns)").all().map((c) => c.name);
  if (!cols.includes("walk_in_name")) db.exec("ALTER TABLE sales_returns ADD COLUMN walk_in_name TEXT");
  if (!cols.includes("walk_in_phone")) db.exec("ALTER TABLE sales_returns ADD COLUMN walk_in_phone TEXT");
};
```

- [ ] **Step 2: Apply + verify.** Restart `npm run dev:server` (migrations run on boot). Verify with electron-node:
`npx electron -e "const d=require('better-sqlite3')('server/data/retailer.db'); console.log(d.prepare('PRAGMA table_info(sales_returns)').all().map(c=>c.name))"`
Expected: array includes `walk_in_name`, `walk_in_phone`.

- [ ] **Step 3: Commit.**

```bash
git add electron/migrations/
git commit -m "feat(returns): add walk_in_name/phone columns to sales_returns"
```

### Task 3.2: returnService persistence (create/edit/read)

**Files:**
- Modify: `server/src/services/returnService.js` — `createReturn` (INSERT ~248), `createGeneralReturn` (INSERT ~395), `editSalesReturn` (UPDATE ~784), `getReturns`/`getReturnDetails` SELECTs (~572/596).
- Test: `server/tests/returnService.walkin.test.js` (create)

**Interfaces:**
- Consumes: `payload.walk_in_name`, `payload.walk_in_phone` (strings, optional). For `createReturn`, source invoice row exposes `walk_in_name`/`walk_in_phone` (added by migrations 170/171).
- Produces: persisted + returned `walk_in_name`/`walk_in_phone` on every return read path.

- [ ] **Step 1: Write failing test** `server/tests/returnService.walkin.test.js`:

```js
const { createGeneralReturn, getReturnDetails } = require("../src/services/returnService");
it("persists walk-in name/phone on a direct return", () => {
  const r = createGeneralReturn({ lines: [/* one valid line */], refund_method: "cash_back",
    walk_in_name: "عميل نقدي", walk_in_phone: "01000000000", user_id: 1 });
  const details = getReturnDetails(r.id);
  expect(details.walk_in_name).toBe("عميل نقدي");
  expect(details.walk_in_phone).toBe("01000000000");
});
```

- [ ] **Step 2: Run it, verify it fails.** `npm test --prefix server -- returnService.walkin` → FAIL.

- [ ] **Step 3: Implement.**
  - `createGeneralReturn`: destructure `walk_in_name, walk_in_phone` from payload; add both columns to the INSERT column list + values (line ~395).
  - `createReturn`: compute `const wName = payload.walk_in_name || invoice.walk_in_name || null; const wPhone = payload.walk_in_phone || invoice.walk_in_phone || null;` and add to the INSERT (line ~248). (Ensure the `invoice` SELECT includes `walk_in_name, walk_in_phone`.)
  - `editSalesReturn`: add `walk_in_name = ?, walk_in_phone = ?` to the UPDATE set list (line ~784), values `payload.walk_in_name ?? sr.walk_in_name, payload.walk_in_phone ?? sr.walk_in_phone`.
  - `getReturns` + `getReturnDetails`: add `sr.walk_in_name, sr.walk_in_phone` to the SELECT column lists.

- [ ] **Step 4: Run tests, verify pass.** `npm test --prefix server -- returnService.walkin` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add server/src/services/returnService.js server/tests/returnService.walkin.test.js
git commit -m "feat(returns): persist + expose walk-in customer on sales returns"
```

### Task 3.3: Return form — mount WalkInCustomer + inherit-from-invoice

**Files:**
- Modify: `client/src/pages/sales/SalesReturnFormPage.jsx` — customer area for both modes; include `walk_in_name/phone` in the save payload (near lines 2014/2046).
- Reuse: `client/src/components/pos/WalkInCustomer.jsx` (study the POS mounting in `client/src/pages/pos/POSPage.jsx` for the exact props/commit flow — see memory `messaging-center-overhaul`).

**Interfaces:**
- Consumes: `WalkInCustomer` component + its commit callback (`walkInSet` shape: `{ name, phone }`), mutually exclusive with a selected real `customer`.
- Produces: save payload includes `walk_in_name`, `walk_in_phone` when a walk-in is committed; edit mode prefills them.

- [ ] **Step 1: Direct mode** — render `WalkInCustomer` (same as POS) alongside the existing customer search; committing a walk-in sets local `walkIn` state and clears any selected `customer` (mutually exclusive).
- [ ] **Step 2: From-invoice mode** — when an invoice is loaded, prefill customer from the invoice; if the invoice has `walk_in_name/phone`, show them via `<InvoiceCustomer invoice={loadedInvoice} />` read-only; if the invoice has NO customer and NO walk-in, allow the `WalkInCustomer` create UI.
- [ ] **Step 3: Save payload** — add `walk_in_name: walkIn?.name || null, walk_in_phone: walkIn?.phone || null` to both save calls (lines ~2014 and ~2046). In edit mode, initialize `walkIn` from the loaded return's `walk_in_name/phone`.
- [ ] **Step 4: Manual verification.** Create a direct return with a walk-in (name+phone), save, reopen in edit/view.
Expected: walk-in name+phone show as saved. Create a from-invoice return where the source POS invoice was a walk-in → the return shows the same walk-in.

- [ ] **Step 5: Commit.**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "feat(returns): walk-in customer create + inherit on the return form"
```

### Task 3.4: Display walk-in in return detail + all preview modals

**Files:**
- Modify: `client/src/pages/pos/SalesReturnDetailPage.jsx` — show walk-in customer.
- Modify: any return preview/print modal that shows customer (grep `customer_name` in return-related components; reuse `InvoiceCustomer`/`invoiceCustomerText`).

- [ ] **Step 1: Replace raw customer rendering** in the return detail + preview modals with `invoiceCustomerText(returnRecord)` / `<InvoiceCustomer invoice={returnRecord} />` (the helper already prefers walk-in phone; pass the return row which now carries `walk_in_*`).
- [ ] **Step 2: Manual verification.** Open a walk-in return's detail page and its print/preview modal.
Expected: walk-in name + phone appear consistently in all places.

- [ ] **Step 3: Commit.**

```bash
git add client/src/pages/pos/SalesReturnDetailPage.jsx client/src/components/
git commit -m "feat(returns): show walk-in customer in return detail + previews"
```

**✅ PHASE 3 CHECKPOINT — review before Phase 4.**

---

## PHASE 4 — Telegram Scheduled Digests + Preset Refinement

**Design:** Add weekly/monthly/yearly analytics digests to the existing `telegramService` owner-notification channel, driven by a scheduler with **catch-up on next launch** (per-digest last-sent marker; on boot send any un-sent previous-period digest). Each digest toggleable. Refine all message presets for more info + better structure. **Digest content is confirmed at this checkpoint** — the tasks below lock the mechanism; the exact metric list is finalized against `server/src/services/dailySessionService.js` + reports queries when this phase starts.

### Task 4.1: Digest tracking table + settings toggles

**Files:**
- Create: `electron/migrations/NNN_telegram_digests.js` — a `telegram_digest_log` table `(period_type TEXT, period_key TEXT, sent_at TEXT, UNIQUE(period_type, period_key))` + settings columns `telegram_notify_weekly/monthly/yearly` (INTEGER DEFAULT 0).

- [ ] **Step 1: Write the migration** (PRAGMA-guarded `addColumnIfMissing` for the settings columns; `CREATE TABLE IF NOT EXISTS` for the log).
- [ ] **Step 2: Apply + verify** columns/table exist (electron-node PRAGMA check as in Task 3.1).
- [ ] **Step 3: Commit.**

### Task 4.2: Digest builder + analytics queries

**Files:**
- Create: `server/src/services/telegramDigest.js`
- Test: `server/tests/telegramDigest.test.js`

**Interfaces:**
- Consumes: `db`, a `periodType ∈ {"weekly","monthly","yearly"}`, and computed date bounds.
- Produces: `buildDigest(db, periodType, { from, to, prevFrom, prevTo }) → string` (Arabic Markdown) and `periodKeyFor(periodType, date) → string` (e.g. `2026-W28`, `2026-07`, `2026`).

- [ ] **Step 1: Write failing tests** for `periodKeyFor` (deterministic keys) and `buildDigest` (returns a non-empty Arabic string containing the sales total). Seed a tiny in-memory dataset.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `periodKeyFor` + `buildDigest`. Digest metrics (confirmed rich set): period sales total + Δ vs previous period, invoice count, top products, best customers, gross profit, cash/treasury position, outstanding customer debts, low-stock count. Use the same SQL sources the reports pages use (grep `server/src/routes/reports*.js` for the canonical aggregations to avoid divergent numbers).
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

### Task 4.3: Scheduler with catch-up on launch

**Files:**
- Create: `server/src/jobs/telegramDigestJob.js`
- Modify: `server/src/index.js` — start the job on boot (near the existing auto-backup cron + `startTelegramRetryJob`).

**Interfaces:**
- Consumes: `telegramDigest.buildDigest/periodKeyFor`, `telegramService.notifyOwner`/`sendTelegramMessage`, `telegram_digest_log`.
- Produces: `runDueDigests(db)` — for each enabled period type, compute the just-completed period's `period_key`; if not in `telegram_digest_log`, build+send the digest, then insert the log row. Called once on boot (catch-up) and on a daily interval.

- [ ] **Step 1: Write failing test** — `runDueDigests` sends + logs a missing previous-period digest exactly once (second call is a no-op). Mock the send.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `runDueDigests` + a `setInterval` (daily) started from `index.js`; run once immediately on boot for catch-up. Respect the per-period settings toggles + overall `telegram_enabled`.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.**

### Task 4.4: Digest toggles in the Telegram settings UI

**Files:**
- Modify: the Telegram settings UI (the granular toggles live alongside `telegram_notify_*`; grep `telegram_notify_daily_close` in `client/src`).
- Modify: `client/src/locales/ar.json` + `en.json` — labels for weekly/monthly/yearly toggles.

- [ ] **Step 1: Add three toggles** (weekly/monthly/yearly) wired to the settings save, mirroring the existing granular notification toggles.
- [ ] **Step 2: Manual verification.** Enable weekly, delete its `telegram_digest_log` row, restart the server.
Expected: a weekly digest is delivered on boot (catch-up) and not re-sent on the next restart.
- [ ] **Step 3: Commit.**

### Task 4.5: Refine message presets

**Files:**
- Modify: the seed/default templates for `telegram_*` categories (in `telegramService.buildMessage` defaults) + customer-facing `receipt`/`birthday`/`debt` presets (grep `message_templates` seed + `client` template editor defaults).

- [ ] **Step 1: Rewrite each default template** for more info + clearer structure (grouped sections, emoji headers, aligned key/value lines, branch header). Keep the existing `{variable}` placeholders (`buildTemplateVars` keys) — do not introduce variables not produced by `buildTemplateVars`.
- [ ] **Step 2: Manual verification.** Send a test of each event type; confirm rendering + all variables resolve (no stray `{var}`).
- [ ] **Step 3: Commit.**

**✅ PHASE 4 CHECKPOINT — final review.**

---

## Self-Review Notes

- **Spec coverage:** Phase 1 → WhatsApp reload bug (Task 1.1) + error/QR UX (1.2). Phase 2 → Telegram Option B connect (2.1-2.2) + guides (2.3). Phase 3 → sales-return walk-in: migration (3.1), persistence incl. from-invoice inherit + editable-when-empty (3.2-3.3), display everywhere (3.4). Phase 4 → rich weekly/monthly/yearly digests (4.2) with catch-up-on-launch (4.3), toggles (4.4), preset refinement (4.5). All four locked decisions covered.
- **Deferred by agreement:** exact Phase 4 digest metric list is finalized at the Phase 4 checkpoint against the reports queries (user agreed "firm details at its checkpoint") — Task 4.2 names the confirmed rich metric set and the canonical SQL source to reuse.
- **Verification method:** connection flows (Baileys/Telegram/Electron) are verified manually/e2e (cannot unit-test without a live phone/bot); pure logic (migrations, returnService, digest builder, scheduler) is TDD with Jest.
- **Migration numbers:** every migration task says "verify NNN = highest existing +1" — do not hardcode; never append to an applied migration.
- **Type consistency:** `walk_in_name`/`walk_in_phone` used identically across migration, returnService, form payload, and display. `periodKeyFor`/`buildDigest`/`runDueDigests` signatures consistent across Tasks 4.2-4.3.
