import React, { useEffect, useMemo, useState } from "react";
import { MessageCircle, Copy, ExternalLink, Send, AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../ui/Modal";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { buildWhatsAppReceiptMessage, normalizeEgyptPhone } from "../../utils/whatsappReceiptMessage";

export default function WhatsAppSendModal({ open, onClose, invoice, kind = "receipt", title }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState("");
  const [shopName, setShopName] = useState("");

  const customerName = invoice?.customer_name || invoice?.walk_in_name || "";
  const rawPhone = invoice?.customer_phone || invoice?.walk_in_phone || "";

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
      api.get("/api/settings").catch(() => ({ data: { data: {} } })),
    ]).then(([templatesRes, settingsRes]) => {
      const rows = templatesRes.data?.data || [];
      const matched = rows.find((x) => x.kind === kind) || rows.find((x) => x.kind === "receipt");
      setTemplate(matched?.body || "");
      setShopName(settingsRes.data?.data?.company_name || "");
    }).catch(() => {
      setTemplate("");
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
    });
  }, [template, customerName, invoice, shopName]);

  const waMeUrl = useMemo(() => {
    if (!phone || !message) return "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [phone, message]);

  async function handleSend() {
    if (!phone) {
      toast.error(t("whatsapp.noPhone"));
      return;
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

  function handleCopy() {
    if (!message) return;
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
                disabled={sending || !phone || !message}
                className="col-span-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
              >
                {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? t("common.sending") : t("whatsapp.send")}
              </button>
              <button
                onClick={() => waMeUrl && window.open(waMeUrl, "_blank", "noopener,noreferrer")}
                disabled={!waMeUrl}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                title={t("whatsapp.openInWhatsApp")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                onClick={handleCopy}
                disabled={!message}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
                title={t("whatsapp.copyMessage")}
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("common.copy")}</span>
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
