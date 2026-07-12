# WhatsApp Invoice Image Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `WhatsAppSendModal` (the "إرسال الإيصال عبر واتساب" modal), let the user choose to send the Sales invoice or Sales Return as an image that faithfully matches the real Print Preview, instead of only a text message.

**Architecture:** A new hook, `usePrintSettingsForDoc(docType)`, replicates the subset of `PrintPreviewModal`'s settings-resolution logic that matters for a screenshot (per-doc settings + `_global` scope inheritance + paper-size resolution), reusing the exact same utility functions `PrintPreviewModal` already imports (`resolveDocPaperSize`, `resolveEffectiveLayout`, `familyOfSize`) so there is no reimplemented merge logic — just the fetch-and-merge wiring, done once, in one small file. `WhatsAppSendModal` gains a text/image toggle (visible only for `kind="receipt"` and `kind="return_receipt"`), renders the real `PrintThermalDoc`/`PrintA4Doc` components off-screen using that hook's output, captures them with `html2canvas` (already a project dependency), and enqueues the result through the existing `POST /api/whatsapp/enqueue` endpoint with `payload: { image, caption }` — the outbox drainer in `electron/whatsapp/engine.js` already branches on `payload.image` vs `payload.text`, so no server changes are needed.

**Tech Stack:** React 18, react-i18next, html2canvas, Vitest + @testing-library/react.

## Global Constraints

- No server or Electron main-process changes — `payload.image` (base64 PNG, no data-URL prefix) is already handled by the existing outbox drainer at `electron/whatsapp/engine.js:674-678`.
- The image/text choice is scoped to `WhatsAppSendModal` only, and only appears for `kind === "receipt"` (Sales) and `kind === "return_receipt"` (Sales Return). Every other use of this modal is unaffected.
- All new user-facing copy goes into both `client/src/locales/ar.json` and `client/src/locales/en.json`.
- Reuse existing print-rendering components (`PrintThermalDoc`, `PrintA4Doc` from `client/src/components/print/PrintDoc.jsx`) and existing settings-resolution utilities — do not reimplement layout merging.
- Theme tokens only for any new styling (`bg-bg-surface`, `border-border-normal`, etc. — matching the rest of this file).

---

### Task 1: `usePrintSettingsForDoc` hook

**Files:**
- Create: `client/src/hooks/usePrintSettingsForDoc.js`
- Test: `client/src/hooks/__tests__/usePrintSettingsForDoc.test.js`

**Interfaces:**
- Produces: `usePrintSettingsForDoc(docType)` → `{ loading, template, settings }`.
  - `template`: resolved paper size string (`"58mm" | "80mm" | "A5" | "A4"`), via `resolveDocPaperSize`.
  - `settings`: merged flat settings object with `settings.layout = { [family]: <resolved family layout> }`, ready to pass straight into `PrintThermalDoc`/`PrintA4Doc`.
  - When `docType` is falsy, `loading` is `false` immediately and no requests are made.

- [ ] **Step 1: Write the failing test**

