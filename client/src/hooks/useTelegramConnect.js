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
