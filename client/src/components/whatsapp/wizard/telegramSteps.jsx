import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, BadgeCheck, Camera, Receipt, Send, QrCode, Keyboard, User, Check } from "lucide-react";
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

function ScanAndStartScene({ qr, pollStatus }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary">
          <Camera className="h-6 w-6" />
        </div>
        <QrTile src={qr} accent={ACCENT} size={140} />
      </div>
      {pollStatus === "polling" && (
        <div className="flex items-center gap-2 mt-1">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-[11px] font-bold text-primary">جاري البحث عن الاتصال...</span>
        </div>
      )}
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
  const { config, setConfig, qrData, generatingQr, scanConnected, pollStatus, generateDeepLink, save } = connect;

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
        <div className="space-y-1 text-right">
          <label className="text-[10px] font-black text-text-secondary block">رمز البوت (Bot Token)</label>
          <input type="password" dir="ltr" value={config.telegram_bot_token === "null" || !config.telegram_bot_token ? "" : config.telegram_bot_token}
            onChange={(e) => setConfig((c) => ({ ...c, telegram_bot_token: e.target.value }))}
            placeholder={t("telegram.botTokenPlaceholder")}
            className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
        </div>
      ),
      canGoNext: Boolean(config.telegram_bot_token.trim()),
    },
    {
      key: "scan-start",
      illustration: <ScanAndStartScene qr={qrData?.qr} pollStatus={pollStatus} />,
      caption: t("wizard.telegram.step4.caption"),
      content: (
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={generateDeepLink} disabled={generatingQr}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-60 transition-all active:scale-95" style={{ background: ACCENT }}>
            {generatingQr ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-normal border-t-transparent" /> : null}
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

function ChooseMethodScene({ method, setMethod }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <p className="text-xs font-bold text-text-muted text-center leading-relaxed">{t("telegram.wizard.chooseMethodHint")}</p>
      <div className="flex gap-3 w-full">
        <button type="button" onClick={() => setMethod("qr")}
          className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all ${method === "qr" ? "border-primary bg-primary/5" : "border-border-normal bg-bg-base hover:border-primary/40"}`}>
          <QrCode className="h-10 w-10" style={{ color: method === "qr" ? "var(--primary)" : "var(--text-muted)" }} />
          <span className="text-xs font-black text-text-primary">{t("telegram.qrMethod")}</span>
          <span className="text-[10px] font-bold text-text-muted text-center leading-relaxed">{t("telegram.qrMethodDesc")}</span>
          <span className="text-[10px] font-bold text-primary text-center">{t("telegram.wizard.qrStep1Desc").split("—")[0]}</span>
        </button>
        <button type="button" onClick={() => setMethod("manual")}
          className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all ${method === "manual" ? "border-primary bg-primary/5" : "border-border-normal bg-bg-base hover:border-primary/40"}`}>
          <Keyboard className="h-10 w-10" style={{ color: method === "manual" ? "var(--primary)" : "var(--text-muted)" }} />
          <span className="text-xs font-black text-text-primary">{t("telegram.manualMethod")}</span>
          <span className="text-[10px] font-bold text-text-muted text-center leading-relaxed">{t("telegram.manualMethodDesc")}</span>
          <span className="text-[10px] font-bold text-primary text-center">{t("telegram.wizard.manualStep1Desc").split("—")[0]}</span>
        </button>
      </div>
    </div>
  );
}

function QRConnectScene({ qrData, generatingQr, pollStatus, onGenerate }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {!qrData ? (
        <div className="space-y-3 w-full">
          <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white mt-0.5">١</span>
            <div>
              <p className="text-[11px] font-black text-text-primary">{t("telegram.wizard.qrStep1Title")}</p>
              <p className="text-[10px] font-bold text-text-muted leading-relaxed">{t("telegram.wizard.qrStep1Desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white mt-0.5">٢</span>
            <div>
              <p className="text-[11px] font-black text-text-primary">{t("telegram.wizard.qrStep2Title")}</p>
              <p className="text-[10px] font-bold text-text-muted leading-relaxed">{t("telegram.wizard.qrStep2Desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white mt-0.5">٣</span>
            <div>
              <p className="text-[11px] font-black text-text-primary">{t("telegram.wizard.qrStep3Title")}</p>
              <p className="text-[10px] font-bold text-text-muted leading-relaxed">{t("telegram.wizard.qrStep3Desc")}</p>
            </div>
          </div>
          <button type="button" onClick={onGenerate} disabled={generatingQr}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 text-xs font-black text-white disabled:opacity-60 transition-all active:scale-95" style={{ background: ACCENT }}>
            {generatingQr ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-normal border-t-transparent" /> : null}
            {t("telegram.generateQr")}
          </button>
        </div>
      ) : (
        <>
          <QrTile src={qrData.qr} accent={ACCENT} size={140} />
          {pollStatus === "polling" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <span className="text-[11px] font-black text-primary">{t("telegram.wizard.qrWaiting")}</span>
            </div>
          )}
          <div className="w-full space-y-2">
            <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-text text-[10px] font-black text-white mt-0.5">٢</span>
              <p className="text-[10px] font-bold text-text-secondary leading-relaxed">{t("telegram.wizard.qrStep2Desc")}</p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-text text-[10px] font-black text-white mt-0.5">٣</span>
              <p className="text-[10px] font-bold text-text-secondary leading-relaxed">{t("telegram.wizard.qrStep3Desc")}</p>
            </div>
          </div>
          <a href={qrData.url} target="_blank" rel="noreferrer" dir="ltr" className="text-[11px] font-black underline" style={{ color: ACCENT }}>
            {t("telegram.fallbackLink")}
          </a>
        </>
      )}
    </div>
  );
}

function ManualEntryScene({ chatId, setChatId, detecting, onDetect }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="space-y-2 w-full">
        <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white mt-0.5">١</span>
          <div>
            <p className="text-[11px] font-black text-text-primary">{t("telegram.wizard.manualStep1Title")}</p>
            <p className="text-[10px] font-bold text-text-muted leading-relaxed">{t("telegram.wizard.manualStep1Desc")}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white mt-0.5">٢</span>
          <div>
            <p className="text-[11px] font-black text-text-primary">{t("telegram.wizard.manualStep2Title")}</p>
            <p className="text-[10px] font-bold text-text-muted leading-relaxed">{t("telegram.wizard.manualStep2Desc")}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-bg-base p-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white mt-0.5">٣</span>
          <div className="flex-1">
            <p className="text-[11px] font-black text-text-primary">{t("telegram.wizard.manualStep3Title")}</p>
            <p className="text-[10px] font-bold text-text-muted leading-relaxed">{t("telegram.wizard.manualStep3Desc")}</p>
          </div>
        </div>
      </div>

      <div className="w-full text-right">
        <label className="text-xs font-black text-text-secondary mb-1.5 block">{t("telegram.chatId")} *</label>
        <div className="flex gap-1.5">
          <input type="text" dir="ltr" value={chatId === "null" || !chatId ? "" : chatId} onChange={e => setChatId(e.target.value)}
            placeholder={t("telegram.chatIdPlaceholder")}
            className="flex-1 min-w-0 rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
          <button type="button" onClick={onDetect} disabled={detecting}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-primary px-3 py-2.5 text-[11px] font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {detecting ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-normal border-t-transparent" /> : null}
            {t("telegram.detectButton")}
          </button>
        </div>
      </div>

      <details className="w-full group">
        <summary className="text-[10px] font-black text-primary cursor-pointer hover:underline list-none flex items-center gap-1">
          {t("telegram.wizard.manualHowToGet")}
        </summary>
        <div className="mt-2 rounded-lg bg-bg-base p-3 text-[10px] font-bold text-text-muted leading-relaxed whitespace-pre-line">
          {t("telegram.wizard.manualHowToGetDesc")}
        </div>
      </details>
    </div>
  );
}

function NameRecipientScene({ name, setName }) {
  const { t } = useTranslation();
  const trimmed = (name === "null" || !name) ? "" : name;
  const isEmpty = !trimmed.trim();
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
        <User className="h-7 w-7 text-primary" />
      </div>
      <div className="rounded-xl bg-bg-base p-4 w-full border border-border-subtle">
        <p className="text-sm font-black text-text-primary">{t("telegram.wizard.nameStepTitle")}</p>
        <p className="text-[11px] font-bold text-text-muted leading-relaxed mt-1">{t("telegram.wizard.nameStepDesc")}</p>
      </div>
      <div className="w-full space-y-1.5">
        <label className="text-sm font-black text-text-primary block">
          {t("telegram.nameRecipient")} <span className="text-danger-text">*</span>
        </label>
        <input type="text" value={trimmed} onChange={e => setName(e.target.value)}
          placeholder={t("telegram.nameRecipientHint")}
          autoFocus
          className={`w-full rounded-xl border-2 px-4 py-3.5 text-sm font-bold outline-none transition-all ${
            isEmpty
              ? "border-danger-border/50 bg-danger-bg/10 placeholder:text-danger-text/40 focus:border-danger-text focus:bg-bg-surface"
              : "border-border-normal bg-bg-input focus:border-primary focus:bg-bg-surface"
          }`} />
        {isEmpty && (
          <p className="text-[11px] font-bold text-danger-text flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger-text" />
            {t("telegram.wizard.nameRequired", "الاسم مطلوب للمتابعة")}
          </p>
        )}
      </div>
    </div>
  );
}

function RecipientSuccessScene() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3">
      <SuccessBurst accent="var(--success-text)" />
      <div className="rounded-lg bg-success-bg border border-success-border p-3 w-full text-center">
        <p className="text-xs font-black text-success-text">{t("telegram.wizard.successTitle")}</p>
        <p className="text-[10px] font-bold text-text-secondary leading-relaxed mt-1">{t("telegram.wizard.successDesc")}</p>
      </div>
    </div>
  );
}

function useAddRecipientStepsLogic() {
  const { t } = useTranslation();
  const connect = useTelegramConnect();
  const { config, qrData, generatingQr, scanConnected, pollStatus, detecting, generateDeepLink } = connect;

  const [method, setMethod] = useState(null);
  const [chatId, setChatId] = useState("");
  const [name, setName] = useState("");

  // Mirror config.telegram_chat_id → local chatId after detectChatId() succeeds
  useEffect(() => {
    if (method !== "manual") return;
    const detected = config.telegram_chat_id;
    if (detected && detected !== "null" && detected !== chatId) {
      setChatId(detected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.telegram_chat_id, method]);

  const steps = [
    { key: "choose-method", illustration: <ChooseMethodScene method={method} setMethod={setMethod} />, caption: t("telegram.wizard.chooseMethodHint"), canGoNext: Boolean(method) },
  ];

  if (method === "qr") {
    steps.push({
      key: "qr-scan",
      illustration: <QRConnectScene qrData={qrData} generatingQr={generatingQr} pollStatus={pollStatus} onGenerate={() => generateDeepLink()} />,
      caption: !qrData ? t("telegram.wizard.qrStep1Desc") : t("telegram.wizard.qrWaiting"),
      canGoNext: scanConnected || Boolean(chatId),
    });
  } else if (method === "manual") {
    steps.push({
      key: "manual-entry",
      illustration: <ManualEntryScene chatId={chatId} setChatId={setChatId} detecting={detecting} onDetect={connect.detectChatId} />,
      caption: t("telegram.wizard.manualStep3Desc"),
      canGoNext: Boolean(chatId.trim()),
    });
  }

  steps.push(
    { key: "name", illustration: <NameRecipientScene name={name} setName={setName} />, caption: t("telegram.wizard.nameStepDesc"), canGoNext: Boolean(name.trim()) },
    { key: "success", illustration: <RecipientSuccessScene />, caption: t("telegram.wizard.successDesc") },
  );

  const finalChatId = method === "qr" ? (scanConnected ? config.telegram_chat_id : chatId) : chatId;

  const forceIndex = scanConnected && method === "qr" ? steps.findIndex(s => s.key === "name") : undefined;

  return { steps, forceIndex, finalChatId, name, connect };
}

export function useAddRecipientSteps() {
  const logic = useAddRecipientStepsLogic();
  const { steps, forceIndex } = logic;
  return { steps, forceIndex, ...logic };
}

export function AddRecipientWizard({ onClose, onAdded }) {
  const { t } = useTranslation();
  const logic = useAddRecipientStepsLogic();
  const { steps, forceIndex, finalChatId, name, connect } = logic;
  const { addRecipient } = connect;
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    if (completing || !finalChatId?.trim() || !name.trim()) return;
    setCompleting(true);
    try {
      await addRecipient({ chatId: finalChatId.trim(), name: name.trim() });
      onAdded?.();
      onClose?.();
    } catch { /* toast shown by hook */ }
    finally { setCompleting(false); }
  }

  return (
    <ChannelConnectWizard
      onClose={onClose} onComplete={handleComplete} nextDisabled={completing}
      icon={User} accent={ACCENT}
      title={t("telegram.addRecipientWizard")} subtitle={t("telegram.chooseConnectMethod")}
      steps={steps.map((s, i) => ({
        ...s,
        nextLabel: i === steps.length - 2 ? t("telegram.addRecipientWizard") : undefined,
      }))}
      forceIndex={forceIndex}
    />
  );
}
