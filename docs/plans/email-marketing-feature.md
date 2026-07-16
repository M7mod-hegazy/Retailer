# Email Marketing Feature — Implementation Plan

## Overview
Add email as a 4th equal channel alongside WhatsApp, SMS, and Telegram.
Backend + wizard + dashboard card + campaign channel + invoice send hidden button.

---

## Database Migration

- [ ] **203_email_marketing.js** — Create migration file
  - [ ] Add `email_enabled` (INTEGER DEFAULT 0) to `settings`
  - [ ] Add `email_provider` (TEXT — 'smtp' | 'sendgrid' | 'mailgun')
  - [ ] Add `email_host`, `email_port`, `email_secure`, `email_user`, `email_pass` to `settings`
  - [ ] Add `email_api_key`, `email_domain` to `settings`
  - [ ] Add `email_from_name`, `email_from_email` to `settings`
  - [ ] Add `email` column to `customers` table (TEXT DEFAULT NULL)
  - [ ] Create `email_outbox` table (id, recipient_email, subject, html_body, text_body, status, sent_at, error, campaign_id)
  - [ ] Create `email_events` table (id, campaign_id, recipient_email, event_type, metadata, created_at)

---

## Backend — Email Service

- [ ] **server/src/services/emailService.js** — Create email sending service
  - [ ] Import nodemailer
  - [ ] Create `createTransport(config)` — builds transporter from settings
  - [ ] `sendEmail({ to, subject, html, text, attachments })` — send single email
  - [ ] `sendBulk({ recipients, subject, html, text })` — queue multiple emails
  - [ ] `verifyConnection()` — test SMTP connectivity
  - [ ] Support providers: SMTP (nodemailer native), SendGrid (nodemailer + @sendgrid/nodemailer), Mailgun (REST API)
  - [ ] Normalize phone→email lookup for contacts
  - [ ] Inject tracking pixel for open tracking
  - [ ] Wrap links for click tracking

---

## Backend — Email Routes

- [ ] **server/src/routes/email.routes.js** — Create email config routes
  - [ ] `GET /api/email/config` — Get current email config (masked password/key)
  - [ ] `PUT /api/email/config` — Save email provider config
  - [ ] `POST /api/email/test-connection` — Verify provider connection
  - [ ] `POST /api/email/send-test` — Send test email to a given address
  - [ ] `GET /api/email/status` — Quick enabled/disabled check

---

## Backend — CRM Routes Updates

- [ ] **server/src/routes/whatsappCrm.routes.js** — Update for email support
  - [ ] Update `/config` endpoint to return `email_enabled` alongside `sms_enabled`
  - [ ] Update `/stats` endpoint to include email stats (sent today, total sent, delivery rate)
  - [ ] Update `/contacts` endpoint to include `email` field in results
  - [ ] Update `POST /campaigns` to accept `channel: 'email'`
  - [ ] Update `POST /campaigns` to filter recipients with email when channel=email
  - [ ] Add email subject field support in campaign payload

---

## Backend — App Mount

- [ ] **server/src/index.js** — Register email routes
  - [ ] Import email routes
  - [ ] Mount at `/api/email`

---

## Backend — Invoice Routes Update

- [ ] **server/src/routes/invoices.routes.js** — Update for invoice send
  - [ ] Update `GET /by-phone` to include all invoice types (sales + returns + credit notes)
  - [ ] Add `doc_no` to response fields
  - [ ] Add `type` field (sale/return/credit_note)
  - [ ] Add `GET /by-doc` endpoint — search by doc number across all customers

---

## Frontend — Email Connect Hook

- [ ] **client/src/hooks/useEmailConnect.js** — Create hook
  - [ ] Load email config from `GET /api/email/config`
  - [ ] `save(config)` — PUT to `/api/email/config`
  - [ ] `testConnection()` — POST to `/api/email/test-connection`
  - [ ] `sendTest(email)` — POST to `/api/email/send-test`
  - [ ] State: `email`, `setEmail`, `loading`, `saving`, `saved`, `testEmail`, `setTestEmail`, `testing`

---

## Frontend — Email Connect Wizard

- [ ] **client/src/components/whatsapp/wizard/emailSteps.jsx** — Create wizard
  - [ ] Step 1 — Concept: Store → Email Provider → Customer Inbox (illustration)
  - [ ] Step 2 — Provider Selection: SMTP / SendGrid / Mailgun dropdown
  - [ ] Step 3 — Credentials Form:
    - [ ] SMTP: Host, Port, Username, Password, Secure toggle
    - [ ] SendGrid: API Key
    - [ ] Mailgun: API Key, Domain
    - [ ] From Name + From Email fields
  - [ ] Step 4 — Enable & Test:
    - [ ] "Activate and save" button
    - [ ] Test email input + send test button
  - [ ] Step 5 — Success illustration
  - [ ] Use `ChannelConnectWizard` wrapper (same as SMS/WhatsApp/Telegram)
  - [ ] Accent color: `var(--danger)` (email red)

---

## Frontend — Dashboard Updates

- [ ] **WhatsAppCrmPage.jsx — DashboardTab** — Add 4th channel card
  - [ ] Change grid from `lg:grid-cols-3` to `lg:grid-cols-4`
  - [ ] Add Email channel card (same structure as WhatsApp/SMS/Telegram):
    - [ ] Vertical accent stripe (green when enabled, gray when disabled)
    - [ ] Icon: `Mail` from lucide-react
    - [ ] Status badge: "مفعّلة" / "غير مفعّلة"
    - [ ] Description text
    - [ ] Connect/Settings button
    - [ ] Tags row: "رسائل بريد", "قوالب HTML", "تتبع الفتح"
  - [ ] Wire `emailEnabled` state from config
  - [ ] Wire wizard open for email channel
  - [ ] Pass `emailEnabled` to MarketingTab and header

