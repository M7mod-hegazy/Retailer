# POS Draft Persistence & Held Invoice Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the active POS cart and held invoices (فواتير معلقة) to SQLite so they survive app restarts, and add age-based color alerts with a one-time popup reminder.

**Architecture:** A new `pos_drafts` table stores both the active cart (`type='active'`) and held invoices (`type='held'`). On POS mount, the active draft is restored from DB and held invoices are loaded. The Zustand store is augmented with async DB sync. Settings gains two threshold fields (`held_yellow_hours`, `held_red_hours`) used to color the held-invoices badge and trigger a one-time session popup.

**Tech Stack:** better-sqlite3 (sync), Express.js routes, React/Zustand, TailwindCSS, i18next (ar/en)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `electron/migrations/066_pos_drafts.js` | Create | New `pos_drafts` table |
| `server/src/routes/posDrafts.js` | Create | CRUD endpoints for drafts |
| `server/src/index.js` | Modify | Mount `/api/pos-drafts` router |
| `client/src/stores/posStore.js` | Modify | Load/save active draft & held invoices via API |
| `client/src/pages/pos/POSPage.jsx` | Modify | On mount restore draft; one-time popup for stale held invoices; remove nav block |
| `client/src/pages/settings/SettingsPage.jsx` | Modify | Add yellow/red hour threshold inputs in POS section |
| `client/src/locales/ar.json` | Modify | Add Arabic translation keys |
| `client/src/locales/en.json` | Modify | Add English translation keys |

---

## Task 1: DB Migration — `pos_drafts` table

**Files:**
- Create: `electron/migrations/066_pos_drafts.js`

- [ ] **Step 1: Create migration file**

```js
// electron/migrations/066_pos_drafts.js
module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pos_drafts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        type       TEXT NOT NULL DEFAULT 'held',
        lines_json TEXT NOT NULL DEFAULT '[]',
        customer_json TEXT,
        discount   INTEGER NOT NULL DEFAULT 0,
        increase   INTEGER NOT NULL DEFAULT 0,
        payment_type TEXT NOT NULL DEFAULT 'cash',
        held_at    TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    // Ensure at most one active draft exists (enforced by app logic, not DB constraint)
  },
  down(db) {
    db.exec(`DROP TABLE IF EXISTS pos_drafts;`);
  },
};
```

- [ ] **Step 2: Verify the migration file is picked up**

Check `electron/main.js` or wherever migrations are applied — confirm it scans `electron/migrations/` numerically and will pick up `066_pos_drafts.js`.

```bash
grep -n "migrations" electron/main.js | head -20
```

- [ ] **Step 3: Commit**

```bash
git add electron/migrations/066_pos_drafts.js
git commit -m "feat: add pos_drafts migration table"
```

---

## Task 2: Server Route — `/api/pos-drafts`

**Files:**
- Create: `server/src/routes/posDrafts.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: Create route file**

```js
// server/src/routes/posDrafts.js
const express = require("express");
const router = express.Router();