```js
// client/src/hooks/__tests__/usePrintSettingsForDoc.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePrintSettingsForDoc } from "../usePrintSettingsForDoc";

const mockApiGet = vi.hoisted(() => vi.fn());
vi.mock("../../services/api", () => ({ default: { get: mockApiGet } }));

function mockRoutes(routes) {
  mockApiGet.mockImplementation((url) => {
    for (const [prefix, data] of routes) {
      if (url.startsWith(prefix)) return Promise.resolve({ data: { data } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
}

describe("usePrintSettingsForDoc", () => {
  beforeEach(() => { mockApiGet.mockReset(); });

  it("defaults to the doc type's default paper size when nothing is saved", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", {}],
      ["/api/print-settings-per-doc/_global", {}],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.template).toBe("80mm");
  });

  it("uses the doc's explicit paper_size override", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/sales_return", { paper_size: "A4" }],
      ["/api/print-settings-per-doc/_global", {}],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("sales_return"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.template).toBe("A4");
  });

  it("inherits the _global scope's roll layout by default", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", {}],
      ["/api/print-settings-per-doc/_global", { layout: { roll: { headerStyle: "logo-center" } } }],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.layout.roll.headerStyle).toBe("logo-center");
  });

  it("uses the doc's own layout when it opts out of global inheritance", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", { inherit_global_roll: false, layout: { roll: { headerStyle: "logo-right" } } }],
      ["/api/print-settings-per-doc/_global", { layout: { roll: { headerStyle: "logo-center" } } }],
      ["/api/settings", {}],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.layout.roll.headerStyle).toBe("logo-right");
  });

  it("merges flat doc-level fields over global settings when not inheriting", async () => {
    mockRoutes([
      ["/api/print-settings-per-doc/pos_receipt", { inherit_global_roll: false, print_font: "cairo" }],
      ["/api/print-settings-per-doc/_global", { print_font: "tajawal" }],
      ["/api/settings", { company_name: "My Shop" }],
    ]);
    const { result } = renderHook(() => usePrintSettingsForDoc("pos_receipt"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.print_font).toBe("cairo");
    expect(result.current.settings.company_name).toBe("My Shop");
  });

  it("does nothing when docType is falsy", () => {
    const { result } = renderHook(() => usePrintSettingsForDoc(null));
    expect(result.current.loading).toBe(false);
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix client -- usePrintSettingsForDoc.test.js`
Expected: FAIL — cannot resolve `../usePrintSettingsForDoc`.

- [ ] **Step 3: Implement the hook**