- [ ] **WhatsAppCrmPage.jsx — Header** — Add email status badge
  - [ ] Add 4th status pill: "Gmail: مفعّلة / غير مفعّلة"
  - [ ] Same styling pattern as WhatsApp/SMS/Telegram pills

---

## Frontend — Campaign Channel Updates

- [ ] **WhatsAppCrmPage.jsx — CreateCampaignModal** — Add email channel
  - [ ] Add "Email" toggle option alongside WhatsApp and SMS
  - [ ] Email-specific fields when selected:
    - [ ] Subject line input (with variable chips: {name}, {shop})
    - [ ] Email body textarea (supports HTML)
    - [ ] Preview panel showing email rendering
  - [ ] Filter recipients: only those with email address when channel=email
  - [ ] Show warning: "X contacts don't have email addresses"
  - [ ] Send button text: "إرسال حملة بريدية"

- [ ] **WhatsAppCrmPage.jsx — Campaign cards** — Add email channel badge
  - [ ] Email channel: purple badge with envelope icon
  - [ ] Channel badge text: "بريد"

---

## Frontend — Invoice Send Modal Updates

- [ ] **WhatsAppCrmPage.jsx — SendInvoiceModal** — Add hidden email button
  - [ ] Accept `emailEnabled` prop (from MarketingTab)
  - [ ] Show email send button ONLY when `emailEnabled === true`
  - [ ] Email button: icon `Mail`, styled similar to WhatsApp button but with different color
  - [ ] On click: send invoice as email attachment (PDF/image) to customer's email
  - [ ] Before send: prompt for email address if customer has none
  - [ ] Button hidden completely when email is not configured/active

---

## Frontend — Contact Table Updates

- [ ] **WhatsAppCrmPage.jsx — MarketingTab contacts table** — Add email column
  - [ ] Add "البريد" column header
  - [ ] Show customer email or "—" for leads without email
  - [ ] Green dot if email exists, gray if not

---

## Translations

- [ ] **client/src/locales/ar.json** — Add Arabic translations
  - [ ] `wizard.email.title`: "تفعيل البريد الإلكتروني"
  - [ ] `wizard.email.subtitle`: "قناة مجانية عبر SMTP أو خدمات بريد"
  - [ ] `wizard.email.step1.caption`: "البريد الإلكتروني بيوصل لأي عميل عنده إيميل — مجاناً وبدون حدود"
  - [ ] `wizard.email.step2.caption`: "اختار نوع الخدمة: SMTP خاص بيك، أو SendGrid / Mailgun"
  - [ ] `wizard.email.step3.caption`: "ادخل بيانات الاتصال — 호스트 ومفتاح API"
  - [ ] `wizard.email.step4.caption`: "فعّل وجرّب تبعت رسالة تجريبية على إيميلك"
  - [ ] `wizard.email.step4.button`: "تفعيل وحفظ"
  - [ ] `wizard.email.step5.caption`: "تمام! دلوقتي تقدر تبعت حملات بريدية للعملاء"
  - [ ] `email.title`: "البريد الإلكتروني"
  - [ ] `email.desc`: "إرسال فواتير وحملات تسويقية عبر البريد"
  - [ ] `email.sendInvoice`: "إرسال بالبريد"
  - [ ] `email.subject`: "الموضوع"
  - [ ] `email.campaignChannel`: "بريد إلكتروني"
  - [ ] `email.noEmail`: "لا يوجد بريد إلكتروني"
  - [ ] `email.connectedTags`: "رسائل بريد|قوالب HTML|تتبع الفتح|مجاني"

- [ ] **client/src/locales/en.json** — Add English translations
  - [ ] `wizard.email.title`: "Activate Email"
  - [ ] `wizard.email.subtitle`: "Free channel via SMTP or email services"
  - [ ] `wizard.email.step1.caption`: "Email reaches any customer with an address — free and unlimited"
  - [ ] `wizard.email.step2.caption`: "Choose a service: your own SMTP, or SendGrid / Mailgun"
  - [ ] `wizard.email.step3.caption`: "Enter connection details — host and API key"
  - [ ] `wizard.email.step4.caption`: "Activate and send a test email to confirm it works"
  - [ ] `wizard.email.step4.button`: "Activate and save"
  - [ ] `wizard.email.step5.caption`: "Done! You can now send email campaigns to customers"
  - [ ] `email.title`: "Email"
  - [ ] `email.desc`: "Send invoices and marketing campaigns via email"
  - [ ] `email.sendInvoice`: "Send via Email"
  - [ ] `email.subject`: "Subject"
  - [ ] `email.campaignChannel`: "Email"
  - [ ] `email.noEmail`: "No email address"
  - [ ] `email.connectedTags`: "Email campaigns|HTML templates|Open tracking|Free"

---

## Verification

- [ ] Test email config save/load cycle
- [ ] Test connection with real SMTP server
- [ ] Test campaign creation with email channel
- [ ] Test invoice send modal — email button shows only when active
- [ ] Test dashboard — 4 channel cards render correctly
- [ ] Test header — email status badge shows
- [ ] Test translations — all strings appear in Arabic and English