// GET /api/pos-drafts?type=active  or  ?type=held
router.get("/", (req, res) => {
  const { type } = req.query;
  const db = req.app.locals.db;
  try {
    let rows;
    if (type) {
      rows = db.prepare("SELECT * FROM pos_drafts WHERE type = ? ORDER BY held_at ASC").all(type);
    } else {
      rows = db.prepare("SELECT * FROM pos_drafts ORDER BY held_at ASC").all();
    }
    const parsed = rows.map((r) => ({
      ...r,
      lines: JSON.parse(r.lines_json || "[]"),
      customer: r.customer_json ? JSON.parse(r.customer_json) : null,
    }));
    res.json({ data: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pos-drafts  — create a draft
router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const { type = "held", lines, customer, discount, increase, payment_type } = req.body;
  try {
    // If saving active draft, delete previous active draft first
    if (type === "active") {
      db.prepare("DELETE FROM pos_drafts WHERE type = 'active'").run();
    }
    const stmt = db.prepare(`
      INSERT INTO pos_drafts (type, lines_json, customer_json, discount, increase, payment_type, held_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const result = stmt.run(
      type,
      JSON.stringify(lines || []),
      customer ? JSON.stringify(customer) : null,
      Number(discount || 0),
      Number(increase || 0),
      payment_type || "cash"
    );
    res.json({ data: { id: result.lastInsertRowid } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pos-drafts/:id
router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  try {
    db.prepare("DELETE FROM pos_drafts WHERE id = ?").run(Number(req.params.id));
    res.json({ data: { ok: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pos-drafts/type/active  — clear active draft
router.delete("/type/active", (req, res) => {
  const db = req.app.locals.db;
  try {
    db.prepare("DELETE FROM pos_drafts WHERE type = 'active'").run();
    res.json({ data: { ok: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount route in `server/src/index.js`**

Find the block where other routes are mounted (e.g. `app.use("/api/invoices", ...)`). Add:

```js
app.use("/api/pos-drafts", require("./routes/posDrafts"));
```

- [ ] **Step 3: Start dev server and smoke-test endpoints**

```bash
# In one terminal
npm run dev:server

# In another
curl http://localhost:5000/api/pos-drafts
# Expected: { "data": [] }
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/posDrafts.js server/src/index.js
git commit -m "feat: add pos-drafts API endpoints"
```

---

## Task 3: Zustand Store — persist active cart & held invoices to DB

**Files:**
- Modify: `client/src/stores/posStore.js`

The store currently holds `heldInvoices` in memory only. We'll:
1. Add `loadDraftsFromDB()` — called on POS mount to restore state
2. Make `holdCurrentInvoice()` save to DB
3. Make `discardHeldInvoice()` delete from DB
4. Make `resumeHeldInvoice()` delete from DB on resume
5. Add `syncActiveCartToDB()` — debounced, called whenever lines/customer/discount/increase/paymentType change
6. Add `clearActiveDraftFromDB()` — called after invoice is completed/paid

- [ ] **Step 1: Add DB-synced actions to `posStore.js`**

Open `client/src/stores/posStore.js`. Add the following imports at top if not present:
```js
import api from "../services/api";
```

Then add these new actions inside the `create(...)` block (alongside existing actions):

```js
// Load both active cart and held invoices from DB on POS mount
loadDraftsFromDB: async () => {
  try {
    const res = await api.get("/api/pos-drafts");
    const all = res.data?.data || [];
    const active = all.find((d) => d.type === "active");
    const held = all.filter((d) => d.type === "held");
    const heldSlots = held.map((d) => ({
      id: d.id,
      dbId: d.id,
      heldAt: d.held_at,
      heldTotal: d.lines.reduce((s, l) => s + l.quantity * l.unit_price - Number(l.line_discount || 0), 0) - Number(d.discount || 0) + Number(d.increase || 0),
      linesCount: d.lines.length,
      lines: d.lines,
      customer: d.customer,
      discount: d.discount,
      increase: d.increase,
      paymentType: d.payment_type,
    }));
    if (active) {
      set({
        lines: active.lines,
        customer: active.customer,
        discount: active.discount,
        increase: active.increase,
        paymentType: active.payment_type,
        heldInvoices: heldSlots,
        _activeDraftDbId: active.id,
      });
    } else {
      set({ heldInvoices: heldSlots });
    }
  } catch (_) {
    // silently fail — in-memory state remains
  }
},

// Save current cart state as active draft (replace previous)
syncActiveCartToDB: async () => {
  const state = get();
  if (!state.lines.length) {
    // Nothing in cart — delete active draft if exists
    if (state._activeDraftDbId) {
      await api.delete(`/api/pos-drafts/${state._activeDraftDbId}`).catch(() => {});
      set({ _activeDraftDbId: null });
    }
    return;
  }
  try {
    const res = await api.post("/api/pos-drafts", {
      type: "active",
      lines: state.lines,
      customer: state.customer,
      discount: state.discount,
      increase: state.increase,
      payment_type: state.paymentType,
    });
    set({ _activeDraftDbId: res.data?.data?.id || null });
  } catch (_) {}
},

clearActiveDraftFromDB: async () => {
  const { _activeDraftDbId } = get();
  if (_activeDraftDbId) {
    await api.delete(`/api/pos-drafts/${_activeDraftDbId}`).catch(() => {});
    set({ _activeDraftDbId: null });
  }
},
```

Also add `_activeDraftDbId: null` to the initial state object at the top of `create(...)`.

- [ ] **Step 2: Update `holdCurrentInvoice` to also save to DB**

Find the existing `holdCurrentInvoice` action. After building `slot`, add a DB save:

```js
holdCurrentInvoice: () => {
  const state = get();
  if (!state.lines.length) return;
  // ... existing slot building code stays unchanged ...

  // Save held invoice to DB
  api.post("/api/pos-drafts", {
    type: "held",
    lines: state.lines,
    customer: state.customer,
    discount: state.discount,
    increase: state.increase,
    payment_type: state.paymentType,
  }).then((res) => {
    const dbId = res.data?.data?.id;
    if (dbId) {
      set((s) => ({
        heldInvoices: s.heldInvoices.map((h) =>
          h.id === slot.id ? { ...h, dbId } : h
        ),
      }));
    }
  }).catch(() => {});

  // Clear active draft from DB (cart is now held)
  get().clearActiveDraftFromDB();

  // existing set(...) stays unchanged
},
```

- [ ] **Step 3: Update `discardHeldInvoice` to delete from DB**

```js
discardHeldInvoice: (id) => {
  const state = get();
  const held = state.heldInvoices.find((h) => h.id === id);
  if (held?.dbId) {
    api.delete(`/api/pos-drafts/${held.dbId}`).catch(() => {});
  }
  set((s) => ({ heldInvoices: s.heldInvoices.filter((h) => h.id !== id) }));
},
```

- [ ] **Step 4: Update `resumeHeldInvoice` to delete from DB**

```js
resumeHeldInvoice: (id) => {
  const state = get();
  const held = state.heldInvoices.find((entry) => entry.id === id);
  if (!held) return;
  if (held.dbId) {
    api.delete(`/api/pos-drafts/${held.dbId}`).catch(() => {});
  }
  set({
    heldInvoices: state.heldInvoices.filter((entry) => entry.id !== id),
    lines: held.lines,
    customer: held.customer,
    discount: held.discount,
    increase: held.increase || 0,
    paymentType: held.paymentType,
  });
},
```

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/posStore.js
git commit -m "feat: sync pos drafts and held invoices to SQLite"
```

---

## Task 4: POSPage — restore on mount, sync on change, popup alert, remove nav block

**Files:**
- Modify: `client/src/pages/pos/POSPage.jsx`

- [ ] **Step 1: Load drafts on mount**

Find the `useEffect` block that runs on POS page mount (look for `useEffect(() => { ... }, [])` near the top). Add `loadDraftsFromDB` to the store selector:

```js
const loadDraftsFromDB = usePosStore((s) => s.loadDraftsFromDB);
const syncActiveCartToDB = usePosStore((s) => s.syncActiveCartToDB);
const clearActiveDraftFromDB = usePosStore((s) => s.clearActiveDraftFromDB);
```

In the mount effect (or a new one), call:
```js
useEffect(() => {
  loadDraftsFromDB();
}, []);
```

- [ ] **Step 2: Debounced sync on cart change**

Add a debounced sync whenever lines, customer, discount, increase, or paymentType change:

```js
// Near top of component, after store selectors:
const syncTimerRef = useRef(null);

useEffect(() => {
  if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
  syncTimerRef.current = setTimeout(() => {
    syncActiveCartToDB();
  }, 1500); // 1.5s debounce
  return () => clearTimeout(syncTimerRef.current);
}, [lines, customer, discount, increase, paymentType]);
```

- [ ] **Step 3: Clear active draft after successful invoice save**

Find where the invoice is successfully saved/paid (look for `clear()` call in the save handler). Add before or after the `clear()` call:

```js
await clearActiveDraftFromDB();
```

- [ ] **Step 4: Remove the navigation block**

Find and remove the `beforeunload` / `pendingNavRef` / `history.pushState` override block. It spans roughly lines 290–345 in `POSPage.jsx`. The entire navigation-blocking `useEffect` should be deleted. Also remove the confirmation dialog JSX that references `pendingNavRef`.

**Verify by searching for these and removing:**
- `pendingNavRef`
- The `useEffect` that patches `window.history.pushState` and `window.history.back`
- The dialog JSX that asks "هل تريد المغادرة؟" or similar

- [ ] **Step 5: Add one-time stale held-invoice popup**

Read threshold settings from the store settings (they'll be added in Task 5). Add this effect after `loadDraftsFromDB` runs:

```js
const [staleHeldAlert, setStaleHeldAlert] = useState(false);
const staleAlertShownRef = useRef(false);

useEffect(() => {
  if (staleAlertShownRef.current) return;
  if (!heldInvoices.length) return;
  const yellowHours = Number(storeSettings?.held_yellow_hours || 2);
  const now = Date.now();
  const hasStale = heldInvoices.some((h) => {
    const ageHours = (now - new Date(h.heldAt).getTime()) / 3_600_000;
    return ageHours >= yellowHours;
  });
  if (hasStale) {
    staleAlertShownRef.current = true;
    setStaleHeldAlert(true);
  }
}, [heldInvoices, storeSettings]);
```

Add popup JSX (place near other modals at the bottom of the component return):

```jsx
{staleHeldAlert && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center">
      <div className="text-3xl mb-2">⚠️</div>
      <h3 className="text-[16px] font-black text-slate-800 mb-1">فواتير معلقة قديمة</h3>
      <p className="text-[13px] text-slate-500 mb-4">لديك فواتير معلقة منذ فترة طويلة. يرجى مراجعتها.</p>
      <button
        onClick={() => setStaleHeldAlert(false)}
        className="px-6 py-2 bg-slate-800 text-white rounded-lg text-[13px] font-bold"
      >
        حسناً
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Color-code the held-invoices badge**

Find the "فواتير معلقة" button rendering (around line 1785). Replace the static badge with a color-aware one:

```jsx
// Helper to compute badge color
const heldBadgeColor = (() => {
  if (!heldInvoices.length) return "bg-amber-100 text-amber-700";
  const yellowHours = Number(storeSettings?.held_yellow_hours || 2);
  const redHours = Number(storeSettings?.held_red_hours || 8);
  const now = Date.now();
  const maxAge = Math.max(...heldInvoices.map((h) => (now - new Date(h.heldAt).getTime()) / 3_600_000));
  if (maxAge >= redHours) return "bg-red-100 text-red-700 animate-pulse";
  if (maxAge >= yellowHours) return "bg-yellow-100 text-yellow-700";
  return "bg-amber-100 text-amber-700";
})();
```

Apply `heldBadgeColor` to the badge `<span>` className instead of the current hardcoded classes.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/pos/POSPage.jsx
git commit -m "feat: restore pos cart on mount, sync to db, stale held invoice alerts"
```

---

## Task 5: Settings — yellow/red threshold inputs

**Files:**
- Modify: `client/src/pages/settings/SettingsPage.jsx`
- Modify: `client/src/locales/ar.json`
- Modify: `client/src/locales/en.json`

- [ ] **Step 1: Add translation keys**

In `client/src/locales/ar.json`, add inside the root object:
```json
"held_yellow_hours_label": "تنبيه أصفر بعد (ساعات)",
"held_red_hours_label": "تنبيه أحمر بعد (ساعات)",
"held_thresholds_section": "تنبيهات الفواتير المعلقة"
```

In `client/src/locales/en.json`, add:
```json
"held_yellow_hours_label": "Yellow alert after (hours)",
"held_red_hours_label": "Red alert after (hours)",
"held_thresholds_section": "Held Invoice Alerts"
```

- [ ] **Step 2: Add inputs to POS settings section in `SettingsPage.jsx`**

Find the POS section (search for `default_pos_view`). After the existing view-mode toggle, add:

```jsx
{/* Held invoice alert thresholds */}
<div className="mt-4">
  <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2">
    تنبيهات الفواتير المعلقة
  </p>
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label className="text-[12px] text-slate-600 block mb-1">تنبيه أصفر بعد (ساعات)</label>
      <input
        type="number"
        min={1}
        max={72}
        value={settings.held_yellow_hours ?? 2}
        onChange={(e) => handleChange("held_yellow_hours", Number(e.target.value))}
        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-mono"
      />
    </div>
    <div>
      <label className="text-[12px] text-slate-600 block mb-1">تنبيه أحمر بعد (ساعات)</label>
      <input
        type="number"
        min={1}
        max={168}
        value={settings.held_red_hours ?? 8}
        onChange={(e) => handleChange("held_red_hours", Number(e.target.value))}
        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-mono"
      />
    </div>
  </div>
</div>
```

These use the existing `handleChange` + `handleSubmit` flow — no new save logic needed.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/settings/SettingsPage.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat: add held invoice alert threshold settings"
```

---

## Task 6: Smoke Test — full flow verification

- [ ] **Step 1: Start the app**
```bash
npm run dev
```

- [ ] **Step 2: Test active cart persistence**
  1. Open POS, add 2 items to cart
  2. Navigate to Customers page
  3. Navigate back to POS
  4. **Expected:** Same 2 items still in cart

- [ ] **Step 3: Test restart persistence**
  1. Add items to POS cart
  2. Kill and restart the app (`npm run dev`)
  3. Open POS
  4. **Expected:** Items restored in cart

- [ ] **Step 4: Test held invoice persistence**
  1. Add items, click "تعليق" to hold invoice
  2. Kill and restart app
  3. Open POS
  4. **Expected:** Held invoice badge shows (1), invoice is in dropdown

- [ ] **Step 5: Test stale alert**
  1. In SQLite, manually update a held invoice's `held_at` to 3 hours ago:
     ```sql
     UPDATE pos_drafts SET held_at = datetime('now', '-3 hours') WHERE type = 'held';
     ```
  2. Restart app, open POS
  3. **Expected:** Yellow badge + popup appears once

- [ ] **Step 6: Test settings thresholds**
  1. Go to Settings > POS section
  2. Change yellow threshold to 1 hour, save
  3. **Expected:** Badge turns yellow for the manually-aged invoice

- [ ] **Step 7: Final commit**
```bash
git add -A
git commit -m "feat: pos draft persistence and held invoice alerts complete"
```
