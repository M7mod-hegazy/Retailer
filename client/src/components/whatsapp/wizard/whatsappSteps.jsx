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

function ScanScene({ qr, loading }) {
  return (
    <div className="flex items-center gap-4">
      <PhoneFrame accent={ACCENT}>
        <div className="space-y-1.5 text-[10px] font-bold text-text-secondary">
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"><Settings2 className="h-3.5 w-3.5" /> الإعدادات</div>
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"><Smartphone className="h-3.5 w-3.5" /> الأجهزة المرتبطة</div>
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-white" style={{ background: ACCENT }}><Link2 className="h-3.5 w-3.5" /> ربط جهاز</div>
        </div>
      </PhoneFrame>
      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="h-[140px] w-[140px] rounded-2xl border-2 border-dashed animate-pulse flex flex-col items-center justify-center gap-2"
            style={{ borderColor: ACCENT + "60", background: ACCENT + "08" }}>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: ACCENT }} />
            <span className="text-[10px] font-black text-center px-2" style={{ color: ACCENT }}>جارٍ توليد رمز QR…</span>
          </div>
        </div>
      ) : (
        <QrTile src={qr} accent={ACCENT} size={140} />
      )}
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
  const qrLoading = linking || (!engine.qr && engine.status !== "connected");

  const steps = [
    {
      key: "intro",
      illustration: <IntroScene />,
      caption: t("wizard.whatsapp.step1.caption"),
      onNext: onLink,
      nextLabel: t("wizard.whatsapp.step1.button"),
      nextLoading: linking,
      canGoNext: !linking,
    },
    {
      key: "scan",
      illustration: <ScanScene qr={engine.qr} loading={qrLoading} />,
      caption: qrLoading ? "جارٍ الاتصال بالخادم وتوليد رمز QR، يرجى الانتظار…" : t("wizard.whatsapp.step2.caption"),
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
      nextDisabled={linking}
    />
  );
}
