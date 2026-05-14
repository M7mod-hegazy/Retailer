# Invoice System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul all 4 invoice pages (POS, Purchase, Sales Return, Purchase Return) with a unified doc number system, idle/active state, full POS-feature parity on return pages, advanced invoice search, live balance panels, and proper post-save reset.

**Architecture:** Server gets a daily-reset doc-number utility + reservation endpoint. A shared `useInvoiceActivation` hook manages idle/active state across pages. Both return form pages are rebuilt as full POS-style split layouts with all POS features. POS and Purchase pages receive targeted fixes.

**Tech Stack:** React 18, Express.js, SQLite (better-sqlite3 synchronous), TailwindCSS, Zustand, TanStack Query, lucide-react, react-hot-toast

---

## File Map

### Server
| File | Action | Purpose |
|------|--------|---------|
| `server/src/utils/docNumber.js` | Modify | Daily-reset format `PREFIX-YYYYMMDD-NNN` |
| `server/src/routes/documents.routes.js` | Create | `POST /api/documents/reserve` — reserve a doc number on form activation |
| `server/src/app.js` | Modify | Mount new documents route |
| `electron/migrations/057_doc_sequences_daily.js` | Create | Alter `document_sequences`: replace `year` logic with `day TEXT` |

### Client — Cleanup
| File | Action | Purpose |
|------|--------|---------|
| `client/src/pages/purchases/PurchasesListPage.jsx` | Delete | Replaced by redirect to `/purchases/new` |
| `client/src/pages/sales/SalesReturnPage.jsx` | Delete | Replaced by redirect to `/sales/returns/new` |
| `client/src/pages/purchases/PurchaseReturnPage.jsx` | Delete | Replaced by redirect to `/purchases/returns/new` |
| `client/src/App.jsx` | Modify | Remove 3 list page imports/routes; add redirects |

### Client — Shared
| File | Action | Purpose |
|------|--------|---------|
| `client/src/hooks/useInvoiceActivation.js` | Create | Idle→Active state: calls reserve endpoint on first interaction, locks in docNo + createdAt |

### Client — Page Fixes
| File | Action | Purpose |
|------|--------|---------|
| `client/src/pages/pos/POSPage.jsx` | Modify | Add idle/active state; show docNo+datetime on both list & grid views; fix post-save reset; extend balance panel with ajal debt + treasury projected |
| `client/src/pages/purchases/PurchaseFormPage.jsx` | Modify | Add idle/active state via hook; extend balance panel with ajal debt + treasury projected; fix post-save reset |

### Client — Return Pages Rebuild
| File | Action | Purpose |
|------|--------|---------|
| `client/src/pages/sales/SalesReturnFormPage.jsx` | Rewrite | Full POS-style split layout — all POS features + advanced invoice search toggle + customer balance panel |
| `client/src/pages/purchases/PurchaseReturnFormPage.jsx` | Rewrite | Same as sales return but for suppliers/purchases |

---

## Task 1: Server — Daily Doc Number System

**Files:**
- Modify: `server/src/utils/docNumber.js`
- Create: `electron/migrations/057_doc_sequences_daily.js`

- [ ] **Step 1: Create migration 057**

Create `electron/migrations/057_doc_sequences_daily.js`:

```js
module.exports = {
  up(db) {
    // Add 'day' column (YYYYMMDD string) to document_sequences
    try { db.exec(`ALTER TABLE document_sequences ADD COLUMN day TEXT NOT NULL DEFAULT '';`); } catch(e) {}

    // Update prefixes to new agreed values
    db.exec(`
      INSERT OR REPLACE INTO settings_kv (key, value) VALUES
        ('doc_prefix_pos_sale',         'INV'),
        ('doc_prefix_purchase_receipt', 'PUR'),
        ('doc_prefix_sales_return',     'SRT'),
        ('doc_prefix_purchase_return',  'PRT');
    `);
  },
  down(db) {
    // SQLite can't drop columns; leave as-is
  },
};
```

- [ ] **Step 2: Rewrite `server/src/utils/docNumber.js`**

```js
const { getDb } = require("../config/database");

/**
 * Generate a sequential document number in format PREFIX-YYYYMMDD-NNN(N).
 * Counter resets every calendar day.
 * @param {string} type - e.g. 'pos_sale', 'purchase_receipt', 'sales_return', 'purchase_return'
 * @param {string} [overridePrefix]
 * @returns {string} e.g. "INV-20260508-0001" or "PUR-20260508-001"
 */
function generateDocNumber(type, overridePrefix) {
  const db = getDb();

  // YYYYMMDD of today (local time)
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  // Prefix from settings_kv or fallback
  let prefix = overridePrefix;
  if (!prefix) {
    const row = db.prepare("SELECT value FROM settings_kv WHERE key = ?").get(`doc_prefix_${type}`);
    prefix = row?.value || type.toUpperCase().slice(0, 4);
  }

  // Digit width: pos_sale (INV) uses 4 digits, everything else 3
  const digits = type === "pos_sale" ? 4 : 3;

  const existing = db.prepare(
    "SELECT day, last_seq FROM document_sequences WHERE type = ?"
  ).get(type);

  let nextSeq;
  if (!existing) {
    db.prepare(
      "INSERT INTO document_sequences (type, day, last_seq) VALUES (?, ?, 1)"
    ).run(type, day);
    nextSeq = 1;
  } else if (existing.day !== day) {
    // New day — reset counter
    db.prepare(
      "UPDATE document_sequences SET day = ?, last_seq = 1 WHERE type = ?"
    ).run(day, type);
    nextSeq = 1;
  } else {
    nextSeq = existing.last_seq + 1;
    db.prepare(
      "UPDATE document_sequences SET last_seq = ? WHERE type = ?"
    ).run(nextSeq, type);
  }

  return `${prefix}-${day}-${String(nextSeq).padStart(digits, "0")}`;
}

module.exports = { generateDocNumber };
```

- [ ] **Step 3: Verify existing callers still work**

Run: `grep -rn "generateDocNumber" server/src/` and confirm each call passes a valid `type` string (`pos_sale`, `purchase_receipt`, `sales_return`, `purchase_return`). No other arguments need changing.

- [ ] **Step 4: Commit**

```bash
git add electron/migrations/057_doc_sequences_daily.js server/src/utils/docNumber.js
git commit -m "feat: daily-reset doc numbers — INV-YYYYMMDD-0001, PUR/SRT/PRT-YYYYMMDD-001"
```

---

## Task 2: Server — Doc Number Reservation Endpoint

**Files:**
- Create: `server/src/routes/documents.routes.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: Create `server/src/routes/documents.routes.js`**

```js
const express = require("express");
const router = express.Router();
const { generateDocNumber } = require("../utils/docNumber");
const authMiddleware = require("../middleware/auth");

const VALID_TYPES = ["pos_sale", "purchase_receipt", "sales_return", "purchase_return"];

// POST /api/documents/reserve
// Atomically increments the sequence and returns the reserved doc number.
// The caller MUST use this number when saving — if the form is abandoned the
// number is silently wasted (gap in sequence), which is acceptable.
router.post("/reserve", authMiddleware, (req, res, next) => {
  try {
    const { type } = req.body;
    if (!VALID_TYPES.includes(type)) {
      const e = new Error(`Invalid document type: ${type}`); e.status = 400; throw e;
    }
    const docNo = generateDocNumber(type);
    res.json({ success: true, data: { doc_no: docNo } });
  } catch (e) { next(e); }
});

