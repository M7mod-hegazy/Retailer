# Channel Connect Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-only "كيف أبدأ التفعيل؟" step lists on `/whatsapp-crm` with an interactive, illustrated wizard per channel (WhatsApp, Telegram, SMS) so non-technical Arabic-speaking store owners can activate each channel themselves, doing the real activation inside the wizard instead of reading instructions then hunting for the real controls elsewhere.

**Architecture:** One presentational shell (`ChannelConnectWizard`) renders whatever step array it's given. Each channel gets its own `use<Channel>WizardSteps()` hook that builds that array (drawn illustration + one-sentence caption + optional live controls per step) and a thin wrapper component that wires the hook to the shell. WhatsApp's live state (engine/QR/errors) is threaded in via props from `DashboardTab`, which already owns it. Telegram and SMS's live state is extracted out of the existing `TelegramTab` / `SmsSetupModal` into two new hooks (`useTelegramConnect`, `useSmsConnect`) so the wizard and the existing post-activation settings screens share one implementation instead of duplicating API calls.

**Tech Stack:** React 18, Vite, Tailwind (theme-token utility classes), react-i18next, lucide-react icons, Vitest + @testing-library/react for tests.

## Global Constraints

- Illustrations are coded React/CSS components only — no bundled images, GIFs, or videos.
- All colors come from theme CSS vars (`var(--primary)`, `var(--success-text)`, `var(--info-text)`, `var(--border-normal)`, `var(--bg-surface)`, `var(--bg-base)`, etc.) or the matching Tailwind utility classes already used in this file (`bg-bg-surface`, `text-text-muted`, ...). Never a raw hex/Tailwind palette color.
- RTL-first: every new component renders `dir="rtl"` at its root (or inherits it — the wizard modal sets it explicitly like the existing `SmsSetupModal`/`WelcomeWizard`).
- All new user-facing copy goes into both `client/src/locales/ar.json` and `client/src/locales/en.json` under `wizard.*` keys, reusing existing `telegram.*`/`whatsapp.*`/`sms.*` keys where one already fits (do not duplicate).
- No server/API changes. Every live action in the wizard calls an endpoint that already exists.
- Existing settings screens (`TelegramTab`, `SmsSetupModal`) remain the post-activation destinations — the wizard only owns first-time activation.

---

### Task 1: Illustration primitives

**Files:**
- Create: `client/src/components/whatsapp/wizard/illustrations/PhoneFrame.jsx`
- Create: `client/src/components/whatsapp/wizard/illustrations/ChatBubble.jsx`
- Create: `client/src/components/whatsapp/wizard/illustrations/TokenKey.jsx`
- Create: `client/src/components/whatsapp/wizard/illustrations/SuccessBurst.jsx`
- Create: `client/src/components/whatsapp/wizard/illustrations/QrTile.jsx`
- Test: `client/src/components/whatsapp/wizard/illustrations/__tests__/illustrations.test.jsx`

**Interfaces:**
- Produces:
  - `PhoneFrame({ accent, children, className })` — div styled like a phone silhouette, class `phone-frame` on the outer element, `style.borderColor = accent`.
  - `ChatBubble({ from, children, accent })` — `from` is `"bot"` (default) or `"me"`.
  - `TokenKey({ label, accent })` — `label` rendered `dir="ltr"`.
  - `SuccessBurst({ accent })` — renders a `<svg>` (via the `Check` icon).
  - `QrTile({ src, alt, accent, size })` — renders `<img role="img">` when `src` is given, else a dashed placeholder containing an `<svg>` (via the `QrCode` icon).

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/whatsapp/wizard/illustrations/__tests__/illustrations.test.jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PhoneFrame from "../PhoneFrame";
import ChatBubble from "../ChatBubble";
import TokenKey from "../TokenKey";
import SuccessBurst from "../SuccessBurst";
import QrTile from "../QrTile";

