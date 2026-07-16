import React from "react";
import { useTranslation } from "react-i18next";
import { Mail, Server, Key, CircleCheckBig, Send } from "lucide-react";
import PhoneFrame from "./illustrations/PhoneFrame";
import SuccessBurst from "./illustrations/SuccessBurst";
import ChannelConnectWizard from "./ChannelConnectWizard";
import { useEmailConnect } from "../../../hooks/useEmailConnect";

const ACCENT = "var(--danger)";

function ConceptScene() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary"><Mail className="h-5 w-5" /></div>
      <div className="h-px w-6 bg-border-normal" />
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: ACCENT }}><Server className="h-5 w-5" /></div>
        <span className="text-[9px] font-black text-text-muted">SMTP / SendGrid / Mailgun</span>
      </div>
      <div className="h-px w-6 bg-border-normal" />
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary"><Send className="h-5 w-5" /></div>
    </div>
  );
}

function CredentialsScene() {
  return (
    <div className="w-full max-w-xs rounded-xl border border-border-normal bg-bg-surface p-3">
      <div className="h-2 w-2/3 rounded bg-bg-base mb-2" />
      <div className="rounded-lg border border-dashed p-2 text-[10px] font-mono font-bold text-text-secondary" dir="ltr" style={{ borderColor: ACCENT }}>
        Host · Port · API Key
      </div>
    </div>
  );
}

function EnableTestScene() {
  return (
    <PhoneFrame accent={ACCENT}>
      <div className="flex items-center gap-1.5 rounded-lg bg-bg-surface px-2 py-1.5 text-[10px] font-bold text-text-secondary">
        <CircleCheckBig className="h-3.5 w-3.5" style={{ color: ACCENT }} /> رسالة بريد تجريبية وصلت ✓
      </div>
    </PhoneFrame>
  );
}

function SuccessScene() {
  return <SuccessBurst accent={ACCENT} />;
}