module.exports = router;
```

- [ ] **Step 2: Mount in `server/src/app.js`**

Find the block where routes are mounted (e.g. `app.use("/api/purchases", ...)`). Add:

```js
const documentsRoutes = require("./routes/documents.routes");
// mount alongside other /api routes:
app.use("/api/documents", documentsRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/documents.routes.js server/src/app.js
git commit -m "feat: POST /api/documents/reserve — reserve doc number on form activation"
```

---

## Task 3: Client — Shared `useInvoiceActivation` Hook

**Files:**
- Create: `client/src/hooks/useInvoiceActivation.js`

- [ ] **Step 1: Create the hook**

```js
import { useState, useRef, useCallback } from "react";
import api from "../services/api";

/**
 * Manages idle → active state for invoice forms.
 * Doc number and createdAt are null until the user's first meaningful interaction.
 *
 * @param {string} documentType - one of: pos_sale | purchase_receipt | sales_return | purchase_return
 * @param {{ docNo: string|null, createdAt: string|null }|null} editValues
 *   Pass existing doc_no + created_at when in edit/amend mode — skips activation entirely.
 */
export function useInvoiceActivation(documentType, editValues = null) {
  const isEditMode = !!editValues;

  const [docNo, setDocNo] = useState(editValues?.docNo ?? null);
  const [createdAt, setCreatedAt] = useState(editValues?.createdAt ?? null);
  const [isActive, setIsActive] = useState(isEditMode);
  const activating = useRef(false);

  // Call this on first meaningful user interaction (add item / select party / toggle search)
  const activate = useCallback(async () => {
    if (isActive || activating.current || isEditMode) return;
    activating.current = true;
    try {
      const res = await api.post("/api/documents/reserve", { type: documentType });
      const reserved = res.data.data.doc_no;
      const now = new Date().toISOString();
      setDocNo(reserved);
      setCreatedAt(now);
      setIsActive(true);
    } catch {
      // Non-fatal: form still usable, doc number generated on save as fallback
    } finally {
      activating.current = false;
    }
  }, [isActive, isEditMode, documentType]);

  // Reset back to idle (call after successful save)
  const reset = useCallback(() => {
    setDocNo(null);
    setCreatedAt(null);
    setIsActive(false);
    activating.current = false;
  }, []);

  return { docNo, createdAt, isActive, activate, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useInvoiceActivation.js
git commit -m "feat: useInvoiceActivation hook — idle/active state with server-reserved doc numbers"
```

---

## Task 4: Route Cleanup

**Files:**
- Delete: `client/src/pages/purchases/PurchasesListPage.jsx`
- Delete: `client/src/pages/sales/SalesReturnPage.jsx`
- Delete: `client/src/pages/purchases/PurchaseReturnPage.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Delete the 3 list pages**

```bash
rm client/src/pages/purchases/PurchasesListPage.jsx
rm client/src/pages/sales/SalesReturnPage.jsx
rm client/src/pages/purchases/PurchaseReturnPage.jsx
```

- [ ] **Step 2: Update `client/src/App.jsx`**

Remove these 6 lines (imports + routes):
```js
// Remove imports:
const PurchasesListPage = lazy(() => import("./pages/purchases/PurchasesListPage"));
const SalesReturnPage = lazy(() => import("./pages/sales/SalesReturnPage"));
const PurchaseReturnPage = lazy(() => import("./pages/purchases/PurchaseReturnPage"));

// Remove routes and replace with redirects:
<Route path="purchases" element={<PurchasesListPage />} />
<Route path="sales/returns" element={<SalesReturnPage />} />
<Route path="purchases/returns" element={<PurchaseReturnPage />} />
```

Replace those 3 routes with:
```jsx
<Route path="purchases" element={<Navigate to="/purchases/new" replace />} />
<Route path="sales/returns" element={<Navigate to="/sales/returns/new" replace />} />
<Route path="purchases/returns" element={<Navigate to="/purchases/returns/new" replace />} />
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: remove list pre-pages — sales/returns, purchases/returns, purchases all go direct to /new"
```

---

## Task 5: POS Page — Idle/Active State + DocNo/Date Display + Balance Panel Fix + Post-Save Reset

**Files:**
- Modify: `client/src/pages/pos/POSPage.jsx`

Context: POSPage is ~3700 lines. Make targeted changes only.

- [ ] **Step 1: Add `useInvoiceActivation` hook**

Near the top of `POSPage` (after existing state declarations, around line 438), add:

```js
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";

// Inside POSPage component, in amend context block:
const amendDocNo = amendContext?.prefill?.invoice_no || null;
const amendCreatedAt = amendContext?.prefill?.created_at || null;
const { docNo, createdAt, isActive, activate, reset: resetActivation } = useInvoiceActivation(
  "pos_sale",
  amendDocNo ? { docNo: amendDocNo, createdAt: amendCreatedAt } : null
);
```

- [ ] **Step 2: Wire activation to first interactions**

In `handleSelectItem` (the function that adds items to cart), call `activate()` as first line:
```js
async function handleSelectItem(item) {
  activate();
  // ... rest of existing code
}
```

In the customer select handler (where `setCustomer` is called for the first time):
```js
function handleSelectCustomer(c) {
  activate();
  setCustomer(c);
  // ...
}
```

- [ ] **Step 3: Show docNo + createdAt on both list and grid view headers**

Find the POS page header area in both the list view and grid view render paths. Look for where `invoiceTick` is used (around line 1281 and 2713). In both locations, add a two-field strip above the cart:

```jsx
{/* Doc number + datetime strip — appears once form is active */}
<div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/80 border-b border-slate-700/50">
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Doc</span>
    <input
      readOnly
      disabled
      value={isActive ? (docNo || "—") : "—"}
      placeholder="—"
      className="w-[160px] rounded-sm border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-black text-amber-400 outline-none disabled:cursor-default"
    />
  </div>
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</span>
    <input
      readOnly
      disabled
      value={isActive && createdAt ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "short", timeStyle: "short" }).format(new Date(createdAt)) : "—"}
      className="w-[140px] rounded-sm border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-black text-slate-300 outline-none disabled:cursor-default"
    />
  </div>
</div>
```

- [ ] **Step 4: Fix post-save reset**

Find the section after a successful save (where `setSaveSuccess`, `setLastSavedInvoice` etc. are called). After the existing `clear()` call, add:

```js
resetActivation();
```

This returns the form to idle (no docNo, no date) until next interaction.

- [ ] **Step 5: Extend balance panel with ajal debt + treasury balance**

Find the customer balance section in the right panel (search for `opening_balance` around line ~1100-1200 in the list view render). Add two rows after the existing balance display:

```jsx
{/* Ajal outstanding debt */}
{customer?.ajal_total > 0 && (
  <div className="mt-1 flex items-center justify-between rounded-sm bg-rose-50 border border-rose-100 px-3 py-1.5">
    <span className="text-[10px] font-bold text-rose-500">Outstanding Ajal Debt</span>
    <span className="text-[12px] font-black font-mono text-rose-700">
      {Number(customer.ajal_total || 0).toFixed(2)}
    </span>
  </div>
)}
{/* Treasury projected balance */}
{selectedTreasuryId && (paymentType === "cash" || paymentType === "multi") && (
  <div className="mt-1 flex items-center justify-between rounded-sm bg-emerald-50 border border-emerald-100 px-3 py-1.5">
    <span className="text-[10px] font-bold text-emerald-600">Treasury After Sale</span>
    <span className="text-[12px] font-black font-mono text-emerald-700">
      {(Number(treasuries.find(t => String(t.id) === String(selectedTreasuryId))?.balance || 0) + totals.total).toFixed(2)}
    </span>
  </div>
)}
```

To get `ajal_total` on the customer object, fetch it when a customer is selected:
```js
async function handleSelectCustomer(c) {
  activate();
  const enriched = { ...c };
  try {
    const r = await api.get(`/api/ajal-debts?party_type=customer&party_id=${c.id}&status=open`);
    enriched.ajal_total = (r.data.data || []).reduce((s, d) => s + Number(d.original_amount) - Number(d.paid_amount), 0);
  } catch { enriched.ajal_total = 0; }
  setCustomer(enriched);
  setCustomerQuery(c.name || "");
  setCustomerLookupOpen(false);
}
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/pos/POSPage.jsx client/src/hooks/useInvoiceActivation.js
git commit -m "feat: POS — idle/active state, docNo+date display on list/grid, balance panel with ajal+treasury, post-save reset"
```

---

## Task 6: Purchase Form Page — Idle/Active State + Balance Panel + Post-Save Reset

**Files:**
- Modify: `client/src/pages/purchases/PurchaseFormPage.jsx`

- [ ] **Step 1: Add `useInvoiceActivation` hook**

In the component, near the `isEditMode` declaration (around line 85), add:

```js
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";

// Inside component:
const { docNo, createdAt, isActive, activate, reset: resetActivation } = useInvoiceActivation(
  "purchase_receipt",
  isEditMode ? { docNo: docDate ? null : null, createdAt: null } : null
  // edit mode: docNo/createdAt come from loaded purchase data
);
```

When loading existing purchase (in the edit-mode useEffect, around line 155), after setting state:
```js
// Override activation state for edit mode — form is always active with preserved values
if (p.doc_no) { /* already handled by editValues in hook */ }
```

Actually for edit mode, pass the loaded values to the hook after load. Use a ref pattern:
```js
const [editDocNo, setEditDocNo] = useState(null);
const [editCreatedAt, setEditCreatedAt] = useState(null);

const { docNo, createdAt, isActive, activate, reset: resetActivation } = useInvoiceActivation(
  "purchase_receipt",
  isEditMode && editDocNo ? { docNo: editDocNo, createdAt: editCreatedAt } : (isEditMode ? null : null)
);
```

Then in the load effect: `setEditDocNo(p.doc_no); setEditCreatedAt(p.created_at);`

- [ ] **Step 2: Wire activation**

In the supplier select handler and in `addLine` (or wherever lines are added), call `activate()`:
```js
function handleSelectSupplier(s) {
  activate();
  setSupplier(s);
  // ...
}
```

- [ ] **Step 3: Add docNo + date display strip in the page header**

Find the header area of PurchaseFormPage (around line 650-700 where the title and doc_no are shown). Add the same disabled input strip as POS:

```jsx
<div className="flex items-center gap-3 mt-2">
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doc No</span>
    <input readOnly disabled
      value={isActive ? (docNo || originalDocNo || "—") : "—"}
      className="w-[180px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-mono font-black text-slate-700 outline-none disabled:cursor-default"
    />
  </div>
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</span>
    <input readOnly disabled
      value={(createdAt || originalCreatedAt) ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(createdAt || originalCreatedAt)) : "—"}
      className="w-[180px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-mono font-black text-slate-500 outline-none disabled:cursor-default"
    />
  </div>
</div>
```

- [ ] **Step 4: Extend balance panel with ajal debt + treasury**

In the supplier balance panel (around line 779), after the existing "balance after invoice" row, add:

```jsx
{/* Supplier ajal outstanding debt */}
{supplier?.ajal_total > 0 && (
  <div className="mt-1 flex items-center justify-between rounded-sm bg-rose-50 border border-rose-100 px-3 py-1.5">
    <span className="text-[10px] font-bold text-rose-500">Outstanding Ajal</span>
    <span className="text-[12px] font-black font-mono text-rose-700">
      {Number(supplier.ajal_total).toFixed(2)}
    </span>
  </div>
)}
{/* Treasury projected balance after payment */}
{selectedTreasuryId && paymentMode === "cash" && totals.total > 0 && (
  <div className="mt-1 flex items-center justify-between rounded-sm bg-amber-50 border border-amber-100 px-3 py-1.5">
    <span className="text-[10px] font-bold text-amber-600">Treasury After Payment</span>
    <span className="text-[12px] font-black font-mono text-amber-700">
      {(Number(treasuries.find(t => String(t.id) === String(selectedTreasuryId))?.balance || 0) - totals.total).toFixed(2)}
    </span>
  </div>
)}
```

Fetch ajal total when supplier is selected:
```js
async function handleSelectSupplier(s) {
  activate();
  const enriched = { ...s };
  try {
    const r = await api.get(`/api/ajal-debts?party_type=supplier&party_id=${s.id}&status=open`);
    enriched.ajal_total = (r.data.data || []).reduce((sum, d) => sum + Number(d.original_amount) - Number(d.paid_amount), 0);
  } catch { enriched.ajal_total = 0; }
  setSupplier(enriched);
}
```

- [ ] **Step 5: Fix post-save reset**

Find where the successful save toast/redirect happens. After clearing lines, call:
```js
resetActivation();
setSupplier(null);
setLines([]);
// ... other resets
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/purchases/PurchaseFormPage.jsx
git commit -m "feat: PurchaseFormPage — idle/active state, docNo+date strip, ajal+treasury balance panel, post-save reset"
```

---

## Task 7: Sales Return Form Page — Full Rebuild

**Files:**
- Rewrite: `client/src/pages/sales/SalesReturnFormPage.jsx`

This page is rebuilt as a full POS-style split layout matching `PurchaseFormPage` quality but for sales returns.

### Layout structure
```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: [Doc No input] [Date input] [← Back] [Save F9] [Print F12] │
├──────────────────────────────────┬──────────────────────────┤
│ LEFT: Items / Return Lines       │ RIGHT: Customer panel    │
│  ┌────────────────────────────┐  │  OR (toggle ON):         │
│  │ Staging area:              │  │  Advanced Invoice Search  │
│  │ [Item search F2] [Qty] [▲▼]│  │  [Search input live]     │
│  │ [Add to return]            │  │  [Results list]          │
│  └────────────────────────────┘  │  [Invoice detail modal]  │
│  ┌────────────────────────────┐  ├──────────────────────────┤
│  │ Return lines table:        │  │ Customer balance panel   │
│  │ # | Item | OrigQty | Prev  │  │ (live, updates per line) │
│  │   | Ret  | RetQty▲▼| After│  │                          │
│  └────────────────────────────┘  │ Settlement type          │
│  [Barcode listener]              │ Treasury selector        │
│  [Bottom total bar]              │ Reason selector          │
│  [Offline indicator]             │ Notes                    │
└──────────────────────────────────┴──────────────────────────┘
```

- [ ] **Step 1: Write the full `SalesReturnFormPage.jsx`**

```jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Search, Trash2, Plus, Minus, History, CheckCircle2,
  AlertCircle, RotateCcw, Printer, Package, User, Warehouse,
  ChevronDown, X, Barcode, ZoomIn, Eye, ExternalLink, LayoutGrid,
  List, Keyboard, Save, AlertTriangle, Wifi, WifiOff, Filter,
  RefreshCw, FileText
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import BarcodeListener from "../../components/pos/BarcodeListener";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";
import { useInvoiceActivation } from "../../hooks/useInvoiceActivation";
import { useAuthStore } from "../../stores/authStore";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function fmt(v, d = 2) { return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtDT(iso) { return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); }

const REFUND_METHODS = [
  { id: "cash_back",   label: "Cash Refund",   sub: "Cash out of treasury" },
  { id: "credit_note", label: "Credit Note",   sub: "Added to customer credit balance" },
];

const RETURN_REASONS = [
  { id: "changed_mind", label: "Changed mind" },
  { id: "defective",    label: "Defective product" },
  { id: "wrong_item",   label: "Wrong item" },
  { id: "damaged",      label: "Damaged" },
  { id: "other",        label: "Other" },
];

// Inline nav guard (same pattern as POSPage)
function useNavGuard(shouldBlock) {
  const [showModal, setShowModal] = useState(false);
  const pendingNavRef = useRef(null);
  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
  const proceed = () => { setShowModal(false); pendingNavRef.current?.(); };
  const cancel = () => setShowModal(false);
  return { showModal, proceed, cancel };
}

export default function SalesReturnFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const editReturnId = location.state?.edit_return_id ?? null;
  const isEditMode = !!editReturnId;

  // ── Activation ──────────────────────────────────────────────────────────────
  const [editDocNo, setEditDocNo] = useState(null);
  const [editCreatedAt, setEditCreatedAt] = useState(null);
  const { docNo, createdAt, isActive, activate, reset: resetActivation } = useInvoiceActivation(
    "sales_return",
    isEditMode && editDocNo ? { docNo: editDocNo, createdAt: editCreatedAt } : null
  );

  // ── Data ────────────────────────────────────────────────────────────────────
  const [lines, setLines] = useState([]);         // return lines being built
  const [customer, setCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState("");
  const [employees, setEmployees] = useState([]);
  const [sellerId, setSellerId] = useState("");
  const [items, setItems] = useState([]);
  const [stockLevels, setStockLevels] = useState({});
  const [loadedInvoice, setLoadedInvoice] = useState(null); // invoice loaded for invoice-based return
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // ── Staging area (item picker before adding to lines) ───────────────────────
  const [selectedItem, setSelectedItem] = useState(null);
  const [stagingQty, setStagingQty] = useState("1");
  const [stagingPrice, setStagingPrice] = useState("");
  const [stagingWarehouse, setStagingWarehouse] = useState("");

  // ── Search ──────────────────────────────────────────────────────────────────
  const [itemNameQuery, setItemNameQuery] = useState("");
  const [itemLookupOpen, setItemLookupOpen] = useState(false);
  const [detailedSearchOpen, setDetailedSearchOpen] = useState(false);
  const [detailedQuery, setDetailedQuery] = useState("");
  const [detailedCategory, setDetailedCategory] = useState("all");
  const [categories, setCategories] = useState([]);

  // ── Right panel ─────────────────────────────────────────────────────────────
  const [rightPanel, setRightPanel] = useState("info"); // "info" | "search"

  // ── Invoice search (right panel search mode) ─────────────────────────────
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false);
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);
  const [activeInvoiceDetail, setActiveInvoiceDetail] = useState(null);
  const [invoiceDetailLines, setInvoiceDetailLines] = useState([]); // with checkbox state
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");

  // ── Column resize ────────────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState({ index: 36, item: 200, origQty: 80, prevRet: 80, retQty: 90, afterRet: 90, price: 90, total: 100, actions: 44 });
  const resizingCol = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  // ── Sort ────────────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });

  // ── Save ────────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // ── Nav guard ────────────────────────────────────────────────────────────
  const { showModal: navLockVisible, proceed: navProceed, cancel: navCancel } = useNavGuard(lines.length > 0);

  // ── Customer balance (live) ──────────────────────────────────────────────
  const [customerBalance, setCustomerBalance] = useState(null); // { current, ajal_total }

  // ── Refs ─────────────────────────────────────────────────────────────────
  const itemInputRef = useRef(null);
  const invoiceSearchRef = useRef(null);

  // ────────────────────────────────────────────────────────────────────────────
  // Effects
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    api.get("/api/warehouses").then(r => { const w = r.data.data || []; setWarehouses(w); if (w.length) { setSelectedWarehouse(String(w[0].id)); setStagingWarehouse(String(w[0].id)); } }).catch(() => {});
    api.get("/api/treasuries").then(r => { const t = r.data.data || []; setTreasuries(t); if (t.length) setSelectedTreasury(String(t[0].id)); }).catch(() => {});
    api.get("/api/customers?limit=500").then(r => setCustomers(r.data.data || [])).catch(() => {});
    api.get("/api/employees").then(r => setEmployees(r.data.data || [])).catch(() => {});
    api.get("/api/items").then(r => setItems(r.data.data || [])).catch(() => {});
    api.get("/api/definitions/categories").then(r => setCategories(r.data.data || [])).catch(() => {});
    api.get("/api/stock/levels").then(r => {
      const g = {};
      (r.data.data || []).forEach(row => { if (!g[row.item_id]) g[row.item_id] = {}; g[row.item_id][row.warehouse_id] = row.quantity; });
      setStockLevels(g);
    }).catch(() => {});
  }, []);

  // Load existing return in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/api/invoices/returns/${editReturnId}`).then(r => {
      const sr = r.data.data;
      setEditDocNo(sr.doc_no);
      setEditCreatedAt(sr.created_at);
      setRefundMethod(sr.refund_method || "cash_back");
      setReason(sr.reason || "");
      setNotes(sr.notes || "");
      if (sr.warehouse_id) setSelectedWarehouse(String(sr.warehouse_id));
      if (sr.treasury_id) setSelectedTreasury(String(sr.treasury_id));
      if (sr.customer_id) {
        const c = { id: sr.customer_id, name: sr.customer_name || String(sr.customer_id) };
        setCustomer(c);
        fetchCustomerBalance(c);
      }
      setLines((sr.lines || []).map((l, i) => ({
        key: `edit-${l.id || i}`,
        invoice_line_id: l.invoice_line_id || null,
        item_id: l.item_id,
        item_name: l.item_name_ar || l.item_name || l.name,
        unit_price: Number(l.unit_price || 0),
        retQty: Number(l.quantity),
        maxQty: Number(l.quantity),
        origQty: Number(l.orig_qty || l.quantity),
        prevRet: 0,
        warehouse_id: sr.warehouse_id || (warehouses[0]?.id),
      })));
      if (sr.invoice_id) {
        api.get(`/api/invoices/${sr.invoice_id}`).then(inv => setLoadedInvoice(inv.data.data)).catch(() => {});
      }
    }).catch(() => toast.error("Failed to load return"));
  }, [isEditMode, editReturnId]);

  // Item name lookup (debounced)
  useEffect(() => {
    if (!itemNameQuery.trim()) { setItemLookupOpen(false); return; }
    const t = setTimeout(() => setItemLookupOpen(true), 200);
    return () => clearTimeout(t);
  }, [itemNameQuery]);

  // Invoice search (debounced, right panel)
  useEffect(() => {
    if (!invoiceQuery.trim() || invoiceQuery.length < 2) { setInvoiceResults([]); return; }
    setInvoiceSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/api/invoices?search=${encodeURIComponent(invoiceQuery)}&limit=30`);
        setInvoiceResults(r.data.data || []);
      } catch { setInvoiceResults([]); }
      setInvoiceSearchLoading(false);
    }, 300);
    return () => { clearTimeout(t); setInvoiceSearchLoading(false); };
  }, [invoiceQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.key === "F2") { e.preventDefault(); itemInputRef.current?.focus(); itemInputRef.current?.select(); }
      if (e.key === "F9") { e.preventDefault(); handleSave(false); }
      if (e.key === "F12") { e.preventDefault(); handleSave(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────

  async function fetchCustomerBalance(c) {
    if (!c?.id) { setCustomerBalance(null); return; }
    try {
      const [custR, ajalR] = await Promise.all([
        api.get(`/api/customers/${c.id}`),
        api.get(`/api/ajal-debts?party_type=customer&party_id=${c.id}&status=open`),
      ]);
      const bal = Number(custR.data.data?.opening_balance || 0);
      const ajal = (ajalR.data.data || []).reduce((s, d) => s + Number(d.original_amount) - Number(d.paid_amount), 0);
      setCustomerBalance({ current: bal, ajal_total: ajal });
    } catch { setCustomerBalance(null); }
  }

  function handleSelectCustomer(c) {
    activate();
    setCustomer(c);
    fetchCustomerBalance(c);
  }

  const filteredItems = useMemo(() => {
    if (!itemNameQuery.trim()) return [];
    return fuzzyFilterRows(items, itemNameQuery, ["name", "item_code", "barcode"]).slice(0, 20);
  }, [items, itemNameQuery]);

  const detailedItems = useMemo(() => {
    let rows = detailedCategory === "all" ? items : items.filter(i => String(i.category_id) === detailedCategory);
    if (detailedQuery.trim()) rows = fuzzyFilterRows(rows, detailedQuery, ["name", "item_code", "barcode"]);
    return rows;
  }, [items, detailedQuery, detailedCategory]);

  const total = useMemo(() => lines.reduce((s, l) => s + l.unit_price * l.retQty, 0), [lines]);

  function handleAddItemToStaging(item) {
    activate();
    setSelectedItem(item);
    setStagingQty("1");
    setStagingPrice(String(item.sale_price || item.price || 0));
    setStagingWarehouse(String(warehouses[0]?.id || ""));
    setItemNameQuery("");
    setItemLookupOpen(false);
    setDetailedSearchOpen(false);
  }

  function handleCommitStaging() {
    if (!selectedItem) return;
    const qty = Number(stagingQty) || 1;
    const price = Number(stagingPrice) || 0;
    setLines(prev => {
      const existing = prev.findIndex(l => l.item_id === selectedItem.id && !l.invoice_line_id);
      if (existing >= 0) {
        return prev.map((l, i) => i === existing ? { ...l, retQty: l.retQty + qty } : l);
      }
      return [...prev, {
        key: `new-${selectedItem.id}-${Date.now()}`,
        invoice_line_id: null,
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        unit_price: price,
        retQty: qty,
        maxQty: null,
        origQty: null,
        prevRet: 0,
        warehouse_id: stagingWarehouse || String(warehouses[0]?.id || ""),
      }];
    });
    setSelectedItem(null);
  }

  function updateLineQty(key, delta) {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const next = Math.max(0, l.retQty + delta);
      const capped = l.maxQty !== null ? Math.min(next, l.maxQty - l.prevRet) : next;
      return { ...l, retQty: capped };
    }));
  }

  function removeLine(key) {
    setLines(prev => prev.filter(l => l.key !== key));
  }

  // Column resize
  const onResizeStart = (e, col) => {
    e.preventDefault(); e.stopPropagation();
    resizingCol.current = col;
    resizeStartX.current = e.clientX;
    resizeStartW.current = colWidths[col] || 80;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMove = mv => { if (!resizingCol.current) return; const w = Math.max(resizeStartW.current + resizeStartX.current - mv.clientX, 40); setColWidths(p => ({ ...p, [resizingCol.current]: w })); };
    const onUp = () => { resizingCol.current = null; document.body.classList.remove("cursor-col-resize", "select-none"); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  function toggleSort(key) {
    setSortConfig(p => p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const sortedLines = useMemo(() => {
    if (!sortConfig.key) return lines;
    return [...lines].sort((a, b) => {
      const va = a[sortConfig.key] ?? 0;
      const vb = b[sortConfig.key] ?? 0;
      return sortConfig.dir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [lines, sortConfig]);

  // Load invoice detail for modal
  async function handleOpenInvoiceDetail(inv) {
    try {
      const [invR, retR] = await Promise.all([
        api.get(`/api/invoices/${inv.id}`),
        api.get(`/api/invoices/returns?invoice_id=${inv.id}`).catch(() => ({ data: { data: [] } })),
      ]);
      const detail = invR.data.data;
      const prevReturns = retR.data.data || [];
      // Build per-line prev returned quantities
      const prevMap = {};
      prevReturns.forEach(ret => {
        (ret.lines || []).forEach(rl => {
          prevMap[rl.invoice_line_id] = (prevMap[rl.invoice_line_id] || 0) + Number(rl.quantity);
        });
      });
      const detailLines = (detail.lines || []).map(l => ({
        ...l,
        origQty: Number(l.quantity),
        prevRet: prevMap[l.id] || 0,
        retQty: 0,
        checked: false,
      }));
      setActiveInvoiceDetail(detail);
      setInvoiceDetailLines(detailLines);
      setInvoiceDetailOpen(true);
    } catch { toast.error("Failed to load invoice details"); }
  }

  function toggleInvoiceLineCheck(idx) {
    setInvoiceDetailLines(prev => prev.map((l, i) => i === idx ? { ...l, checked: !l.checked, retQty: !l.checked ? Math.max(0, l.origQty - l.prevRet) : 0 } : l));
  }

  function updateInvoiceLineRetQty(idx, val) {
    setInvoiceDetailLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const capped = Math.min(Math.max(0, Number(val)), Math.max(0, l.origQty - l.prevRet));
      return { ...l, retQty: capped };
    }));
  }

  function handleConfirmInvoiceSelection() {
    const checked = invoiceDetailLines.filter(l => l.checked && l.retQty > 0);
    if (!checked.length) { toast.error("Select at least one item with qty > 0"); return; }
    activate();
    if (activeInvoiceDetail?.customer_id) {
      const c = customers.find(c => c.id === activeInvoiceDetail.customer_id) || { id: activeInvoiceDetail.customer_id, name: activeInvoiceDetail.customer_name };
      handleSelectCustomer(c);
    }
    setLoadedInvoice(activeInvoiceDetail);
    setLines(checked.map(l => ({
      key: `inv-${l.id}-${Date.now()}`,
      invoice_line_id: l.id,
      item_id: l.item_id,
      item_name: l.item_name_ar || l.item_name || l.name,
      unit_price: Number(l.unit_price || l.price || 0),
      retQty: l.retQty,
      maxQty: l.origQty,
      origQty: l.origQty,
      prevRet: l.prevRet,
      warehouse_id: selectedWarehouse,
    })));
    setInvoiceDetailOpen(false);
    setRightPanel("info");
  }

  // Barcode scan handler
  function handleBarcodeScan(item) {
    handleAddItemToStaging(item);
  }

  async function handleSave(withPrint = false) {
    if (!lines.length) { toast.error("Add at least one item"); return; }
    const activeLines = lines.filter(l => l.retQty > 0);
    if (!activeLines.length) { toast.error("At least one item must have qty > 0"); return; }
    setIsSaving(true);
    try {
      const payload = {
        doc_no: docNo,
        created_at: createdAt,
        invoice_id: loadedInvoice?.id || null,
        customer_id: customer?.id || null,
        refund_method: refundMethod,
        reason,
        notes,
        warehouse_id: selectedWarehouse,
        treasury_id: selectedTreasury,
        seller_id: sellerId || null,
        lines: activeLines.map(l => ({
          invoice_line_id: l.invoice_line_id,
          item_id: l.item_id,
          quantity: l.retQty,
          unit_price: l.unit_price,
        })),
      };
      let result;
      if (isEditMode) {
        result = await api.put(`/api/invoices/returns/${editReturnId}/amend`, payload);
      } else {
        result = await api.post("/api/invoices/returns", payload);
      }
      const saved = result.data.data;
      setLastSaved(saved);
      toast.success(`Return ${saved.doc_no || ""} saved`);
      if (withPrint) setPrintPreviewOpen(true);
      // Reset to idle
      setLines([]);
      setCustomer(null);
      setCustomerBalance(null);
      setLoadedInvoice(null);
      setNotes("");
      setReason("");
      resetActivation();
    } catch (e) {
      toast.error(e.response?.data?.message || "Save failed");
    }
    setIsSaving(false);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  const treasury = treasuries.find(t => String(t.id) === selectedTreasury);
  const projectedTreasury = refundMethod === "cash_back" ? (Number(treasury?.balance || 0) - total) : null;
  const projectedCustomerBalance = customerBalance !== null ? (Number(customerBalance.current) + (refundMethod === "credit_note" ? total : 0)) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 font-sans" dir="rtl">
      <BarcodeListener onScan={handleBarcodeScan} items={items} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2">
        <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-[14px] font-black text-white leading-none">Sales Return</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">مرتجعات المبيعات</p>
        </div>
        <div className="flex items-center gap-2 mr-4">
          <input readOnly disabled value={isActive ? (docNo || "—") : "—"}
            className="w-[160px] rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-mono font-black text-emerald-400 outline-none disabled:cursor-default" />
          <input readOnly disabled value={isActive && createdAt ? fmtDT(createdAt) : "—"}
            className="w-[160px] rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-mono font-black text-slate-300 outline-none disabled:cursor-default" />
        </div>
        {isOffline && (
          <div className="flex items-center gap-1 rounded-md bg-rose-900/50 border border-rose-700 px-2 py-1">
            <WifiOff className="h-3 w-3 text-rose-400" />
            <span className="text-[10px] font-black text-rose-400">Offline</span>
          </div>
        )}
        <div className="mr-auto flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500">F9 Save · F12 Print · F2 Item</span>
          <button onClick={() => handleSave(false)} disabled={isSaving || !lines.length}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 text-[12px] font-black text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors active:scale-95">
            <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving..." : "Save (F9)"}
          </button>
          <button onClick={() => handleSave(true)} disabled={isSaving || !lines.length}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-[12px] font-black text-white hover:bg-slate-600 disabled:opacity-40 transition-colors active:scale-95">
            <Printer className="h-3.5 w-3.5" /> Save + Print (F12)
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Items / Return Lines ──────────────────────────────────── */}
        <div className="flex flex-1 min-w-0 flex-col border-l border-slate-800">

          {/* Staging area */}
          <div className="shrink-0 border-b border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center gap-2">
              {/* Item name search */}
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={itemInputRef}
                  value={itemNameQuery}
                  onChange={e => setItemNameQuery(e.target.value)}
                  onFocus={() => itemNameQuery && setItemLookupOpen(true)}
                  onBlur={() => setTimeout(() => setItemLookupOpen(false), 150)}
                  placeholder="Search item name or SKU... (F2)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 pr-9 pl-3 py-2 text-[12px] font-bold text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
                />
                {itemLookupOpen && filteredItems.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
                    <div className="max-h-[220px] overflow-y-auto p-1">
                      {filteredItems.map(item => (
                        <button key={item.id} type="button" onMouseDown={e => e.preventDefault()}
                          onClick={() => handleAddItemToStaging(item)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start hover:bg-slate-700 transition-colors">
                          <div className="flex-1">
                            <div className="text-[12px] font-black text-white"><Highlight text={item.name} query={itemNameQuery} /></div>
                            <div className="text-[10px] font-mono text-slate-400"><Highlight text={item.item_code || item.barcode || `#${item.id}`} query={itemNameQuery} /></div>
                          </div>
                          <span className="font-mono text-[12px] font-black text-emerald-400">{fmt(item.sale_price || item.price)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setDetailedSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-emerald-500 transition-colors"
                title="Advanced item search">
                <Filter className="h-4 w-4" />
              </button>
            </div>

            {/* Staging controls (visible when item selected) */}
            {selectedItem && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-2">
                <span className="flex-1 text-[12px] font-black text-emerald-300 truncate">{selectedItem.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setStagingQty(q => String(Math.max(1, Number(q) - 1)))} className="h-7 w-7 flex items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-600"><Minus className="h-3 w-3" /></button>
                  <input type="number" value={stagingQty} min="0.001" step="any" onChange={e => setStagingQty(e.target.value)}
                    className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-center text-[12px] font-mono font-black text-white outline-none focus:border-emerald-500" />
                  <button onClick={() => setStagingQty(q => String(Number(q) + 1))} className="h-7 w-7 flex items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-600"><Plus className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400">Price</span>
                  <input type="number" value={stagingPrice} step="any" onChange={e => setStagingPrice(e.target.value)}
                    className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-center text-[12px] font-mono font-black text-white outline-none focus:border-emerald-500" />
                </div>
                <select value={stagingWarehouse} onChange={e => setStagingWarehouse(e.target.value)}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-white outline-none focus:border-emerald-500">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button onClick={handleCommitStaging}
                  className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-600 transition-colors active:scale-95">
                  <Plus className="h-3 w-3" /> Add
                </button>
                <button onClick={() => setSelectedItem(null)} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>

          {/* Lines table */}
          <div className="flex-1 overflow-auto bg-slate-950">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-600">
                <RotateCcw className="h-12 w-12 opacity-20" />
                <p className="text-[13px] font-black">No return items yet</p>
                <p className="text-[11px] font-bold opacity-60">Add items above or search for an invoice →</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-[12px]">
                <thead className="sticky top-0 z-10 bg-slate-900">
                  <tr>
                    {[
                      { key: "index", label: "#", w: colWidths.index },
                      { key: "item_name", label: "Item", w: colWidths.item },
                      { key: "origQty", label: "Orig Qty", w: colWidths.origQty },
                      { key: "prevRet", label: "Prev Ret", w: colWidths.prevRet },
                      { key: "retQty", label: "Return Qty", w: colWidths.retQty },
                      { key: "afterRet", label: "After Return", w: colWidths.afterRet },
                      { key: "unit_price", label: "Price", w: colWidths.price },
                      { key: "total", label: "Total", w: colWidths.total },
                      { key: "actions", label: "", w: colWidths.actions },
                    ].map(col => (
                      <th key={col.key} style={{ width: col.w, minWidth: col.w }}
                        className="relative border-b border-slate-800 px-2 py-2 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 select-none"
                        onClick={() => col.key !== "actions" && col.key !== "index" && toggleSort(col.key)}>
                        {col.label}
                        {sortConfig.key === col.key && <span className="ml-1 text-emerald-400">{sortConfig.dir === "asc" ? "↑" : "↓"}</span>}
                        {col.key !== "actions" && (
                          <div onMouseDown={e => onResizeStart(e, col.key)}
                            className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-emerald-500/40" />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedLines.map((l, i) => {
                    const after = l.origQty !== null ? l.origQty - l.prevRet - l.retQty : null;
                    const lineTotal = l.unit_price * l.retQty;
                    return (
                      <tr key={l.key} className="border-b border-slate-800/60 hover:bg-slate-900/50 transition-colors">
                        <td className="px-2 py-1.5 text-center text-slate-600 font-mono">{i + 1}</td>
                        <td className="px-2 py-1.5 font-bold text-white truncate max-w-0" style={{ width: colWidths.item }}>
                          <span className="block truncate">{l.item_name}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-slate-400">{l.origQty ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center font-mono text-amber-500">{l.prevRet > 0 ? l.prevRet : "—"}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateLineQty(l.key, -1)} className="h-5 w-5 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:bg-emerald-800 hover:text-white transition-colors"><Minus className="h-2.5 w-2.5" /></button>
                            <input type="number" value={l.retQty} min="0" step="any"
                              onChange={e => setLines(prev => prev.map(x => x.key === l.key ? { ...x, retQty: Math.min(Number(e.target.value) || 0, x.maxQty !== null ? x.maxQty - x.prevRet : Infinity) } : x))}
                              className="w-12 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-center text-[12px] font-mono font-black text-white outline-none focus:border-emerald-500" />
                            <button onClick={() => updateLineQty(l.key, 1)} className="h-5 w-5 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:bg-emerald-800 hover:text-white transition-colors"><Plus className="h-2.5 w-2.5" /></button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono">
                          {after !== null ? (
                            <span className={after < 0 ? "text-rose-400 font-black" : "text-slate-400"}>{after}</span>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-slate-300">{fmt(l.unit_price)}</td>
                        <td className="px-2 py-1.5 text-left font-mono font-black text-emerald-400">{fmt(lineTotal)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => removeLine(l.key)} className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:bg-rose-900/50 hover:text-rose-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom total bar */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Lines</span>
              <span className="text-[14px] font-black text-white">{lines.length}</span>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Units</span>
              <span className="text-[14px] font-black text-white">{lines.reduce((s, l) => s + l.retQty, 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Total Return</span>
              <span className="text-[24px] font-black font-mono text-emerald-400">{fmt(total)}</span>
              <span className="text-[11px] text-slate-500">EGP</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Info panel OR Invoice search ─────────────────────────── */}
        <div className="w-[300px] shrink-0 flex flex-col border-l border-slate-800 bg-slate-900 overflow-y-auto">

          {/* Panel toggle */}
          <div className="shrink-0 flex border-b border-slate-800">
            <button onClick={() => setRightPanel("info")}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${rightPanel === "info" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"}`}>
              <List className="h-3 w-3 inline mr-1" /> Info
            </button>
            <button onClick={() => { setRightPanel("search"); activate(); setTimeout(() => invoiceSearchRef.current?.focus(), 50); }}
              className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${rightPanel === "search" ? "bg-emerald-900/50 text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}>
              <Search className="h-3 w-3 inline mr-1" /> Invoice Search
            </button>
          </div>

          {rightPanel === "info" ? (
            <div className="flex flex-col gap-3 p-3">

              {/* Customer selector */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Customer</label>
                <select value={customer?.id || ""} onChange={e => { const c = customers.find(x => String(x.id) === e.target.value); if (c) handleSelectCustomer(c); else { setCustomer(null); setCustomerBalance(null); } }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                  <option value="">Cash customer (no record)</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Customer balance panel */}
              {customerBalance !== null && (
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Customer Balance</span>
                  <div className="flex justify-between">
                    <span className="text-[11px] font-bold text-slate-400">Current</span>
                    <span className={`text-[12px] font-black font-mono ${customerBalance.current < 0 ? "text-rose-400" : "text-slate-200"}`}>{fmt(customerBalance.current)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] font-bold text-emerald-400">Return amount</span>
                    <span className="text-[12px] font-black font-mono text-emerald-400">+ {fmt(total)}</span>
                  </div>
                  <div className="h-px bg-slate-700" />
                  <div className="flex justify-between">
                    <span className="text-[11px] font-black text-slate-300">After Return</span>
                    <span className={`text-[13px] font-black font-mono ${projectedCustomerBalance < 0 ? "text-rose-400" : "text-emerald-400"}`}>{fmt(projectedCustomerBalance)}</span>
                  </div>
                  {customerBalance.ajal_total > 0 && (
                    <div className="flex justify-between border-t border-slate-700 pt-2">
                      <span className="text-[10px] font-bold text-amber-400">Outstanding Ajal</span>
                      <span className="text-[11px] font-black font-mono text-amber-400">{fmt(customerBalance.ajal_total)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Refund method */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Refund Method</label>
                {REFUND_METHODS.map(m => (
                  <button key={m.id} onClick={() => setRefundMethod(m.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border p-2.5 mb-1.5 text-right transition-all ${refundMethod === m.id ? "border-emerald-600 bg-emerald-950/50" : "border-slate-700 hover:border-slate-600"}`}>
                    <div className="flex-1">
                      <div className={`text-[12px] font-black ${refundMethod === m.id ? "text-emerald-300" : "text-slate-300"}`}>{m.label}</div>
                      <div className="text-[10px] text-slate-500">{m.sub}</div>
                    </div>
                    {refundMethod === m.id && <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Treasury selector (shown for cash_back) */}
              {refundMethod === "cash_back" && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Treasury</label>
                  <select value={selectedTreasury} onChange={e => setSelectedTreasury(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                    {treasuries.map(t => <option key={t.id} value={t.id}>{t.name} — {fmt(t.balance)}</option>)}
                  </select>
                  {treasury && (
                    <div className="mt-1.5 rounded-lg border border-slate-700 bg-slate-800 p-2.5 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-slate-400">Current Balance</span>
                        <span className="text-[11px] font-mono font-black text-slate-200">{fmt(treasury.balance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-rose-400">Refund Out</span>
                        <span className="text-[11px] font-mono font-black text-rose-400">- {fmt(total)}</span>
                      </div>
                      <div className="h-px bg-slate-700" />
                      <div className="flex justify-between">
                        <span className="text-[10px] font-black text-slate-300">After Refund</span>
                        <span className={`text-[12px] font-mono font-black ${projectedTreasury < 0 ? "text-rose-400" : "text-emerald-400"}`}>{fmt(projectedTreasury)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                  <option value="">— Select reason —</option>
                  {RETURN_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>

              {/* Seller */}
              {employees.length > 0 && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Seller / Employee</label>
                  <select value={sellerId} onChange={e => setSellerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                    <option value="">— None —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}

              {/* Warehouse */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Return to Warehouse</label>
                <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional notes..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] font-bold text-white placeholder:text-slate-600 outline-none focus:border-emerald-500 resize-none" />
              </div>
            </div>

          ) : (
            /* ── Invoice Search Panel ─────────────────────────────────────── */
            <div className="flex flex-col gap-3 p-3 flex-1">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Search Invoices</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input ref={invoiceSearchRef} value={invoiceQuery} onChange={e => setInvoiceQuery(e.target.value)}
                    placeholder="Invoice no, product name, SKU, customer..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 pr-9 pl-3 py-2 text-[12px] font-bold text-white placeholder:text-slate-500 outline-none focus:border-emerald-500" />
                </div>
                {invoiceSearchLoading && <p className="text-[10px] text-slate-500 mt-1">Searching...</p>}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {invoiceResults.map(inv => (
                  <div key={inv.id} className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-black text-white">{inv.invoice_no || inv.doc_no || `#${inv.id}`}</span>
                      <span className="font-mono text-[12px] font-black text-emerald-400">{fmt(inv.total)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-bold">{inv.customer_name || "Cash customer"}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{inv.created_at ? fmtDT(inv.created_at) : ""}</div>
                    <button onClick={() => handleOpenInvoiceDetail(inv)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-700 py-1.5 text-[11px] font-black text-emerald-400 hover:bg-emerald-900/30 transition-colors">
                      <Eye className="h-3 w-3" /> View Details
                    </button>
                  </div>
                ))}
                {invoiceQuery.length >= 2 && !invoiceSearchLoading && invoiceResults.length === 0 && (
                  <p className="text-center text-[11px] text-slate-500 font-bold py-4">No invoices found</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Invoice Detail Modal ─────────────────────────────────────────────── */}
      <Modal open={invoiceDetailOpen} onClose={() => setInvoiceDetailOpen(false)}
        title={`Invoice Detail — ${activeInvoiceDetail?.invoice_no || activeInvoiceDetail?.doc_no || ""}`}
        maxWidth="max-w-3xl">
        {activeInvoiceDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-[12px] font-bold text-slate-700">
              <span>{activeInvoiceDetail.customer_name || "Cash customer"}</span>
              <span className="font-mono text-emerald-700">{fmt(activeInvoiceDetail.total)} EGP</span>
              <span className="text-slate-400">{activeInvoiceDetail.created_at ? fmtDT(activeInvoiceDetail.created_at) : ""}</span>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-[12px] border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right font-black text-slate-500 text-[10px] uppercase w-8">✓</th>
                    <th className="px-3 py-2 text-right font-black text-slate-500 text-[10px] uppercase">Item</th>
                    <th className="px-3 py-2 text-center font-black text-slate-500 text-[10px] uppercase w-20">Orig Qty</th>
                    <th className="px-3 py-2 text-center font-black text-slate-500 text-[10px] uppercase w-20">Prev Ret</th>
                    <th className="px-3 py-2 text-center font-black text-slate-500 text-[10px] uppercase w-24">Return Qty</th>
                    <th className="px-3 py-2 text-center font-black text-slate-500 text-[10px] uppercase w-20">After</th>
                    <th className="px-3 py-2 text-left font-black text-slate-500 text-[10px] uppercase w-24">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceDetailLines.map((l, i) => {
                    const maxRet = l.origQty - l.prevRet;
                    const after = maxRet - l.retQty;
                    return (
                      <tr key={l.id || i} className={`border-t border-slate-100 transition-colors ${l.checked ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={l.checked} onChange={() => toggleInvoiceLineCheck(i)}
                            disabled={maxRet <= 0}
                            className="h-4 w-4 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" />
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-800 truncate max-w-[180px]">
                          <div className="truncate">{l.item_name_ar || l.item_name || l.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{l.barcode || l.item_code || ""}</div>
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-600">{l.origQty}</td>
                        <td className="px-3 py-2 text-center font-mono text-amber-600">{l.prevRet > 0 ? l.prevRet : "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {l.checked ? (
                            <input type="number" value={l.retQty} min="0" max={maxRet} step="any"
                              onChange={e => updateInvoiceLineRetQty(i, e.target.value)}
                              className="w-16 rounded border border-emerald-300 bg-white px-1.5 py-0.5 text-center text-[12px] font-mono font-black text-emerald-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300" />
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {l.checked ? (
                            <span className={after < 0 ? "text-rose-600 font-black" : "text-slate-500"}>{after}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-left font-mono font-black text-slate-700">{fmt(l.unit_price || l.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold text-slate-500">
                {invoiceDetailLines.filter(l => l.checked).length} items selected ·{" "}
                <span className="font-black text-emerald-600">
                  {fmt(invoiceDetailLines.filter(l => l.checked).reduce((s, l) => s + (l.unit_price || l.price || 0) * l.retQty, 0))} EGP
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setInvoiceDetailOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-[12px] font-black text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirmInvoiceSelection}
                  disabled={!invoiceDetailLines.some(l => l.checked && l.retQty > 0)}
                  className="rounded-lg bg-emerald-600 px-6 py-2 text-[12px] font-black text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors active:scale-95">
                  Use This Invoice →
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Detailed Item Search Modal ────────────────────────────────────────── */}
      <Modal open={detailedSearchOpen} onClose={() => setDetailedSearchOpen(false)} title="Advanced Item Search" maxWidth="max-w-3xl">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={detailedQuery} onChange={e => setDetailedQuery(e.target.value)} autoFocus
                placeholder="Search by name, SKU, barcode..."
                className="w-full rounded-lg border border-slate-200 pr-9 pl-3 py-2 text-[12px] font-bold outline-none focus:border-emerald-500" />
            </div>
            <select value={detailedCategory} onChange={e => setDetailedCategory(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-emerald-500">
              <option value="all">All categories</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
          <div className="max-h-[400px] overflow-auto rounded-lg border border-slate-200">
            <DataGrid data={detailedItems.slice(0, 100)} rowKey="id" emptyMessage="No items found"
              className="border-0"
              columns={[
                { id: "code", header: "SKU", width: 100, cellClass: "px-3 font-mono text-[11px] font-black text-slate-500", render: r => r.item_code || r.barcode || `#${r.id}` },
                { id: "name", header: "Name", width: 220, cellClass: "px-3 font-bold text-slate-800", render: r => <Highlight text={r.name} query={detailedQuery} /> },
                { id: "category", header: "Category", width: 120, cellClass: "px-3 text-[11px] text-slate-500", render: r => r.category_name || "—" },
                { id: "stock", header: "Stock", width: 80, cellClass: "px-3 text-center font-mono font-black text-slate-700", render: r => { const s = stockLevels[r.id]; return s ? Object.values(s).reduce((a, b) => a + b, 0) : 0; } },
                { id: "price", header: "Price", width: 90, cellClass: "px-3 text-left font-mono font-black text-emerald-700", render: r => fmt(r.sale_price || r.price) },
                { id: "actions", header: "", width: 60, cellClass: "px-3", render: r => (
                  <button onClick={() => { handleAddItemToStaging(r); setDetailedSearchOpen(false); }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors active:scale-95">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )},
              ]} />
          </div>
        </div>
      </Modal>

      {/* ── Nav guard modal ───────────────────────────────────────────────────── */}
      {navLockVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-[16px] font-black text-slate-800 mb-2">Leave page?</h3>
            <p className="text-[13px] text-slate-500 mb-5">You have unsaved return items. Leave anyway?</p>
            <div className="flex gap-3">
              <button onClick={navCancel} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[13px] font-black text-slate-700 hover:bg-slate-50">Stay</button>
              <button onClick={navProceed} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-[13px] font-black text-white hover:bg-rose-500">Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Preview ─────────────────────────────────────────────────────── */}
      {printPreviewOpen && lastSaved && (
        <PrintPreviewModal
          open={printPreviewOpen}
          onClose={() => setPrintPreviewOpen(false)}
          docType="sales_return"
          docId={lastSaved.id}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/sales/SalesReturnFormPage.jsx
git commit -m "feat: rebuild SalesReturnFormPage — full POS-style split layout, advanced invoice search modal, customer balance panel, idle/active state"
```

---

## Task 8: Purchase Return Form Page — Full Rebuild

**Files:**
- Rewrite: `client/src/pages/purchases/PurchaseReturnFormPage.jsx`

This mirrors Task 7 exactly but adapted for purchase returns:
- "Customer" → "Supplier"
- `refund_method` → `settlement_type` (options: `account` = supplier credit, `cash` = cash payment out)
- Color theme: **amber** instead of emerald (matches existing PurchaseFormPage branding)
- API calls: `/api/purchases` instead of `/api/invoices`, `/api/suppliers` instead of `/api/customers`
- Doc type: `purchase_return`
- Balance label: "Supplier Balance" (positive = supplier owes you, negative = you owe supplier)
- Invoice search searches purchases: `GET /api/purchases?search=...`

- [ ] **Step 1: Write the full `PurchaseReturnFormPage.jsx`**

Copy the SalesReturnFormPage code from Task 7 and apply these substitutions:

| Sales Return | Purchase Return |
|-------------|-----------------|
| `"sales_return"` (doc type) | `"purchase_return"` |
| `customers`, `customer`, `setCustomer` | `suppliers`, `supplier`, `setSupplier` |
| `customer_id` | `supplier_id` |
| `customer_name` | `supplier_name` |
| `/api/customers` | `/api/suppliers` |
| `/api/invoices/returns` | `/api/purchases/returns` |
| `/api/invoices?search=` | `/api/purchases?search=` |
| `GET /api/invoices/${id}` | `GET /api/purchases/${id}` |
| `refundMethod`, `setRefundMethod` | `settlementType`, `setSettlementType` |
| `refund_method` (payload key) | `settlement_type` |
| `REFUND_METHODS` array | `SETTLEMENT_TYPES = [{ id: "account", label: "Supplier Account", sub: "Deducted from supplier balance" }, { id: "cash", label: "Cash Payment", sub: "Cash out of treasury" }]` |
| `RETURN_REASONS` (same, keep as-is) | same |
| `emerald` theme color (buttons, borders, accents) | `amber` theme color |
| `"Sales Return"` heading | `"Purchase Return"` |
| `"مرتجعات المبيعات"` subtitle | `"مرتجعات المشتريات"` |
| `invoice_id` in payload | `purchase_id` in payload |
| `invoice_line_id` | `purchase_line_id` |
| `unit_price` on lines | `unit_cost` on lines |
| `sale_price` on items | `cost_price || last_cost` on items |
| `api.put("/api/invoices/returns/${id}/amend"` | `api.put("/api/purchases/returns/${id}/amend"` |
| `api.post("/api/invoices/returns"` | `api.post("/api/purchases/returns"` |
| `"customer"` in ajal query | `"supplier"` |
| Balance label: "Customer Balance" | "Supplier Balance" |
| Balance arrow: "+ return" (credit) | "− return" (reduces what supplier owes) |
| `invoice_no` field on results | `doc_no` field on results |

The settlement type logic for treasury panel: show treasury panel when `settlementType === "cash"` (cash payment to supplier on return), hide when `settlementType === "account"` (just reduces supplier debt).

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/purchases/PurchaseReturnFormPage.jsx
git commit -m "feat: rebuild PurchaseReturnFormPage — full POS-style split layout, amber theme, purchase search, supplier balance panel"
```

---

## Task 9: Final Integration Check

- [ ] **Step 1: Verify App.jsx has no dangling imports**

```bash
grep -n "SalesReturnPage\|PurchaseReturnPage\|PurchasesListPage" client/src/App.jsx
```
Expected: no output (all 3 removed).

- [ ] **Step 2: Verify migration file is in correct sequence**

```bash
ls electron/migrations/ | sort | tail -5
```
Expected: `057_doc_sequences_daily.js` appears last or near-last.

- [ ] **Step 3: Verify Electron picks up migration**

Check `electron/main.js` or the migration runner to confirm it auto-applies all migrations in `electron/migrations/` on startup. No manual registration should be needed if the existing pattern is glob-based.

```bash
grep -n "migrations" electron/main.js | head -10
```

- [ ] **Step 4: Start dev server and smoke test**

```bash
npm run dev
```

Test checklist:
- [ ] Navigate to `/purchases` → redirects to `/purchases/new`
- [ ] Navigate to `/sales/returns` → redirects to `/sales/returns/new`
- [ ] Navigate to `/purchases/returns` → redirects to `/purchases/returns/new`
- [ ] Open `/purchases/new` → form shows no doc number (idle state)
- [ ] Select a supplier → doc number appears (e.g. `PUR-20260508-001`)
- [ ] Open POS → create invoice → doc number format is `INV-20260508-0001`
- [ ] Open `/sales/returns/new` → idle state, no doc number
- [ ] Toggle "Invoice Search" → right panel switches
- [ ] Search for an invoice → results appear
- [ ] Click "View Details" → modal opens with line checkboxes
- [ ] Check lines + set qty → click "Use This Invoice" → lines populate left panel
- [ ] Save → success toast + form resets to idle
- [ ] Open `/purchases/returns/new` → same flow with amber theme

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: invoice system overhaul — daily doc numbers, idle/active state, return page rebuilds, route cleanup"
```

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Daily doc number format `PREFIX-YYYYMMDD-NNN` | Task 1 |
| New prefixes INV/PUR/SRT/PRT | Task 1 |
| POST /api/documents/reserve endpoint | Task 2 |
| useInvoiceActivation hook | Task 3 |
| Route redirects (3 list pages removed) | Task 4 |
| POS idle/active + docNo display on list & grid | Task 5 |
| POS balance panel — ajal + treasury | Task 5 |
| POS post-save reset to idle | Task 5 |
| PurchaseFormPage idle/active + doc strip | Task 6 |
| PurchaseFormPage balance — ajal + treasury | Task 6 |
| PurchaseFormPage post-save reset | Task 6 |
| SalesReturnFormPage full POS-style rebuild | Task 7 |
| Advanced invoice search (live, by product/SKU) | Task 7 |
| Invoice detail modal with per-line checkboxes | Task 7 |
| Customer balance panel (live) | Task 7 |
| All POS features (barcode, resize, sort, F-keys, nav guard, print, staging, warehouse, seller, offline) | Task 7 |
| PurchaseReturnFormPage same as Task 7 but purchase/supplier/amber | Task 8 |
| فواتير اليوم moved into form pages | POS already has it; return pages have Invoice Search toggle instead |
