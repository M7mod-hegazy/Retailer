import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import api from "../services/api";

const POLL_INTERVAL_MS = 3000;
const DEBOUNCE_MS = 800;

function hasAnyRecipient(recipients) {
  return Array.isArray(recipients) && recipients.some((r) => r.enabled && r.chatId);
}

function readBool(r, snake, camel, defaultValue = false) {
  if (r[snake] !== undefined && r[snake] !== null) return Boolean(r[snake]);
  if (r[camel] !== undefined && r[camel] !== null) return Boolean(r[camel]);
  return defaultValue;
}

function configSnapshot(config) {
  return {
    telegram_enabled: Boolean(config.telegram_enabled),
    telegram_bot_token: config.telegram_bot_token || "",
    telegram_api_base: config.telegram_api_base || "https://api.telegram.org",
    telegram_status_chip_enabled: config.telegram_status_chip_enabled !== false,
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

export const TELEGRAM_PRESET_DETAILED = "قياسي — مفصل";
export const TELEGRAM_PRESET_BRIEF = "مختصر — سريع";
export const TELEGRAM_PRESET_OPTIONS = [TELEGRAM_PRESET_DETAILED, TELEGRAM_PRESET_BRIEF];

const RECIPIENT_FIELD_DEFAULTS = {
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
  notifyRepairOrder: true,
  // New edit/delete events (migration 201)
  notifyExpenseEdited: true,
  notifyExpenseDeleted: true,
  notifyRevenueEdited: true,
  notifyRevenueDeleted: true,
  // Return lifecycle sub-events (migration 210)
  telegram_sales_return_edited: true,
  telegram_sales_return_cancelled: true,
  telegram_purchase_return_edited: true,
  // Sub-event toggles (persisted server-side since migration 208)
  telegram_invoice_edited: true,
  telegram_invoice_amended: true,
  telegram_purchase_edited: true,
  telegram_purchase_return_cancelled: true,
  telegram_branch_transfer_edited: true,
  telegram_branch_transfer_cancelled: true,
  telegram_withdrawal_edited: true,
  telegram_withdrawal_deleted: true,
};

function pickField(r, key) {
  const value = r?.[key];
  if (value !== undefined && value !== null) return value;
  return RECIPIENT_FIELD_DEFAULTS[key];
}

function recipientToApi(r) {
  const repairOn = r.notifyRepairOrder !== undefined
    ? r.notifyRepairOrder
    : (pickField(r, "notifyRepairCreated") && pickField(r, "notifyRepairReady") && pickField(r, "notifyRepairDelivered"));
  return {
    name: r.name || "",
    chat_id: String(r.chatId || "").trim(),
    enabled: Boolean(pickField(r, "enabled")),
    notify_new_invoice: Boolean(pickField(r, "notifyNewInvoice")),
    notify_daily_close: Boolean(pickField(r, "notifyDailyClose")),
    notify_large_amounts: Boolean(pickField(r, "notifyLargeAmounts")),
    notify_returns_voids: Boolean(pickField(r, "notifyReturnsVoids")),
    notify_purchases_payments: Boolean(pickField(r, "notifyPurchasesPayments")),
    notify_customer_created: Boolean(pickField(r, "notifyCustomerCreated")),
    notify_supplier_created: Boolean(pickField(r, "notifySupplierCreated")),
    notify_expense_created: Boolean(pickField(r, "notifyExpenseCreated")),
    notify_return_payment: Boolean(pickField(r, "notifyReturnPayment")),
    notify_low_stock: Boolean(pickField(r, "notifyLowStock")),
    notify_system: Boolean(pickField(r, "notifySystem")),
    notify_weekly: Boolean(pickField(r, "notifyWeekly")),
    notify_monthly: Boolean(pickField(r, "notifyMonthly")),
    notify_yearly: Boolean(pickField(r, "notifyYearly")),
    notify_stock_transfer: Boolean(pickField(r, "notifyStockTransfer")),
    notify_inventory_adjustment: Boolean(pickField(r, "notifyInventoryAdjustment")),
    notify_new_product: Boolean(pickField(r, "notifyNewProduct")),
    notify_price_change: Boolean(pickField(r, "notifyPriceChange")),
    notify_batch_expiry: Boolean(pickField(r, "notifyBatchExpiry")),
    notify_physical_count: Boolean(pickField(r, "notifyPhysicalCount")),
    notify_supplier_payment: Boolean(pickField(r, "notifySupplierPayment")),
    notify_debt_payment: Boolean(pickField(r, "notifyDebtPayment")),
    notify_installment_paid: Boolean(pickField(r, "notifyInstallmentPaid")),
    notify_purchase_voided: Boolean(pickField(r, "notifyPurchaseVoided")),
    notify_purchase_return: Boolean(pickField(r, "notifyPurchaseReturn")),
    notify_branch_transfer: Boolean(pickField(r, "notifyBranchTransfer")),
    notify_password_changed: Boolean(pickField(r, "notifyPasswordChanged")),
    notify_permission_changed: Boolean(pickField(r, "notifyPermissionChanged")),
    notify_supervisor_override: Boolean(pickField(r, "notifySupervisorOverride")),
    notify_repair_created: Boolean(repairOn),
    notify_repair_ready: Boolean(repairOn),
    notify_repair_delivered: Boolean(repairOn),
    notify_revenue_created: Boolean(pickField(r, "notifyRevenueCreated")),
    notify_withdrawal_created: Boolean(pickField(r, "notifyWithdrawalCreated")),
    notify_employee_created: Boolean(pickField(r, "notifyEmployeeCreated")),
    notify_salary_settled: Boolean(pickField(r, "notifySalarySettled")),
    notify_advance_created: Boolean(pickField(r, "notifyAdvanceCreated")),
    notify_deduction_created: Boolean(pickField(r, "notifyDeductionCreated")),
    notify_bonus_created: Boolean(pickField(r, "notifyBonusCreated")),
    // New edit/delete events (migration 201)
    notify_expense_edited: Boolean(pickField(r, "notifyExpenseEdited")),
    notify_expense_deleted: Boolean(pickField(r, "notifyExpenseDeleted")),
    notify_revenue_edited: Boolean(pickField(r, "notifyRevenueEdited")),
    notify_revenue_deleted: Boolean(pickField(r, "notifyRevenueDeleted")),
    // Return lifecycle sub-events (migration 210)
    notify_sales_return_edited: Boolean(pickField(r, "telegram_sales_return_edited")),
    notify_sales_return_cancelled: Boolean(pickField(r, "telegram_sales_return_cancelled")),
    notify_purchase_return_edited: Boolean(pickField(r, "telegram_purchase_return_edited")),
    // Edit/cancel sub-events — real per-recipient columns since migration 208
    notify_invoice_edited: Boolean(pickField(r, "telegram_invoice_edited")),
    notify_invoice_amended: Boolean(pickField(r, "telegram_invoice_amended")),
    notify_purchase_edited: Boolean(pickField(r, "telegram_purchase_edited")),
    notify_purchase_return_cancelled: Boolean(pickField(r, "telegram_purchase_return_cancelled")),
    notify_branch_transfer_edited: Boolean(pickField(r, "telegram_branch_transfer_edited")),
    notify_branch_transfer_cancelled: Boolean(pickField(r, "telegram_branch_transfer_cancelled")),
    notify_withdrawal_edited: Boolean(pickField(r, "telegram_withdrawal_edited")),
    notify_withdrawal_deleted: Boolean(pickField(r, "telegram_withdrawal_deleted")),
    event_presets: parseEventPresets(r.eventPresets ?? r.event_presets),
  };
}

function recipientFromApi(r) {
  const notifyRepairCreated = readBool(r, "notify_repair_created", "notifyRepairCreated", true);
  const notifyRepairReady = readBool(r, "notify_repair_ready", "notifyRepairReady", true);
  const notifyRepairDelivered = readBool(r, "notify_repair_delivered", "notifyRepairDelivered", true);
  return {
    id: r.id,
    name: r.name || "",
    chatId: r.chat_id || r.chatId || "",
    enabled: readBool(r, "enabled", "enabled", false),
    notifyNewInvoice: readBool(r, "notify_new_invoice", "notifyNewInvoice", true),
    notifyDailyClose: readBool(r, "notify_daily_close", "notifyDailyClose", true),
    notifyLargeAmounts: readBool(r, "notify_large_amounts", "notifyLargeAmounts", true),
    notifyReturnsVoids: readBool(r, "notify_returns_voids", "notifyReturnsVoids", true),
    notifyPurchasesPayments: readBool(r, "notify_purchases_payments", "notifyPurchasesPayments", true),
    notifyCustomerCreated: readBool(r, "notify_customer_created", "notifyCustomerCreated", true),
    notifySupplierCreated: readBool(r, "notify_supplier_created", "notifySupplierCreated", true),
    notifyExpenseCreated: readBool(r, "notify_expense_created", "notifyExpenseCreated", true),
    notifyReturnPayment: readBool(r, "notify_return_payment", "notifyReturnPayment", true),
    notifyLowStock: readBool(r, "notify_low_stock", "notifyLowStock", true),
    notifySystem: readBool(r, "notify_system", "notifySystem", true),
    notifyWeekly: readBool(r, "notify_weekly", "notifyWeekly", false),
    notifyMonthly: readBool(r, "notify_monthly", "notifyMonthly", false),
    notifyYearly: readBool(r, "notify_yearly", "notifyYearly", false),
    notifyStockTransfer: readBool(r, "notify_stock_transfer", "notifyStockTransfer", true),
    notifyInventoryAdjustment: readBool(r, "notify_inventory_adjustment", "notifyInventoryAdjustment", true),
    notifyNewProduct: readBool(r, "notify_new_product", "notifyNewProduct", true),
    notifyPriceChange: readBool(r, "notify_price_change", "notifyPriceChange", true),
    notifyBatchExpiry: readBool(r, "notify_batch_expiry", "notifyBatchExpiry", true),
    notifyPhysicalCount: readBool(r, "notify_physical_count", "notifyPhysicalCount", true),
    notifySupplierPayment: readBool(r, "notify_supplier_payment", "notifySupplierPayment", true),
    notifyDebtPayment: readBool(r, "notify_debt_payment", "notifyDebtPayment", true),
    notifyInstallmentPaid: readBool(r, "notify_installment_paid", "notifyInstallmentPaid", true),
    notifyPurchaseVoided: readBool(r, "notify_purchase_voided", "notifyPurchaseVoided", true),
    notifyPurchaseReturn: readBool(r, "notify_purchase_return", "notifyPurchaseReturn", true),
    notifyBranchTransfer: readBool(r, "notify_branch_transfer", "notifyBranchTransfer", true),
    notifyPasswordChanged: readBool(r, "notify_password_changed", "notifyPasswordChanged", true),
    notifyPermissionChanged: readBool(r, "notify_permission_changed", "notifyPermissionChanged", true),
    notifySupervisorOverride: readBool(r, "notify_supervisor_override", "notifySupervisorOverride", true),
    notifyRepairCreated,
    notifyRepairReady,
    notifyRepairDelivered,
    notifyRepairOrder: notifyRepairCreated && notifyRepairReady && notifyRepairDelivered,
    notifyRevenueCreated: readBool(r, "notify_revenue_created", "notifyRevenueCreated", true),
    notifyWithdrawalCreated: readBool(r, "notify_withdrawal_created", "notifyWithdrawalCreated", true),
    notifyEmployeeCreated: readBool(r, "notify_employee_created", "notifyEmployeeCreated", true),
    notifySalarySettled: readBool(r, "notify_salary_settled", "notifySalarySettled", true),
    notifyAdvanceCreated: readBool(r, "notify_advance_created", "notifyAdvanceCreated", true),
    notifyDeductionCreated: readBool(r, "notify_deduction_created", "notifyDeductionCreated", true),
    notifyBonusCreated: readBool(r, "notify_bonus_created", "notifyBonusCreated", true),
    // New edit/delete events (migration 201)
    notifyExpenseEdited: readBool(r, "notify_expense_edited", "notifyExpenseEdited", true),
    notifyExpenseDeleted: readBool(r, "notify_expense_deleted", "notifyExpenseDeleted", true),
    notifyRevenueEdited: readBool(r, "notify_revenue_edited", "notifyRevenueEdited", true),
    notifyRevenueDeleted: readBool(r, "notify_revenue_deleted", "notifyRevenueDeleted", true),
    // Edit/cancel sub-events — persisted server-side since migration 208; the
    // UI keeps its historical telegram_* field names. Camel fallbacks cover the
    // notifyXxx keys the service layer exposes.
    telegram_sales_return_edited: readBool(r, "notify_sales_return_edited", "notifySalesReturnEdited", true),
    telegram_sales_return_cancelled: readBool(r, "notify_sales_return_cancelled", "notifySalesReturnCancelled", true),
    telegram_purchase_return_edited: readBool(r, "notify_purchase_return_edited", "notifyPurchaseReturnEdited", true),
    telegram_invoice_edited: readBool(r, "notify_invoice_edited", "notifyInvoiceEdited", true),
    telegram_invoice_amended: readBool(r, "notify_invoice_amended", "notifyInvoiceAmended", true),
    telegram_purchase_edited: readBool(r, "notify_purchase_edited", "notifyPurchaseEdited", true),
    telegram_purchase_return_cancelled: readBool(r, "notify_purchase_return_cancelled", "notifyPurchaseReturnCancelled", true),
    telegram_branch_transfer_edited: readBool(r, "notify_branch_transfer_edited", "notifyBranchTransferEdited", true),
    telegram_branch_transfer_cancelled: readBool(r, "notify_branch_transfer_cancelled", "notifyBranchTransferCancelled", true),
    telegram_withdrawal_edited: readBool(r, "notify_withdrawal_edited", "notifyWithdrawalEdited", true),
    telegram_withdrawal_deleted: readBool(r, "notify_withdrawal_deleted", "notifyWithdrawalDeleted", true),
    eventPresets: parseEventPresets(r.eventPresets ?? r.event_presets),
  };
}

function recipientsSnapshot(recipients) {
  return (recipients || []).map((r) => recipientToApi(r));
}

export function useTelegramConnect(onSaved) {
  const { t } = useTranslation();
  const [config, setConfig] = useState({
    telegram_enabled: false,
    telegram_bot_token: "",
    telegram_chat_id: "",
    telegram_api_base: "https://api.telegram.org",
    telegram_status_chip_enabled: true,
  });
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingInsights, setSendingInsights] = useState(false);
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
  const snapshotRef = useRef("");
  const recipientsRef = useRef([]);

  const syncSnapshot = useCallback((cfg, recs) => {
    snapshotRef.current = JSON.stringify({
      config: configSnapshot(cfg),
      recipients: recipientsSnapshot(recs),
    });
    setDirty(false);
  }, []);

  useEffect(() => {
    recipientsRef.current = recipients;
  }, [recipients]);

  useEffect(() => {
    if (loading || !snapshotRef.current) return;
    const current = JSON.stringify({
      config: configSnapshot(config),
      recipients: recipientsSnapshot(recipients),
    });
    setDirty(current !== snapshotRef.current);
  }, [config, recipients, loading]);

  // Auto-validate bot token when it changes (debounced)
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
        telegram_status_chip_enabled: d.telegram_status_chip_enabled === undefined || d.telegram_status_chip_enabled === null
          ? true
          : Boolean(d.telegram_status_chip_enabled),
      };
      setConfig(loaded);
      // Server-side migrateLegacyRecipientIfNeeded promotes a legacy
      // settings.telegram_chat_id into the recipients table, so the list is
      // used as-is — synthesizing an id-less recipient here caused duplicate
      // rows (POST instead of PUT on every save).
      const loadedRecipients = (recipientsRes.data?.data || []).map(recipientFromApi);
      setRecipients(loadedRecipients);
      setSaved(loaded.telegram_enabled && Boolean(loaded.telegram_bot_token) && hasAnyRecipient(loadedRecipients));
      if (loaded.telegram_bot_token) lastValidatedToken.current = loaded.telegram_bot_token;
      syncSnapshot(loaded, loadedRecipients);
    }).catch(() => { if (mountedRef.current) setLoadError(true); }).finally(() => { if (mountedRef.current) setLoading(false); });
  }, [syncSnapshot]);

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
        const chatId = String(body.data.chatId);
        setConfig(c => ({ ...c, telegram_chat_id: chatId }));
        setRecipients((prev) => {
          if (prev.length === 0) return prev;
          return prev.map((rec, idx) => idx === 0
            ? { ...rec, chatId, name: rec.name || body.data.chatName || rec.name }
            : rec);
        });
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
        telegram_status_chip_enabled: config.telegram_status_chip_enabled !== false,
      });
      // Persist all recipients.
      const savedRecipients = await saveRecipients();
      const nextSaved = config.telegram_enabled && Boolean(config.telegram_bot_token.trim()) && hasAnyRecipient(savedRecipients);
      setSaved(nextSaved);
      syncSnapshot(config, savedRecipients);
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

  // Build + send the smart-decisions report (تقرير القرارات الذكية) on demand to
  // all enabled recipients. Server returns {empty:true} when nothing actionable.
  async function sendInsightsNow() {
    setSendingInsights(true);
    try {
      const res = await api.post("/api/telegram/insights/send", {});
      const data = res.data?.data || {};
      if (data.empty) {
        toast(t("telegram.insightsEmpty", "لا توجد توصيات حالياً — كل المؤشرات سليمة ✅"), { icon: "✅" });
      } else {
        toast.success(t("telegram.insightsSent", `تم إرسال تقرير القرارات الذكية (${data.sent} مستلم)`));
      }
    } catch (e) {
      toast.error(e.response?.data?.message || t("telegram.insightsError", "تعذّر إرسال التقرير"));
    } finally {
      setSendingInsights(false);
    }
  }

  function createRecipient() {
    return {
      name: "",
      chatId: "",
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
      notifyRepairOrder: true,
      // New edit/delete events (migration 201)
      notifyExpenseEdited: true,
      notifyExpenseDeleted: true,
      notifyRevenueEdited: true,
      notifyRevenueDeleted: true,
      // Return lifecycle sub-events (migration 210)
      telegram_sales_return_edited: true,
      telegram_sales_return_cancelled: true,
      telegram_purchase_return_edited: true,
      // Sub-event toggles (persisted server-side)
      telegram_invoice_edited: true,
      telegram_invoice_amended: true,
      telegram_purchase_edited: true,
      telegram_purchase_return_cancelled: true,
      telegram_branch_transfer_edited: true,
      telegram_branch_transfer_cancelled: true,
      telegram_withdrawal_edited: true,
      telegram_withdrawal_deleted: true,
      eventPresets: {},
    };
  }

  function updateRecipientLocal(index, patch) {
    setRecipients((prev) => prev.map((r, i) => {
      if (i !== index) return r;
      const merged = { ...r, ...patch };
      if (patch.eventPresets) {
        merged.eventPresets = { ...(r.eventPresets || {}), ...patch.eventPresets };
      }
      return merged;
    }));
  }

  async function persistRecipient(recipient) {
    const payload = recipientToApi(recipient);
    try {
      if (recipient.id) {
        const r = await api.put(`/api/telegram/recipients/${recipient.id}`, payload);
        if (r.data?.success === false) throw new Error(r.data?.message || t("telegram.saveError"));
        return r.data?.data ? recipientFromApi(r.data.data) : recipient;
      }
      const r = await api.post("/api/telegram/recipients", payload);
      if (r.data?.success === false) throw new Error(r.data?.message || t("telegram.saveError"));
      return recipientFromApi(r.data?.data);
    } catch (e) {
      const msg = e.response?.data?.message || e.message || t("telegram.saveError");
      toast.error(msg);
      throw e;
    }
  }

  async function addRecipient(overrides = {}) {
    const newRec = { ...createRecipient(), ...overrides };
    const saved = await persistRecipient(newRec);
    // The server upserts by chat_id, so adding an already-registered chat
    // returns the existing row — replace it in place instead of appending.
    setRecipients((prev) => {
      const idx = prev.findIndex((p) => (saved.id && p.id === saved.id) || (saved.chatId && p.chatId === saved.chatId));
      if (idx >= 0) return prev.map((p, i) => (i === idx ? saved : p));
      return [...prev, saved];
    });
    return saved;
  }

  async function saveRecipients() {
    const saved = [];
    for (const recipient of recipientsRef.current) {
      saved.push(await persistRecipient(recipient));
    }
    setRecipients(saved);
    recipientsRef.current = saved;
    return saved;
  }

  async function deleteRecipient(index) {
    const list = recipientsRef.current;
    const recipient = list[index];
    try {
      if (recipient?.id) {
        await api.delete(`/api/telegram/recipients/${recipient.id}`);
      }
      const next = list.filter((_, i) => i !== index);
      setRecipients(next);
      recipientsRef.current = next;
      syncSnapshot(config, next);
      setSaved(config.telegram_enabled && Boolean(config.telegram_bot_token.trim()) && hasAnyRecipient(next));
    } catch (e) {
      const msg = e.response?.data?.message || e.message || t("telegram.deleteError");
      toast.error(msg);
      throw e;
    }
  }

  async function saveSingleRecipient(index, recipientOverride) {
    const recipient = recipientOverride || recipientsRef.current[index];
    if (!recipient) return;
    const saved = await persistRecipient(recipient);
    const nextRecipients = recipientsRef.current.map((r, i) => (i === index ? saved : r));
    setRecipients(nextRecipients);
    recipientsRef.current = nextRecipients;
    syncSnapshot(config, nextRecipients);
    return saved;
  }

  async function refreshRecipients() {
    try {
      const r = await api.get("/api/telegram/recipients").catch(() => ({ data: { data: [] } }));
      const loadedRecipients = (r.data?.data || []).map(recipientFromApi);
      setRecipients(loadedRecipients);
    } catch { /* silent */ }
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
      syncSnapshot({ telegram_enabled: false, telegram_bot_token: "", telegram_api_base: config.telegram_api_base }, []);
      toast.success(t("telegram.disconnected"));
    } catch (e) {
      toast.error(e.response?.data?.message || t("telegram.disconnectError"));
    } finally { setDisconnecting(false); }
  }

  return {
    config, setConfig, loading, loadError, saving, saved, dirty, testing, detecting,
    disconnecting,
    recipients, setRecipients,
    createRecipient, updateRecipientLocal, addRecipient, saveRecipients, deleteRecipient, saveSingleRecipient, refreshRecipients,
    qrData, generatingQr, scanConnected, pollStatus,
    botInfo, validating,
    pairing, startPairing, cancelPairing,
    history, loadingHistory, fetchHistory,
    detectChatId, generateDeepLink, save, sendTest, disconnect,
    sendInsightsNow, sendingInsights,
  };
}
