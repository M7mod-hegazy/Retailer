import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "../services/api";

const POLL_INTERVAL_MS = 3000;
const DEBOUNCE_MS = 800;

function hasAnyRecipient(recipients) {
  return Array.isArray(recipients) && recipients.some((r) => r.enabled && r.chatId);
}

export function useTelegramConnect(onSaved) {
  const { t } = useTranslation();
  const [config, setConfig] = useState({
    telegram_enabled: false,
    telegram_bot_token: "",
    telegram_chat_id: "",
    telegram_api_base: "https://api.telegram.org",
  });
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [scanConnected, setScanConnected] = useState(false);
  const [pollStatus, setPollStatus] = useState("idle");

  // Bot validation (auto-validate on paste)
  const [botInfo, setBotInfo] = useState(null); // { username, name, id }
  const [validating, setValidating] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Phone pairing
  const [pairing, setPairing] = useState(null); // { code, url }
  const [pairingPollTimer, setPairingPollTimer] = useState(null);

  const pollAbortRef = useRef(null);
  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const debounceRef = useRef(null);
  const lastValidatedToken = useRef("");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    Promise.all([
      api.get("/api/settings"),
      api.get("/api/telegram/recipients").catch(() => ({ data: { data: [] } })),
    ]).then(([settingsRes, recipientsRes]) => {
      if (!mountedRef.current) return;
      const d = settingsRes.data?.data || {};
      const loaded = {
        telegram_enabled: Boolean(d.telegram_enabled),
        telegram_bot_token: d.telegram_bot_token || "",
        telegram_chat_id: d.telegram_chat_id || "",
        telegram_api_base: d.telegram_api_base || "https://api.telegram.org",
      };
      setConfig(loaded);
      const loadedRecipients = (recipientsRes.data?.data || []).map(recipientFromApi);
      setRecipients(loadedRecipients);
      setSaved(loaded.telegram_enabled && Boolean(loaded.telegram_bot_token) && hasAnyRecipient(loadedRecipients));
      if (loaded.telegram_bot_token) lastValidatedToken.current = loaded.telegram_bot_token;
    }).catch(() => { if (mountedRef.current) setLoadError(true); }).finally(() => { if (mountedRef.current) setLoading(false); });
  }, []);

  // Auto-validate bot token when it changes (debounced)
  useEffect(() => {
    const token = config.telegram_bot_token.trim();
    if (!token || token === lastValidatedToken.current) { setBotInfo(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBotInfo(null);
    setValidating(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.post("/api/telegram/bot-info", {
          bot_token: token,
          api_base: config.telegram_api_base?.trim() || undefined,
        }, { validateStatus: s => s < 500 });
        if (!mountedRef.current) return;
        if (r.data?.found !== false && r.data?.data) {
          setBotInfo(r.data.data);
          lastValidatedToken.current = token;
          // Auto-generate QR after valid token
          if (!qrData) {
            generateDeepLinkForToken(token);
          }
        }
      } catch { /* ignore */ }
      finally { if (mountedRef.current) setValidating(false); }
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.telegram_bot_token, config.telegram_api_base]);

  async function detectChatId() {
    if (!config.telegram_bot_token.trim()) { toast.error(t("telegram.detectNeedsToken")); return; }
    setDetecting(true);
    try {
      const r = await api.post("/api/telegram/detect-chat-id", {
        bot_token: config.telegram_bot_token.trim(),
        api_base: config.telegram_api_base?.trim() || undefined,
      }, { validateStatus: s => s < 500 });
      const body = r.data;
      if (body?.found === false) {
        toast.error(t("telegram.detectNothing"), { duration: 4000 });
      } else if (body?.data?.chatId) {
        setConfig(c => ({ ...c, telegram_chat_id: body.data.chatId }));
        toast.success(body.data.chatName ? t("telegram.detectFound", { name: body.data.chatName }) : t("telegram.detectFoundNoName"));
      } else if (body?.success === false) {
        toast.error(body.message || t("telegram.detectError"));
      }
    } catch (e) { toast.error(e.response?.data?.message || t("telegram.detectError")); }
    finally { setDetecting(false); }
  }

  async function generateDeepLinkForToken(token) {
    setGeneratingQr(true);
    setScanConnected(false);
    try {
      const r = await api.post("/api/telegram/deep-link", {
        bot_token: token,
        api_base: config.telegram_api_base?.trim() || undefined,
      });
      if (r.data?.data?.qr) setQrData(r.data.data);
    } catch (e) { /* silent — auto-gen should not show errors */ }
    finally { setGeneratingQr(false); }
  }

  async function generateDeepLink() {
    if (!config.telegram_bot_token.trim()) { toast.error(t("telegram.detectNeedsToken")); return; }
    await generateDeepLinkForToken(config.telegram_bot_token.trim());
  }

  const pollForScan = useCallback(async () => {
    if (!mountedRef.current) return;
    const token = config.telegram_bot_token.trim();
    if (!token) return;

    if (pollAbortRef.current) pollAbortRef.current.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    try {
      setPollStatus("polling");
      const r = await api.post("/api/telegram/detect-chat-id", {
        bot_token: token,
        api_base: config.telegram_api_base?.trim() || undefined,
      }, {
        validateStatus: () => true,
        signal: controller.signal,
      });

      if (!mountedRef.current || controller.signal.aborted) return;

      if (r.status === 200 && r.data?.found !== false && r.data?.data?.chatId) {
        const chat = r.data.data;
        setConfig(c => ({ ...c, telegram_chat_id: chat.chatId, telegram_enabled: true }));
        // Auto-create a recipient from the scanned chat if no matching one exists.
        setRecipients((prev) => {
          const exists = prev.some((rec) => rec.chatId === String(chat.chatId));
          if (exists) return prev;
          const newRec = createRecipient();
          newRec.name = chat.chatName || newRec.name;
          newRec.chatId = String(chat.chatId);
          // Fire-and-forget save; the user still needs to press Save for the backend.
          return [...prev, newRec];
        });
        setScanConnected(true);
        setPollStatus("connected");
        toast.success(chat.chatName ? t("telegram.detectFound", { name: chat.chatName }) : t("telegram.detectFoundNoName"));
      } else {
        setPollStatus("polling");
      }
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      if (!mountedRef.current) return;
      setPollStatus("error");
    }
  }, [config.telegram_bot_token, config.telegram_api_base, t]);

  useEffect(() => {
    if (!qrData || scanConnected) {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
      if (pollAbortRef.current) { pollAbortRef.current.abort(); pollAbortRef.current = null; }
      if (scanConnected) setPollStatus("connected");
      return;
    }
    pollForScan();
    pollTimerRef.current = setInterval(pollForScan, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
      if (pollAbortRef.current) { pollAbortRef.current.abort(); pollAbortRef.current = null; }
    };
  }, [qrData, scanConnected, pollForScan]);

  // ── Phone pairing ──────────────────────────────────────────────────
  async function startPairing() {
    try {
      const r = await api.post("/api/telegram/pairing/start");
      if (r.data?.data) setPairing(r.data.data);
    } catch (e) { toast.error(e.response?.data?.message || "تعذّر بدء الربط"); }
  }

  function cancelPairing() {
    if (pairing?.code) api.delete(`/api/telegram/pairing/${pairing.code}`).catch(() => {});
    if (pairingPollTimer) { clearInterval(pairingPollTimer); setPairingPollTimer(null); }
    setPairing(null);
  }

  useEffect(() => {
    if (!pairing?.code) return;
    const timer = setInterval(async () => {
      try {
        const r = await api.get(`/api/telegram/pairing/${pairing.code}/status`);
        if (r.data?.found && r.data?.data?.token) {
          setConfig(c => ({ ...c, telegram_bot_token: r.data.data.token }));
          cancelPairing();
          toast.success(t("telegram.pairingReceived"));
        }
      } catch { /* ignore */ }
    }, 2000);
    setPairingPollTimer(timer);
    return () => { clearInterval(timer); setPairingPollTimer(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing?.code]);

  async function save() {
    if (config.telegram_enabled && (!config.telegram_bot_token.trim() || !hasAnyRecipient(recipients))) {
      toast.error(t("telegram.validation"));
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/settings", {
        telegram_enabled: config.telegram_enabled,
        telegram_bot_token: config.telegram_bot_token,
        telegram_api_base: config.telegram_api_base,
      });
      // Persist all recipients.
      await saveRecipients();
      setSaved(config.telegram_enabled && Boolean(config.telegram_bot_token.trim()) && hasAnyRecipient(recipients));
      toast.success(config.telegram_enabled ? t("telegram.saveSuccessOn") : t("telegram.saveSuccessOff"));
      onSaved?.();
    } catch (e) {
      const msg = e.response?.data?.message || t("telegram.saveError");
      toast.error(msg);
      console.error("[telegram] save failed:", e.response?.status, msg);
    }
    finally { setSaving(false); }
  }

  async function sendTest(chatId) {
    setTesting(true);
    try {
      await api.post("/api/telegram/test", { chat_id: chatId });
      toast.success(t("telegram.testSuccess"));
    } catch (e) { toast.error(e.response?.data?.message || t("telegram.testError")); }
    finally { setTesting(false); }
  }

  function createRecipient() {
    return {
      name: "",
      chatId: config.telegram_chat_id || "",
      enabled: true,
      notifyNewInvoice: true,
      notifyDailyClose: true,
      notifyLargeAmounts: true,
      notifyReturnsVoids: true,
      notifyPurchasesPayments: true,
      notifyCustomerCreated: true,
      notifySupplierCreated: true,
      notifyExpenseCreated: true,
      notifyReturnPayment: true,
      notifyLowStock: true,
      notifySystem: true,
      notifyWeekly: false,
      notifyMonthly: false,
      notifyYearly: false,
      // Extended events (migration 194)
      notifyStockTransfer: true,
      notifyInventoryAdjustment: true,
      notifyNewProduct: true,
      notifyPriceChange: true,
      notifyBatchExpiry: true,
      notifyPhysicalCount: true,
      notifySupplierPayment: true,
      notifyDebtPayment: true,
      notifyInstallmentPaid: true,
      notifyPurchaseVoided: true,
      notifyPurchaseReturn: true,
      notifyBranchTransfer: true,
      notifyPasswordChanged: true,
      notifyPermissionChanged: true,
      notifySupervisorOverride: true,
      notifyRepairCreated: true,
      notifyRepairReady: true,
      notifyRepairDelivered: true,
      notifyRevenueCreated: true,
      notifyWithdrawalCreated: true,
      notifyEmployeeCreated: true,
      notifySalarySettled: true,
      notifyAdvanceCreated: true,
      notifyDeductionCreated: true,
      notifyBonusCreated: true,
      eventPresets: {},
    };
  }

  function updateRecipientLocal(index, patch) {
    setRecipients((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function persistRecipient(recipient) {
    const payload = recipientToApi(recipient);
    if (recipient.id) {
      const r = await api.put(`/api/telegram/recipients/${recipient.id}`, payload);
      return r.data?.data ? recipientFromApi(r.data.data) : recipient;
    }
    const r = await api.post("/api/telegram/recipients", payload);
    return recipientFromApi(r.data?.data);
  }

  async function addRecipient(overrides = {}) {
    const newRec = { ...createRecipient(), ...overrides };
    const saved = await persistRecipient(newRec);
    setRecipients((prev) => [...prev, saved]);
    return saved;
  }

  async function saveRecipients() {
    const saved = [];
    for (const recipient of recipients) {
      saved.push(await persistRecipient(recipient));
    }
    setRecipients(saved);
  }

  async function deleteRecipient(index) {
    const recipient = recipients[index];
    if (recipient?.id) {
      await api.delete(`/api/telegram/recipients/${recipient.id}`);
    }
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveSingleRecipient(index) {
    const recipient = recipients[index];
    if (!recipient) return;
    const saved = await persistRecipient(recipient);
    setRecipients((prev) => prev.map((r, i) => i === index ? saved : r));
    return saved;
  }

  async function refreshRecipients() {
    try {
      const r = await api.get("/api/telegram/recipients").catch(() => ({ data: { data: [] } }));
      const loadedRecipients = (r.data?.data || []).map(recipientFromApi);
      setRecipients(loadedRecipients);
    } catch { /* silent */ }
  }

  function recipientToApi(r) {
    return {
      name: r.name,
      chat_id: r.chatId,
      enabled: r.enabled,
      notify_new_invoice: r.notifyNewInvoice,
      notify_daily_close: r.notifyDailyClose,
      notify_large_amounts: r.notifyLargeAmounts,
      notify_returns_voids: r.notifyReturnsVoids,
      notify_purchases_payments: r.notifyPurchasesPayments,
      notify_customer_created: r.notifyCustomerCreated,
      notify_supplier_created: r.notifySupplierCreated,
      notify_expense_created: r.notifyExpenseCreated,
      notify_return_payment: r.notifyReturnPayment,
      notify_low_stock: r.notifyLowStock,
      notify_system: r.notifySystem,
      notify_weekly: r.notifyWeekly,
      notify_monthly: r.notifyMonthly,
      notify_yearly: r.notifyYearly,
      // Extended events (migration 194)
      notify_stock_transfer: r.notifyStockTransfer,
      notify_inventory_adjustment: r.notifyInventoryAdjustment,
      notify_new_product: r.notifyNewProduct,
      notify_price_change: r.notifyPriceChange,
      notify_batch_expiry: r.notifyBatchExpiry,
      notify_physical_count: r.notifyPhysicalCount,
      notify_supplier_payment: r.notifySupplierPayment,
      notify_debt_payment: r.notifyDebtPayment,
      notify_installment_paid: r.notifyInstallmentPaid,
      notify_purchase_voided: r.notifyPurchaseVoided,
      notify_purchase_return: r.notifyPurchaseReturn,
      notify_branch_transfer: r.notifyBranchTransfer,
      notify_password_changed: r.notifyPasswordChanged,
      notify_permission_changed: r.notifyPermissionChanged,
      notify_supervisor_override: r.notifySupervisorOverride,
      notify_repair_created: r.notifyRepairCreated,
      notify_repair_ready: r.notifyRepairReady,
      notify_repair_delivered: r.notifyRepairDelivered,
      notify_revenue_created: r.notifyRevenueCreated,
      notify_withdrawal_created: r.notifyWithdrawalCreated,
      notify_employee_created: r.notifyEmployeeCreated,
      notify_salary_settled: r.notifySalarySettled,
      notify_advance_created: r.notifyAdvanceCreated,
      notify_deduction_created: r.notifyDeductionCreated,
      notify_bonus_created: r.notifyBonusCreated,
      event_presets: r.eventPresets || {},
    };
  }

  function recipientFromApi(r) {
    return {
      id: r.id,
      name: r.name || "",
      chatId: r.chat_id || "",
      enabled: Boolean(r.enabled),
      notifyNewInvoice: Boolean(r.notify_new_invoice),
      notifyDailyClose: Boolean(r.notify_daily_close),
      notifyLargeAmounts: Boolean(r.notify_large_amounts),
      notifyReturnsVoids: Boolean(r.notify_returns_voids),
      notifyPurchasesPayments: Boolean(r.notify_purchases_payments),
      notifyCustomerCreated: Boolean(r.notify_customer_created),
      notifySupplierCreated: Boolean(r.notify_supplier_created),
      notifyExpenseCreated: Boolean(r.notify_expense_created),
      notifyReturnPayment: Boolean(r.notify_return_payment),
      notifyLowStock: Boolean(r.notify_low_stock),
      notifySystem: Boolean(r.notify_system),
      notifyWeekly: Boolean(r.notify_weekly),
      notifyMonthly: Boolean(r.notify_monthly),
      notifyYearly: Boolean(r.notify_yearly),
      // Extended events (migration 194)
      notifyStockTransfer: Boolean(r.notify_stock_transfer),
      notifyInventoryAdjustment: Boolean(r.notify_inventory_adjustment),
      notifyNewProduct: Boolean(r.notify_new_product),
      notifyPriceChange: Boolean(r.notify_price_change),
      notifyBatchExpiry: Boolean(r.notify_batch_expiry),
      notifyPhysicalCount: Boolean(r.notify_physical_count),
      notifySupplierPayment: Boolean(r.notify_supplier_payment),
      notifyDebtPayment: Boolean(r.notify_debt_payment),
      notifyInstallmentPaid: Boolean(r.notify_installment_paid),
      notifyPurchaseVoided: Boolean(r.notify_purchase_voided),
      notifyPurchaseReturn: Boolean(r.notify_purchase_return),
      notifyBranchTransfer: Boolean(r.notify_branch_transfer),
      notifyPasswordChanged: Boolean(r.notify_password_changed),
      notifyPermissionChanged: Boolean(r.notify_permission_changed),
      notifySupervisorOverride: Boolean(r.notify_supervisor_override),
      notifyRepairCreated: Boolean(r.notify_repair_created),
      notifyRepairReady: Boolean(r.notify_repair_ready),
      notifyRepairDelivered: Boolean(r.notify_repair_delivered),
      notifyRevenueCreated: Boolean(r.notify_revenue_created),
      notifyWithdrawalCreated: Boolean(r.notify_withdrawal_created),
      notifyEmployeeCreated: Boolean(r.notify_employee_created),
      notifySalarySettled: Boolean(r.notify_salary_settled),
      notifyAdvanceCreated: Boolean(r.notify_advance_created),
      notifyDeductionCreated: Boolean(r.notify_deduction_created),
      notifyBonusCreated: Boolean(r.notify_bonus_created),
      eventPresets: parseEventPresets(r.eventPresets ?? r.event_presets),
    };
  }

  function parseEventPresets(raw) {
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    }
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
    return {};
  }

  async function fetchHistory(limit = 50) {
    setLoadingHistory(true);
    try {
      const r = await api.get("/api/telegram/history", { params: { limit } });
      setHistory(r.data?.data || []);
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  }

  function clearConnectionState() {
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    if (pollAbortRef.current) { pollAbortRef.current.abort(); pollAbortRef.current = null; }
    if (pairingPollTimer) { clearInterval(pairingPollTimer); setPairingPollTimer(null); }
    if (pairing?.code) api.delete(`/api/telegram/pairing/${pairing.code}`).catch(() => {});
    setQrData(null);
    setScanConnected(false);
    setPollStatus("idle");
    setBotInfo(null);
    lastValidatedToken.current = "";
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await api.post("/api/telegram/disconnect");
      clearConnectionState();
      setConfig(c => ({
        ...c,
        telegram_enabled: false,
        telegram_bot_token: "",
        telegram_chat_id: "",
      }));
      setRecipients([]);
      setSaved(false);
      toast.success(t("telegram.disconnected"));
    } catch (e) {
      toast.error(e.response?.data?.message || t("telegram.disconnectError"));
    } finally { setDisconnecting(false); }
  }

  return {
    config, setConfig, loading, loadError, saving, saved, testing, detecting,
    disconnecting,
    recipients, setRecipients,
    createRecipient, updateRecipientLocal, addRecipient, saveRecipients, deleteRecipient, saveSingleRecipient, refreshRecipients,
    qrData, generatingQr, scanConnected, pollStatus,
    botInfo, validating,
    pairing, startPairing, cancelPairing,
    history, loadingHistory, fetchHistory,
    detectChatId, generateDeepLink, save, sendTest, disconnect,
  };
}