export function useEmailWizardSteps({ onSaved } = {}) {
  const { t } = useTranslation();
  const {
    email, setEmail, testEmail, setTestEmail,
    save, sendTest, testConnection,
    saving, saved, testing, testingConnection,
  } = useEmailConnect(onSaved);

  async function enableAndSave() {
    const next = { ...email, email_enabled: true };
    setEmail(next);
    await save(next);
  }

  const isSmtp = email.email_provider === "smtp";

  const steps = [
    { key: "concept", illustration: <ConceptScene />, caption: t("wizard.email.step1.caption") },
    {
      key: "provider",
      illustration: <CredentialsScene />,
      caption: t("wizard.email.step2.caption"),
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "smtp", label: "SMTP خاص" },
              { id: "sendgrid", label: "SendGrid" },
              { id: "mailgun", label: "Mailgun" },
            ].map(p => (
              <button key={p.id} type="button" onClick={() => setEmail(s => ({ ...s, email_provider: p.id }))}
                className={`rounded-xl border p-3 text-center transition-all ${
                  email.email_provider === p.id
                    ? "border-primary bg-primary-50 text-primary"
                    : "border-border-normal bg-bg-surface text-text-secondary hover:border-border-strong"
                }`}>
                <p className="text-xs font-black">{p.label}</p>
              </button>
            ))}
          </div>

          {isSmtp && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-right">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-secondary block">اسم الخادم (Host)</label>
                  <input type="text" dir="ltr" value={email.email_host === "null" || !email.email_host ? "" : email.email_host}
                    onChange={e => setEmail(s => ({ ...s, email_host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-secondary block">المنفذ (Port)</label>
                  <input type="number" dir="ltr" value={email.email_port === "null" || !email.email_port ? "" : email.email_port}
                    onChange={e => setEmail(s => ({ ...s, email_port: Number(e.target.value) || 465 }))}
                    placeholder="465"
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-secondary block">اسم المستخدم (User)</label>
                  <input type="text" dir="ltr" value={email.email_user === "null" || !email.email_user ? "" : email.email_user}
                    onChange={e => setEmail(s => ({ ...s, email_user: e.target.value }))}
                    placeholder="username"
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-secondary block">كلمة المرور (Pass)</label>
                  <input type="password" dir="ltr" value={email.email_pass === "null" || !email.email_pass ? "" : email.email_pass}
                    onChange={e => setEmail(s => ({ ...s, email_pass: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={email.email_secure}
                  onChange={e => setEmail(s => ({ ...s, email_secure: e.target.checked }))}
                  className="h-4 w-4 rounded border-border-normal text-primary focus:ring-primary" />
                <span className="text-xs font-bold text-text-secondary">TLS/SSL (منفذ 465)</span>
              </label>
            </div>
          )}

          {!isSmtp && (
            <div className="space-y-3">
              <div className="space-y-1 text-right">
                <label className="text-[10px] font-black text-text-secondary block">مفتاح API (API Key)</label>
                <input type="password" dir="ltr" value={email.email_api_key === "null" || !email.email_api_key ? "" : email.email_api_key}
                  onChange={e => setEmail(s => ({ ...s, email_api_key: e.target.value }))}
                  placeholder={email.email_provider === "sendgrid" ? "SG.xxxx" : "key-xxxx"}
                  className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
              </div>
              {email.email_provider === "mailgun" && (
                <div className="space-y-1 text-right">
                  <label className="text-[10px] font-black text-text-secondary block">اسم النطاق (Domain)</label>
                  <input type="text" dir="ltr" value={email.email_domain === "null" || !email.email_domain ? "" : email.email_domain}
                    onChange={e => setEmail(s => ({ ...s, email_domain: e.target.value }))}
                    placeholder="mg.yourdomain.com"
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-secondary block">اسم المرسل (From Name)</label>
              <input type="text" value={email.email_from_name === "null" || !email.email_from_name ? "" : email.email_from_name}
                onChange={e => setEmail(s => ({ ...s, email_from_name: e.target.value }))}
                placeholder="اسم المتجر"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-secondary block">بريد المرسل (From Email)</label>
              <input type="email" dir="ltr" value={email.email_from_email === "null" || !email.email_from_email ? "" : email.email_from_email}
                onChange={e => setEmail(s => ({ ...s, email_from_email: e.target.value }))}
                placeholder="store@gmail.com"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary transition-colors" />
            </div>
          </div>
        </div>
      ),
      canGoNext: Boolean(email.email_from_email?.trim()),
    },
    {
      key: "enable-test",
      illustration: <EnableTestScene />,
      caption: t("wizard.email.step3.caption"),
      content: (
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={enableAndSave} disabled={saving}
              className="rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {t("wizard.email.step4.button")}
            </button>
            {saved && (
              <button type="button" onClick={testConnection} disabled={testingConnection}
                className="rounded-lg border border-border-normal bg-bg-surface px-4 py-2 text-xs font-black text-text-secondary disabled:opacity-50 hover:bg-bg-base transition-all">
                {testingConnection ? "جارٍ الفحص..." : "فحص الاتصال"}
              </button>
            )}
          </div>
          {saved && (
            <div className="flex items-center gap-1.5">
              <input type="email" dir="ltr" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="test@gmail.com"
                className="rounded-lg border border-border-normal bg-bg-input px-3 py-2 text-xs font-bold outline-none" />
              <button type="button" onClick={sendTest} disabled={testing || !testEmail.trim()}
                className="rounded-lg border border-border-normal bg-bg-surface px-3 py-2 text-[11px] font-black text-text-secondary disabled:opacity-50">
                {testing ? "جارٍ الإرسال..." : "إرسال تجريبي"}
              </button>
            </div>
          )}
        </div>
      ),
      canGoNext: saved,
    },
    { key: "success", illustration: <SuccessScene />, caption: t("wizard.email.step5.caption") },
  ];

  return { steps };
}

export default function EmailConnectWizard({ onClose, onSaved }) {
  const { t } = useTranslation();
  const { steps } = useEmailWizardSteps({ onSaved });
  return (
    <ChannelConnectWizard
      onClose={onClose} icon={Mail} accent={ACCENT}
      title={t("wizard.email.title")} subtitle={t("wizard.email.subtitle")}
      steps={steps}
    />
  );
}
