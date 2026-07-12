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
