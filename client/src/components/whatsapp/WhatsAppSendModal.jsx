import React, { useEffect, useMemo, useState } from "react";
import { MessageCircle, Copy, ExternalLink, Send, AlertCircle, RefreshCw, Check, Wifi, WifiOff, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../ui/Modal";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { buildWhatsAppReceiptMessage, normalizeEgyptPhone } from "../../utils/whatsappReceiptMessage";
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";

function ConnectionBadge({ wa }) {
  const { t } = useTranslation();
  if (wa.status === "loading") return null;
  const map = {
    connected: { icon: Wifi, cls: "bg-success-bg border-success-border text-success-text", label: t("whatsapp.connected") || "متصل" },
    qr: { icon: Smartphone, cls: "bg-warning-bg border-warning-border text-warning-text animate-pulse", label: t("whatsapp.waitingScan") || "انتظار المسح" },
    connecting: { icon: RefreshCw, cls: "bg-bg-surface border-border-normal text-text-muted", label: t("whatsapp.connecting") || "جاري الاتصال..." },
    error: { icon: WifiOff, cls: "bg-danger-bg border-danger-border text-danger", label: t("whatsapp.connectFailed") || "خطأ" },
  };
  const fallback = { icon: WifiOff, cls: "bg-bg-surface border-border-normal text-text-muted", label: t("whatsapp.disconnected") || "غير متصل" };
  const { icon: Icon, cls, label } = map[wa.status] || fallback;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${cls}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${wa.status === "connecting" ? "animate-spin" : ""}`} />
      <span>{label}</span>
      {wa.status === "connected" && wa.phone && <span dir="ltr" className="text-[11px] font-mono opacity-70">{wa.phone}</span>}
      {wa.error && <span className="text-[11px] font-bold opacity-70 truncate max-w-[180px]">{wa.error}</span>}
    </div>
  );
}

export default function WhatsAppSendModal({ open, onClose, invoice, kind = "receipt", title, onBeforeSend }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const wa = useWhatsAppStatus(8000);
  const [template, setTemplate] = useState("");
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingFirst, setSavingFirst] = useState(false);
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");

  const customerName = invoice?.customer_name || invoice?.walk_in_name || "";
  const rawPhone = invoice?.customer_phone || invoice?.walk_in_phone || "";
  const invoiceItems = invoice?.lines || invoice?.items || [];

  useEffect(() => {
    if (open) {
      setPhone(normalizeEgyptPhone(rawPhone));
    }
  }, [open, rawPhone]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.get("/api/whatsapp/templates").catch(() => ({ data: { data: [] } })),
      api.get("/api/whatsapp/crm/template-variants").catch(() => ({ data: { data: [] } })),
      api.get("/api/settings").catch(() => ({ data: { data: {} } })),
    ]).then(([templatesRes, variantsRes, settingsRes]) => {
      const rows = templatesRes.data?.data || [];
      const matched = rows.find((x) => x.kind === kind) || rows.find((x) => x.kind === "receipt");
      setTemplate(matched?.body || "");

      const allVariants = variantsRes.data?.data || [];
      setVariants(allVariants.filter(v => v.category === kind));

      setShopName(settingsRes.data?.data?.company_name || "");
    }).catch(() => {
      setTemplate("");
      setVariants([]);
      setShopName("");
    }).finally(() => setLoading(false));
  }, [open, kind]);

  const message = useMemo(() => {
    return buildWhatsAppReceiptMessage({
      template,
      customerName,
      walkInName: invoice?.walk_in_name,
      invoiceNo: invoice?.invoice_no || invoice?.doc_no || invoice?.id,
      total: invoice?.total,
      shopName,
      createdAt: invoice?.created_at,
      paymentType: invoice?.payment_type || invoice?.paymentType,
      discount: invoice?.discount,
      itemsCount: invoiceItems.length || invoice?.items_count,
      cashierName: invoice?.created_by_username || invoice?.cashierName || invoice?.cashier,
      items: invoiceItems,
      payments: invoice?.payments,
    });
  }, [template, customerName, invoice, shopName, invoiceItems]);

  const waMeUrl = useMemo(() => {
    if (!phone || !message) return "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [phone, message]);

  async function handleSend() {
    if (!phone) {
      toast.error(t("whatsapp.noPhone"));
      return;
    }
    if (!wa.isConnected) {
      toast.error(t("whatsapp.notConnected") || "واتساب غير متصل — تأكد من الاتصال أولاً");
      return;
    }
    // Save the invoice first if a pre-save callback is provided
    if (onBeforeSend) {
      setSavingFirst(true);
      try { await onBeforeSend(); } catch { setSavingFirst(false); return; }
      setSavingFirst(false);
    }
    setSending(true);
    try {
      await api.post("/api/whatsapp/enqueue", {
        recipient_phone: phone,
        customer_id: invoice?.customer_id || null,
        kind,
        payload: { text: message },
      });
      toast.success(t("whatsapp.queued"));
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.message || t("whatsapp.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  async function handleOpenWhatsApp() {
    if (!waMeUrl) return;
    if (onBeforeSend) {
      setSavingFirst(true);
      try { await onBeforeSend(); } catch { setSavingFirst(false); return; }
      setSavingFirst(false);
    }
    window.open(waMeUrl, "_blank", "noopener,noreferrer");
    onClose?.();
  }

  async function handleCopy() {
    if (!message) return;
    if (onBeforeSend) {
      setSavingFirst(true);
      try { await onBeforeSend(); } catch { setSavingFirst(false); return; }
      setSavingFirst(false);
    }
    navigator.clipboard?.writeText(message).then(() => toast.success(t("whatsapp.copied")));
  }

  const hasPermission = !user || user.role === "dev" || user.role === "admin" ||
    (Array.isArray(user.permissions?.whatsapp_receipt) && user.permissions.whatsapp_receipt.includes("send"));

  if (!hasPermission) {
    return (
      <Modal open={open} onClose={onClose} title={title || t("whatsapp.sendReceipt")} showDetach={false}>
        <div className="flex flex-col items-center justify-center py-8 text-center" dir="rtl">
          <AlertCircle className="h-10 w-10 text-danger mb-3" />
          <p className="text-sm font-black text-text-primary">{t("permissions.denied")}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title || t("whatsapp.sendReceipt")} showDetach={false} maxWidth="max-w-lg">
      <div className="space-y-4" dir="rtl">
        <ConnectionBadge wa={wa} />

        {!wa.isConnected && wa.status !== "loading" && wa.status !== "qr" && (
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-warning-text shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-warning-text">
                {t("whatsapp.waNotConnected") || "واتساب غير متصل حالياً"}
              </p>
              <p className="text-[11px] font-bold text-text-secondary mt-0.5">
                {t("whatsapp.waNotConnectedHint") || "يمكنك نسخ الرسالة أو فتحها في واتساب يدوياً. للإرسال التلقائي، اربط واتساب أولاً من مركز الرسائل."}
              </p>
            </div>
          </div>
        )}

        {wa.status === "qr" && (
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5">
            <Smartphone className="h-4 w-4 text-warning-text shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-xs font-black text-warning-text">
                {t("whatsapp.waWaitingScan") || "واتساب في انتظار مسح QR"}
              </p>
              <p className="text-[11px] font-bold text-text-secondary mt-0.5">
                {t("whatsapp.waWaitingScanHint") || "امسح رمز QR من هاتفك لتفعيل الإرسال التلقائي."}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.recipient")}</label>
              <input
                dir="ltr"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(normalizeEgyptPhone(e.target.value))}
                placeholder="2010xxxxxxxx"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold font-mono outline-none focus:border-primary focus:bg-bg-surface transition-colors"
              />
            </div>

            {variants.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-black text-text-secondary">اختيار القالب</label>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map(v => (
                    <button key={v.id} onClick={() => setTemplate(v.body)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${
                        template === v.body
                          ? "bg-primary text-white border-primary"
                          : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"
                      }`}>
                      {template === v.body && <Check className="inline h-3 w-3 ml-1" />}
                      {v.label || "بدون اسم"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-black text-text-secondary">{t("whatsapp.preview")}</label>
              <textarea
                value={message}
                readOnly
                rows={7}
                className="w-full resize-none rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-medium leading-relaxed text-text-primary outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={handleSend}
                disabled={savingFirst || sending || !phone || !message || !wa.isConnected}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                title={!wa.isConnected ? (t("whatsapp.notConnected") || "واتساب غير متصل") : undefined}
              >
                {(sending || savingFirst) ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {savingFirst ? "جاري الحفظ..." : sending ? t("whatsapp.sending") : t("whatsapp.send")}
              </button>
              <button
                onClick={handleOpenWhatsApp}
                disabled={savingFirst || !waMeUrl}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                title={t("whatsapp.openInWhatsApp")}
              >
                {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                onClick={handleCopy}
                disabled={savingFirst || !message}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                title={t("whatsapp.copyMessage")}
              >
                {savingFirst ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{t("whatsapp.copy")}</span>
              </button>
            </div>

            {!phone && (
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-warning-text">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("whatsapp.noPhone")}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
