# Plan: Add Per-Doc Copies + Global Reprint Stamp Toggle

## Context
The print settings panel (`PrintingSettingsPanel.jsx`) has a per-document settings table with columns: المستند (Doc), الحجم النشط (Active Size), سلوك الطباعة (Print Mode). The user wants two additions:
1. A **copies** column — so each document type can specify how many copies to print during fast/instant print
2. A **global toggle** to disable the "نسخة — إعادة طباعة" (reprint stamp) feature across all documents, without needing to open the Studio for each doc

Currently `print_copies` is consumed in `PrintPreviewModal.jsx:582` but has no UI in the settings table. The `reprint_stamp` setting exists per-doc in the Studio Inspector but has no global on/off in the settings panel.

---

## Changes

### 1. Add "Copies" column to the per-document settings table

**File:** `client/src/pages/settings/PrintingSettingsPanel.jsx`

- Add a 4th column header: "النسخ" (Copies) in the `<thead>` (line ~420)
- In each collapsed row (line ~505), add a number input bound to `doc.print_copies` (default 1, min 1, max 10)
- On change, call `updateDoc(key, { print_copies: Number(value) })`
- Update the category row `colSpan` from 4 to 5
- Update the expanded row `colSpan` from 4 to 5

### 2. Add global reprint stamp toggle

**File:** `client/src/pages/settings/PrintingSettingsPanel.jsx`

- Add state: `const [globalReprintStamp, setGlobalReprintStamp] = useState(true)`
- Load from `_global` scope settings on mount (alongside existing `loadDocSettings`)
- Save via `updateDoc("_global", { reprint_stamp: <value> })` 
- Place the toggle as a small control row **above** the per-document table (in the "إعدادات طباعة المستندات" section, after the instruction box and before the table)
- The toggle reads: `block_print_copy_stamp` — when OFF (default), reprints show "نسخة" stamp; when ON, the stamp is blocked/hidden globally

**File:** `client/src/components/print/PrintPreviewModal.jsx`

- Modify `stampEnabled` logic (line ~563) to also check the global `_global` scope setting:
  - Load `_global` settings and check if `reprint_stamp === false` at global level → if so, disable stamp for all docs
  - Per-doc override: if a specific doc has `reprint_stamp === true`, it can force-enable even if global is off (or vice versa)

**File:** `client/src/hooks/usePrintSettingsForDoc.js`

- Already fetches `_global` settings — verify `reprint_stamp` flows through to `combinedSettings`

---

## Files to modify
1. `client/src/pages/settings/PrintingSettingsPanel.jsx` — table column + global toggle UI
2. `client/src/components/print/PrintPreviewModal.jsx` — stamp logic to respect global toggle

## Verification
1. Run `npm run dev` and navigate to Settings → الطباعة
2. Verify the "النسخ" column appears with number inputs (default 1)
3. Change copies for a doc type → confirm it persists (reload page)
4. Toggle the global reprint stamp off → print an already-printed invoice → verify no "نسخة" stamp appears
5. Toggle it back on → verify stamp reappears
