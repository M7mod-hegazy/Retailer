/**
 * Email Service — Unified interface for SMTP, SendGrid, and Mailgun.
 * Uses nodemailer for SMTP and SendGrid (via nodemailer transport).
 * Mailgun uses REST API directly.
 */
const nodemailer = require("nodemailer");
const { getDb } = require("../config/database");
const logger = require("../config/logger");

let _transporter = null;
let _lastConfigKey = null;

/**
 * Load email config from the settings table.
 */
function loadConfig() {
  const db = getDb();
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() || {};
  return {
    enabled: Boolean(row.email_enabled),
    provider: row.email_provider || "smtp",
    host: row.email_host || "",
    port: Number(row.email_port) || 465,
    secure: Boolean(row.email_secure ?? 1),
    user: row.email_user || "",
    pass: row.email_pass || "",
    apiKey: row.email_api_key || "",
    domain: row.email_domain || "",
    fromName: row.email_from_name || "",
    fromEmail: row.email_from_email || "",
  };
}

/**
 * Build a nodemailer transporter from saved config.
 * Caches the transporter; recreates only when config changes.
 */
function getTransporter() {
  const cfg = loadConfig();
  if (!cfg.enabled || !cfg.provider) return null;

  // Cache key — recreate transporter when any config value changes
  const key = JSON.stringify(cfg);
  if (_transporter && _lastConfigKey === key) return _transporter;

  try {
    if (cfg.provider === "smtp") {
      _transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      });
    } else if (cfg.provider === "sendgrid") {
      _transporter = nodemailer.createTransport({
        service: "SendGrid",
        auth: { user: "apikey", pass: cfg.apiKey },
      });
    } else if (cfg.provider === "mailgun") {
      // Mailgun via nodemailer
      _transporter = nodemailer.createTransport({
        host: `smtp.mailgun.org`,
        port: 587,
        secure: false,
        auth: { user: cfg.user || `postmaster@${cfg.domain}`, pass: cfg.apiKey },
      });
    } else {
      return null;
    }

    _lastConfigKey = key;
    logger.info({ message: "Email transporter created", provider: cfg.provider });
    return _transporter;
  } catch (err) {
    logger.error({ message: "Failed to create email transporter", error: err.message });
    _transporter = null;
    _lastConfigKey = null;
    return null;
  }
}

/**
 * Verify the email connection is working.
 * Returns { success, message }.
 */
async function verifyConnection() {
  const transporter = getTransporter();
  if (!transporter) return { success: false, message: "Email service not configured" };
  try {
    await transporter.verify();
    return { success: true, message: "Connection successful" };
  } catch (err) {
    return { success: false, message: err.message || "Connection failed" };
  }
}

/**
 * Send a single email.
 * @param {Object} opts
 * @param {string} opts.to - Recipient email
 * @param {string} opts.subject - Email subject
 * @param {string} opts.html - HTML body
 * @param {string} opts.text - Plain text fallback
 * @param {Array}  opts.attachments - nodemailer attachments array
 * @returns {{ success, messageId, error? }}
 */
async function sendEmail({ to, subject, html, text, attachments }) {
  const cfg = loadConfig();
  const transporter = getTransporter();
  if (!transporter) return { success: false, error: "Email service not configured" };

  const from = cfg.fromEmail
    ? `"${cfg.fromName || cfg.fromEmail}" <${cfg.fromEmail}>`
    : cfg.user || "noreply@example.com";

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: html || undefined,
      text: text || undefined,
      attachments: attachments || undefined,
    });
    logger.info({ message: "Email sent", to, messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ message: "Email send failed", to, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Send bulk emails by queuing them into email_outbox.
 * The drainer (cron or inline) picks them up and sends.
 * @param {Array<{email, name, subject, html, text}>} recipients
 * @param {number} campaignId
 */
function queueBulk(recipients, campaignId) {
  const db = getDb();
  const ins = db.prepare(`
    INSERT INTO email_outbox (recipient_email, recipient_name, subject, html_body, text_body, campaign_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);
  const tx = db.transaction(() => {
    for (const r of recipients) {
      ins.run(r.email, r.name || null, r.subject, r.html || null, r.text || null, campaignId || null);
    }
  });
  tx();
  return recipients.length;
}

/**
 * Process pending emails in the outbox.
 * Called by cron or on-demand.
 * @param {number} limit - Max emails per batch
 */
async function drainOutbox(limit = 20) {
  const db = getDb();
  const pending = db.prepare(`
    SELECT * FROM email_outbox WHERE status = 'pending' ORDER BY id ASC LIMIT ?
  `).all(limit);

  if (!pending.length) return 0;

  let sent = 0;
  for (const row of pending) {
    const result = await sendEmail({
      to: row.recipient_email,
      subject: row.subject,
      html: row.html_body,
      text: row.text_body,
    });
    if (result.success) {
      db.prepare("UPDATE email_outbox SET status='sent', sent_at=datetime('now') WHERE id=?").run(row.id);
      sent++;
    } else {
      db.prepare("UPDATE email_outbox SET status='failed', error=? WHERE id=?").run(result.error || "unknown", row.id);
    }
  }
  return sent;
}

/**
 * Get email stats for the dashboard.
 */
function getStats() {
  const db = getDb();
  const enabled = db.prepare("SELECT email_enabled FROM settings WHERE id=1").get()?.email_enabled;
  const sentToday = db.prepare("SELECT COUNT(*) AS c FROM email_outbox WHERE status='sent' AND date(sent_at)=date('now')").get()?.c || 0;
  const sentTotal = db.prepare("SELECT COUNT(*) AS c FROM email_outbox WHERE status='sent'").get()?.c || 0;
  const pending = db.prepare("SELECT COUNT(*) AS c FROM email_outbox WHERE status='pending'").get()?.c || 0;
  const failed = db.prepare("SELECT COUNT(*) AS c FROM email_outbox WHERE status='failed'").get()?.c || 0;
  return { enabled: Boolean(enabled), sentToday, sentTotal, pending, failed };
}

/**
 * Start the email outbox drainer — polls every 30s.
 * No-op until email is enabled.
 */
let _drainerInterval = null;
function startEmailDrainer() {
  if (_drainerInterval) return;
  _drainerInterval = setInterval(async () => {
    try {
      const cfg = loadConfig();
      if (!cfg.enabled) return;
      await drainOutbox(10);
    } catch (err) {
      logger.error({ message: "Email drainer error", error: err.message });
    }
  }, 30000);
  // Don't block process exit
  if (_drainerInterval.unref) _drainerInterval.unref();
}

module.exports = {
  loadConfig,
  getTransporter,
  verifyConnection,
  sendEmail,
  queueBulk,
  drainOutbox,
  getStats,
  startEmailDrainer,
};
