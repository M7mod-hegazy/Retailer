# Fix: Expenses, Revenues, Withdrawals — Bugs

## Bug 1: Double-submit → Duplicate Records

### Problem
`handleSave`/`handleSubmit` lack an early-return guard. React `setSaving(true)` is async — two rapid clicks bypass `disabled={saving}` before re-render.

### Files & Exact Changes

#### 1. `client/src/pages/expenses/ExpensesListPage.jsx` (line 461)
Before `setSaving(true)`, add:
```js
if (saving) return;
```

#### 2. `client/src/pages/expenses/RevenuesListPage.jsx` (line 462)
Before `setSaving(true)`, add:
```js
if (saving) return;
```

#### 3. `client/src/pages/expenses/WithdrawalsListPage.jsx` (line 450)
Before `setSaving(true)`, add:
```js
if (saving) return;
```

#### 4. `client/src/pages/expenses/ExpenseFormModal.jsx` (line 70)
After `e.preventDefault()`, before validation, add:
```js
if (loading) return;
```

#### 5. `client/src/pages/expenses/RevenueFormModal.jsx` (line 64)
After `e.preventDefault()`, before validation, add:
```js
if (loading) return;
```

---

## Bug 2: Date Picker Only Clickable from Top-Right

### Problem
The CSS `[&::-webkit-calendar-picker-indicator]:inset-0` overlay doesn't reliably catch clicks across the full input in Chromium/Electron RTL mode.

### Files & Exact Changes

#### 1. `client/src/pages/expenses/ExpensesListPage.jsx` — InlineAddForm (lines 212-221)

Replace the date input div block:
```jsx
{/* BEFORE */}
<div className="relative flex items-center">
  <Calendar className="absolute right-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
  <input
    type="date" value={form.created_at} max={today()} onChange={handleDateChange}
    className={`${fieldCls} ${!isToday ? "border-rose-400 text-rose-600" : ""} pr-10 pl-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
  />
  {isToday && (
    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-zinc-805 rounded px-1.5 py-0.5 pointer-events-none leading-tight">اليوم</span>
  )}
</div>
```

```jsx
{/* AFTER — add useRef at top of InlineAddForm: const dateRef = useRef(null); */}
<div className="relative flex items-center cursor-pointer" onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}>
  <Calendar className="absolute right-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
  <input
    ref={dateRef}
    type="date" value={form.created_at} max={today()} onChange={handleDateChange}
    className={`${fieldCls} ${!isToday ? "border-rose-400 text-rose-600" : ""} pr-10 pl-10`}
  />
  {isToday && (
    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-zinc-805 rounded px-1.5 py-0.5 pointer-events-none leading-tight">اليوم</span>
  )}
</div>
```

#### 2. `client/src/pages/expenses/RevenuesListPage.jsx` — InlineAddForm (lines 213-222)

Same pattern — add `const dateRef = useRef(null)`, same `onClick` wrapper, same input ref.

#### 3. `client/src/pages/expenses/WithdrawalsListPage.jsx` — InlineAddForm (lines 213-222)

Same pattern — add `const dateRef = useRef(null)`, same `onClick` wrapper, same input ref.

---

## Bug 3: Input Focus Loss (Fixes Only on App Restart)

### Problem
1. `setTimeout(focus, N)` races with render cycle + synchronous `better-sqlite3` DB calls that block the renderer — queued focus events fire in bulk and fight each other.
2. `openField()` in `useFieldNavigation.js` has no guard against rapid successive calls.
3. Electron BrowserWindow lacks `backgroundThrottling: false`, causing focus desync when window loses/regains focus.

### Files & Exact Changes

#### 1. `electron/main.js` (line ~196, BrowserWindow constructor)

Add `backgroundThrottling: false` to webPreferences:
```js
webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    backgroundThrottling: false,
},
```

#### 2. `client/src/hooks/useFieldNavigation.js` — `openField` function

Add debounce guard using a module-level variable:
```js
let _lastFocusTarget = null;
let _lastFocusTime = 0;

export function openField(el) {
  if (!el) return;
  // Debounce: ignore if same element focused within last 50ms
  const now = Date.now();
  if (el === _lastFocusTarget && now - _lastFocusTime < 50) return;
  _lastFocusTarget = el;
  _lastFocusTime = now;
  el.focus();
  if (el.tagName === "SELECT") {
    el.showPicker?.();
  } else {
    try { el.select(); } catch { /* number inputs don't support .select() in all browsers */ }
  }
}
```

#### 3. `client/src/pages/expenses/ExpensesListPage.jsx` — InlineAddForm (lines 119-123)

Replace `setTimeout` with `requestAnimationFrame`:
```jsx
useEffect(() => {
    const raf = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(raf);
}, []);
```

#### 4. `client/src/pages/expenses/RevenuesListPage.jsx` — InlineAddForm (lines 119-123)

Same replacement:
```jsx
useEffect(() => {
    const raf = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(raf);
}, []);
```

#### 5. `client/src/pages/expenses/WithdrawalsListPage.jsx` — InlineAddForm (lines 119-124)

Same replacement:
```jsx
useEffect(() => {
    const raf = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(raf);
}, []);
```