describe("wizard illustration primitives", () => {
  it("PhoneFrame renders its children and applies the accent border color", () => {
    const { container } = render(<PhoneFrame accent="rgb(1, 2, 3)"><span>محتوى</span></PhoneFrame>);
    expect(screen.getByText("محتوى")).toBeInTheDocument();
    const frame = container.querySelector(".phone-frame");
    expect(frame).toHaveStyle({ borderColor: "rgb(1, 2, 3)" });
  });

  it("ChatBubble aligns 'me' messages to the end and 'bot' messages to the start", () => {
    const { container, rerender } = render(<ChatBubble from="bot">رسالة البوت</ChatBubble>);
    expect(screen.getByText("رسالة البوت")).toBeInTheDocument();
    expect(container.querySelector(".justify-start")).toBeTruthy();

    rerender(<ChatBubble from="me">ردي</ChatBubble>);
    expect(screen.getByText("ردي")).toBeInTheDocument();
    expect(container.querySelector(".justify-end")).toBeTruthy();
  });

  it("TokenKey renders the label in LTR direction", () => {
    render(<TokenKey label="123:ABC-token" />);
    expect(screen.getByText("123:ABC-token")).toHaveAttribute("dir", "ltr");
  });

  it("SuccessBurst renders a check icon", () => {
    const { container } = render(<SuccessBurst accent="rgb(9, 9, 9)" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("QrTile renders the real image when src is provided", () => {
    render(<QrTile src="data:image/png;base64,abc" alt="QR كود" />);
    expect(screen.getByRole("img", { name: "QR كود" })).toHaveAttribute("src", "data:image/png;base64,abc");
  });

  it("QrTile renders a placeholder icon when no src is provided", () => {
    const { container } = render(<QrTile alt="QR كود" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix client -- illustrations.test.jsx`
Expected: FAIL — cannot resolve `../PhoneFrame` (module does not exist).

- [ ] **Step 3: Implement the five primitives**

```jsx
// client/src/components/whatsapp/wizard/illustrations/PhoneFrame.jsx
import React from "react";

export default function PhoneFrame({ accent = "var(--primary)", children, className = "" }) {
  return (
    <div className={`phone-frame w-56 rounded-[28px] border-4 bg-bg-surface shadow-card overflow-hidden ${className}`} style={{ borderColor: accent }}>
      <div className="flex justify-center py-1.5" style={{ background: accent }}>
        <div className="h-1.5 w-10 rounded-full bg-white/60" />
      </div>
      <div className="p-3 space-y-2 min-h-[140px] bg-bg-base">
        {children}
      </div>
    </div>
  );
}
```

```jsx
// client/src/components/whatsapp/wizard/illustrations/ChatBubble.jsx
import React from "react";

export default function ChatBubble({ from = "bot", children, accent = "var(--primary)" }) {
  const isMe = from === "me";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[11px] font-bold leading-snug ${isMe ? "text-white" : "bg-bg-surface text-text-primary border border-border-normal"}`}
        style={isMe ? { background: accent } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
```

```jsx
// client/src/components/whatsapp/wizard/illustrations/TokenKey.jsx
import React from "react";
import { KeyRound } from "lucide-react";

export default function TokenKey({ label = "Bot Token", accent = "var(--primary)" }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2" style={{ borderColor: accent }}>
      <KeyRound className="h-4 w-4 shrink-0" style={{ color: accent }} />
      <span className="text-[11px] font-mono font-bold text-text-secondary truncate" dir="ltr">{label}</span>
    </div>
  );
}
```

```jsx
// client/src/components/whatsapp/wizard/illustrations/SuccessBurst.jsx
import React from "react";
import { Check } from "lucide-react";

export default function SuccessBurst({ accent = "var(--success-text)" }) {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: accent }} />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-card" style={{ background: accent }}>
        <Check className="h-8 w-8" />
      </span>
    </div>
  );
}
```

```jsx
// client/src/components/whatsapp/wizard/illustrations/QrTile.jsx
import React from "react";
import { QrCode } from "lucide-react";

export default function QrTile({ src, alt = "QR", accent = "var(--primary)", size = 160 }) {
  if (src) {
    return (
      <img src={src} alt={alt} className="rounded-xl border-2 shadow-card" style={{ borderColor: accent, width: size, height: size }} />
    );
  }
  return (
    <div className="flex items-center justify-center rounded-xl border-2 border-dashed bg-bg-base" style={{ borderColor: accent, width: size, height: size }}>
      <QrCode className="h-10 w-10 text-text-muted" />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix client -- illustrations.test.jsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/whatsapp/wizard/illustrations
git commit -m "feat(messaging): coded illustration primitives for the connect wizard"
```

---

### Task 2: `ChannelConnectWizard` shell

**Files:**
- Create: `client/src/components/whatsapp/wizard/ChannelConnectWizard.jsx`
- Test: `client/src/components/whatsapp/wizard/__tests__/ChannelConnectWizard.test.jsx`

**Interfaces:**
- Consumes: nothing from Task 1 directly (it's illustration-agnostic — steps pass their own `illustration` node).
- Produces: default export `ChannelConnectWizard({ onClose, icon: Icon, title, subtitle, accent, steps, forceIndex })`.
  - `steps: Array<{ key, illustration: ReactNode, caption: string, content?: ReactNode, canGoNext?: boolean, nextLabel?: string }>`. `canGoNext` defaults to `true` when omitted.
  - `forceIndex?: number` — when it exceeds the current step index, the wizard jumps forward to it (used for auto-advancing to a "success" step).
  - The caller is responsible for conditionally mounting/unmounting this component (same pattern as the existing `SmsSetupModal` — no internal `open` prop).

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/whatsapp/wizard/__tests__/ChannelConnectWizard.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChannelConnectWizard from "../ChannelConnectWizard";
import { Wifi } from "lucide-react";

const baseSteps = [
  { key: "one", illustration: <div>مشهد ١</div>, caption: "الخطوة الأولى" },
  { key: "two", illustration: <div>مشهد ٢</div>, caption: "الخطوة الثانية", canGoNext: false },
  { key: "three", illustration: <div>مشهد ٣</div>, caption: "الخطوة الثالثة" },
];

function renderWizard({ steps: stepsProp, ...rest } = {}) {
  const onClose = vi.fn();
  const utils = render(
    <ChannelConnectWizard
      icon={Wifi} title="تفعيل تجريبي" subtitle="عنوان فرعي" accent="rgb(1,2,3)"
      steps={stepsProp || baseSteps} onClose={onClose} {...rest}
    />
  );
  return { onClose, ...utils };
}

describe("ChannelConnectWizard", () => {
  it("shows the title, subtitle and first step caption", () => {
    renderWizard();
    expect(screen.getByText("تفعيل تجريبي")).toBeInTheDocument();
    expect(screen.getByText("عنوان فرعي")).toBeInTheDocument();
    expect(screen.getByText("الخطوة الأولى")).toBeInTheDocument();
  });

  it("advances to the next step when 'التالي' is clicked", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByText("الخطوة الثانية")).toBeInTheDocument();
  });

  it("disables the next button when the current step's canGoNext is false", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  });

  it("goes back to the previous step with 'السابق'", () => {
    renderWizard({ steps: [baseSteps[0], { ...baseSteps[1], canGoNext: true }, baseSteps[2]] });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByText("الخطوة الثانية")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "السابق" }));
    expect(screen.getByText("الخطوة الأولى")).toBeInTheDocument();
  });

  it("shows 'تم' on the last step and calls onClose when clicked", () => {
    const { onClose } = renderWizard({ steps: [baseSteps[0], { ...baseSteps[1], canGoNext: true }, baseSteps[2]] });
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(screen.getByText("الخطوة الثالثة")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تم" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the close (X) button is clicked", () => {
    const { onClose } = renderWizard();
    fireEvent.click(screen.getByLabelText("إغلاق"));
    expect(onClose).toHaveBeenCalled();
  });

  it("jumps forward automatically when forceIndex increases", () => {
    const { rerender } = renderWizard();
    expect(screen.getByText("الخطوة الأولى")).toBeInTheDocument();
    rerender(<ChannelConnectWizard icon={Wifi} title="تفعيل تجريبي" accent="rgb(1,2,3)" steps={baseSteps} forceIndex={2} onClose={() => {}} />);
    expect(screen.getByText("الخطوة الثالثة")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix client -- ChannelConnectWizard.test.jsx`
Expected: FAIL — cannot resolve `../ChannelConnectWizard`.

- [ ] **Step 3: Implement the shell**

```jsx
// client/src/components/whatsapp/wizard/ChannelConnectWizard.jsx
import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";

export default function ChannelConnectWizard({ onClose, icon: Icon, title, subtitle, accent = "var(--primary)", steps, forceIndex }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof forceIndex === "number" && forceIndex > index && forceIndex < steps.length) {
      setIndex(forceIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceIndex]);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const canGoNext = step.canGoNext !== false;

  function goNext() {
    if (isLast) { onClose?.(); return; }
    if (!canGoNext) return;
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function goPrev() {
    if (isFirst) return;
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay p-4" onMouseDown={onClose}>
      <div className="relative w-full max-w-lg rounded-3xl bg-bg-surface shadow-modal overflow-hidden animate-fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="إغلاق"
          className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-bg-base transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 px-6 pt-6">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-card" style={{ background: accent }}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-black text-text-primary truncate">{title}</h2>
            {subtitle && <p className="text-[11px] font-bold text-text-muted truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex justify-center gap-1.5 pt-4">
          {steps.map((s, i) => (
            <div key={s.key} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === index ? 24 : 6, background: i === index ? accent : "var(--border-normal)" }} />
          ))}
        </div>

        <div className="p-6 min-h-[320px] flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {step.illustration}
            <p className="text-sm font-bold text-text-secondary text-center leading-relaxed max-w-sm">{step.caption}</p>
            {step.content && <div className="w-full mt-1">{step.content}</div>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <button onClick={goPrev} disabled={isFirst}
            className="flex items-center gap-1.5 text-sm font-bold text-text-muted hover:text-text-primary disabled:opacity-0 transition-colors">
            <ChevronRight className="h-4 w-4" /> السابق
          </button>
          <button onClick={goNext} disabled={!canGoNext}
            className="flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-black text-white shadow transition-all active:scale-95 disabled:opacity-40"
            style={{ background: accent }}>
            {isLast ? (<><Check className="h-4 w-4" /> تم</>) : (<>{step.nextLabel || "التالي"} <ChevronLeft className="h-4 w-4" /></>)}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix client -- ChannelConnectWizard.test.jsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/whatsapp/wizard/ChannelConnectWizard.jsx client/src/components/whatsapp/wizard/__tests__/ChannelConnectWizard.test.jsx
git commit -m "feat(messaging): illustrated ChannelConnectWizard modal shell"
```

---

### Task 3: `useTelegramConnect` hook + `TelegramTab` refactor

**Files:**
- Create: `client/src/hooks/useTelegramConnect.js`
- Test: `client/src/hooks/__tests__/useTelegramConnect.test.js`
- Modify: `client/src/pages/whatsapp/WhatsAppCrmPage.jsx:1-19` (add import), `:2482-2612` (replace local state/effects/handlers with the hook)

**Interfaces:**
- Produces: `useTelegramConnect(onSaved?: () => void)` returning `{ config, setConfig, loading, loadError, saving, saved, testing, detecting, qrData, generatingQr, scanConnected, detectChatId, generateDeepLink, save, sendTest }`. `save()` takes no arguments (uses current `config`), matches the original `TelegramTab.save` contract exactly, and calls `onSaved?.()` after a successful PUT.

This is a pure extraction: the hook body is the current `TelegramTab` state/effects/handlers verbatim, with the `onConfigChanged` prop renamed to the hook's `onSaved` parameter. Behavior must not change.

- [ ] **Step 1: Write the failing test**

```js
// client/src/hooks/__tests__/useTelegramConnect.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTelegramConnect } from "../useTelegramConnect";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiPut = vi.hoisted(() => vi.fn());
vi.mock("../../services/api", () => ({ default: { get: mockApiGet, post: mockApiPost, put: mockApiPut } }));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

describe("useTelegramConnect", () => {
  beforeEach(() => {
    mockApiGet.mockReset().mockResolvedValue({ data: { data: {} } });
    mockApiPost.mockReset();
    mockApiPut.mockReset().mockResolvedValue({});
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it("loads settings on mount and marks saved when already configured", async () => {
    mockApiGet.mockResolvedValue({ data: { data: { telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "123" } } });
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config.telegram_bot_token).toBe("tok");
    expect(result.current.saved).toBe(true);
  });

  it("flags loadError when settings fail to load", async () => {
    mockApiGet.mockRejectedValue(new Error("no perms"));
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });

  it("detectChatId requires a token first", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.detectChatId(); });
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("telegram.detectNeedsToken");
  });

  it("detectChatId fills the chat id on success", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_bot_token: "tok" })); });
    mockApiPost.mockResolvedValue({ data: { data: { chatId: "555", chatName: "Owner" } } });
    await act(async () => { await result.current.detectChatId(); });
    expect(result.current.config.telegram_chat_id).toBe("555");
    expect(mockToast.success).toHaveBeenCalled();
  });

  it("generateDeepLink stores the returned QR payload", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_bot_token: "tok" })); });
    mockApiPost.mockResolvedValue({ data: { data: { qr: "data:image/png;base64,x", url: "https://t.me/x" } } });
    await act(async () => { await result.current.generateDeepLink(); });
    expect(result.current.qrData).toEqual({ qr: "data:image/png;base64,x", url: "https://t.me/x" });
  });

  it("save rejects enabling without a token and chat id", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true })); });
    await act(async () => { await result.current.save(); });
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it("save persists settings and marks saved when fully configured", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "1" })); });
    await act(async () => { await result.current.save(); });
    expect(result.current.saved).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "1" }));
  });

  it("calls the onSaved callback after a successful save", async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useTelegramConnect(onSaved));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "1" })); });
    await act(async () => { await result.current.save(); });
    expect(onSaved).toHaveBeenCalled();
  });

  it("sendTest calls the telegram test endpoint", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockApiPost.mockResolvedValue({});
    await act(async () => { await result.current.sendTest(); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/telegram/test");
    expect(mockToast.success).toHaveBeenCalledWith("telegram.testSuccess");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix client -- useTelegramConnect.test.js`
Expected: FAIL — cannot resolve `../useTelegramConnect`.

- [ ] **Step 3: Implement the hook**

```js
// client/src/hooks/useTelegramConnect.js
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "../services/api";

export function useTelegramConnect(onSaved) {
  const { t } = useTranslation();
  const [config, setConfig] = useState({
    telegram_enabled: false,
    telegram_bot_token: "",
    telegram_chat_id: "",
    telegram_api_base: "https://api.telegram.org",
    telegram_notify_new_invoice: true,
    telegram_notify_daily_close: true,
    telegram_notify_large_amounts: true,
    telegram_notify_returns_voids: true,
    telegram_notify_purchases_payments: true,
    telegram_notify_low_stock: true,
    telegram_notify_system: true,
    telegram_notify_weekly: false,
    telegram_notify_monthly: false,
    telegram_notify_yearly: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [qrData, setQrData] = useState(null); // { url, qr, username }
  const [generatingQr, setGeneratingQr] = useState(false);
  const [scanConnected, setScanConnected] = useState(false);

  useEffect(() => {
    api.get("/api/settings").then(r => {
      const d = r.data?.data || {};
      const asBool = (v, fallback) => v === undefined || v === null ? fallback : v !== 0 && v !== false && v !== "0";
      const bundled = asBool(d.telegram_notify_important_actions, true);
      const loaded = {
        telegram_enabled: Boolean(d.telegram_enabled),
        telegram_bot_token: d.telegram_bot_token || "",
        telegram_chat_id: d.telegram_chat_id || "",
        telegram_api_base: d.telegram_api_base || "https://api.telegram.org",
        telegram_notify_new_invoice: asBool(d.telegram_notify_new_invoice, true),
        telegram_notify_daily_close: asBool(d.telegram_notify_daily_close, true),
        telegram_notify_large_amounts: asBool(d.telegram_notify_large_amounts, bundled),
        telegram_notify_returns_voids: asBool(d.telegram_notify_returns_voids, bundled),
        telegram_notify_purchases_payments: asBool(d.telegram_notify_purchases_payments, bundled),
        telegram_notify_low_stock: asBool(d.telegram_notify_low_stock, bundled),
        telegram_notify_system: asBool(d.telegram_notify_system, bundled),
        telegram_notify_weekly: asBool(d.telegram_notify_weekly, false),
        telegram_notify_monthly: asBool(d.telegram_notify_monthly, false),
        telegram_notify_yearly: asBool(d.telegram_notify_yearly, false),
      };
      setConfig(loaded);
      setSaved(loaded.telegram_enabled && Boolean(loaded.telegram_bot_token) && Boolean(loaded.telegram_chat_id));
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, []);

  async function detectChatId() {
    if (!config.telegram_bot_token.trim()) { toast.error(t("telegram.detectNeedsToken")); return; }
    setDetecting(true);
    try {
      const r = await api.post("/api/telegram/detect-chat-id", {
        bot_token: config.telegram_bot_token.trim(),
        api_base: config.telegram_api_base?.trim() || undefined,
      });
      const chat = r.data?.data;
      if (chat?.chatId) {
        setConfig(c => ({ ...c, telegram_chat_id: chat.chatId }));
        toast.success(chat.chatName ? t("telegram.detectFound", { name: chat.chatName }) : t("telegram.detectFoundNoName"));
      }
    } catch (e) { toast.error(e.response?.data?.message || t("telegram.detectError")); }
    finally { setDetecting(false); }
  }

  async function generateDeepLink() {
    if (!config.telegram_bot_token.trim()) { toast.error(t("telegram.detectNeedsToken")); return; }
    setGeneratingQr(true);
    setScanConnected(false);
    try {
      const r = await api.post("/api/telegram/deep-link", {
        bot_token: config.telegram_bot_token.trim(),
        api_base: config.telegram_api_base?.trim() || undefined,
      });
      if (r.data?.data?.qr) setQrData(r.data.data);
    } catch (e) { toast.error(e.response?.data?.message || t("telegram.qrError")); }
    finally { setGeneratingQr(false); }
  }

  useEffect(() => {
    if (!qrData || scanConnected) return;
    const id = setInterval(async () => {
      try {
        const r = await api.post("/api/telegram/detect-chat-id", {
          bot_token: config.telegram_bot_token.trim(),
          api_base: config.telegram_api_base?.trim() || undefined,
        });
        const chat = r.data?.data;
        if (chat?.chatId) {
          setConfig(c => ({ ...c, telegram_chat_id: chat.chatId, telegram_enabled: true }));
          setScanConnected(true);
          toast.success(chat.chatName ? t("telegram.detectFound", { name: chat.chatName }) : t("telegram.detectFoundNoName"));
        }
      } catch { /* 404 = not scanned yet; keep waiting */ }
    }, 3000);
    return () => clearInterval(id);
  }, [qrData, scanConnected, config.telegram_bot_token, config.telegram_api_base, t]);

  async function save() {
    if (config.telegram_enabled && (!config.telegram_bot_token.trim() || !config.telegram_chat_id.trim())) {
      toast.error(t("telegram.validation"));
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/settings", config);
      setSaved(config.telegram_enabled && Boolean(config.telegram_bot_token.trim()) && Boolean(config.telegram_chat_id.trim()));
      toast.success(config.telegram_enabled ? t("telegram.saveSuccessOn") : t("telegram.saveSuccessOff"));
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.message || t("telegram.saveError")); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    setTesting(true);
    try {
      await api.post("/api/telegram/test");
      toast.success(t("telegram.testSuccess"));
    } catch (e) { toast.error(e.response?.data?.message || t("telegram.testError")); }
    finally { setTesting(false); }
  }

  return {
    config, setConfig, loading, loadError, saving, saved, testing, detecting,
    qrData, generatingQr, scanConnected, detectChatId, generateDeepLink, save, sendTest,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix client -- useTelegramConnect.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Refactor `TelegramTab` to consume the hook**

In `client/src/pages/whatsapp/WhatsAppCrmPage.jsx`, add the import after the existing `useWhatsAppStatus` import (around line 18):

```jsx
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";
import { useTelegramConnect } from "../../hooks/useTelegramConnect";
```

Then replace the `TelegramTab` function's state/effects/handlers block (currently lines 2482-2612, from `function TelegramTab({ telegramEnabled, onConfigChanged }) {` through the closing brace of `sendTest`) with:

```jsx
function TelegramTab({ telegramEnabled, onConfigChanged }) {
  const { t } = useTranslation();
  const {
    config, setConfig, loading, loadError, saving, saved, testing, detecting,
    qrData, generatingQr, scanConnected, detectChatId, generateDeepLink, save, sendTest,
  } = useTelegramConnect(onConfigChanged);
```

Everything below this point in `TelegramTab` (the `StepBadge`/`Toggle` helpers and the JSX render, which reference `config`, `setConfig`, `loading`, `loadError`, `saving`, `saved`, `testing`, `detecting`, `qrData`, `generatingQr`, `scanConnected`, `detectChatId`, `generateDeepLink`, `save`, `sendTest`) is unchanged — the destructured names match exactly.

- [ ] **Step 6: Manually verify no regression**

Run: `npm run dev` (from repo root), open `/whatsapp-crm`, switch to the تيليجرام tab, confirm the existing token/QR/detect/save/test flow still behaves as before.

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/useTelegramConnect.js client/src/hooks/__tests__/useTelegramConnect.test.js client/src/pages/whatsapp/WhatsAppCrmPage.jsx
git commit -m "refactor(messaging): extract Telegram connect logic into useTelegramConnect"
```

---

### Task 4: `useSmsConnect` hook + `SmsSetupModal` refactor

**Files:**
- Create: `client/src/hooks/useSmsConnect.js`
- Test: `client/src/hooks/__tests__/useSmsConnect.test.js`
- Modify: `client/src/pages/whatsapp/WhatsAppCrmPage.jsx:2309-2356` (replace local state/handlers with the hook), imports around line 19.

**Interfaces:**
- Produces: `useSmsConnect(onSaved?: () => void)` returning `{ sms, setSms, loading, loadError, saving, saved, testPhone, setTestPhone, testing, save, sendTest }`. `save(overrideSms?)` uses `overrideSms` when given, else the current `sms` state — needed later by the wizard's combined "enable + save" button, which must save the just-set value in the same click without waiting for a state-update re-render. Backward compatible: `SmsSetupModal`'s existing `onClick={save}` call (no argument) is unaffected.

- [ ] **Step 1: Write the failing test**

```js
// client/src/hooks/__tests__/useSmsConnect.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSmsConnect } from "../useSmsConnect";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiPut = vi.hoisted(() => vi.fn());
vi.mock("../../services/api", () => ({ default: { get: mockApiGet, post: mockApiPost, put: mockApiPut } }));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));

describe("useSmsConnect", () => {
  beforeEach(() => {
    mockApiGet.mockReset().mockResolvedValue({ data: { data: {} } });
    mockApiPost.mockReset();
    mockApiPut.mockReset().mockResolvedValue({});
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it("loads settings on mount and marks saved when already configured", async () => {
    mockApiGet.mockResolvedValue({ data: { data: { sms_enabled: true, sms_api_url: "https://provider.test" } } });
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sms.sms_api_url).toBe("https://provider.test");
    expect(result.current.saved).toBe(true);
  });

  it("flags loadError when settings fail to load", async () => {
    mockApiGet.mockRejectedValue(new Error("no perms"));
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });

  it("save rejects enabling without an API URL", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSms((s) => ({ ...s, sms_enabled: true })); });
    await act(async () => { await result.current.save(); });
    expect(mockApiPut).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalled();
  });

  it("save persists the current state and returns to saved=true", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSms((s) => ({ ...s, sms_enabled: true, sms_api_url: "https://provider.test" })); });
    await act(async () => { await result.current.save(); });
    expect(result.current.saved).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ sms_enabled: true, sms_api_url: "https://provider.test" }));
  });

  it("save accepts an override object so a fresh value can be persisted without waiting for a re-render", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const fresh = { sms_enabled: true, sms_api_url: "https://provider.test", sms_api_key: "", sms_sender: "", sms_body_template: "" };
    await act(async () => { await result.current.save(fresh); });
    expect(mockApiPut).toHaveBeenCalledWith("/api/settings", fresh);
    expect(result.current.saved).toBe(true);
  });

  it("calls the onSaved callback after a successful save", async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSmsConnect(onSaved));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSms((s) => ({ ...s, sms_enabled: true, sms_api_url: "https://provider.test" })); });
    await act(async () => { await result.current.save(); });
    expect(onSaved).toHaveBeenCalled();
  });

  it("sendTest does nothing without a phone number", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.sendTest(); });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("sendTest posts to the sms-test endpoint with the entered phone", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setTestPhone("0100000000"); });
    mockApiPost.mockResolvedValue({});
    await act(async () => { await result.current.sendTest(); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/whatsapp/sms-test", { phone: "0100000000" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix client -- useSmsConnect.test.js`
Expected: FAIL — cannot resolve `../useSmsConnect`.

- [ ] **Step 3: Implement the hook**

```js
// client/src/hooks/useSmsConnect.js
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

export function useSmsConnect(onSaved) {
  const [sms, setSms] = useState({ sms_enabled: false, sms_api_url: "", sms_api_key: "", sms_sender: "", sms_body_template: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get("/api/settings").then(r => {
      const d = r.data?.data || {};
      const loaded = {
        sms_enabled: Boolean(d.sms_enabled),
        sms_api_url: d.sms_api_url || "",
        sms_api_key: d.sms_api_key || "",
        sms_sender: d.sms_sender || "",
        sms_body_template: d.sms_body_template || "",
      };
      setSms(loaded);
      setSaved(loaded.sms_enabled && Boolean(loaded.sms_api_url));
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, []);

  async function save(overrideSms) {
    const cfg = overrideSms || sms;
    if (cfg.sms_enabled && !cfg.sms_api_url.trim()) {
      toast.error("أدخل رابط بوابة الإرسال أولاً");
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/settings", cfg);
      setSaved(cfg.sms_enabled && Boolean(cfg.sms_api_url.trim()));
      toast.success(cfg.sms_enabled ? "تم تفعيل خدمة SMS — جرّب الإرسال لرقمك" : "تم حفظ الإعدادات");
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      await api.post("/api/whatsapp/sms-test", { phone: testPhone.trim() });
      toast.success("وصلت؟ ✓ تم الإرسال عبر بوابة SMS بنجاح");
    } catch (e) { toast.error(e.response?.data?.message || "فشل إرسال الرسالة التجريبية"); }
    finally { setTesting(false); }
  }

  return { sms, setSms, loading, loadError, saving, saved, testPhone, setTestPhone, testing, save, sendTest };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix client -- useSmsConnect.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Refactor `SmsSetupModal` to consume the hook**

Add the import next to `useTelegramConnect`'s (Task 3, around line 19):

```jsx
import { useTelegramConnect } from "../../hooks/useTelegramConnect";
import { useSmsConnect } from "../../hooks/useSmsConnect";
```

Replace `SmsSetupModal`'s state/handlers block (currently lines 2309-2356, from `function SmsSetupModal({ onClose, onSaved }) {` through the closing brace of `sendTest`) with:

```jsx
function SmsSetupModal({ onClose, onSaved }) {
  const { sms, setSms, loading, loadError, saving, saved, testPhone, setTestPhone, testing, save, sendTest } = useSmsConnect(onSaved);
```

The rest of `SmsSetupModal` (the `StepBadge` helper and JSX render) is unchanged — same destructured names.

- [ ] **Step 6: Manually verify no regression**

Run: `npm run dev`, open `/whatsapp-crm`, click "تفعيل SMS" (or "الإعدادات" if already on), confirm the existing credentials/enable/save/test flow behaves as before.

- [ ] **Step 7: Commit**

```bash
git add client/src/hooks/useSmsConnect.js client/src/hooks/__tests__/useSmsConnect.test.js client/src/pages/whatsapp/WhatsAppCrmPage.jsx
git commit -m "refactor(messaging): extract SMS connect logic into useSmsConnect"
```

---

### Task 5: WhatsApp wizard steps

**Files:**
- Create: `client/src/components/whatsapp/wizard/whatsappSteps.jsx`
- Test: `client/src/components/whatsapp/wizard/__tests__/whatsappSteps.test.jsx`
- Modify: `client/src/locales/ar.json` (add keys after `"messaging.channelsSubtitle"`, line 1138), `client/src/locales/en.json` (same key, line 1132)

**Interfaces:**
- Consumes: `PhoneFrame`, `QrTile`, `SuccessBurst` (Task 1); `ChannelConnectWizard` (Task 2).
- Produces:
  - Named export `useWhatsappWizardSteps({ engine, linking, connectError, onLink, onClearAndRetry })` → `{ steps, forceIndex }`. `engine` is the same shape as `DashboardTab`'s `engine` state (`{ status, qr, phone, error }`).
  - Default export `WhatsAppConnectWizard({ onClose, engine, linking, connectError, onLink, onClearAndRetry })` — ready-to-render wrapper around `ChannelConnectWizard`.

- [ ] **Step 1: Add the i18n keys**

In `client/src/locales/ar.json`, after line 1138 (`"messaging.channelsSubtitle": "..."`):

```json
  "wizard.whatsapp.title": "تفعيل واتساب",
  "wizard.whatsapp.subtitle": "٣ خطوات بسيطة من موبايلك",
  "wizard.whatsapp.step1.caption": "هنولّد كود QR على الشاشة، وهتصوّره بكاميرا موبايلك عشان نربط رقم واتساب المتجر بالبرنامج",
  "wizard.whatsapp.step1.button": "ابدأ الربط",
  "wizard.whatsapp.step2.caption": "افتح واتساب في موبايلك: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز، وصوّر الكود اللي هنا",
  "wizard.whatsapp.step3.caption": "تم الربط بنجاح! دلوقتي هيتبعت للعملاء إيصالات وعروض أوتوماتيك من غير ما تفتح موبايلك",
```

In `client/src/locales/en.json`, after line 1132 (`"messaging.channelsSubtitle": "..."`):

```json
  "wizard.whatsapp.title": "Activate WhatsApp",
  "wizard.whatsapp.subtitle": "3 simple steps from your phone",
  "wizard.whatsapp.step1.caption": "We'll generate a QR code on screen for you to scan with your phone camera, linking the store's WhatsApp number to the app.",
  "wizard.whatsapp.step1.button": "Start linking",
  "wizard.whatsapp.step2.caption": "Open WhatsApp on your phone: Settings → Linked Devices → Link a Device, then scan the code shown here.",
  "wizard.whatsapp.step3.caption": "Linked successfully! Customers will now automatically receive receipts and offers — no need to open your phone again.",
```

- [ ] **Step 2: Write the failing test**

```jsx
// client/src/components/whatsapp/wizard/__tests__/whatsappSteps.test.jsx
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWhatsappWizardSteps } from "../whatsappSteps";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

function baseArgs(overrides = {}) {
  return { engine: { status: "disconnected" }, linking: false, connectError: null, onLink: vi.fn(), onClearAndRetry: vi.fn(), ...overrides };
}

describe("useWhatsappWizardSteps", () => {
  it("has 3 steps: intro, scan, success", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs()));
    expect(result.current.steps.map((s) => s.key)).toEqual(["intro", "scan", "success"]);
  });

  it("blocks leaving the intro step until the engine reaches qr or connected", () => {
    const { result, rerender } = renderHook(
      ({ status }) => useWhatsappWizardSteps(baseArgs({ engine: { status } })),
      { initialProps: { status: "disconnected" } },
    );
    expect(result.current.steps[0].canGoNext).toBe(false);
    rerender({ status: "qr" });
    expect(result.current.steps[0].canGoNext).toBe(true);
  });

  it("blocks leaving the scan step until connected", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs({ engine: { status: "qr", qr: "data:x" } })));
    expect(result.current.steps[1].canGoNext).toBe(false);
  });

  it("forces the success step once connected", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs({ engine: { status: "connected", phone: "201000000000" } })));
    expect(result.current.forceIndex).toBe(2);
  });

  it("leaves forceIndex undefined before connecting", () => {
    const { result } = renderHook(() => useWhatsappWizardSteps(baseArgs({ engine: { status: "qr" } })));
    expect(result.current.forceIndex).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --prefix client -- whatsappSteps.test.jsx`
Expected: FAIL — cannot resolve `../whatsappSteps`.

- [ ] **Step 4: Implement the steps + wrapper**

```jsx
// client/src/components/whatsapp/wizard/whatsappSteps.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Monitor, Smartphone, ArrowLeftRight, Settings2, Link2, CheckCheck, Wifi } from "lucide-react";
import PhoneFrame from "./illustrations/PhoneFrame";
import QrTile from "./illustrations/QrTile";
import SuccessBurst from "./illustrations/SuccessBurst";
import ChannelConnectWizard from "./ChannelConnectWizard";

const ACCENT = "var(--success-text)";

function IntroScene() {
  return (
    <div className="flex items-center gap-4">
      <PhoneFrame accent={ACCENT}><QrTile accent={ACCENT} size={110} /></PhoneFrame>
      <ArrowLeftRight className="h-5 w-5 text-text-muted shrink-0" />
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary">
          <Monitor className="h-6 w-6" />
        </div>
        <span className="text-[10px] font-black text-text-secondary">الكمبيوتر</span>
      </div>
    </div>
  );
}

function ScanScene({ qr }) {
  return (
    <div className="flex items-center gap-4">
      <PhoneFrame accent={ACCENT}>
        <div className="space-y-1.5 text-[10px] font-bold text-text-secondary">
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"><Settings2 className="h-3.5 w-3.5" /> الإعدادات</div>
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"><Smartphone className="h-3.5 w-3.5" /> الأجهزة المرتبطة</div>
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-white" style={{ background: ACCENT }}><Link2 className="h-3.5 w-3.5" /> ربط جهاز</div>
        </div>
      </PhoneFrame>
      <QrTile src={qr} accent={ACCENT} size={140} />
    </div>
  );
}

function SuccessScene({ phone }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <SuccessBurst accent={ACCENT} />
      {phone && <p className="text-sm font-black text-success-text font-mono" dir="ltr">+{phone}</p>}
    </div>
  );
}

export function useWhatsappWizardSteps({ engine, linking, connectError, onLink, onClearAndRetry }) {
  const { t } = useTranslation();

  const steps = [
    {
      key: "intro",
      illustration: <IntroScene />,
      caption: t("wizard.whatsapp.step1.caption"),
      content: (
        <button type="button" onClick={onLink} disabled={linking}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-card disabled:opacity-60 transition-all active:scale-95"
          style={{ background: ACCENT }}>
          <CheckCheck className="h-4 w-4" /> {t("wizard.whatsapp.step1.button")}
        </button>
      ),
      canGoNext: engine.status === "qr" || engine.status === "connected",
    },
    {
      key: "scan",
      illustration: <ScanScene qr={engine.qr} />,
      caption: t("wizard.whatsapp.step2.caption"),
      content: connectError ? (
        <div className="rounded-xl border border-danger-border bg-danger-bg p-3 text-center">
          <p className="text-xs font-bold text-danger">{connectError}</p>
          <button type="button" onClick={onClearAndRetry} className="mt-2 rounded-lg bg-danger px-3 py-1.5 text-[11px] font-black text-white">
            {t("whatsapp.clearSession")}
          </button>
        </div>
      ) : null,
      canGoNext: engine.status === "connected",
    },
    { key: "success", illustration: <SuccessScene phone={engine.phone} />, caption: t("wizard.whatsapp.step3.caption") },
  ];

  const forceIndex = engine.status === "connected" ? 2 : undefined;

  return { steps, forceIndex };
}

export default function WhatsAppConnectWizard({ onClose, engine, linking, connectError, onLink, onClearAndRetry }) {
  const { t } = useTranslation();
  const { steps, forceIndex } = useWhatsappWizardSteps({ engine, linking, connectError, onLink, onClearAndRetry });
  return (
    <ChannelConnectWizard
      onClose={onClose} icon={Wifi} accent={ACCENT}
      title={t("wizard.whatsapp.title")} subtitle={t("wizard.whatsapp.subtitle")}
      steps={steps} forceIndex={forceIndex}
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --prefix client -- whatsappSteps.test.jsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/whatsapp/wizard/whatsappSteps.jsx client/src/components/whatsapp/wizard/__tests__/whatsappSteps.test.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(messaging): WhatsApp connect wizard steps"
```

---

### Task 6: Telegram wizard steps

**Files:**
- Create: `client/src/components/whatsapp/wizard/telegramSteps.jsx`
- Test: `client/src/components/whatsapp/wizard/__tests__/telegramSteps.test.jsx`
- Modify: `client/src/locales/ar.json`, `client/src/locales/en.json` (append after the WhatsApp wizard keys added in Task 5)

**Interfaces:**
- Consumes: `PhoneFrame`, `ChatBubble`, `TokenKey`, `QrTile`, `SuccessBurst` (Task 1); `ChannelConnectWizard` (Task 2); `useTelegramConnect` (Task 3).
- Produces:
  - Named export `useTelegramWizardSteps({ onSaved }?)` → `{ steps, forceIndex, connect }` (`connect` is the raw `useTelegramConnect()` return, exposed for testability and not otherwise consumed by callers).
  - Default export `TelegramConnectWizard({ onClose, onSaved })`.
  - Auto-save behavior: an internal effect calls `connect.save()` exactly once when `connect.scanConnected` flips to `true` (the scan already set `telegram_enabled`/`telegram_chat_id` in `config` via the same state batch inside `useTelegramConnect`'s polling effect, so `save()` persists the freshly-scanned values with no extra parameters needed).

- [ ] **Step 1: Add the i18n keys**

In `client/src/locales/ar.json`, after the `wizard.whatsapp.*` keys added in Task 5:

```json
  "wizard.telegram.title": "تفعيل تيليجرام",
  "wizard.telegram.subtitle": "٥ خطوات — هتاخد دقيقتين بس",
  "wizard.telegram.step1.caption": "افتح تطبيق تيليجرام في موبايلك، وابحث عن BotFather (هتلاقي علامة توثيق زرقاء جنب اسمه)، وابدأ محادثة معاه",
  "wizard.telegram.step2.caption": "ابعتله /newbot، هيسألك عن اسم للبوت اكتب أي اسم، وبعدين هيطلب اسم مستخدم لازم ينتهي بكلمة bot",
  "wizard.telegram.step3.caption": "هيبعتلك رسالة فيها كود طويل (Bot Token) — انسخه والصقه في الخانة تحت",
  "wizard.telegram.step4.caption": "دوس الزرار عشان يظهر كود، صوّره بكاميرا موبايلك، وبعدين دوس Start جوه البوت",
  "wizard.telegram.step5.caption": "تم الربط! هتوصلك تنبيهات فورية على كل فاتورة، إغلاق يومية، وأحداث مهمة",
```

In `client/src/locales/en.json`, after the `wizard.whatsapp.*` keys added in Task 5:

```json
  "wizard.telegram.title": "Activate Telegram",
  "wizard.telegram.subtitle": "5 steps — takes about two minutes",
  "wizard.telegram.step1.caption": "Open Telegram on your phone, search for BotFather (look for the blue verified badge next to the name), and start a chat with it.",
  "wizard.telegram.step2.caption": "Send /newbot. It will ask for a name — type anything — then a username that must end in \"bot\".",
  "wizard.telegram.step3.caption": "It will send you a message with a long code (Bot Token) — copy it and paste it in the field below.",
  "wizard.telegram.step4.caption": "Tap the button below to generate a code, scan it with your phone camera, then tap Start inside the bot.",
  "wizard.telegram.step5.caption": "Linked! You'll now get instant alerts for every invoice, daily closing, and important events.",
```

- [ ] **Step 2: Write the failing test**

```jsx
// client/src/components/whatsapp/wizard/__tests__/telegramSteps.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTelegramWizardSteps } from "../telegramSteps";

const mockConnect = vi.hoisted(() => ({
  config: { telegram_bot_token: "", telegram_chat_id: "" },
  setConfig: vi.fn(),
  qrData: null,
  generatingQr: false,
  scanConnected: false,
  generateDeepLink: vi.fn(),
  save: vi.fn(),
  saving: false,
}));
const mockUseTelegramConnect = vi.hoisted(() => vi.fn(() => mockConnect));
vi.mock("../../../../hooks/useTelegramConnect", () => ({ useTelegramConnect: mockUseTelegramConnect }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

describe("useTelegramWizardSteps", () => {
  beforeEach(() => {
    mockConnect.config = { telegram_bot_token: "", telegram_chat_id: "" };
    mockConnect.qrData = null;
    mockConnect.scanConnected = false;
    mockConnect.save.mockReset();
    mockUseTelegramConnect.mockReturnValue(mockConnect);
  });

  it("has 5 steps in order", () => {
    const { result } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.steps.map((s) => s.key)).toEqual(["find-botfather", "create-bot", "paste-token", "scan-start", "success"]);
  });

  it("blocks the token step until a token is entered", () => {
    const { result, rerender } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.steps[2].canGoNext).toBe(false);
    mockConnect.config = { ...mockConnect.config, telegram_bot_token: "tok" };
    rerender();
    expect(result.current.steps[2].canGoNext).toBe(true);
  });

  it("blocks the scan step until scanConnected is true", () => {
    const { result, rerender } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.steps[3].canGoNext).toBe(false);
    mockConnect.scanConnected = true;
    rerender();
    expect(result.current.steps[3].canGoNext).toBe(true);
  });

  it("forces the success step once scanConnected is true", () => {
    mockConnect.scanConnected = true;
    const { result } = renderHook(() => useTelegramWizardSteps());
    expect(result.current.forceIndex).toBe(4);
  });

  it("calls save exactly once when scanConnected flips to true", () => {
    const { rerender } = renderHook(() => useTelegramWizardSteps());
    expect(mockConnect.save).not.toHaveBeenCalled();
    mockConnect.scanConnected = true;
    rerender();
    expect(mockConnect.save).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --prefix client -- telegramSteps.test.jsx`
Expected: FAIL — cannot resolve `../telegramSteps`.

- [ ] **Step 4: Implement the steps + wrapper**

```jsx
// client/src/components/whatsapp/wizard/telegramSteps.jsx
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, BadgeCheck, Camera, Receipt, Send } from "lucide-react";
import PhoneFrame from "./illustrations/PhoneFrame";
import ChatBubble from "./illustrations/ChatBubble";
import TokenKey from "./illustrations/TokenKey";
import QrTile from "./illustrations/QrTile";
import SuccessBurst from "./illustrations/SuccessBurst";
import ChannelConnectWizard from "./ChannelConnectWizard";
import { useTelegramConnect } from "../../../hooks/useTelegramConnect";

const ACCENT = "var(--primary)";

function FindBotFatherScene() {
  return (
    <PhoneFrame accent={ACCENT}>
      <div className="flex items-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-2 py-1.5 text-[10px] font-bold text-text-secondary">
        <Search className="h-3.5 w-3.5" /> BotFather
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-bg-surface px-2 py-1.5">
        <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
        <div className="min-w-0">
          <p className="text-[11px] font-black text-text-primary truncate">@BotFather</p>
          <p className="text-[9px] font-bold text-text-muted truncate">bot creator</p>
        </div>
      </div>
    </PhoneFrame>
  );
}

function CreateBotScene() {
  return (
    <PhoneFrame accent={ACCENT}>
      <ChatBubble from="me" accent={ACCENT}>/newbot</ChatBubble>
      <ChatBubble from="bot">تمام، سمّي البوت... بعد كده اختار اسم مستخدم ينتهي بكلمة bot</ChatBubble>
    </PhoneFrame>
  );
}

function PasteTokenScene({ token }) {
  return (
    <PhoneFrame accent={ACCENT}>
      <ChatBubble from="bot">Use this token to access the HTTP API:</ChatBubble>
      <TokenKey accent={ACCENT} label={token?.trim() ? token : "123456:ABC-token-هنا"} />
    </PhoneFrame>
  );
}

function ScanAndStartScene({ qr }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary">
        <Camera className="h-6 w-6" />
      </div>
      <QrTile src={qr} accent={ACCENT} size={140} />
    </div>
  );
}

function SuccessScene() {
  return (
    <div className="flex flex-col items-center gap-3">
      <SuccessBurst accent="var(--success-text)" />
      <ChatBubble from="bot"><span className="flex items-center gap-1"><Receipt className="h-3 w-3" /> فاتورة جديدة #1042 — ٢٥٠ ج.م</span></ChatBubble>
    </div>
  );
}

export function useTelegramWizardSteps({ onSaved } = {}) {
  const { t } = useTranslation();
  const connect = useTelegramConnect(onSaved);
  const { config, setConfig, qrData, generatingQr, scanConnected, generateDeepLink, save } = connect;

  useEffect(() => {
    if (scanConnected) save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanConnected]);

  const steps = [
    { key: "find-botfather", illustration: <FindBotFatherScene />, caption: t("wizard.telegram.step1.caption") },
    { key: "create-bot", illustration: <CreateBotScene />, caption: t("wizard.telegram.step2.caption") },
    {
      key: "paste-token",
      illustration: <PasteTokenScene token={config.telegram_bot_token} />,
      caption: t("wizard.telegram.step3.caption"),
      content: (
        <input type="password" dir="ltr" value={config.telegram_bot_token}
          onChange={(e) => setConfig((c) => ({ ...c, telegram_bot_token: e.target.value }))}
          placeholder={t("telegram.botTokenPlaceholder")}
          className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
      ),
      canGoNext: Boolean(config.telegram_bot_token.trim()),
    },
    {
      key: "scan-start",
      illustration: <ScanAndStartScene qr={qrData?.qr} />,
      caption: t("wizard.telegram.step4.caption"),
      content: (
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={generateDeepLink} disabled={generatingQr}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-60" style={{ background: ACCENT }}>
            {qrData ? t("telegram.regenerateQr") : t("telegram.generateQr")}
          </button>
          {qrData && (
            <a href={qrData.url} target="_blank" rel="noreferrer" dir="ltr" className="text-[11px] font-black underline" style={{ color: ACCENT }}>
              {t("telegram.fallbackLink")}
            </a>
          )}
        </div>
      ),
      canGoNext: scanConnected,
    },
    { key: "success", illustration: <SuccessScene />, caption: t("wizard.telegram.step5.caption") },
  ];

  const forceIndex = scanConnected ? 4 : undefined;

  return { steps, forceIndex, connect };
}

export default function TelegramConnectWizard({ onClose, onSaved }) {
  const { t } = useTranslation();
  const { steps, forceIndex } = useTelegramWizardSteps({ onSaved });
  return (
    <ChannelConnectWizard
      onClose={onClose} icon={Send} accent={ACCENT}
      title={t("wizard.telegram.title")} subtitle={t("wizard.telegram.subtitle")}
      steps={steps} forceIndex={forceIndex}
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --prefix client -- telegramSteps.test.jsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/whatsapp/wizard/telegramSteps.jsx client/src/components/whatsapp/wizard/__tests__/telegramSteps.test.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(messaging): Telegram connect wizard steps"
```

---

### Task 7: SMS wizard steps

**Files:**
- Create: `client/src/components/whatsapp/wizard/smsSteps.jsx`
- Test: `client/src/components/whatsapp/wizard/__tests__/smsSteps.test.jsx`
- Modify: `client/src/locales/ar.json`, `client/src/locales/en.json` (append after the Telegram wizard keys added in Task 6)

**Interfaces:**
- Consumes: `PhoneFrame`, `SuccessBurst` (Task 1); `ChannelConnectWizard` (Task 2); `useSmsConnect` (Task 4).
- Produces:
  - Named export `useSmsWizardSteps({ onSaved }?)` → `{ steps }`.
  - Default export `SmsConnectWizard({ onClose, onSaved })`.
  - The "enable-test" step's action button sets `sms_enabled: true` and calls `save()` with that exact object in the same handler (via `useSmsConnect`'s `save(overrideSms)` param from Task 4), so the freshly-checked value is what actually gets persisted.

- [ ] **Step 1: Add the i18n keys**

In `client/src/locales/ar.json`, after the `wizard.telegram.*` keys added in Task 6:

```json
  "wizard.sms.title": "تفعيل رسائل SMS",
  "wizard.sms.subtitle": "قناة مدفوعة عبر شركة خارجية",
  "wizard.sms.step1.caption": "SMS بتوصل لأي رقم موبايل حتى لو مفيش نت أو واتساب — بس لازم تشترك عند شركة زي SMS Misr أو Cequens الأول",
  "wizard.sms.step2.caption": "الشركة هتديك رابط API ومفتاح API — الصقهم هنا",
  "wizard.sms.step3.caption": "دوس الزرار عشان يتفعّل، بعدين جرّب تبعت لنفسك رسالة للتأكد إنها شغالة",
  "wizard.sms.step3.button": "تشغيل وحفظ",
  "wizard.sms.step4.caption": "تمام! دلوقتي أي حملة أو تذكير هتقدر تختار تبعته SMS",
```

In `client/src/locales/en.json`, after the `wizard.telegram.*` keys added in Task 6:

```json
  "wizard.sms.title": "Activate SMS Messages",
  "wizard.sms.subtitle": "A paid channel via an external provider",
  "wizard.sms.step1.caption": "SMS reaches any phone number even without internet or WhatsApp — but you need to subscribe with a provider like SMS Misr or Cequens first.",
  "wizard.sms.step2.caption": "The provider will give you an API URL and API key — paste them here.",
  "wizard.sms.step3.caption": "Tap the button to activate, then send yourself a test message to confirm it works.",
  "wizard.sms.step3.button": "Activate and save",
  "wizard.sms.step4.caption": "Done! You can now choose SMS for any campaign or reminder.",
```

- [ ] **Step 2: Write the failing test**

```jsx
// client/src/components/whatsapp/wizard/__tests__/smsSteps.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSmsWizardSteps } from "../smsSteps";

const mockConnect = vi.hoisted(() => ({
  sms: { sms_enabled: false, sms_api_url: "", sms_api_key: "", sms_sender: "" },
  setSms: vi.fn(),
  testPhone: "",
  setTestPhone: vi.fn(),
  save: vi.fn(),
  sendTest: vi.fn(),
  saving: false,
  testing: false,
  saved: false,
}));
const mockUseSmsConnect = vi.hoisted(() => vi.fn(() => mockConnect));
vi.mock("../../../../hooks/useSmsConnect", () => ({ useSmsConnect: mockUseSmsConnect }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

describe("useSmsWizardSteps", () => {
  beforeEach(() => {
    mockConnect.sms = { sms_enabled: false, sms_api_url: "", sms_api_key: "", sms_sender: "" };
    mockConnect.saved = false;
    mockConnect.setSms.mockReset();
    mockConnect.save.mockReset();
    mockUseSmsConnect.mockReturnValue(mockConnect);
  });

  it("has 4 steps in order", () => {
    const { result } = renderHook(() => useSmsWizardSteps());
    expect(result.current.steps.map((s) => s.key)).toEqual(["concept", "credentials", "enable-test", "success"]);
  });

  it("blocks the credentials step until an API URL is entered", () => {
    const { result, rerender } = renderHook(() => useSmsWizardSteps());
    expect(result.current.steps[1].canGoNext).toBe(false);
    mockConnect.sms = { ...mockConnect.sms, sms_api_url: "https://provider.test" };
    rerender();
    expect(result.current.steps[1].canGoNext).toBe(true);
  });

  it("blocks the enable-test step until saved is true", () => {
    const { result, rerender } = renderHook(() => useSmsWizardSteps());
    expect(result.current.steps[2].canGoNext).toBe(false);
    mockConnect.saved = true;
    rerender();
    expect(result.current.steps[2].canGoNext).toBe(true);
  });

  it("enable-test's button enables sms and saves the fresh value in one call", () => {
    mockConnect.sms = { sms_enabled: false, sms_api_url: "https://provider.test", sms_api_key: "", sms_sender: "" };
    const { result } = renderHook(() => useSmsWizardSteps());
    render(result.current.steps[2].content);
    fireEvent.click(screen.getByText("wizard.sms.step3.button"));
    expect(mockConnect.setSms).toHaveBeenCalledWith({ ...mockConnect.sms, sms_enabled: true });
    expect(mockConnect.save).toHaveBeenCalledWith({ ...mockConnect.sms, sms_enabled: true });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --prefix client -- smsSteps.test.jsx`
Expected: FAIL — cannot resolve `../smsSteps`.

- [ ] **Step 4: Implement the steps + wrapper**

```jsx
// client/src/components/whatsapp/wizard/smsSteps.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Store, Cloud, Smartphone, CircleCheckBig, MessageCircle } from "lucide-react";
import PhoneFrame from "./illustrations/PhoneFrame";
import SuccessBurst from "./illustrations/SuccessBurst";
import ChannelConnectWizard from "./ChannelConnectWizard";
import { useSmsConnect } from "../../../hooks/useSmsConnect";

const ACCENT = "var(--info-text)";

function ConceptScene() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary"><Store className="h-5 w-5" /></div>
      <div className="h-px w-6 bg-border-normal" />
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: ACCENT }}><Cloud className="h-5 w-5" /></div>
        <span className="text-[9px] font-black text-text-muted">SMS Misr / Cequens</span>
      </div>
      <div className="h-px w-6 bg-border-normal" />
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary"><Smartphone className="h-5 w-5" /></div>
    </div>
  );
}

function CredentialsScene() {
  return (
    <div className="w-full max-w-xs rounded-xl border border-border-normal bg-bg-surface p-3">
      <div className="h-2 w-2/3 rounded bg-bg-base mb-2" />
      <div className="rounded-lg border border-dashed p-2 text-[10px] font-mono font-bold text-text-secondary" dir="ltr" style={{ borderColor: ACCENT }}>
        API URL · API Key
      </div>
    </div>
  );
}

function EnableTestScene() {
  return (
    <PhoneFrame accent={ACCENT}>
      <div className="flex items-center gap-1.5 rounded-lg bg-bg-surface px-2 py-1.5 text-[10px] font-bold text-text-secondary">
        <CircleCheckBig className="h-3.5 w-3.5" style={{ color: ACCENT }} /> رسالة SMS تجريبية وصلت ✓
      </div>
    </PhoneFrame>
  );
}

function SuccessScene() {
  return <SuccessBurst accent={ACCENT} />;
}

export function useSmsWizardSteps({ onSaved } = {}) {
  const { t } = useTranslation();
  const { sms, setSms, testPhone, setTestPhone, save, sendTest, saving, testing, saved } = useSmsConnect(onSaved);

  async function enableAndSave() {
    const next = { ...sms, sms_enabled: true };
    setSms(next);
    await save(next);
  }

  const steps = [
    { key: "concept", illustration: <ConceptScene />, caption: t("wizard.sms.step1.caption") },
    {
      key: "credentials",
      illustration: <CredentialsScene />,
      caption: t("wizard.sms.step2.caption"),
      content: (
        <div className="space-y-2">
          <input type="url" dir="ltr" value={sms.sms_api_url}
            onChange={(e) => setSms((s) => ({ ...s, sms_api_url: e.target.value }))}
            placeholder="https://smsmisr.com/api/SMS/..."
            className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
          <div className="grid grid-cols-2 gap-2">
            <input type="password" dir="ltr" value={sms.sms_api_key}
              onChange={(e) => setSms((s) => ({ ...s, sms_api_key: e.target.value }))}
              placeholder="API Key"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
            <input type="text" dir="ltr" value={sms.sms_sender}
              onChange={(e) => setSms((s) => ({ ...s, sms_sender: e.target.value }))}
              placeholder="Sender ID"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
          </div>
        </div>
      ),
      canGoNext: Boolean(sms.sms_api_url.trim()),
    },
    {
      key: "enable-test",
      illustration: <EnableTestScene />,
      caption: t("wizard.sms.step3.caption"),
      content: (
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={enableAndSave} disabled={saving}
            className="rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-60" style={{ background: ACCENT }}>
            {t("wizard.sms.step3.button")}
          </button>
          {saved && (
            <div className="flex items-center gap-1.5">
              <input type="tel" dir="ltr" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="rounded-lg border border-border-normal bg-bg-input px-3 py-2 text-xs font-bold outline-none" />
              <button type="button" onClick={sendTest} disabled={testing || !testPhone.trim()}
                className="rounded-lg border border-border-normal bg-bg-surface px-3 py-2 text-[11px] font-black text-text-secondary disabled:opacity-50">
                {t("telegram.test")}
              </button>
            </div>
          )}
        </div>
      ),
      canGoNext: saved,
    },
    { key: "success", illustration: <SuccessScene />, caption: t("wizard.sms.step4.caption") },
  ];

  return { steps };
}

export default function SmsConnectWizard({ onClose, onSaved }) {
  const { t } = useTranslation();
  const { steps } = useSmsWizardSteps({ onSaved });
  return (
    <ChannelConnectWizard
      onClose={onClose} icon={MessageCircle} accent={ACCENT}
      title={t("wizard.sms.title")} subtitle={t("wizard.sms.subtitle")}
      steps={steps}
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --prefix client -- smsSteps.test.jsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/whatsapp/wizard/smsSteps.jsx client/src/components/whatsapp/wizard/__tests__/smsSteps.test.jsx client/src/locales/ar.json client/src/locales/en.json
git commit -m "feat(messaging): SMS connect wizard steps"
```

---

### Task 8: Wire the wizards into the dashboard cards

**Files:**
- Modify: `client/src/pages/whatsapp/WhatsAppCrmPage.jsx` (imports around line 1-19; `DashboardTab` around lines 400-719)
- Test: `client/src/pages/whatsapp/__tests__/DashboardTab.test.jsx`

**Interfaces:**
- Consumes: `WhatsAppConnectWizard` (Task 5, default export), `TelegramConnectWizard` (Task 6, default export), `SmsConnectWizard` (Task 7, default export).
- Produces: `DashboardTab` becomes a named export (in addition to remaining used internally), enabling direct testing without mounting the full `WhatsAppCrmPage`.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/pages/whatsapp/__tests__/DashboardTab.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardTab } from "../WhatsAppCrmPage";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiPut = vi.hoisted(() => vi.fn());
vi.mock("../../../services/api", () => ({ default: { get: mockApiGet, post: mockApiPost, put: mockApiPut } }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

const waStatus = { status: "disconnected", qr: null, error: null, phone: null };

function renderDashboard(props = {}) {
  return render(
    <DashboardTab
      stats={null} loading={false} waStatus={waStatus}
      smsEnabled={false} telegramEnabled={false}
      onRefresh={vi.fn()} onConfigChanged={vi.fn()} setActiveTab={vi.fn()}
      {...props}
    />
  );
}

describe("DashboardTab channel wizards", () => {
  beforeEach(() => {
    mockApiGet.mockReset().mockResolvedValue({ data: { data: {} } });
    mockApiPost.mockReset();
    mockApiPut.mockReset();
  });

  it("opens the WhatsApp wizard from the card button", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "whatsapp.title" }));
    expect(screen.getByText("wizard.whatsapp.title")).toBeInTheDocument();
  });

  it("opens the SMS wizard when SMS is not yet enabled", () => {
    renderDashboard({ smsEnabled: false });
    fireEvent.click(screen.getByText("تفعيل SMS"));
    expect(screen.getByText("wizard.sms.title")).toBeInTheDocument();
  });

  it("opens SMS settings instead of the wizard once SMS is enabled", () => {
    renderDashboard({ smsEnabled: true });
    fireEvent.click(screen.getByText("الإعدادات"));
    expect(screen.queryByText("wizard.sms.title")).not.toBeInTheDocument();
  });

  it("opens the Telegram wizard when Telegram is not yet enabled", () => {
    renderDashboard({ telegramEnabled: false });
    fireEvent.click(screen.getByText("telegram.activate"));
    expect(screen.getByText("wizard.telegram.title")).toBeInTheDocument();
  });

  it("switches to the Telegram tab instead of the wizard once Telegram is enabled", () => {
    const setActiveTab = vi.fn();
    renderDashboard({ telegramEnabled: true, setActiveTab });
    fireEvent.click(screen.getByText("telegram.settings"));
    expect(setActiveTab).toHaveBeenCalledWith("telegram");
    expect(screen.queryByText("wizard.telegram.title")).not.toBeInTheDocument();
  });

  it("closes the wizard and returns to the dashboard", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "whatsapp.title" }));
    expect(screen.getByText("wizard.whatsapp.title")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("إغلاق"));
    expect(screen.queryByText("wizard.whatsapp.title")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix client -- DashboardTab.test.jsx`
Expected: FAIL — `DashboardTab` is not exported from `WhatsAppCrmPage.jsx`, and the wizard buttons don't exist yet.

- [ ] **Step 3: Add imports**

Replace (around line 17-18):

```jsx
import ConnectGuide from "../../components/whatsapp/ConnectGuide";
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";
```

with:

```jsx
import ConnectGuide from "../../components/whatsapp/ConnectGuide";
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";
import WhatsAppConnectWizard from "../../components/whatsapp/wizard/whatsappSteps";
import TelegramConnectWizard from "../../components/whatsapp/wizard/telegramSteps";
import SmsConnectWizard from "../../components/whatsapp/wizard/smsSteps";
```

(`useTelegramConnect` and `useSmsConnect` imports were already added in Tasks 3 and 4.)

Also drop `AlertCircle` from the lucide-react import list (it's only used inside the block removed in Step 5 below) — change line 5 from:

```jsx
  Search, X, CheckCircle, AlertCircle, Clock, Zap, Info, Archive,
```

to:

```jsx
  Search, X, CheckCircle, Clock, Zap, Info, Archive,
```

- [ ] **Step 4: Export `DashboardTab` and add wizard-open state**

Change (around line 400):

```jsx
function DashboardTab({ stats, loading, waStatus, smsEnabled, telegramEnabled, onRefresh, onConfigChanged, setActiveTab }) {
```

to:

```jsx
export function DashboardTab({ stats, loading, waStatus, smsEnabled, telegramEnabled, onRefresh, onConfigChanged, setActiveTab }) {
```

Add wizard state next to the existing `connectError` state (around line 405):

```jsx
  const [connectError, setConnectError] = useState(null);
  const [wizardChannel, setWizardChannel] = useState(null); // null | "whatsapp" | "sms" | "telegram"
```

- [ ] **Step 5: Repoint the WhatsApp card button and drop its inline QR/error block**

Replace the WhatsApp action button block:

```jsx
              {!isUnavailable && (
                state !== "connected" ? (
                  <button onClick={handleLink} disabled={linking}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white shadow-card hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 min-w-[130px] justify-center">
                    {linking ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                    {linking ? t("whatsapp.connecting") : state === "qr" ? t("whatsapp.waitingScan") : t("whatsapp.title")}
                  </button>
                ) : (
                  <button onClick={handleUnlink}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl border border-danger-border bg-bg-surface px-4 py-2 text-xs font-black text-danger hover:bg-danger-bg transition-all active:scale-95">
                    <Unlink className="h-3.5 w-3.5" /> فصل
                  </button>
                )
              )}
```

with:

```jsx
              {!isUnavailable && (
                state !== "connected" ? (
                  <button onClick={() => setWizardChannel("whatsapp")}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white shadow-card hover:opacity-90 transition-all active:scale-95 min-w-[130px] justify-center">
                    <Link className="h-3.5 w-3.5" /> {t("whatsapp.title")}
                  </button>
                ) : (
                  <button onClick={handleUnlink}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl border border-danger-border bg-bg-surface px-4 py-2 text-xs font-black text-danger hover:bg-danger-bg transition-all active:scale-95">
                    <Unlink className="h-3.5 w-3.5" /> فصل
                  </button>
                )
              )}
```

Then delete the entire "Loading / QR / Error states" block that follows the "What you get" tags (from the `{/* Loading / QR / Error states */}` comment through its closing `</div>`, right before the WhatsApp card's own closing `</div>`) — replace:

```jsx
            {/* Loading / QR / Error states */}
            {!isUnavailable && state !== "connected" && (
              <div className="mt-4">
                {linking && state !== "qr" && (
                  <div className="rounded-xl bg-bg-base p-4 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm font-black text-text-primary">{t("whatsapp.connecting")}</p>
                    <p className="text-[11px] font-bold text-text-muted mt-1">{t("whatsapp.qrHint")}</p>
                  </div>
                )}

                {state === "qr" && engine.qr && (
                  <div className="rounded-xl border border-warning-border bg-bg-surface p-4">
                    <div className="flex flex-col items-center gap-3">
                      <img src={engine.qr} alt="QR" className="h-48 w-48 rounded-xl border-2 border-warning-border" />
                      <p className="text-sm font-black text-warning-text text-center">{t("whatsapp.waitingScan")}</p>
                      <p className="text-[11px] font-bold text-text-secondary text-center max-w-xs">{t("whatsapp.qrHint")}</p>
                      <p className="text-[10px] font-bold text-text-muted text-center">{t("whatsapp.qrRefreshing")}</p>
                    </div>
                  </div>
                )}

                {connectError && (
                  <div className="rounded-xl border border-danger-border bg-danger-bg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-danger">{t("whatsapp.connectFailed")}</p>
                        <p className="text-[11px] font-bold text-danger-text mt-1">{connectError}</p>
                        <p className="text-[11px] font-bold text-text-muted mt-2">{t("whatsapp.errorHint")}</p>
                        <button onClick={handleClearAndRetry}
                          className="mt-3 flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
                          <RefreshCw className="h-3.5 w-3.5" />
                          {t("whatsapp.clearSession")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {engine.error && !connectError && (
                  <div className="rounded-xl border border-danger-border bg-danger-bg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-danger">{t("whatsapp.connectFailed")}</p>
                        <p className="text-[11px] font-bold text-danger-text mt-1">{engine.error}</p>
                        <p className="text-[11px] font-bold text-text-muted mt-2">{t("whatsapp.errorHint")}</p>
                        <button onClick={handleClearAndRetry}
                          className="mt-3 flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
                          <RefreshCw className="h-3.5 w-3.5" />
                          {t("whatsapp.clearSession")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!linking && state !== "qr" && !connectError && !engine.error && (
                  <details className="rounded-xl bg-bg-base p-3">
                    <summary className="text-[11px] font-black text-text-secondary cursor-pointer list-none flex items-center gap-1.5">
                      <ChevronDown className="h-3 w-3" /> كيف أبدأ الربط؟
                    </summary>
                    <div className="mt-2.5">
                      <ConnectGuide channel="whatsapp" />
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
```

with just:

```jsx
          </div>
```

- [ ] **Step 6: Repoint the SMS card button and drop its collapsible**

Replace:

```jsx
              <button onClick={() => setSmsSetupOpen(true)}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all active:scale-95 ${smsEnabled
                    ? "border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"
                    : "bg-primary text-white shadow-card hover:opacity-90"
                  }`}>
```

with:

```jsx
              <button onClick={() => (smsEnabled ? setSmsSetupOpen(true) : setWizardChannel("sms"))}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all active:scale-95 ${smsEnabled
                    ? "border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"
                    : "bg-primary text-white shadow-card hover:opacity-90"
                  }`}>
```

Then delete the SMS `<details>` block:

```jsx
            {!smsEnabled && (
              <details className="mt-4 rounded-xl bg-bg-base p-3">
                <summary className="text-[11px] font-black text-text-secondary cursor-pointer list-none flex items-center gap-1.5">
                  <ChevronDown className="h-3 w-3" /> كيف أبدأ التفعيل؟
                </summary>
                <ol className="space-y-2 mt-2.5">
                  {t("sms.steps").split("|").map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] font-bold text-text-secondary">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>

          {/* Telegram channel */}
```

with:

```jsx
          </div>

          {/* Telegram channel */}
```

- [ ] **Step 7: Repoint the Telegram card button and drop its collapsible**

Replace:

```jsx
              <button onClick={() => setActiveTab("telegram")}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all active:scale-95 ${telegramEnabled
                    ? "border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"
                    : "bg-primary text-white shadow-card hover:opacity-90"
                  }`}>
```

with:

```jsx
              <button onClick={() => (telegramEnabled ? setActiveTab("telegram") : setWizardChannel("telegram"))}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all active:scale-95 ${telegramEnabled
                    ? "border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"
                    : "bg-primary text-white shadow-card hover:opacity-90"
                  }`}>
```

Then delete the Telegram `<details>` block and add the three wizard renders right after the existing `SmsSetupModal` render:

```jsx
            {!telegramEnabled && (
              <details className="mt-4 rounded-xl bg-bg-base p-3">
                <summary className="text-[11px] font-black text-text-secondary cursor-pointer list-none flex items-center gap-1.5">
                  <ChevronDown className="h-3 w-3" /> كيف أبدأ التفعيل؟
                </summary>
                <ol className="space-y-2 mt-2.5">
                  {t("telegram.steps").split("|").map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] font-bold text-text-secondary">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </div>
      </div>

      {smsSetupOpen && (
        <SmsSetupModal
          onClose={() => setSmsSetupOpen(false)}
          onSaved={() => { onConfigChanged?.(); }}
        />
      )}
```

with:

```jsx
          </div>
        </div>
      </div>

      {smsSetupOpen && (
        <SmsSetupModal
          onClose={() => setSmsSetupOpen(false)}
          onSaved={() => { onConfigChanged?.(); }}
        />
      )}

      {wizardChannel === "whatsapp" && (
        <WhatsAppConnectWizard
          onClose={() => setWizardChannel(null)}
          engine={engine} linking={linking} connectError={connectError}
          onLink={handleLink} onClearAndRetry={handleClearAndRetry}
        />
      )}
      {wizardChannel === "telegram" && (
        <TelegramConnectWizard onClose={() => setWizardChannel(null)} onSaved={onConfigChanged} />
      )}
      {wizardChannel === "sms" && (
        <SmsConnectWizard onClose={() => setWizardChannel(null)} onSaved={onConfigChanged} />
      )}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test --prefix client -- DashboardTab.test.jsx`
Expected: PASS (6 tests).

- [ ] **Step 9: Run the full client test suite**

Run: `npm test --prefix client`
Expected: PASS — no regressions in other suites (in particular the print-block tests, which don't touch this file, and any other `WhatsAppCrmPage.jsx` consumers).

- [ ] **Step 10: Manually verify in the running app**

Run: `npm run dev`, open `/whatsapp-crm`:
- Click "واتساب" → wizard opens on the intro step → click "ابدأ الربط" → QR appears in step 2 (real engine QR) → scan with a phone → step auto-advances to the success screen with the linked number.
- Click "تفعيل SMS" → paste a provider URL/key → "تشغيل وحفظ" → test-send to your own number → step 4.
- Click "تفعيل Telegram" → paste a real Bot Token → "توليد رمز الربط" → scan with a phone and tap Start → wizard auto-advances to the success screen; confirm the تيليجرام tab now shows it enabled with the same token/chat id.
- Confirm both `ar` and `en` locales render correctly (switch language in settings) and the modal looks right in RTL.

- [ ] **Step 11: Commit**

```bash
git add client/src/pages/whatsapp/WhatsAppCrmPage.jsx client/src/pages/whatsapp/__tests__/DashboardTab.test.jsx
git commit -m "feat(messaging): wire the illustrated connect wizards into the dashboard cards"
```

---

## Post-plan cleanup (not a task — verify only)

The old `*.steps` i18n keys (`whatsapp.steps`, `sms.steps`, `telegram.steps`) and `ConnectGuide`'s `channel="whatsapp"` usage are now dead in `WhatsAppCrmPage.jsx` after Task 8, but `ConnectGuide` itself and `telegram.steps` are still referenced from `TelegramTab`'s `guideTitle` `<details>` (line ~2739) — leave those in place; they're an intentional secondary reference in the settings tab, not part of this plan's scope. Do not delete `whatsapp.steps` / `sms.steps` from the locale files if anything else references them — grep before removing:

```bash
grep -rn "whatsapp.steps\|sms.steps" client/src --include="*.jsx" --include="*.js"
```

If nothing outside `WhatsAppCrmPage.jsx`'s now-removed block uses them, they can be deleted from `ar.json`/`en.json` in a follow-up commit — this is optional tidy-up, not required for the feature to work.
