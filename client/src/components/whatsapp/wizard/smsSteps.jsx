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
