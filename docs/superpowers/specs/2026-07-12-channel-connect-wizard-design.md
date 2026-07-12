# Channel Connect Wizard — Design Spec

**Date:** 2026-07-12
**Page:** `/whatsapp-crm` (مركز الرسائل والحملات)
**Goal:** Non-technical Arabic-speaking store owners can activate all three messaging channels (WhatsApp, SMS, Telegram) without help. Text-only step lists are replaced by an interactive, illustrated wizard where the user *does* the activation, guided by drawn visuals of exactly what they will see on their phone.

## Problem

Today each channel card on the dashboard has a `<details>` collapsible («كيف أبدأ التفعيل؟») containing pipe-separated **text** steps from `ar.json` (`whatsapp.steps`, `sms.steps`, `telegram.steps`). The actual activation happens elsewhere (WhatsApp: inline QR in the card; SMS: `SmsSetupModal`; Telegram: the تيليجرام tab). Non-technical users must read instructions in one place, then find and operate a different screen. Telegram is the worst case (BotFather → /newbot → copy token → generate QR → Start).

## Solution overview

One shared **`ChannelConnectWizard`** modal component with per-channel step definitions. Each step shows:

1. A **large coded-SVG illustration** (top) — a drawn mock of exactly what the user sees at that moment (their phone's Telegram/WhatsApp screen, the provider dashboard, etc.).
2. One short sentence of instruction (bottom).
3. Where possible, the **real action embedded in the step** (live QR, token input, test send) — the user never leaves the wizard.
4. Big «التالي / السابق» buttons + progress dots (Arabic-indic numerals), close (X) at any time.
5. **Auto-advance** when live state changes (QR scanned → success step).

### Non-negotiable constraints (existing conventions)

- **Coded illustrations only** — inline SVG React components. No bundled PNGs/GIFs/videos (offline-safe, translatable, themable). Same rule already stated in `ConnectGuide.jsx`.
- **Theme tokens only** — CSS vars (`--primary`, `--success-text`, `--bg-surface`, …), never raw Tailwind palette colors.
- **RTL-first** with `rtl:`/`ltr:` variants; illustrations must render correctly in RTL.
- **All strings in both** `client/src/locales/ar.json` and `en.json` under new `wizard.*` keys.
- **No server changes** — the wizard reuses existing endpoints unchanged.

## Components & file layout

New folder `client/src/components/whatsapp/wizard/`:

| File | Purpose |
|---|---|
| `ChannelConnectWizard.jsx` | Modal shell: header (channel icon, title, progress dots), illustration area, step text, nav buttons, close. Takes a `steps` array + `channel` accent. |
| `whatsappSteps.jsx` | Step definitions + live logic for WhatsApp (uses engine link/status passed as props from the dashboard). |
| `telegramSteps.jsx` | Step definitions + live logic for Telegram (token input, deep-link QR, detect-chat-id polling, settings save). |
| `smsSteps.jsx` | Step definitions + live logic for SMS (provider fields, save, test send). |
| `illustrations/` | Shared SVG primitives: `PhoneFrame`, `ChatBubble`, `QrTile`, `TokenKey`, `SuccessBurst`, plus per-step composed illustrations. |

A step is `{ key, title, body, Illustration, action?, canNext?, autoAdvanceWhen? }`:
- `Illustration` — React SVG component (receives accent color).
- `action` — optional live React node rendered under the text (input field, QR image, buttons).
- `canNext` — predicate gating the «التالي» button (e.g., token pasted).
- `autoAdvanceWhen` — predicate; when true, wizard jumps forward automatically (e.g., WhatsApp `connected`, Telegram `scanConnected`).

The wizard shell owns only navigation/presentation; channel state lives in the per-channel step modules (hooks) so each flow is independently testable.

## Per-channel flows

### WhatsApp (opened by «ربط واتساب»)

| Step | Illustration | Live action |
|---|---|---|
| 1. intro | Computer screen showing a QR + phone beside it, arrow between | «ابدأ الربط» button → calls existing `handleLink` (POST engine-link), advances |
| 2. scan | Real QR (large, from `engine.qr`) next to a drawn WhatsApp phone screen highlighting: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز | QR auto-refresh as today |
| 3. success (auto) | `SuccessBurst` + linked phone number | Shows what-you-get tags; «تم» closes |

Errors (connect failed / session stale) render inside the wizard with the existing «مسح الجلسة وإعادة المحاولة» action. If engine is `unavailable` (not Electron), the wizard entry button stays disabled as today.

### Telegram (opened by «تفعيل Telegram»)

| Step | Illustration | Live action |
|---|---|---|
| 1. find BotFather | Drawn phone: Telegram search bar with `@BotFather` + blue verified badge | — |
| 2. create bot | Drawn chat bubbles: user sends `/newbot`, BotFather asks for name, then username ending in `bot` | — |
| 3. paste token | Drawn BotFather message with token string highlighted + copy gesture | Real token input; «التالي» disabled until non-empty |
| 4. scan & start | Drawn phone scanning a QR | Real «توليد رمز الربط» (POST `/api/telegram/deep-link`) → real QR + existing 3s `detect-chat-id` polling + fallback link |
| 5. success (auto) | `SuccessBurst` + drawn notification bubble (invoice alert) | On `scanConnected`: PUT `/api/settings` with `telegram_enabled: true`, token, chat id. Shows «الإعدادات» link to the تيليجرام tab for notification toggles |

The existing تيليجرام tab remains the post-activation settings screen (toggles, digests, test send). Its own inline ConnectGuide stays as a secondary reference.

### SMS (opened by «تفعيل SMS»)

| Step | Illustration | Live action |
|---|---|---|
| 1. concept | Drawn: store → provider cloud (SMS Misr / Cequens labels) → several phones receiving SMS; paper + key = "الشركة هتديك رابط ومفتاح" | — |
| 2. credentials | Drawn mini provider-dashboard pointing at where URL/key live | Real fields: رابط البوابة (required), مفتاح API, اسم المرسل; «التالي» disabled until URL present |
| 3. enable & test | Drawn phone receiving an SMS with a check | «تشغيل وحفظ» (PUT `/api/settings` with `sms_enabled: true`) then live «إرسال تجريبي» to own number (POST `/api/whatsapp/sms-test`) |
| 4. success | `SuccessBurst` | What-you-get tags; «تم» closes |

Advanced JSON body template stays out of the wizard — it remains in `SmsSetupModal`, which becomes the post-activation «الإعدادات» view.

## Dashboard card changes (`WhatsAppCrmPage.jsx`)

- The three activation buttons open the wizard instead of today's targets, **only while the channel is not yet connected/enabled**. Once active, buttons behave as today (فصل / الإعدادات / تبويب تيليجرام).
- The `<details>` «كيف أبدأ التفعيل؟» collapsibles are replaced by a single link «شرح بالصور — كيف أبدأ؟» that opens the same wizard.
- WhatsApp inline QR/error blocks in the card are removed in favor of the wizard (the card keeps the status badge and tags). The WhatsApp engine state hook stays where it is; the wizard receives it via props.
- Old i18n keys `*.steps` are superseded by `wizard.*` keys; keep `whatsapp.qrHint` etc. where still referenced.

## Error handling

- Every live API call surfaces its error **inside the current step** (danger panel + retry), never as a dead end; toasts remain for secondary confirmation.
- Permission failures (settings require admin) render the existing EmptyState message inside the wizard body.
- Closing the wizard mid-flow is always allowed and leaves state consistent (nothing is saved until the explicit save/auto-save step).

## Testing

- Component render tests are out of scope (no client unit-test harness in repo); verification is manual via `npm run dev`:
  - each wizard opens from its card button, RTL layout, both themes;
  - WhatsApp: full link flow against the dev engine (QR appears, error path via airplane-mode);
  - Telegram: token → QR → Start on a real bot → auto-success → settings persisted;
  - SMS: fields → save → test send (or observe correct error from a dummy gateway).
- `npm test --prefix server` must stay green (no server changes expected).

## Out of scope

- Any server/endpoint changes.
- Redesigning the تيليجرام tab or `SmsSetupModal` beyond their new "settings-only" role.
- Video/GIF assets, screenshots of real apps.
- Changing daily-limit/anti-ban messaging logic.