```js
// client/src/hooks/usePrintSettingsForDoc.js
import { useEffect, useState } from "react";
import api from "../services/api";
import { resolveDocPaperSize, DOC_PAPER_CONFIG } from "../pages/settings/PrintingSettingsPanel";
import { resolveEffectiveLayout } from "../components/print/layout/layoutModel";
import { familyOfSize } from "../components/print/studio/studioData";

const BLOCK_DOC_SCOPES = new Set([
  "pos_receipt", "sales_invoice", "purchase_order", "sales_return",
  "quotation", "branch_transfer", "purchase_return", "payment_receipt",
]);

export function usePrintSettingsForDoc(docType) {
  const [loading, setLoading] = useState(Boolean(docType));
  const [template, setTemplate] = useState(() => (docType && DOC_PAPER_CONFIG[docType]?.defaultSize) || "A4");
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (!docType) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/api/print-settings-per-doc/${docType}`).then((r) => r.data?.data || {}).catch(() => ({})),
      api.get("/api/print-settings-per-doc/_global").then((r) => r.data?.data || {}).catch(() => ({})),
      api.get("/api/settings").then((r) => r.data?.data || {}).catch(() => ({})),
    ]).then(([docSettings, globalScopeSettings, globalSettings]) => {
      if (cancelled) return;
      const resolvedTemplate = resolveDocPaperSize(docType, docSettings);
      const family = familyOfSize(resolvedTemplate);
      const effectiveLayout = { [family]: resolveEffectiveLayout(globalScopeSettings, docSettings, family, docType) };

      const { layout: _gsLayout, ...globalScopeFlat } = globalScopeSettings || {};
      const isReportDocForInherit = docType !== "_global" && !BLOCK_DOC_SCOPES.has(docType);
      const inheritFamilyKey = `inherit_global_${family}`;
      const docInheritVal = docSettings[inheritFamilyKey] ?? docSettings.inherit_global;
      const docInheritsGlobal = docInheritVal !== undefined ? docInheritVal : !isReportDocForInherit;
      const localFlatFields = docInheritsGlobal ? {} : docSettings;

      const combined = {
        ...(globalSettings || {}),
        ...globalScopeFlat,
        ...localFlatFields,
        layout: effectiveLayout,
      };

      setTemplate(resolvedTemplate);
      setSettings(combined);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [docType]);

  return { loading, template, settings };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix client -- usePrintSettingsForDoc.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/usePrintSettingsForDoc.js client/src/hooks/__tests__/usePrintSettingsForDoc.test.js
git commit -m "feat(whatsapp): usePrintSettingsForDoc hook for faithful receipt image capture"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `client/src/locales/ar.json` (after line 1171, `"whatsapp.copied": "تم النسخ",`)
- Modify: `client/src/locales/en.json` (after line 1165, `"whatsapp.copied": "Copied",`)

**Interfaces:**
- Produces the translation keys Task 3 consumes: `whatsapp.sendModeText`, `whatsapp.sendModeImage`, `whatsapp.imagePreparing`, `whatsapp.downloadImage`, `whatsapp.imageCaptionReceipt`, `whatsapp.imageCaptionReturn`.

- [ ] **Step 1: Add the Arabic keys**

In `client/src/locales/ar.json`, after `"whatsapp.copied": "تم النسخ",`:

```json
  "whatsapp.sendModeText": "نص",
  "whatsapp.sendModeImage": "صورة",
  "whatsapp.imagePreparing": "جارٍ تجهيز الصورة...",
  "whatsapp.downloadImage": "تنزيل الصورة",
  "whatsapp.imageCaptionReceipt": "فاتورة رقم {{no}} - {{total}} جنيه",
  "whatsapp.imageCaptionReturn": "مرتجع رقم {{no}} - {{total}} جنيه",
```

- [ ] **Step 2: Add the English keys**

In `client/src/locales/en.json`, after `"whatsapp.copied": "Copied",`:

```json
  "whatsapp.sendModeText": "Text",
  "whatsapp.sendModeImage": "Image",
  "whatsapp.imagePreparing": "Preparing image...",
  "whatsapp.downloadImage": "Download image",
  "whatsapp.imageCaptionReceipt": "Invoice #{{no}} - {{total}} EGP",
  "whatsapp.imageCaptionReturn": "Return #{{no}} - {{total}} EGP",
```

- [ ] **Step 3: Verify both files still parse as valid JSON**

Run: `node -e "require('./client/src/locales/ar.json'); require('./client/src/locales/en.json'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(whatsapp): i18n keys for the image send option"
```

---

### Task 3: Text/image choice in `WhatsAppSendModal`

**Files:**
- Modify: `client/src/components/whatsapp/WhatsAppSendModal.jsx` (full file, currently 289 lines)
- Test: `client/src/components/whatsapp/__tests__/WhatsAppSendModal.test.jsx`

**Interfaces:**
- Consumes: `usePrintSettingsForDoc` (Task 1); `PrintThermalDoc`, `PrintA4Doc` from `../print/PrintDoc`; `SHEET_W`, `familyOfSize` from `../print/studio/studioData`; `html2canvas`; the i18n keys from Task 2.
- Produces: no change to `WhatsAppSendModal`'s existing props (`open, onClose, invoice, kind, title, onBeforeSend`) — purely additive internal behavior.

This task modifies the existing component in place. Below are the exact changes against the current file content.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/whatsapp/__tests__/WhatsAppSendModal.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WhatsAppSendModal from "../WhatsAppSendModal";

vi.mock("../../ui/Modal", () => ({
  default: ({ open, title, children }) => (open ? <div><h1>{title}</h1>{children}</div> : null),
}));

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
vi.mock("../../../services/api", () => ({ default: { get: mockApiGet, post: mockApiPost } }));

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const mockUseAuthStore = vi.hoisted(() => vi.fn(() => ({ user: { role: "admin" } })));
vi.mock("../../../stores/authStore", () => ({ useAuthStore: mockUseAuthStore }));

const mockUseWhatsAppStatus = vi.hoisted(() => vi.fn(() => ({ status: "connected", isConnected: true, isReady: true, phone: "201000000000" })));
vi.mock("../../../hooks/useWhatsAppStatus", () => ({ useWhatsAppStatus: mockUseWhatsAppStatus }));

const mockUsePrintSettingsForDoc = vi.hoisted(() => vi.fn(() => ({ loading: false, template: "80mm", settings: {} })));
vi.mock("../../../hooks/usePrintSettingsForDoc", () => ({ usePrintSettingsForDoc: mockUsePrintSettingsForDoc }));

vi.mock("../../print/PrintDoc", () => ({
  PrintThermalDoc: () => <div data-testid="thermal-doc" />,
  PrintA4Doc: () => <div data-testid="a4-doc" />,
}));

const mockHtml2Canvas = vi.hoisted(() => vi.fn(() => Promise.resolve({ toDataURL: () => "data:image/png;base64,zzz" })));
vi.mock("html2canvas", () => ({ default: mockHtml2Canvas }));

const invoice = {
  id: 1, invoice_no: "INV-001", customer_phone: "201000000001", total: 250,
  lines: [{ item_name: "قلم", quantity: 2, unit_price: 10 }],
};

function setup(props = {}) {
  return render(
    <WhatsAppSendModal open onClose={vi.fn()} invoice={invoice} kind="receipt" {...props} />
  );
}

describe("WhatsAppSendModal image/text choice", () => {
  beforeEach(() => {
    mockApiGet.mockReset().mockResolvedValue({ data: { data: [] } });
    mockApiPost.mockReset().mockResolvedValue({});
    mockUsePrintSettingsForDoc.mockReturnValue({ loading: false, template: "80mm", settings: {} });
  });

  it("shows the text/image toggle for a sales receipt", async () => {
    setup({ kind: "receipt" });
    expect(await screen.findByText("نص")).toBeInTheDocument();
    expect(screen.getByText("صورة")).toBeInTheDocument();
  });

  it("shows the text/image toggle for a sales return", async () => {
    setup({ kind: "return_receipt" });
    expect(await screen.findByText("نص")).toBeInTheDocument();
    expect(screen.getByText("صورة")).toBeInTheDocument();
  });

  it("does not show the toggle for other message kinds", async () => {
    setup({ kind: "debt_reminder" });
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    expect(screen.queryByText("صورة")).not.toBeInTheDocument();
  });

  it("sends a text payload by default", async () => {
    setup({ kind: "receipt" });
    const sendBtn = await screen.findByText("إرسال");
    fireEvent.click(sendBtn);
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    const body = mockApiPost.mock.calls[0][1];
    expect(body.payload.text).toBeTruthy();
    expect(body.payload.image).toBeUndefined();
  });

  it("captures and sends an image payload when image mode is selected", async () => {
    setup({ kind: "receipt" });
    fireEvent.click(await screen.findByText("صورة"));
    const sendBtn = await screen.findByText("إرسال");
    fireEvent.click(sendBtn);
    await waitFor(() => expect(mockHtml2Canvas).toHaveBeenCalled());
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());
    const body = mockApiPost.mock.calls[0][1];
    expect(body.payload.image).toBe("zzz");
    expect(body.payload.caption).toContain("INV-001");
    expect(body.payload.text).toBeUndefined();
  });

  it("hides the open-in-WhatsApp and copy buttons in image mode", async () => {
    setup({ kind: "receipt" });
    expect(await screen.findByTitle("فتح في واتساب")).toBeInTheDocument();
    fireEvent.click(screen.getByText("صورة"));
    expect(screen.queryByTitle("فتح في واتساب")).not.toBeInTheDocument();
    expect(screen.getByText("تنزيل الصورة")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix client -- WhatsAppSendModal.test.jsx`
Expected: FAIL — no "صورة" toggle exists yet, `usePrintSettingsForDoc`/`html2canvas`/`PrintDoc` mocks are unused by the current component.

- [ ] **Step 3: Implement the changes**

Add the new icon imports to the existing lucide-react import (line 2) — change:

```jsx
import { MessageCircle, Copy, ExternalLink, Send, AlertCircle, RefreshCw, Check, Wifi, WifiOff, Smartphone } from "lucide-react";
```

to:

```jsx
import { MessageCircle, Copy, ExternalLink, Send, AlertCircle, RefreshCw, Check, Wifi, WifiOff, Smartphone, Image as ImageIcon, Download } from "lucide-react";
```

Add the new module imports (after the existing `useWhatsAppStatus` import, around line 9):

```jsx
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";
import { usePrintSettingsForDoc } from "../../hooks/usePrintSettingsForDoc";
import { PrintThermalDoc, PrintA4Doc } from "../print/PrintDoc";
import { SHEET_W, familyOfSize } from "../print/studio/studioData";
import html2canvas from "html2canvas";
```

Add a `KIND_DOC_TYPE` map and a pure invoice normalizer above the component (after the `ConnectionBadge` function, before `export default function WhatsAppSendModal`):

```jsx
const KIND_DOC_TYPE = { receipt: "pos_receipt", return_receipt: "sales_return" };

// Mirrors the field mapping each source page already applies before handing
// the invoice to PrintPreviewModal (see InvoiceDetailPage.jsx / SalesReturnDetailPage.jsx),
// so the captured image matches what the user would see there.
function normalizeInvoiceForPrint(invoice, kind) {
  const lines = invoice?.lines || invoice?.items || [];
  const invoice_no = invoice?.invoice_no || invoice?.doc_no || invoice?.id;
  if (kind === "return_receipt") {
    return {
      ...invoice,
      invoice_no,
      lines: lines.map((l) => ({
        ...l,
        item_name: l.item_name_ar || l.item_name || l.name,
        code: l.item_code || l.code || "",
        discount_amount: 0,
      })),
    };
  }
  return {
    ...invoice,
    invoice_no,
    lines: lines.map((l) => ({
      ...l,
      item_name: l.item_name || l.name,
      code: l.item_code || l.code || "",
      discount_amount: l.discount_amount ?? l.discount ?? 0,
    })),
  };
}
```

Inside `WhatsAppSendModal`, add state and the print-settings hook right after the existing state declarations (after `const [shopName, setShopName] = useState("");`, around line 42):

```jsx
  const [shopName, setShopName] = useState("");
  const [sendMode, setSendMode] = useState("text");
  const captureRef = useRef(null);

  const docType = KIND_DOC_TYPE[kind] || null;
  const showImageOption = Boolean(docType);
  const { loading: printSettingsLoading, template, settings: printSettings } = usePrintSettingsForDoc(docType);
```

`useRef` must be added to the React import at the top of the file — change:

```jsx
import React, { useEffect, useMemo, useState } from "react";
```

to:

```jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
```

Reset `sendMode` to `"text"` whenever the modal opens, alongside the existing phone-reset effect (replace):

```jsx
  useEffect(() => {
    if (open) {
      setPhone(normalizeEgyptPhone(rawPhone));
    }
  }, [open, rawPhone]);
```

with:

```jsx
  useEffect(() => {
    if (open) {
      setPhone(normalizeEgyptPhone(rawPhone));
      setSendMode("text");
    }
  }, [open, rawPhone]);
```

Add the image caption `useMemo` right after the existing `message` `useMemo` (after its closing `}, [template, customerName, invoice, shopName, invoiceItems]);`):

```jsx
  const imageCaption = useMemo(() => {
    const no = invoice?.invoice_no || invoice?.doc_no || invoice?.id || "";
    const total = invoice?.total ?? "";
    return kind === "return_receipt"
      ? t("whatsapp.imageCaptionReturn", { no, total })
      : t("whatsapp.imageCaptionReceipt", { no, total });
  }, [invoice, kind, t]);

  const printInvoice = useMemo(() => normalizeInvoiceForPrint(invoice, kind), [invoice, kind]);
```

Replace `handleSend` (build the payload based on `sendMode`, capturing the image when needed):

```jsx
  async function handleSend() {
    if (!phone) {
      toast.error(t("whatsapp.noPhone"));
      return;
    }
    if (!wa.isConnected) {
      toast.error(t("whatsapp.notConnected") || "واتساب غير متصل — تأكد من الاتصال أولاً");
      return;
    }
    if (onBeforeSend) {
      setSavingFirst(true);
      try { await onBeforeSend(); } catch { setSavingFirst(false); return; }
      setSavingFirst(false);
    }
    setSending(true);
    try {
      let payload;
      if (sendMode === "image") {
        const canvas = await html2canvas(captureRef.current, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });
        const image = canvas.toDataURL("image/png").split(",")[1];
        payload = { image, caption: imageCaption };
      } else {
        payload = { text: message };
      }
      await api.post("/api/whatsapp/enqueue", {
        recipient_phone: phone,
        customer_id: invoice?.customer_id || null,
        kind,
        payload,
      });
      toast.success(t("whatsapp.queued"));
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.message || t("whatsapp.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  function handleDownloadImage() {
    if (!captureRef.current) return;
    html2canvas(captureRef.current, { useCORS: true, scale: 2, backgroundColor: "#ffffff" }).then((canvas) => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${invoice?.invoice_no || invoice?.doc_no || invoice?.id || "invoice"}.png`;
      a.click();
    });
  }
```

Add the mode toggle and the off-screen capture target right before the recipient input (replace):

```jsx
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.recipient")}</label>
```

with:

```jsx
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <>
            {showImageOption && (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setSendMode("text")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black border transition-all active:scale-95 ${
                    sendMode === "text" ? "bg-primary text-white border-primary" : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"
                  }`}>
                  {t("whatsapp.sendModeText")}
                </button>
                <button type="button" onClick={() => setSendMode("image")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black border transition-all active:scale-95 ${
                    sendMode === "image" ? "bg-primary text-white border-primary" : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"
                  }`}>
                  <ImageIcon className="h-3.5 w-3.5" /> {t("whatsapp.sendModeImage")}
                </button>
              </div>
            )}

            {sendMode === "image" && showImageOption && (
              printSettingsLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs font-bold text-text-muted">
                  <RefreshCw className="h-4 w-4 animate-spin" /> {t("whatsapp.imagePreparing")}
                </div>
              ) : (
                <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, width: SHEET_W[template], background: "#ffffff" }}>
                  <div ref={captureRef}>
                    {familyOfSize(template) === "roll" ? (
                      <PrintThermalDoc invoice={printInvoice} settings={{ ...printSettings, receipt_width: template }} scope={docType} />
                    ) : (
                      <PrintA4Doc invoice={printInvoice} settings={printSettings} size={template} scope={docType} />
                    )}
                  </div>
                </div>
              )
            )}

            <div>
              <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.recipient")}</label>
```

Hide the template-picker / preview textarea when in image mode and show the buttons row differently — replace (the variants block, preview block, and the three-button row):

```jsx
            {variants.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">اختيار القالب</label>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map(v => (
                    <button key={v.id} onClick={() => setTemplate(v.body)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${
                        template === v.body
                          ? "bg-primary text-white border-primary"
                          : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"
                      }`}>
                      {template === v.body && <Check className="inline h-3 w-3 ml-1" />}
                      {v.label || "بدون اسم"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.preview")}</label>
              <textarea
                value={message}
                readOnly
                rows={7}
                className="w-full resize-none rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-medium leading-relaxed text-text-primary outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={handleSend}
                disabled={savingFirst || sending || !phone || !message || !wa.isConnected}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                title={!wa.isConnected ? (t("whatsapp.notConnected") || "واتساب غير متصل") : undefined}
              >
                {(sending || savingFirst) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {savingFirst ? "جاري الحفظ..." : sending ? t("whatsapp.sending") : t("whatsapp.send")}
              </button>
              <button
                onClick={handleOpenWhatsApp}
                disabled={savingFirst || !waMeUrl}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                title={t("whatsapp.openInWhatsApp")}
              >
                {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                onClick={handleCopy}
                disabled={savingFirst || !message}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                title={t("whatsapp.copyMessage")}
              >
                {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{t("whatsapp.copy")}</span>
              </button>
            </div>
```

with:

```jsx
            {sendMode === "text" && variants.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">اختيار القالب</label>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map(v => (
                    <button key={v.id} onClick={() => setTemplate(v.body)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${
                        template === v.body
                          ? "bg-primary text-white border-primary"
                          : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"
                      }`}>
                      {template === v.body && <Check className="inline h-3 w-3 ml-1" />}
                      {v.label || "بدون اسم"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sendMode === "text" && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.preview")}</label>
                <textarea
                  value={message}
                  readOnly
                  rows={7}
                  className="w-full resize-none rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-medium leading-relaxed text-text-primary outline-none"
                />
              </div>
            )}

            <div className={`grid gap-2 pt-1 ${sendMode === "image" ? "grid-cols-2" : "grid-cols-3"}`}>
              <button
                onClick={handleSend}
                disabled={savingFirst || sending || !phone || (sendMode === "text" ? !message : printSettingsLoading) || !wa.isConnected}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                title={!wa.isConnected ? (t("whatsapp.notConnected") || "واتساب غير متصل") : undefined}
              >
                {(sending || savingFirst) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {savingFirst ? "جاري الحفظ..." : sending ? t("whatsapp.sending") : t("whatsapp.send")}
              </button>
              {sendMode === "image" ? (
                <button
                  onClick={handleDownloadImage}
                  disabled={printSettingsLoading}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("whatsapp.downloadImage")}</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleOpenWhatsApp}
                    disabled={savingFirst || !waMeUrl}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                    title={t("whatsapp.openInWhatsApp")}
                  >
                    {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={savingFirst || !message}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                    title={t("whatsapp.copyMessage")}
                  >
                    {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{t("whatsapp.copy")}</span>
                  </button>
                </>
              )}
            </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix client -- WhatsAppSendModal.test.jsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Manually verify in the running app**

Run: `npm run dev`, open a Sales invoice detail page, click "واتساب" to open `WhatsAppSendModal`:
- Confirm the نص/صورة toggle appears, defaults to نص, and text sending is unchanged.
- Click صورة, confirm no visible layout shift (the capture target is off-screen), click إرسال, confirm a WhatsApp message with an image arrives on a real connected number and matches what Print Preview shows for that invoice.
- Repeat from a Sales Return detail page (`kind="return_receipt"`).
- Open the modal from a non-receipt context (if any exists) and confirm no toggle appears.
- Click "تنزيل الصورة" in image mode and confirm a PNG downloads matching the receipt.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/whatsapp/WhatsAppSendModal.jsx client/src/components/whatsapp/__tests__/WhatsAppSendModal.test.jsx
git commit -m "feat(whatsapp): send Sales/Sales Return invoices as an image from Print Preview"
```

---

## Self-review notes

- **Spec coverage:** hook (Task 1) → i18n (Task 2) → modal UI + capture + send + download fallback (Task 3) covers the full approved design: toggle scoped to `WhatsAppSendModal` only, only for receipt/return_receipt, faithful rendering via the real `PrintThermalDoc`/`PrintA4Doc` + resolved settings, sends through the existing enqueue endpoint with no server changes, secondary buttons swapped for a download fallback in image mode.
- **No placeholders:** all steps contain complete, runnable code.
- **Type consistency:** `usePrintSettingsForDoc` returns `{ loading, template, settings }` in Task 1 and is consumed with exactly those names in Task 3; `KIND_DOC_TYPE`/`normalizeInvoiceForPrint`/`imageCaption`/`printInvoice` names are used consistently within Task 3's single file.
