import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageSquare, Wifi, WifiOff, Smartphone, RefreshCw, Link, Unlink, Send, Users,
  Sparkles, BarChart3, Inbox, Megaphone, FileText, ChevronDown, ChevronUp,
  Search, X, CheckCircle, Clock, Zap, Info, Archive,
  MessageCircle, UserPlus, Mail, Globe,
  Bot, Check, Loader2, Image, Settings,
  Pause, Play, Trash2, Plus, Paperclip, Camera, Mic, MicOff,
  Download, Eye, File, FileType, Headphones, Maximize, Minimize,
  Upload, Reply, Smile, Copy, QrCode,
  Receipt, DollarSign, RotateCcw, CreditCard, Wallet, Building2, AlertTriangle,
  Monitor, CalendarDays, CalendarRange, Calendar, User,
  Package, Tags, ShoppingCart, Wrench, Shield, Key, Lock, UserCog,
  ArrowRightLeft, Banknote, CircleDollarSign, Timer, PackageCheck,
  ClipboardList, Landmark, BadgeAlert, HandCoins, Scan, Pencil,
} from "lucide-react";
import Badge from "../../components/ui/Badge";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { usePermission } from "../../hooks/usePermission";
import { usePageTour } from "../../hooks/usePageTour";
import html2canvas from "html2canvas";
import { motion } from "framer-motion";
import LayoutRenderer from "../../components/print/LayoutRenderer";
import { useWhatsAppStatus } from "../../hooks/useWhatsAppStatus";
import { useTelegramConnect, TELEGRAM_PRESET_DETAILED, TELEGRAM_PRESET_BRIEF, TELEGRAM_PRESET_OPTIONS } from "../../hooks/useTelegramConnect";
import { useSmsConnect } from "../../hooks/useSmsConnect";
import WhatsAppConnectWizard from "../../components/whatsapp/wizard/whatsappSteps";
import TelegramConnectWizard, { AddRecipientWizard } from "../../components/whatsapp/wizard/telegramSteps";
import SmsConnectWizard from "../../components/whatsapp/wizard/smsSteps";
import EmailConnectWizard from "../../components/whatsapp/wizard/emailSteps";
import MetaAdsWizard from "../../components/whatsapp/wizard/metaAdsSteps";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { useConfirm } from "../../hooks/useConfirm";

// ─── Shared components ───────────────────────────────────────────────────

function StatusDot({ status, size = "w-2 h-2" }) {
  const colors = {
    connected: "bg-success-text", sent: "bg-success-text", active: "bg-success-text",
    qr: "bg-warning-text", pending: "bg-warning-text",
    connecting: "bg-text-muted", loading: "bg-text-muted",
    disconnected: "bg-text-muted", failed: "bg-danger-text", error: "bg-danger-text",
    unavailable: "bg-danger-text", archived: "bg-text-muted",
  };
  const isPulse = ["connected", "active", "qr", "connecting", "loading"].includes(status);
  return (
    <span className={`relative flex shrink-0 ${size}`}>
      {isPulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${colors[status] || "bg-text-muted"}`} />
      )}
      <span className={`relative inline-flex rounded-full h-full w-full ${colors[status] || "bg-text-muted"}`} />
    </span>
  );
}

const CONTACT_TYPE_BADGE = {
  customer: { text: "عميل", cls: "bg-info-bg text-info-text border-info-border/30" },
  lead: { text: "عميل محتمل", cls: "bg-warning-bg text-warning-text border-warning-border/30" },
};
function ContactTypeBadge({ type, className = "" }) {
  const b = CONTACT_TYPE_BADGE[type] || { text: "رقم غير مسجل", cls: "bg-bg-base text-text-muted border-border-normal" };
  return (
    <span className={`shrink-0 px-2 py-0.5 rounded-lg border text-[10px] font-black tracking-wide ${b.cls} ${className}`}>
      {b.text}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <div className="rounded-3xl border border-border-normal bg-bg-surface p-6 shadow-sm hover:shadow-elevated transition-all duration-300 group relative overflow-hidden flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 relative z-10 w-full">
        <div className="min-w-0">
          <p className="font-mono text-3xl font-black text-text-primary tracking-tighter leading-none">{value ?? "—"}</p>
          <p className="text-xs font-bold text-text-secondary mt-2">{label}</p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:rotate-6"
          style={{ backgroundColor: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sub && (
        <div className="mt-4 pt-3 border-t border-border-subtle/50 w-full">
          <p className="text-[10px] font-black text-text-muted tracking-tight">{sub}</p>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, accent, open, onToggle, badge, children }) {
  return (
    <div className="rounded-3xl border border-border-normal bg-bg-surface shadow-sm overflow-hidden transition-all duration-300 hover:shadow-card">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-5 text-right hover:bg-bg-overlay transition-colors outline-none">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: accent }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-black text-text-primary flex-1 tracking-tight">{title}</span>
        {badge != null && badge !== false && (
          <span className="flex items-center justify-center h-6 min-w-[24px] px-2.5 rounded-full bg-bg-base text-text-secondary border border-border-subtle/60 text-[10px] font-black">{badge}</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>
      {open && (
        <div className="px-6 pb-6 pt-3 border-t border-border-subtle/50 bg-bg-surface/30">
          {children}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-bg-base/20 border border-dashed border-border-normal/60 rounded-[28px] max-w-xl mx-auto">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-surface border border-border-subtle shadow-sm mb-4 text-text-muted">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-black text-text-secondary tracking-tight">{title}</p>
      {description && <p className="text-xs font-bold text-text-muted mt-1.5 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function ChannelCard({ icon: Icon, title, desc, status, statusText, accent, actionLabel, actionIcon: ActionIcon, onAction, actionDanger, extra, unavailable, unavailableHint, features, disabled }) {
  const isOn = status === "connected";
  const isPending = status === "pending";
  // Connected state as a THEME-AWARE tinted surface: the accent colours the
  // border/icon/status/checks, while the card body stays a proper themed surface
  // and text keeps --text-primary/secondary. The old design filled the card with
  // the bright `-text` accent token and put white text on it → washed-out and
  // unreadable on dark themes (the light-blue Telegram / mint WhatsApp cards).
  const tint = (pct) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
  return (
    <div className={`relative overflow-hidden rounded-2xl transition-all duration-300 group flex flex-col ${isOn
        ? "shadow-elevated hover:shadow-modal hover:-translate-y-0.5"
        : isPending
          ? "border border-warning-border/40 bg-warning-bg/15 hover:shadow-elevated"
          : "border border-border-normal bg-bg-surface hover:shadow-elevated"
      }`} style={isOn ? { backgroundColor: `color-mix(in srgb, ${accent} 10%, var(--bg-surface))`, border: `1px solid ${tint(38)}` } : undefined}>
      {/* Accent rail marks the connected card without washing it out. */}
      {isOn && <div className="absolute top-0 bottom-0 right-0 w-1" style={{ backgroundColor: accent }} />}

      <div className="p-5 flex flex-col flex-1 relative z-10">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={isOn ? { backgroundColor: tint(16), color: accent, border: `2px solid ${tint(35)}` } : isPending ? { backgroundColor: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-text)", border: "2px solid var(--warning-border)" } : { backgroundColor: "var(--bg-base)", borderColor: "var(--border-normal)", color: "var(--text-muted)", border: "2px solid var(--border-normal)" }}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black tracking-tight" style={{ color: "var(--text-primary)" }}>{title}</h3>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                style={isOn ? { backgroundColor: tint(16), color: accent, border: `1px solid ${tint(35)}` } : isPending ? { backgroundColor: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" } : { backgroundColor: "var(--bg-base)", color: "var(--text-muted)", border: "1px solid var(--border-normal)" }}>
                {isOn ? statusText : isPending ? "انتظار" : "متوقف"}
              </span>
            </div>
            <p className="text-[11px] font-bold mt-1 leading-relaxed" style={{ color: isOn ? "var(--text-secondary)" : "var(--text-muted)" }}>{desc}</p>
            {extra}
          </div>
        </div>

        {features && features.length > 0 && (
          <div className="mb-3 px-3 py-2.5 rounded-xl"
            style={isOn ? { backgroundColor: "var(--bg-base)", border: `1px solid ${tint(22)}` } : { backgroundColor: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-[9px] font-black mb-1.5" style={{ color: "var(--text-muted)" }}>استخدامات هذه القناة:</p>
            <div className="space-y-1">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5" style={{ color: isOn ? accent : "var(--text-muted)" }}>{isOn ? "✓" : "○"}</span>
                  <span className="text-[10px] font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {unavailable && unavailableHint && <p className="text-[9px] font-black text-danger-text mb-2">{unavailableHint}</p>}
        <div className="flex-1" />

        <div className="mt-3">
          <button onClick={onAction} disabled={disabled}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black transition-all active:scale-[0.97]"
            style={
              disabled ? { border: "1px solid var(--border-normal)", backgroundColor: "var(--bg-base)", color: "var(--text-muted)", cursor: "not-allowed", opacity: 0.5 }
                : isOn ? { border: `1px solid ${tint(40)}`, backgroundColor: tint(12), color: accent }
                  : { backgroundColor: "var(--primary)", color: "#fff" }
            }>
            <ActionIcon className="h-3.5 w-3.5" /> {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoicePreview({ invoice, settings }) {
  return (
    <div className="bg-bg-surface rounded-lg border border-border-normal overflow-hidden">
      <div className="p-3 bg-bg-base border-b border-border-normal flex items-center gap-2">
        <FileText className="h-4 w-4 text-text-muted" />
        <span className="text-xs font-bold text-text-secondary">معاينة الفاتورة</span>
      </div>
      <div className="p-4 flex justify-center">
        <div className="shadow-card border border-border-subtle rounded" style={{ transform: "scale(0.7)", transformOrigin: "top center", width: "595px" }}>
          <LayoutRenderer family="page" invoice={invoice} settings={settings} layout={settings.layout || null} size="A5" />
        </div>
      </div>
    </div>
  );
}

// ─── Send Invoice Modal ──────────────────────────────────────────────────

function SendInvoiceModal({ phone, contactName, contactEmail, emailEnabled, onClose }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [fullInvoice, setFullInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [sending, setSending] = useState(false);
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null);
  const [docSearch, setDocSearch] = useState("");
  const [docResults, setDocResults] = useState([]);
  const [docSearching, setDocSearching] = useState(false);
  const [sendMode, setSendMode] = useState("whatsapp"); // "whatsapp" | "email"
  const previewRef = useRef(null);
  const wa = useWhatsAppStatus(8000);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/api/invoices/by-phone", { params: { phone } });
        setInvoices(r.data?.data || []);
      } catch { } finally { setLoading(false); }
    })();
  }, [phone]);

  // Doc number search (debounced)
  useEffect(() => {
    if (!docSearch.trim() || docSearch.trim().length < 2) { setDocResults([]); return; }
    const t = setTimeout(async () => {
      setDocSearching(true);
      try {
        const r = await api.get("/api/invoices/by-doc", { params: { doc_no: docSearch.trim() } });
        setDocResults(r.data?.data || []);
      } catch { setDocResults([]); } finally { setDocSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [docSearch]);

  async function selectInvoice(invoice) {
    setSelectedInvoice(invoice);
    setFullInvoice(null);
    try {
      const [ir, sr] = await Promise.all([
        api.get(`/api/invoices/${invoice.id}`),
        api.get("/api/print-settings-per-doc/pos_receipt"),
      ]);
      setFullInvoice(ir.data?.data || null);
      setSettings(sr.data?.data || {});
    } catch { toast.error("فشل تحميل بيانات الفاتورة"); }
  }

  async function handleSendWhatsApp(invoiceId) {
    const inv = selectedInvoice || invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    if (!wa.isConnected) {
      toast.error("واتساب غير متصل — تأكد من الاتصال أولاً");
      return;
    }
    setSendingInvoiceId(invoiceId);
    setSending(true);
    try {
      let imageBase64;
      if (invoiceId && invoiceId !== selectedInvoice?.id) {
        const [ir, sr] = await Promise.all([
          api.get(`/api/invoices/${invoiceId}`),
          api.get("/api/print-settings-per-doc/pos_receipt"),
        ]);
        const fi = ir.data?.data;
        const ss = sr.data?.data || {};
        const previewContainer = document.createElement("div");
        previewContainer.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;width:595px;background:var(--bg-surface,#ffffff);";
        document.body.appendChild(previewContainer);
        const root = document.createElement("div");
        previewContainer.appendChild(root);
        const ReactDOM = await import("react-dom/client");
        const rootInstance = ReactDOM.createRoot(root);
        rootInstance.render(React.createElement(LayoutRenderer, { family: "page", invoice: fi, settings: ss, layout: ss.layout || null, size: "A5" }));
        await new Promise(r => setTimeout(r, 500));
        const canvas = await html2canvas(previewContainer, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });
        imageBase64 = canvas.toDataURL("image/png").split(",")[1];
        rootInstance.unmount();
        document.body.removeChild(previewContainer);
      } else if (fullInvoice && previewRef.current) {
        const canvas = await html2canvas(previewRef.current, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });
        imageBase64 = canvas.toDataURL("image/png").split(",")[1];
      } else {
        toast.error("الرجاء اختيار فاتورة أولاً");
        setSending(false);
        setSendingInvoiceId(null);
        return;
      }
      const caption = `فاتورة رقم ${inv.invoice_no || inv.id} - ${inv.total} جنيه`;
      const jid = phone.includes("@") ? phone : `${phone.replace(/[^\d]/g, "")}@s.whatsapp.net`;
      await api.post("/api/whatsapp/crm/send", { jid, imageBase64, caption });
      toast.success("تم إرسال الفاتورة عبر واتساب");
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل إرسال الفاتورة");
    } finally { setSending(false); setSendingInvoiceId(null); }
  }

  async function handleSendEmail(invoiceId) {
    const inv = selectedInvoice || invoices.find(i => i.id === invoiceId) || docResults.find(i => i.id === invoiceId);
    if (!inv) return;
    const emailAddr = contactEmail || inv.customer_email;
    if (!emailAddr) {
      toast.error("لا يوجد بريد إلكتروني لهذا العميل");
      return;
    }
    setSendingInvoiceId(invoiceId);
    setSending(true);
    try {
      let imageBase64;
      if (fullInvoice && previewRef.current) {
        const canvas = await html2canvas(previewRef.current, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });
        imageBase64 = canvas.toDataURL("image/png").split(",")[1];
      } else {
        const [ir, sr] = await Promise.all([
          api.get(`/api/invoices/${invoiceId}`),
          api.get("/api/print-settings-per-doc/pos_receipt"),
        ]);
        const fi = ir.data?.data;
        const ss = sr.data?.data || {};
        const previewContainer = document.createElement("div");
        previewContainer.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1;width:595px;background:var(--bg-surface,#ffffff);";
        document.body.appendChild(previewContainer);
        const root = document.createElement("div");
        previewContainer.appendChild(root);
        const ReactDOM = await import("react-dom/client");
        const rootInstance = ReactDOM.createRoot(root);
        rootInstance.render(React.createElement(LayoutRenderer, { family: "page", invoice: fi, settings: ss, layout: ss.layout || null, size: "A5" }));
        await new Promise(r => setTimeout(r, 500));
        const canvas = await html2canvas(previewContainer, { useCORS: true, scale: 2, backgroundColor: "#ffffff" });
        imageBase64 = canvas.toDataURL("image/png").split(",")[1];
        rootInstance.unmount();
        document.body.removeChild(previewContainer);
      }
      const subject = `فاتورة رقم ${inv.invoice_no || inv.doc_no || inv.id}`;
      const htmlBody = `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#16a34a">${subject}</h2>
          <p>العميل: ${contactName || inv.customer_name || "—"}</p>
          <p>المبلغ: ${Number(inv.total).toLocaleString("ar-EG")} جنيه</p>
          <p>التاريخ: ${new Date(inv.created_at).toLocaleDateString("ar-EG")}</p>
          <img src="data:image/png;base64,${imageBase64}" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px;margin-top:16px" />
        </div>
      `;
      await api.post("/api/whatsapp/crm/send", {
        jid: "email",
        text: subject,
        imageBase64: null,
        caption: null,
        emailTo: emailAddr,
        emailSubject: subject,
        emailHtml: htmlBody,
      });
      toast.success(`تم إرسال الفاتورة على ${emailAddr}`);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل إرسال البريد");
    } finally { setSending(false); setSendingInvoiceId(null); }
  }

  const allInvoices = [...invoices];
  // Merge doc search results that aren't already in the list
  for (const dr of docResults) {
    if (!allInvoices.find(i => i.id === dr.id)) allInvoices.push(dr);
  }

  const typeIcon = (type) => {
    if (type === "return") return <RotateCcw className="h-3 w-3 text-danger" />;
    return <FileText className="h-3 w-3 text-success-text" />;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-3xl mx-4 max-h-[92vh] overflow-y-auto rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> إرسال فاتورة
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>

        {contactName && (
          <p className="text-xs font-bold text-text-secondary mb-3">إلى: <span className="text-text-primary">{contactName}</span>
            {contactEmail && <span className="text-text-muted mr-2">({contactEmail})</span>}
          </p>
        )}

        {!wa.isConnected && wa.status !== "loading" && (
          <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 mb-4 ${wa.status === "qr" ? "border-warning-border bg-warning-bg" : "border-danger-border bg-danger-bg"}`}>
            {wa.status === "qr" ? <Smartphone className="h-4 w-4 text-warning-text shrink-0 mt-0.5 animate-pulse" /> : <WifiOff className="h-4 w-4 text-danger shrink-0 mt-0.5" />}
            <div>
              <p className={`text-xs font-black ${wa.status === "qr" ? "text-warning-text" : "text-danger"}`}>
                {wa.status === "qr" ? "واتساب في انتظار مسح QR" : "واتساب غير متصل"}
              </p>
              <p className="text-[11px] font-bold text-text-secondary mt-0.5">
                {wa.status === "qr" ? "امسح رمز QR من هاتفك لتفعيل الإرسال." : "لا يمكن الإرسال عبر واتساب. اربط واتساب أولاً أو استخدم البريد."}
              </p>
            </div>
          </div>
        )}

        {/* Doc number search bar */}
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input type="text" value={docSearch} onChange={e => setDocSearch(e.target.value)}
            placeholder="بحث برقم الوثيقة (لإرسال فاتورة لعميل آخر)..." dir="rtl"
            className="w-full rounded-xl bg-bg-base border border-border-normal py-2.5 pr-9 pl-3 text-sm font-bold text-text-primary outline-none focus:border-primary transition-all placeholder:text-text-muted" />
          {docSearching && <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-text-muted" />}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>
        ) : allInvoices.length === 0 && !docResults.length ? (
          <EmptyState icon={FileText} title="لا توجد فواتير" description="لا توجد فواتير لهذا العميل" />
        ) : (
          <>
            <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
              {allInvoices.map(inv => (
                <button key={inv.id} onClick={() => selectInvoice(inv)}
                  className={`w-full text-right flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedInvoice?.id === inv.id ? "border-primary bg-primary-50" : "border-border-normal bg-bg-surface hover:border-border-strong"
                    }`}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-base border border-border-subtle">
                    {typeIcon(inv.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-text-primary">{inv.doc_no || inv.invoice_no || `#${inv.id}`}</p>
                      {inv.type === "return" && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-danger-bg text-danger">مرتجع</span>}
                    </div>
                    <p className="text-[11px] font-bold text-text-muted">{new Date(inv.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-sm font-black text-text-primary">{Number(inv.total).toLocaleString("ar-EG")} ج</p>
                    <Badge label={inv.status === "paid" ? "مدفوع" : inv.status === "partial" ? "جزئي" : "غير مدفوع"} variant={inv.status === "paid" ? "success" : inv.status === "partial" ? "warning" : "danger"} />
                  </div>
                </button>
              ))}
            </div>

            {fullInvoice && (
              <div ref={previewRef} className="mb-4">
                <InvoicePreview invoice={fullInvoice} settings={settings} />
              </div>
            )}

            {/* Send mode toggle — email button only visible when emailEnabled */}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base transition-all">
                إلغاء
              </button>
              {emailEnabled && (
                <button onClick={() => handleSendEmail(selectedInvoice?.id)} disabled={!selectedInvoice || sending}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border-normal bg-bg-surface px-4 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base hover:border-danger disabled:opacity-50 transition-all active:scale-95">
                  {sending && sendMode === "email" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {sending && sendMode === "email" ? "جارٍ الإرسال..." : "إرسال بالبريد"}
                </button>
              )}
              <button onClick={() => handleSendWhatsApp(selectedInvoice?.id)} disabled={!selectedInvoice || sending || !wa.isConnected}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                {sending && sendMode === "whatsapp" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending && sendMode === "whatsapp" ? "جارٍ الإرسال..." : "إرسال الفاتورة"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard", label: "لوحة التحكم", icon: BarChart3 },
  { id: "inbox", label: "صندوق الوارد", icon: Inbox },
  { id: "marketing", label: "العملاء والحملات", icon: Megaphone },
  { id: "templates", label: "القوالب", icon: FileText },
  { id: "telegram", label: null, icon: Send, group: "alerts" },
];

export default function WhatsAppCrmPage() {
  usePageTour('whatsapp_crm');
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [waStatus, setWaStatus] = useState({ status: "loading" });
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [chartDays, setChartDays] = useState(14);

  const canSend = usePermission("whatsapp_crm", "send");
  const canAdd = usePermission("whatsapp_crm", "add");
  const canEdit = usePermission("whatsapp_crm", "edit");
  const canDelete = usePermission("whatsapp_crm", "delete");
  const canManageTemplates = usePermission("whatsapp_crm", "manage_templates");
  const canConnect = usePermission("whatsapp_crm", "connect");
  const canManageEvents = usePermission("whatsapp_crm", "manage_events");
  const perms = { canSend, canAdd, canEdit, canDelete, canManageTemplates, canConnect, canManageEvents };

  const refreshConfig = useCallback(() => {
    api.get("/api/whatsapp/crm/config")
      .then(r => {
        setSmsEnabled(Boolean(r.data?.data?.sms_enabled));
        setEmailEnabled(Boolean(r.data?.data?.email_enabled));
      })
      .catch(() => { });
    api.get("/api/telegram/config")
      .then(r => setTelegramEnabled(Boolean(r.data?.data?.enabled)))
      .catch(() => { });
    api.get("/api/meta-ads/config")
      .then(r => setMetaEnabled(Boolean(r.data?.data?.enabled)))
      .catch(() => { });
  }, []);

  useEffect(() => { refreshConfig(); }, [refreshConfig]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [sr, wr] = await Promise.all([
        api.get("/api/whatsapp/crm/stats", { params: { days: chartDays } }),
        api.get("/api/whatsapp/engine-status"),
      ]);
      setStats(sr.data?.data || null);
      setWaStatus(wr.data?.data || { status: "unavailable" });
    } catch { setStats(null); } finally { setStatsLoading(false); }
  }, [chartDays]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const isConnected = waStatus.status === "connected";
  const statusText = isConnected ? "متصل" : waStatus.status === "qr" ? "انتظار المسح" : waStatus.status === "connecting" ? "جارٍ الاتصال..." : "غير متصل";
  const bgStatus = isConnected ? "bg-success-text" : waStatus.status === "qr" ? "bg-warning-text" : "bg-text-muted";

  return (
    <div dir="rtl" className="flex h-full flex-col bg-bg-base">
      {/* ── Merged Header + Tab Bar ───────────────────────────── */}
      <div data-help="wa-tabs" className="shrink-0 border-b border-border-normal bg-bg-surface">
        {/* Row 1: Title + Status chips + Refresh */}
        <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-2">
          <div className="flex items-center gap-3" data-help="wa-header">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary-500/10">
              <MessageSquare className="h-4 w-4" />
            </div>
            <h1 className="text-base font-black text-text-primary tracking-tight">مركز الرسائل والحملات</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {[
              { on: isConnected, label: "واتساب", status: waStatus.status, extra: isConnected && waStatus.phone ? waStatus.phone : null },
              { on: smsEnabled, label: "SMS", status: smsEnabled ? "connected" : "disconnected" },
              { on: telegramEnabled, label: "تيليجرام", status: telegramEnabled ? "connected" : "disconnected" },
              { on: emailEnabled, label: "البريد", status: emailEnabled ? "connected" : "disconnected" },
              { on: metaEnabled, label: "Meta", status: metaEnabled ? "connected" : "disconnected" },
            ].map(c => (
              <span key={c.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${c.on ? "bg-success-bg text-success-text border-success-border/30" : "bg-bg-base text-text-muted border-border-subtle"
                }`}>
                <StatusDot status={c.status} size="w-1.5 h-1.5" />
                {c.label}
                {c.extra && <span dir="ltr" className="font-mono text-text-muted">{c.extra}</span>}
              </span>
            ))}
            <button onClick={fetchStats}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-base hover:bg-bg-overlay text-text-secondary hover:text-text-primary border border-border-subtle transition-all active:scale-95">
              <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {/* Row 2: Tab buttons */}
        <div className="px-6 pb-0">
          <div className="flex items-center gap-1 -mb-px">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <React.Fragment key={tab.id}>
                  {tab.group === "alerts" && (
                    <span className="mx-1.5 h-5 w-px shrink-0 bg-border-normal/40" aria-hidden="true" />
                  )}
                  <button onClick={() => setActiveTab(tab.id)}
                    data-help-tab={tab.id}
                    title={tab.group === "alerts" ? "تنبيهات للمالك فقط — مختلفة عن قنوات مراسلة العملاء" : undefined}
                    className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold transition-all whitespace-nowrap outline-none border-b-2 ${isActive
                        ? "text-primary border-primary"
                        : "text-text-secondary border-transparent hover:text-text-primary hover:border-border-normal"
                      }`}>
                    <tab.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-text-muted"}`} />
                    <span>{tab.id === "telegram" ? t("telegram.channelName") : tab.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      {/* ── Tab Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === "dashboard" && <div data-help="wa-dashboard"><DashboardTab stats={stats} loading={statsLoading} waStatus={waStatus} smsEnabled={smsEnabled} telegramEnabled={telegramEnabled} emailEnabled={emailEnabled} metaEnabled={metaEnabled} onRefresh={fetchStats} onConfigChanged={refreshConfig} setActiveTab={setActiveTab} perms={perms} chartDays={chartDays} setChartDays={setChartDays} /></div>}
          {activeTab === "inbox" && <div data-help="wa-inbox"><InboxTab perms={perms} /></div>}
          {activeTab === "marketing" && <div data-help="wa-marketing"><MarketingTab smsEnabled={smsEnabled} emailEnabled={emailEnabled} metaEnabled={metaEnabled} perms={perms} onConfigChanged={refreshConfig} /></div>}
          {activeTab === "templates" && <div data-help="wa-templates"><TemplatesTab perms={perms} /></div>}
          {activeTab === "telegram" && <div data-help="wa-telegram"><TelegramTab telegramEnabled={telegramEnabled} onConfigChanged={refreshConfig} perms={perms} /></div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════

export function DashboardTab({ stats, loading, waStatus, smsEnabled, telegramEnabled, emailEnabled, metaEnabled, onRefresh, onConfigChanged, setActiveTab, perms, chartDays, setChartDays }) {
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const { t } = useTranslation();
  const [linking, setLinking] = useState(false);
  const [engine, setEngine] = useState(waStatus);
  const [smsSetupOpen, setSmsSetupOpen] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [wizardChannel, setWizardChannel] = useState(null); // null | "whatsapp" | "sms" | "telegram" | "email"
  const [chartHovered, setChartHovered] = useState(null);
  const pollRef = useRef(null);
  const connectAbortRef = useRef(null);

  useEffect(() => { setEngine(waStatus); }, [waStatus]);

  useEffect(() => {
    clearInterval(pollRef.current);
    // Poll in EVERY state so the UI never desyncs from the engine. The engine
    // auto-connects on boot; the old gated poll only ran for connecting/qr/error,
    // so the card froze on a stale `disconnected`/`connected` until a manual
    // reload. Fast cadence while transient, slower while steady.
    const transient = ["connecting", "qr", "error"].includes(engine.status);
    const intervalMs = transient ? 3000 : 6000;
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get("/api/whatsapp/engine-status");
        setEngine(r.data?.data || { status: "unavailable" });
      } catch { /* keep last known state on transient network blips */ }
    }, intervalMs);
    return () => clearInterval(pollRef.current);
  }, [engine.status]);

  async function handleLink() {
    setLinking(true);
    setConnectError(null);
    try {
      connectAbortRef.current?.abort();
      connectAbortRef.current = new AbortController();
      await api.post("/api/whatsapp/engine-connect", null, {
        signal: connectAbortRef.current.signal,
        timeout: 120000, // WhatsApp connect can take up to 2 min while waiting for QR/scan
      });
      await onRefresh();
    } catch (e) {
      if (e.code === "ERR_CANCELED" || e.name === "AbortError" || e.message?.includes("aborted")) return;
      const detail = e.response?.data?.message || e.message || t("whatsapp.connectFailed");
      setConnectError(detail);
      toast.error(detail);
    } finally {
      connectAbortRef.current = null;
      setLinking(false);
    }
  }

  async function handleUnlink() {
    const ok = await confirm({ title: "فصل واتساب", message: "هل أنت متأكد من فصل واتساب؟" });
    if (!ok) return;
    try {
      await api.post("/api/whatsapp/engine-disconnect");
      setEngine({ status: "disconnected" });
      setConnectError(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الفصل");
    }
  }

  async function handleClearAndRetry() {
    setConnectError(null);
    try {
      await api.post("/api/whatsapp/engine-disconnect");
      setEngine({ status: "disconnected" });
    } catch (_) { }
    await handleLink();
  }

  const isUnavailable = ["unavailable", "error"].includes(engine.status);
  const state = engine.status || "loading";

  const statusTheme = {
    connected: { bg: "bg-success-text", text: "متصل", border: "border-success-border", badgeText: "text-white" },
    qr: { bg: "bg-warning-text", text: "انتظار المسح", border: "border-warning-border", badgeText: "text-white" },
    connecting: { bg: "bg-bg-surface", text: "جاري الاتصال...", border: "border-border-normal", badgeText: "text-text-primary" },
    loading: { bg: "bg-bg-surface", text: "تحميل...", border: "border-border-normal", badgeText: "text-text-primary" },
    disconnected: { bg: "bg-bg-surface", text: "غير متصل", border: "border-border-normal", badgeText: "text-text-primary" },
    unavailable: { bg: "bg-danger", text: "غير متاح", border: "border-danger-border", badgeText: "text-white" },
    error: { bg: "bg-danger", text: "خطأ", border: "border-danger-border", badgeText: "text-white" },
  };
  const theme = statusTheme[state] || statusTheme.disconnected;

  return (
    <>
      <div className="space-y-6">
        {/* ── Sending channels ── */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-black text-text-primary">{t("messaging.channelsTitle")}</h2>
              <p className="text-xs font-bold text-text-muted mt-0.5">قنوات مراسلة العملاء وإشعارات النظام — فعّل أو عطّل كل قناة واحصل على ملخص الحالة</p>
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { on: state === "connected", label: "واتساب" },
                { on: smsEnabled, label: "SMS" },
                { on: telegramEnabled, label: "تيليجرام" },
                { on: emailEnabled, label: "البريد" },
                { on: metaEnabled, label: "Meta" },
              ].map(c => (
                <span key={c.label} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${c.on ? "bg-success-bg text-success-text border-success-border/30" : "bg-bg-base text-text-muted border-border-normal"}`}>
                  {c.label}: {c.on ? "مفعّل" : "متوقف"}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* WhatsApp */}
            <ChannelCard
              icon={state === "connected" ? Wifi : state === "qr" ? Smartphone : WifiOff}
              title={t("whatsapp.title")}
              desc="إرسال فواتير ورسائل للعملاء، محادثات مباشرة، وإشعارات الطلبات"
              status={state === "connected" ? "connected" : state === "qr" ? "pending" : "disconnected"}
              statusText={theme.text}
              accent="var(--success-text)"
              actionLabel={state !== "connected" ? t("whatsapp.title") : "فصل"}
              actionIcon={state !== "connected" ? Link : Unlink}
              onAction={state !== "connected" ? () => setWizardChannel("whatsapp") : handleUnlink}
              actionDanger={state === "connected"}
              extra={state === "connected" && engine.phone ? <p className="text-[11px] font-bold text-success-text font-mono mt-1" dir="ltr">+{engine.phone}</p> : null}
              unavailable={isUnavailable}
              unavailableHint="تأكد من تشغيل التطبيق عبر Electron"
              features={["إرسال فواتير البيع والمرتجعات كصور PDF", "محادثات مباشرة مع العملاء", "إشعارات حالة الطلب والتوصيل", "حملات تسويقية جماعية بالواتساب", "إشعارات تلقائية للمدفوعات"]}
              disabled={!perms.canConnect}
            />
            {/* SMS */}
            <ChannelCard
              icon={MessageCircle}
              title={t("sms.title")}
              desc="إرسال رسائل نصية جماعية وتلقائية للعملاء"
              status={smsEnabled ? "connected" : "disconnected"}
              statusText={smsEnabled ? "مفعّلة" : "غير مفعّلة"}
              accent="var(--info-text)"
              actionLabel={smsEnabled ? "الإعدادات" : "تفعيل SMS"}
              actionIcon={smsEnabled ? Settings : Link}
              onAction={() => (smsEnabled ? setSmsSetupOpen(true) : setWizardChannel("sms"))}
              features={["رسائل نصية جماعية للحملات التسويقية", "تنبيهات الطلبات والحسابات", "تأكيد OTP للمعاملات", "رسائل ترحيب للعملاء الجدد"]}
              disabled={!perms.canConnect}
            />
            {/* Telegram */}
            <ChannelCard
              icon={Send}
              title={t("telegram.channelName")}
              desc="إشعارات فورية للمالك — فواتير، مصروفات، مخزون، وتنبيهات أمان"
              status={telegramEnabled ? "connected" : "disconnected"}
              statusText={telegramEnabled ? t("telegram.statusEnabled") : t("telegram.statusDisabled")}
              accent="var(--info-text)"
              actionLabel={telegramEnabled ? t("telegram.settings") : t("telegram.activate")}
              actionIcon={telegramEnabled ? Settings : Link}
              onAction={() => (telegramEnabled ? setActiveTab("telegram") : setWizardChannel("telegram"))}
              features={["تنبيهات فواتير البيع الجديدة للإدارة", "تنبيهات المصروفات والإيرادات", "تنبيهات المخزون المنخفض", "تنبيهات محاولات الدخول الفاشلة", "النسخ الاحتياطي التلقائي"]}
              disabled={!perms.canConnect}
            />
            {/* Email */}
            <ChannelCard
              icon={Mail}
              title={t("email.title")}
              desc="إرسال فواتير وعروض أسعار وحملات تسويقية بالبريد الإلكتروني"
              status={emailEnabled ? "connected" : "disconnected"}
              statusText={emailEnabled ? "مفعّل" : "غير مفعّل"}
              accent="var(--danger)"
              actionLabel={emailEnabled ? "الإعدادات" : "تفعيل البريد"}
              actionIcon={emailEnabled ? Settings : Link}
              onAction={() => setWizardChannel("email")}
              features={["إرسال الفواتير كمرفقات PDF احترافية", "عروض الأسعار والكتالوجات", "حملات تسويقية بريدية جماعية", "إشعارات نقاط الولاء والمكافآت", "متابعة حالة الطلبات تلقائياً"]}
              disabled={!perms.canConnect}
            />
            {/* Meta Ads */}
            <ChannelCard
              icon={Globe}
              title="Meta Ads"
              desc="ربط جماهير مخصصة من العملاء واستيراد العملاء المحتملين من فيسبوك وإنستجرام"
              status={metaEnabled ? "connected" : "disconnected"}
              statusText={metaEnabled ? "مربوط" : "غير مربوط"}
              accent="var(--primary)"
              actionLabel={metaEnabled ? "الإعدادات" : "ربط Meta"}
              actionIcon={metaEnabled ? Settings : Link}
              onAction={() => setWizardChannel("meta")}
              features={["إنشاء جماهير مخصصة من قاعدة العملاء الحاليين", "استيراد Leads من فيسبوك وإنستجرام", "مزامنة بيانات العملاء مع Meta", "تحسين استهداف الحملات الإعلانية", "تتبع أداء الحملات"]}
              disabled={!perms.canConnect}
            />
          </div>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="h-8 w-8 animate-spin text-text-muted" /></div>
        ) : stats ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="جهات اتصال" value={stats.totalContacts} icon={Users} accent="var(--info-text)" sub={`${stats.totalLeads} عميل محتمل`} />
              <StatCard label="مشتركين بالتسويق" value={stats.optedIn} icon={CheckCircle} accent="var(--success-text)" sub={`${stats.optedOut} ملغي`} />
              <StatCard label="رسائل مرسلة" value={stats.sentTotal} icon={Send} accent="var(--warning-text)" sub={`${stats.sentToday} اليوم`} />
              <StatCard label="محادثات" value={stats.convCount} icon={MessageCircle} accent="var(--danger)" sub={`${stats.unreadCount} غير مقروءة`} />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <SectionCard title="آخر النشاطات" icon={Clock} accent="var(--primary)" open={true} onToggle={() => { }}>
                <div className="space-y-1.5 mt-2 max-h-72 overflow-y-auto">
                  {stats.recentMessages?.length > 0 ? stats.recentMessages.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-bg-overlay transition-colors">
                      <StatusDot status={m.direction === "inbound" ? "connected" : "sent"} />
                      <span className={`text-xs font-bold ${m.direction === "inbound" ? "text-success-text" : "text-primary"} shrink-0 w-14`}>
                        {m.direction === "inbound" ? "وارد" : "صادر"}
                      </span>
                      <span className="text-xs font-bold text-text-muted w-24 truncate shrink-0">{m.contact_name || m.remote_jid?.split("@")[0]}</span>
                      <ContactTypeBadge type={m.contact_type} />
                      <span className="text-xs font-bold text-text-primary flex-1 truncate">{m.body || "—"}</span>
                      <span className="text-[11px] text-text-muted shrink-0">{m.created_at ? new Date(m.created_at).toLocaleDateString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}</span>
                    </div>
                  )) : (
                    <EmptyState icon={MessageSquare} title="لا توجد رسائل بعد" description="عند بدء المحادثات ستظهر هنا" />
                  )}
                </div>
              </SectionCard>

              {/* ── Sent by day chart ── */}
              <SectionCard
                title={`آخر ${chartDays} يوم`}
                icon={BarChart3}
                accent="var(--success-text)"
                open={true}
                onToggle={() => { }}
                badge={stats.sentByDay?.length ? `${stats.sentByDay.reduce((s, d) => s + d.count, 0)}` : null}
              >
                <div className="mt-2">
                  {/* Period selector */}
                  <div className="flex items-center gap-1.5 mb-4">
                    {[7, 14, 30, 60].map(d => (
                      <button key={d} onClick={() => setChartDays(d)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${chartDays === d
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-bg-base text-text-muted border-border-subtle hover:text-text-primary hover:border-border-normal"
                          }`}>
                        {d} يوم
                      </button>
                    ))}
                  </div>
                  <div key={chartDays} className="animate-[fadeIn_0.25s_ease-out]">
                    {(() => {
                      // Fill in ALL days in range so gaps (0 messages) show as empty bars
                      const raw = stats.sentByDay || [];
                      const byDay = new Map(raw.map(d => [d.day, d.count]));
                      const filled = [];
                      const today = new Date();
                      for (let i = chartDays - 1; i >= 0; i--) {
                        const dt = new Date(today);
                        dt.setDate(dt.getDate() - i);
                        const key = dt.toISOString().slice(0, 10);
                        filled.push({ day: key, count: byDay.get(key) || 0 });
                      }
                      const data = filled;
                      if (data.every(d => d.count === 0)) return <EmptyState icon={BarChart3} title="لا توجد رسائل في هذه الفترة" description="عند إرسال الرسائل ستظهر هنا" />;
                      const max = Math.max(...data.map(d => d.count), 1);
                      const total = data.reduce((s, d) => s + d.count, 0);
                      const avg = Math.round(total / data.length);
                      const todayIdx = data.length - 1;
                      const n = data.length;

                      // Adaptive sizing: wider chart for longer periods
                      const barUnit = n <= 14 ? 40 : n <= 30 ? 28 : 22;
                      const W = Math.max(560, n * barUnit + 60);
                      const H = 220;
                      const ML = 40, MR = 10, MT = 30, MB = 28;
                      const CW = W - ML - MR, CH = H - MT - MB;
                      const barW = Math.max(Math.min(Math.floor(CW / n) - 2, n <= 14 ? 30 : 20), 4);
                      const gap = (CW - barW * n) / (n + 1);
                      // Show label every N bars depending on density
                      const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : n <= 30 ? 5 : 7;
                      const ticks = [0, 0.25, 0.5, 0.75, 1];
                      return (
                        <div>
                          {/* Summary */}
                          <div className="flex items-center gap-5 mb-4">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-black text-text-primary tracking-tighter font-mono">{total}</span>
                              <span className="text-[11px] font-bold text-text-muted">رسالة</span>
                            </div>
                            <span className="h-4 w-px bg-border-normal/40" />
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-primary font-mono">{avg}</span>
                              <span className="text-[10px] font-bold text-text-muted">متوسط يومي</span>
                            </div>
                            <span className="h-4 w-px bg-border-normal/40" />
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-black text-success-text font-mono">{max}</span>
                              <span className="text-[10px] font-bold text-text-muted">أعلى</span>
                            </div>
                          </div>
                          {/* SVG Chart — scrollable for long periods */}
                          <div className="relative rounded-2xl border border-border-subtle bg-bg-base/40 p-4 pt-6 overflow-visible">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 240, minWidth: 400 }} overflow="visible">
                              {/* Y-axis grid lines + labels */}
                              {ticks.map((t, i) => {
                                const y = MT + CH * (1 - t);
                                const val = Math.round(max * t);
                                return (
                                  <g key={i}>
                                    <line x1={ML} y1={y} x2={W - MR} y2={y} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3,3"} opacity="0.5" />
                                    <text x={ML - 6} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="9" fontWeight="700" fontFamily="monospace">{val}</text>
                                  </g>
                                );
                              })}
                              {/* X-axis baseline */}
                              <line x1={ML} y1={MT + CH} x2={W - MR} y2={MT + CH} stroke="var(--border-normal)" strokeWidth="1.5" />
                              {/* Y-axis line */}
                              <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="var(--border-normal)" strokeWidth="1.5" />
                              {/* Week separators for 14+ days */}
                              {n > 14 && data.map((d, i) => {
                                if (i === 0) return null;
                                const dt = new Date(d.day);
                                if (dt.getDay() === 6 || dt.getDate() === 1) { // Saturday or 1st
                                  const x = ML + gap + i * (barW + gap) - gap / 2;
                                  return <line key={`ws-${i}`} x1={x} y1={MT} x2={x} y2={MT + CH} stroke="var(--border-normal)" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.3" />;
                                }
                                return null;
                              })}
                              {/* Bars */}
                              {data.map((d, i) => {
                                const x = ML + gap + i * (barW + gap);
                                const barH = (d.count / max) * CH;
                                const y = MT + CH - barH;
                                const isMax = d.count === max && d.count > 0;
                                const isToday = i === todayIdx;
                                const isHovered = chartHovered === i;
                                const dt = new Date(d.day);
                                const dayNum = d.day?.slice(8);
                                const monthDay = `${dt.getMonth() + 1}/${dayNum}`;
                                const showLabel = i % labelEvery === 0 || isToday;
                                // Color by intensity: 5-stop palette from muted to vivid
                                const ratio = d.count / max;
                                const palette = [
                                  "var(--primary)",       // 0–20%
                                  "var(--info-text)",     // 20–40%
                                  "var(--primary)",       // 40–60%
                                  "var(--warning-text)",  // 60–80%
                                  "var(--success-text)",  // 80–100%
                                ];
                                const stop = Math.min(Math.floor(ratio * 5), 4);
                                const fill = isMax ? "var(--success-text)" : isToday ? "var(--primary)" : palette[stop];
                                const opacity = isMax ? 1 : isToday ? 0.9 : 0.7;
                                return (
                                  <g key={i}>
                                    {/* Bar */}
                                    <rect
                                      x={x} y={y} width={barW} height={Math.max(barH, 2)}
                                      rx={barW > 8 ? 3 : 1.5} ry={barW > 8 ? 3 : 1.5}
                                      fill={fill}
                                      opacity={isHovered ? 1 : opacity}
                                      className="transition-opacity duration-150"
                                      onMouseEnter={() => setChartHovered(i)}
                                      onMouseLeave={() => setChartHovered(null)}
                                    />
                                    {/* Hover highlight */}
                                    {isHovered && (
                                      <rect x={x - 1} y={y - 1} width={barW + 2} height={barH + 2} rx="4" ry="4" fill="none" stroke={fill} strokeWidth="2" opacity="0.4" />
                                    )}
                                    {/* Day label — only show every Nth */}
                                    {showLabel && (
                                      <>
                                        <text x={x + barW / 2} y={MT + CH + 12} textAnchor="middle" fill={isToday ? "var(--primary)" : "var(--text-muted)"} fontSize={n <= 14 ? "9" : "8"} fontWeight={isToday ? "800" : "600"} fontFamily="monospace">
                                          {n <= 14 ? dayNum : monthDay}
                                        </text>
                                        {n <= 14 && (
                                          <text x={x + barW / 2} y={MT + CH + 22} textAnchor="middle" fill={isToday ? "var(--primary)" : "var(--text-muted)"} fontSize="7" fontWeight="600" opacity="0.6">
                                            {dt.toLocaleDateString("ar-EG", { weekday: "short" })}
                                          </text>
                                        )}
                                      </>
                                    )}
                                  </g>
                                );
                              })}
                              {/* Value on top of hovered bar */}
                              {chartHovered !== null && (() => {
                                const d = data[chartHovered];
                                const x = ML + gap + chartHovered * (barW + gap);
                                const barH = (d.count / max) * CH;
                                const y = MT + CH - barH;
                                const dt = new Date(d.day);
                                const ratio = d.count / max;
                                const palette = ["var(--primary)", "var(--info-text)", "var(--primary)", "var(--warning-text)", "var(--success-text)"];
                                const stop = Math.min(Math.floor(ratio * 5), 4);
                                const hFill = d.count === max && d.count > 0 ? "var(--success-text)" : chartHovered === todayIdx ? "var(--primary)" : palette[stop];
                                const label = `${d.count} رسالة — ${dt.getMonth() + 1}/${d.day?.slice(8)}`;
                                const tw = label.length * 6.5 + 16;
                                return (
                                  <g>
                                    <rect x={x + barW / 2 - tw / 2} y={y - 24} width={tw} height="18" rx="6" fill={hFill} />
                                    <text x={x + barW / 2} y={y - 11} textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="monospace">{label}</text>
                                  </g>
                                );
                              })()}
                            </svg>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <button onClick={() => setActiveTab("inbox")}
                className="group relative overflow-hidden flex items-center gap-4 rounded-[22px] bg-bg-surface border border-border-normal p-5 hover:border-primary hover:shadow-elevated shadow-sm transition-all duration-300 text-right w-full active:scale-[0.98]">
                <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-primary rounded-r-full" />
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-info-bg text-info-text border border-info-border/30 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-6"><Inbox className="h-5 w-5" /></div>
                <div><p className="text-sm font-black text-text-primary tracking-tight">صندوق الوارد</p><p className="text-[11px] font-bold text-text-muted mt-0.5">{stats.unreadCount || 0} غير مقروءة</p></div>
              </button>
              <button onClick={() => setActiveTab("marketing")}
                className="group relative overflow-hidden flex items-center gap-4 rounded-[22px] bg-bg-surface border border-border-normal p-5 hover:border-primary hover:shadow-elevated shadow-sm transition-all duration-300 text-right w-full active:scale-[0.98]">
                <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-success-text rounded-r-full" />
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-success-bg text-success-text border border-success-border/30 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-6"><Megaphone className="h-5 w-5" /></div>
                <div><p className="text-sm font-black text-text-primary tracking-tight">العملاء والحملات</p><p className="text-[11px] font-bold text-text-muted mt-0.5">{stats.totalContacts} عميل — أرسل حملة جماعية</p></div>
              </button>
              <button onClick={() => setActiveTab("templates")}
                className="group relative overflow-hidden flex items-center gap-4 rounded-[22px] bg-bg-surface border border-border-normal p-5 hover:border-primary hover:shadow-elevated shadow-sm transition-all duration-300 text-right w-full active:scale-[0.98]">
                <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-warning-text rounded-r-full" />
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-bg text-warning-text border border-warning-border/30 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-6"><FileText className="h-5 w-5" /></div>
                <div><p className="text-sm font-black text-text-primary tracking-tight">القوالب</p><p className="text-[11px] font-bold text-text-muted mt-0.5">رسائل جاهزة للحملات والإرسال التلقائي</p></div>
              </button>
            </div>
          </>
        ) : (
          <EmptyState icon={BarChart3} title="تعذر تحميل الإحصائيات" description="تأكد من اتصال الخادم" action={
            <button onClick={onRefresh} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:opacity-90">إعادة المحاولة</button>
          } />
        )}

        {/* Channel connect wizards */}
        {wizardChannel === "whatsapp" && <WhatsAppConnectWizard onClose={() => setWizardChannel(null)} engine={engine} linking={linking} connectError={connectError} onLink={handleLink} onClearAndRetry={handleClearAndRetry} />}
        {wizardChannel === "sms" && <SmsConnectWizard onClose={() => setWizardChannel(null)} onSaved={onConfigChanged} />}
        {wizardChannel === "telegram" && <TelegramConnectWizard onClose={() => setWizardChannel(null)} onSaved={onConfigChanged} />}
        {wizardChannel === "email" && <EmailConnectWizard onClose={() => setWizardChannel(null)} onSaved={onConfigChanged} />}
        {wizardChannel === "meta" && <MetaAdsWizard onClose={() => setWizardChannel(null)} onSaved={onConfigChanged} />}
      </div>
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  INBOX TAB — full WhatsApp-like experience
// ═══════════════════════════════════════════════════════════════════════════

function ImageLightbox({ url, caption, onClose }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80" onMouseDown={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]" onMouseDown={e => e.stopPropagation()}>
        <div className="absolute top-2 left-2 right-2 flex justify-between z-10">
          <a href={url} target="_blank" rel="noopener noreferrer" download
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
            <Download className="h-4 w-4" />
          </a>
          <button onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <img src={url} alt={caption || ""} className="max-w-full max-h-[85vh] rounded-2xl shadow-modal" />
        {caption && <p className="text-white text-sm font-bold mt-2 text-center">{caption}</p>}
      </div>
    </div>
  );
}

function AudioPlayer({ src }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => { }); }
  }

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-surface/20 hover:bg-bg-surface/30 transition-colors">
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 mr-0.5" />}
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-bg-surface/20 overflow-hidden">
        <div className="h-full rounded-full bg-bg-surface/60 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <audio ref={audioRef} src={src}
        onTimeUpdate={() => audioRef.current && setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100)}
        onEnded={() => setPlaying(false)} />
    </div>
  );
}

const EMOJIS = ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "💀", "☠️", "👋", "✋", "👌", "👍", "👎", "✊", "👊", "🤞", "🤟", "🤘", "👏", "🙌", "🤲", "🙏", "💅", "💪", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💕", "💞", "💗", "💖", "✨", "⭐", "🌟", "🔥", "💯", "🎉", "🎊", "🎁", "🎈", "🎂", "🏆", "✅", "❌", "❓", "❗", "💬", "🗨️", "👀", "🙈", "🙉", "🙊"];

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

function EmojiPicker({ onSelect, onClose, emojis = EMOJIS }) {
  const ref = useRef(null);
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-16 right-0 z-50 w-72 rounded-xl border border-border-normal bg-bg-surface shadow-modal p-2">
      <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
        {emojis.map(emoji => (
          <button key={emoji} onClick={() => { onSelect(emoji); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-bg-overlay text-lg transition-colors active:scale-90">
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReactionPicker({ onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full bg-bg-surface border border-border-normal shadow-elevated px-2 py-1.5">
      {REACTION_EMOJIS.map(emoji => (
        <button key={emoji} onClick={() => { onSelect(emoji); }}
          className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-bg-overlay text-base transition-all hover:scale-125 active:scale-90">
          {emoji}
        </button>
      ))}
    </div>
  );
}

function InboxTab({ perms }) {
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJid, setSelectedJid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const wa = useWhatsAppStatus(8000);

  // Enhanced features state
  const [replyTo, setReplyTo] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [reactingMsg, setReactingMsg] = useState(null);
  const [reactions, setReactions] = useState({});
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/whatsapp/crm/conversations");
      setConversations(r.data?.data || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const selectConversation = useCallback(async (jid) => {
    setSelectedJid(jid);
    setMessagesLoading(true);
    setReplyTo(null);
    setPage(1);
    setHasMore(true);
    setShowContactInfo(false);
    try {
      await api.post(`/api/whatsapp/crm/conversations/${encodeURIComponent(jid)}/read`);
      const r = await api.get(`/api/whatsapp/crm/conversations/${encodeURIComponent(jid)}/messages`);
      const msgs = r.data?.data || [];
      setMessages(msgs);
      setHasMore(msgs.length >= 50);
      setConversations(prev => prev.map(c => c.remote_jid === jid ? { ...c, unread_count: 0 } : c));
    } catch { } finally { setMessagesLoading(false); }
  }, []);

  useEffect(() => {
    if (!messagesLoading) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesLoading]);

  // ─── Pagination: load older messages on scroll to top ──────────────
  async function loadOlderMessages() {
    if (!selectedJid || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = messages.length;
      const r = await api.get(`/api/whatsapp/crm/conversations/${encodeURIComponent(selectedJid)}/messages?offset=${offset}&limit=50`);
      const older = r.data?.data || [];
      if (older.length === 0) { setHasMore(false); return; }
      const scrollContainer = messagesContainerRef.current;
      const prevScrollHeight = scrollContainer?.scrollHeight || 0;
      setMessages(prev => [...older, ...prev]);
      setPage(p => p + 1);
      setHasMore(older.length >= 50);
      requestAnimationFrame(() => {
        if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight - prevScrollHeight;
      });
    } catch { } finally { setLoadingMore(false); }
  }

  function handleMessagesScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
    if (el.scrollTop < 100 && hasMore && !loadingMore) loadOlderMessages();
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function getMediaUrl(url) {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const base = api.defaults.baseURL || "";
    return `${base}${url}`;
  }

  // ─── Insert emoji at cursor ──────────────────────────────────────────
  function handleEmojiSelect(emoji) {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const newText = sendText.slice(0, start) + emoji + sendText.slice(end);
      setSendText(newText);
      requestAnimationFrame(() => {
        input.setSelectionRange(start + emoji.length, start + emoji.length);
        input.focus();
      });
    } else {
      setSendText(prev => prev + emoji);
    }
  }

  // ─── Send text ─────────────────────────────────────────────────────────
  async function handleSend() {
    if (!sendText.trim() || !selectedJid || sending) return;
    if (!wa.isConnected) {
      toast.error("واتساب غير متصل — تأكد من الاتصال أولاً");
      return;
    }
    setSending(true);
    const textToSend = replyTo
      ? `↩ "${(replyTo.body || "").slice(0, 50)}"\n\n${sendText.trim()}`
      : sendText.trim();
    try {
      await api.post("/api/whatsapp/crm/send", { jid: selectedJid, text: textToSend });
      setMessages(prev => [...prev, {
        direction: "outbound", body: textToSend, message_type: "text",
        status: "sent", created_at: new Date().toISOString(),
      }]);
      setSendText("");
      setReplyTo(null);
      setShowEmojiPicker(false);
      setConversations(prev => prev.map(c => c.remote_jid === selectedJid ? {
        ...c, last_message: textToSend, last_message_at: new Date().toISOString(), last_direction: "outbound",
      } : c));
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الإرسال");
    } finally { setSending(false); }
  }

  // ─── Send file (image / document) ──────────────────────────────────────
  async function sendFile(file) {
    if (!selectedJid) return;
    if (!wa.isConnected) {
      toast.error("واتساب غير متصل — تأكد من الاتصال أولاً");
      return;
    }
    setUploadingMedia(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result.split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const isImage = file.type.startsWith("image/");
      const payload = { jid: selectedJid };
      if (isImage) {
        payload.imageBase64 = base64;
        payload.caption = sendText.trim() || "";
      } else {
        payload.fileBase64 = base64;
        payload.fileName = file.name;
        payload.caption = sendText.trim() || "";
        payload.mimeType = file.type;
      }
      await api.post("/api/whatsapp/crm/send", payload);
      setMessages(prev => [...prev, {
        direction: "outbound", body: sendText.trim() || "",
        caption: sendText.trim() || null,
        message_type: isImage ? "image" : "document",
        status: "sent", created_at: new Date().toISOString(),
        media_url: null, mime_type: file.type,
      }]);
      setSendText("");
      setReplyTo(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل إرسال الملف");
    } finally { setUploadingMedia(false); }
  }

  // ─── Copy message text ───────────────────────────────────────────────
  function copyMessageText(msg) {
    const text = msg.body || msg.caption || "";
    navigator.clipboard.writeText(text).then(() => toast.success("تم النسخ")).catch(() => { });
  }

  // ─── Delete message ──────────────────────────────────────────────────
  async function deleteMessage(msgId) {
    const ok = await confirm({ title: "حذف الرسالة", message: "هل أنت متأكد من حذف هذه الرسالة؟" });
    if (!ok) return;
    try {
      await api.delete(`/api/whatsapp/crm/messages/${msgId}`);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الحذف");
    }
  }

  // ─── Handle reaction ─────────────────────────────────────────────────
  function handleReaction(msgIdx, emoji) {
    setReactingMsg(null);
    setReactions(prev => {
      const key = messages[msgIdx]?.id || msgIdx;
      const existing = prev[key];
      if (existing === emoji) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: emoji };
    });
  }

  // ─── Voice recording ───────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
        if (blob.size < 100) { toast.error("لم يتم تسجيل أي صوت"); return; }
        if (!wa.isConnected) { toast.error("واتساب غير متصل — تأكد من الاتصال أولاً"); return; }
        setUploadingMedia(true);
        try {
          const base64 = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result.split(",")[1]);
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
          await api.post("/api/whatsapp/crm/send", { jid: selectedJid, audioBase64: base64 });
          setMessages(prev => [...prev, {
            direction: "outbound", message_type: "audio",
            status: "sent", created_at: new Date().toISOString(),
          }]);
        } catch (e) {
          toast.error("فشل إرسال التسجيل الصوتي");
        } finally { setUploadingMedia(false); }
      };
      recorder.start();
      setRecording(true);
      setRecordingTimer(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTimer(t => t + 1);
      }, 1000);
    } catch (e) {
      toast.error("تعذر الوصول إلى الميكروفون");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(recordingTimerRef.current);
  }

  // ─── Drag and drop ─────────────────────────────────────────────────────
  function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDragOver(true); }
  function handleDragLeave(e) { e.preventDefault(); setDragOver(false); }
  function handleDrop(e) { e.preventDefault(); setDragOver(false); const files = Array.from(e.dataTransfer.files); if (files.length > 0) sendFile(files[0]); }

  function formatTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ─── Keyboard shortcuts ──────────────────────────────────────────────
  function handleInputKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") { setReplyTo(null); setShowEmojiPicker(false); }
  }

  // ─── Render message bubble ─────────────────────────────────────────────
  function MessageBubble({ msg, index }) {
    const isOut = msg.direction === "outbound";
    const bubbleClass = isOut
      ? "bg-primary text-white rounded-2xl rounded-br-sm border border-primary-600/10 shadow-sm"
      : "bg-bg-surface text-text-primary rounded-2xl rounded-bl-sm border border-border-subtle shadow-sm";
    const reaction = reactions[msg.id || index];

    return (
      <div className={`flex ${isOut ? "justify-start" : "justify-end"} group animate-fade-in`}>
        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm font-bold leading-relaxed ${bubbleClass} relative`}>

          {/* Reply context (body starts with ↩) */}
          {msg.body?.startsWith("↩") && (
            <div className={`text-[10px] ${isOut ? "text-white/50" : "text-text-muted"} mb-1 border-r-2 ${isOut ? "border-border-normal/30" : "border-primary/30"} pr-2 line-clamp-1`}>
              {msg.body.split("\n")[0]}
            </div>
          )}

          {/* Image */}
          {msg.message_type === "image" && (
            <div className="mb-1.5">
              {msg.media_url ? (
                <img src={getMediaUrl(msg.media_url)}
                  onClick={() => setPreviewImage({ url: getMediaUrl(msg.media_url), caption: msg.caption || msg.body })}
                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity max-h-48 object-cover"
                  alt={msg.caption || "صورة"} />
              ) : (
                <div className="flex items-center gap-2 bg-black/10 rounded-lg px-3 py-4">
                  <Image className="h-5 w-5 opacity-60" />
                  <span className="text-xs opacity-60">صورة</span>
                </div>
              )}
              {msg.caption && <p className={`text-xs mt-1 ${isOut ? "text-white/80" : "text-text-secondary"}`}>{msg.caption}</p>}
            </div>
          )}

          {/* Document */}
          {msg.message_type === "document" && (
            <div className="flex items-center gap-2 mb-1">
              <File className={`h-6 w-6 shrink-0 ${isOut ? "text-white/70" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{msg.body || "مستند"}</p>
                {msg.mime_type && <p className={`text-[10px] ${isOut ? "text-white/50" : "text-text-muted"}`}>{msg.mime_type}</p>}
              </div>
              {msg.media_url && (
                <a href={getMediaUrl(msg.media_url)} target="_blank" rel="noopener noreferrer" download
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${isOut ? "hover:bg-bg-surface/20" : "hover:bg-bg-overlay"} transition-colors`}>
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Audio */}
          {msg.message_type === "audio" && (
            <div className="mb-1">
              {msg.media_url ? (
                <AudioPlayer src={getMediaUrl(msg.media_url)} />
              ) : (
                <div className="flex items-center gap-2 opacity-60">
                  <Headphones className="h-4 w-4" />
                  <span className="text-xs">تسجيل صوتي</span>
                </div>
              )}
            </div>
          )}

          {/* Text */}
          {msg.message_type === "text" && (
            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
          )}
          {msg.message_type === "text" && !msg.body && (
            <p className="opacity-50 text-xs">رسالة فارغة</p>
          )}

          {/* Reaction */}
          {reaction && (
            <div className={`absolute -bottom-2 ${isOut ? "-left-1" : "-right-1"} flex items-center justify-center h-5 w-5 rounded-full bg-bg-surface border border-border-normal text-xs shadow-card`}>
              {reaction}
            </div>
          )}

          {/* Timestamp + status */}
          <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : "justify-start"}`}>
            <span className={`text-[10px] ${isOut ? "text-white/60" : "text-text-muted"}`}>
              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}
            </span>
            {isOut && (
              <span className={`text-[10px] ${msg.status === "read" ? "text-info-text" : "text-white/60"}`}>
                {msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓✓" : msg.status === "sent" ? "✓" : "⏳"}
              </span>
            )}
          </div>

          {/* Hover actions */}
          <div className={`absolute -top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOut ? "-left-2" : "-right-2"}`}>
            <button onClick={() => setReplyTo(msg)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-surface shadow-elevated text-text-muted hover:text-primary hover:bg-primary-50 border border-border-normal transition-colors"
              title="رد">
              <Reply className="h-3 w-3" />
            </button>
            {msg.message_type === "text" && msg.body && (
              <button onClick={() => copyMessageText(msg)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-surface shadow-elevated text-text-muted hover:text-primary hover:bg-primary-50 border border-border-normal transition-colors"
                title="نسخ">
                <Copy className="h-3 w-3" />
              </button>
            )}
            <button onClick={() => setReactingMsg(reactingMsg === (msg.id || index) ? null : (msg.id || index))}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-surface shadow-elevated text-text-muted hover:text-primary hover:bg-primary-50 border border-border-normal transition-colors"
              title="تفاعل">
              <Smile className="h-3 w-3" />
            </button>
            {msg.direction === "outbound" && perms.canDelete && (
              <button onClick={() => deleteMessage(msg.id)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-surface shadow-elevated text-text-muted hover:text-danger hover:bg-danger-bg border border-border-normal transition-colors"
                title="حذف">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Reaction picker popup */}
          {reactingMsg === (msg.id || index) && (
            <ReactionPicker
              onSelect={(emoji) => handleReaction(index, emoji)}
              onClose={() => setReactingMsg(null)}
            />
          )}
        </div>
      </div>
    );
  }

  // ─── Shared media helper ──────────────────────────────────────────────
  const sharedMedia = messages.filter(m => m.message_type === "image" || m.message_type === "document");

  const currConv = conversations.find(c => c.remote_jid === selectedJid);

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.contact_name || "").toLowerCase().includes(q) || c.phone_normalized.includes(q);
  });

  return (
    <>
      <div className="flex gap-0 rounded-xl border border-border-normal bg-bg-surface shadow-card overflow-hidden" style={{ height: "calc(100vh - 260px)" }}>
        {/* Conversation list */}
        <div className="w-80 shrink-0 border-l border-border-normal flex flex-col">
          <div className="p-3 border-b border-border-subtle">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث في المحادثات..." dir="rtl"
                className="w-full rounded-lg bg-bg-input py-2.5 pr-9 pl-3 text-sm font-bold text-text-primary outline-none focus:bg-bg-surface focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-text-muted" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-text-muted" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="h-8 w-8 text-text-muted mb-2" />
                <p className="text-sm font-bold text-text-muted">{search ? "لا توجد نتائج" : "لا توجد محادثات"}</p>
              </div>
            ) : (
              filtered.map(conv => (
                <button key={conv.id} onClick={() => selectConversation(conv.remote_jid)}
                  className={`w-full text-right px-4 py-3 border-b border-border-subtle hover:bg-bg-overlay transition-colors ${selectedJid === conv.remote_jid ? "bg-primary-50 border-r-2 border-r-primary" : ""
                    }`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-base text-sm font-black text-text-secondary">
                      {(conv.contact_name || conv.phone_normalized || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-black text-text-primary truncate">{conv.contact_name || conv.phone_normalized}</span>
                          <ContactTypeBadge type={conv.contact_type} />
                        </span>
                        <span className="text-[11px] text-text-muted shrink-0">
                          {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-bold truncate flex-1 ${conv.unread_count > 0 ? "text-text-primary font-black" : "text-text-secondary"}`}>
                          {conv.last_message || "بدون رسائل"}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-white text-[11px] font-black">{conv.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col relative" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          {selectedJid ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-4 px-6 py-4 border-b border-border-normal bg-bg-base/70 backdrop-blur-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary-500/10 text-sm font-black text-primary shadow-sm">
                  {currConv?.contact_name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-text-primary truncate flex items-center gap-1.5">
                    {currConv?.contact_name || selectedJid.split("@")[0]}
                    <ContactTypeBadge type={currConv?.contact_type} />
                  </p>
                  <p className="text-[10px] font-bold text-text-muted font-mono truncate mt-0.5" dir="ltr">{selectedJid.split("@")[0]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowContactInfo(prev => !prev)}
                    title="معلومات الاتصال"
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${showContactInfo ? "bg-primary-50 text-primary" : "text-text-muted hover:bg-bg-overlay"}`}>
                    <Info className="h-4 w-4" />
                  </button>
                  {perms.canSend && <button onClick={() => setShowInvoiceModal(true)}
                    title="إرسال فاتورة"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-primary-50 hover:text-primary transition-colors">
                    <FileText className="h-4 w-4" />
                  </button>}
                  {perms.canEdit && <button onClick={async () => {
                    const ok = await confirm({ title: "أرشفة المحادثة", message: "هل تريد أرشفة هذه المحادثة؟" });
                    if (ok) {
                      api.post(`/api/whatsapp/crm/conversations/${encodeURIComponent(selectedJid)}/archive`).then(() => {
                        setConversations(prev => prev.filter(c => c.remote_jid !== selectedJid));
                        setSelectedJid(null);
                        toast.success("تم الأرشفة");
                      });
                    }
                  }} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-bg-overlay transition-colors">
                    <Archive className="h-4 w-4" />
                  </button>}
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Messages area */}
                <div className="flex-1 flex flex-col">
                  <div ref={messagesContainerRef} onScroll={handleMessagesScroll}
                    className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                    {dragOver && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-primary/10 border-2 border-dashed border-primary">
                        <div className="text-center">
                          <Upload className="h-10 w-10 text-primary mx-auto mb-2" />
                          <p className="text-sm font-black text-primary">أسقط الملف هنا للإرسال</p>
                        </div>
                      </div>
                    )}

                    {loadingMore && (
                      <div className="flex items-center justify-center py-3">
                        <RefreshCw className="h-4 w-4 animate-spin text-text-muted" />
                        <span className="text-xs font-bold text-text-muted mr-2">جاري تحميل الرسائل القديمة...</span>
                      </div>
                    )}
                    {!hasMore && messages.length > 0 && (
                      <p className="text-center text-[11px] font-bold text-text-muted py-2">جميع الرسائل محملة</p>
                    )}

                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-text-muted" /></div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageCircle className="h-10 w-10 text-text-muted mb-2" />
                        <p className="text-sm font-bold text-text-muted">لا توجد رسائل بعد</p>
                        <p className="text-xs text-text-muted">أرسل أول رسالة لبدء المحادثة</p>
                      </div>
                    ) : (
                      messages.map((msg, i) => <MessageBubble key={msg.id || i} msg={msg} index={i} />)
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Scroll to bottom button */}
                  {showScrollBtn && (
                    <button onClick={scrollToBottom}
                      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-elevated hover:opacity-90 transition-all animate-bounce">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  )}

                  {/* Reply preview bar */}
                  {replyTo && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-bg-base border-t border-border-normal">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-primary flex items-center gap-1">
                          <Reply className="h-3 w-3" />
                          الرد على {replyTo.direction === "outbound" ? "نفسك" : (currConv?.contact_name || "المرسل")}
                        </p>
                        <p className="text-xs font-bold text-text-muted truncate">
                          {replyTo.body || (replyTo.message_type === "image" ? "صورة" : replyTo.message_type === "document" ? "مستند" : replyTo.message_type === "audio" ? "تسجيل صوتي" : "")}
                        </p>
                      </div>
                      <button onClick={() => setReplyTo(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-overlay transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Input area */}
                  {perms.canSend ? (
                    <div className="p-3 border-t border-border-normal relative">
                      {!wa.isConnected && wa.status !== "loading" && (
                        <div className={`flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-[11px] font-black border ${wa.status === "qr" ? "border-warning-border bg-warning-bg text-warning-text" : "border-danger-border bg-danger-bg text-danger"}`}>
                          {wa.status === "qr" ? <Smartphone className="h-3 w-3 animate-pulse" /> : <WifiOff className="h-3 w-3" />}
                          {wa.status === "qr" ? "واتساب في انتظار مسح QR" : "واتساب غير متصل — الإرسال متوقف مؤقتاً"}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" onChange={e => {
                          if (e.target.files?.[0]) sendFile(e.target.files[0]);
                          e.target.value = "";
                        }} />

                        <button onClick={() => fileInputRef.current?.click()}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary hover:bg-primary/20 transition-all active:scale-95"
                          title="إرفاق صورة أو ملف">
                          <Paperclip className="h-4 w-4" />
                        </button>

                        <button onClick={() => setShowEmojiPicker(prev => !prev)}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${showEmojiPicker ? "bg-primary text-white" : "text-text-muted hover:bg-primary-50 hover:text-primary"}`}
                          title="إيموجي">
                          <Smile className="h-4 w-4" />
                        </button>

                        {showEmojiPicker && (
                          <EmojiPicker
                            onSelect={handleEmojiSelect}
                            onClose={() => setShowEmojiPicker(false)}
                          />
                        )}

                        {recording ? (
                          <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-danger-bg border border-danger-border">
                            <div className="flex items-center gap-2">
                              <span className="flex h-3 w-3 rounded-full bg-danger animate-pulse" />
                              <span className="text-xs font-black text-danger">تسجيل</span>
                            </div>
                            <span className="text-sm font-black text-danger font-mono" dir="ltr">{formatTimer(recordingTimer)}</span>
                            <div className="flex-1" />
                            <button onClick={stopRecording}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-white hover:opacity-90 transition-all active:scale-95">
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={recording ? stopRecording : startRecording}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted hover:bg-danger-bg hover:text-danger transition-all active:scale-95"
                            title="تسجيل صوتي">
                            <Mic className="h-4 w-4" />
                          </button>
                        )}

                        <input ref={inputRef} type="text" value={sendText} onChange={e => setSendText(e.target.value)}
                          onKeyDown={handleInputKeyDown}
                          placeholder={uploadingMedia ? "جاري الرفع..." : "اكتب رسالتك..."} dir="rtl" disabled={uploadingMedia || recording}
                          className="flex-1 rounded-xl border border-border-normal bg-bg-input px-4 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors placeholder:text-text-muted disabled:opacity-50" />
                        <button onClick={handleSend} disabled={!sendText.trim() || sending || uploadingMedia || recording || !wa.isConnected}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-40 transition-all active:scale-95">
                          {sending || uploadingMedia ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border-t border-border-normal">
                      <p className="text-xs font-bold text-text-muted text-center">لا تملك صلاحية الإرسال</p>
                    </div>
                  )}
                </div>

                {/* Contact info panel */}
                {showContactInfo && (
                  <div className="w-72 shrink-0 border-r border-border-normal overflow-y-auto">
                    <div className="p-5 text-center border-b border-border-normal">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-xl font-black text-primary mx-auto mb-3">
                        {currConv?.contact_name?.charAt(0) || "?"}
                      </div>
                      <p className="text-sm font-black text-text-primary">{currConv?.contact_name || "غير معروف"}</p>
                      <p className="text-xs font-bold text-text-muted font-mono mt-1" dir="ltr">{selectedJid?.split("@")[0]}</p>
                      <div className="mt-2">
                        <ContactTypeBadge type={currConv?.contact_type} className="!inline-flex" />
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <p className="text-[11px] font-black text-text-muted mb-2">الوسائط المشتركة ({sharedMedia.length})</p>
                        {sharedMedia.length === 0 ? (
                          <p className="text-xs font-bold text-text-muted text-center py-4">لا توجد وسائط مشتركة</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5">
                            {sharedMedia.slice(0, 12).map((m, i) => (
                              m.message_type === "image" && m.media_url ? (
                                <img key={i} src={getMediaUrl(m.media_url)}
                                  onClick={() => setPreviewImage({ url: getMediaUrl(m.media_url), caption: m.caption })}
                                  className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                  alt="" />
                              ) : (
                                <div key={i} className="flex items-center justify-center aspect-square rounded-lg bg-bg-base">
                                  <File className="h-5 w-5 text-text-muted" />
                                </div>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={MessageCircle} title="اختر محادثة" description="اختر محادثة من القائمة لعرض الرسائل وإرسال الفواتير والملفات" />
            </div>
          )}
        </div>
      </div>

      {showInvoiceModal && currConv && (
        <SendInvoiceModal
          phone={selectedJid}
          contactName={currConv?.contact_name}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {previewImage && (
        <ImageLightbox url={previewImage.url} caption={previewImage.caption} onClose={() => setPreviewImage(null)} />
      )}
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MARKETING TAB — contacts + campaigns merged: pick people, send campaigns,
//  and watch progress from one place.
// ═══════════════════════════════════════════════════════════════════════════

function MarketingTab({ smsEnabled, emailEnabled, metaEnabled, perms, onConfigChanged }) {
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [wizardChannel, setWizardChannel] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOptedOut, setFilterOptedOut] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [sendInvoiceContact, setSendInvoiceContact] = useState(null);
  const [tagContact, setTagContact] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [waStatusMap, setWaStatusMap] = useState({});
  const [waChecking, setWaChecking] = useState(false);
  const [page, setPage] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);
  const [sortBy, setSortBy] = useState("id");
  const [tags, setTags] = useState([]);
  const [filterTag, setFilterTag] = useState("");
  const pageSize = 50;

  const keyOf = (c) => `${c.type}-${c.id}`;

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { q: search || undefined, page, limit: pageSize, sort: sortBy, order: "desc" };
      if (filterOptedOut === "opted_out") params.opted_out = "1";
      else if (filterOptedOut === "opted_in") params.marketing = "1";
      if (filterTag) params.tag_id = filterTag;
      const r = await api.get("/api/whatsapp/crm/contacts", { params });
      setContacts(r.data?.data || []);
      setTotalContacts(r.data?.total || 0);
    } catch { } finally { setLoading(false); }
  }, [search, filterOptedOut, page, sortBy, filterTag]);

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const r = await api.get("/api/whatsapp/crm/campaigns");
      setCampaigns(r.data?.data || []);
    } catch { } finally { setCampaignsLoading(false); }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const r = await api.get("/api/customer-tags");
      setTags(r.data?.data || []);
    } catch { }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  // Reset page when search/filter changes
  useEffect(() => { setPage(1); }, [search, filterOptedOut]);

  // Poll campaign progress more frequently while any campaign is still sending
  useEffect(() => {
    if (!campaigns.some(c => c.status === "active" && Number(c.sent_count) < Number(c.total))) return;
    const t = setInterval(fetchCampaigns, 3000);
    return () => clearInterval(t);
  }, [campaigns, fetchCampaigns]);

  const toggleSelect = (c) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(keyOf(c))) next.delete(keyOf(c)); else next.add(keyOf(c));
    return next;
  });
  const selectableContacts = contacts.filter(c => c.phone && !c.whatsapp_opt_out);
  const allVisibleSelected = selectableContacts.length > 0 && selectableContacts.every(c => selected.has(keyOf(c)));
  const toggleSelectAll = () => setSelected(allVisibleSelected ? new Set() : new Set(selectableContacts.map(keyOf)));
  const selectedRows = contacts.filter(c => selected.has(keyOf(c)));

  async function checkSelectedWhatsApp() {
    const toCheck = selectedRows.filter(c => c.phone && !waStatusMap[c.phone]);
    if (!toCheck.length) return;
    setWaChecking(true);
    try {
      const phones = toCheck.map(c => c.phone);
      const res = await api.post("/api/whatsapp/crm/check-whatsapp-batch", { phones });
      const data = res.data?.data || {};
      setWaStatusMap(prev => ({ ...prev, ...data }));
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل التحقق من واتساب");
    } finally { setWaChecking(false); }
  }

  async function setCampaignStatus(camp, status) {
    try {
      await api.put(`/api/whatsapp/crm/campaigns/${camp.id}`, { status });
      toast.success(status === "paused" ? "تم إيقاف الحملة مؤقتاً" : "تم استئناف الحملة");
      fetchCampaigns();
    } catch (e) { toast.error(e.response?.data?.message || "فشل تحديث الحملة"); }
  }

  async function deleteCampaign(camp) {
    const ok = await confirm({ title: "حذف الحملة", message: `حذف حملة «${camp.name || "بدون اسم"}»؟ ستتوقف الرسائل غير المرسلة.` });
    if (!ok) return;
    try {
      await api.delete(`/api/whatsapp/crm/campaigns/${camp.id}`);
      toast.success("تم حذف الحملة وإيقاف رسائلها المعلقة");
      fetchCampaigns();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحذف"); }
  }

  async function duplicateCampaign(camp) {
    try {
      await api.post(`/api/whatsapp/crm/campaigns/${camp.id}/duplicate`);
      toast.success("تم نسخ الحملة");
      fetchCampaigns();
    } catch (e) { toast.error(e.response?.data?.message || "فشل النسخ"); }
  }

  const [analyticsCampaign, setAnalyticsCampaign] = useState(null);

  return (
    <div className="space-y-5">
      {/* ── Action bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرقم..." dir="rtl"
            className="w-full rounded-xl bg-bg-surface border border-border-normal py-2.5 pr-9 pl-3 text-sm font-bold text-text-primary outline-none focus:border-primary transition-all placeholder:text-text-muted" />
        </div>
        <select value={filterOptedOut} onChange={e => setFilterOptedOut(e.target.value)}
          className="rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-bold text-text-secondary outline-none focus:border-primary">
          <option value="all">كل الجهات</option>
          <option value="opted_in">مشترك تسويق</option>
          <option value="opted_out">ملغي التسويق</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-bold text-text-secondary outline-none focus:border-primary">
          <option value="id">الأحدث</option>
          <option value="name">الاسم</option>
          <option value="last_message_at">آخر رسالة</option>
        </select>
        {tags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="rounded-xl border border-border-normal bg-bg-surface px-3 py-2.5 text-xs font-bold text-text-secondary outline-none focus:border-primary">
            <option value="">كل التاقات</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name} ({t.customer_count})</option>)}
          </select>
        )}
        {perms.canAdd && <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl border border-border-normal bg-bg-surface px-4 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base transition-all active:scale-95">
          <UserPlus className="h-4 w-4" /> إضافة جهة
        </button>}
        <button onClick={() => { fetchContacts(); fetchCampaigns(); }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base">
          <RefreshCw className={`h-4 w-4 ${loading || campaignsLoading ? "animate-spin" : ""}`} />
        </button>
        {perms.canAdd && <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-black text-white shadow-card hover:opacity-90 transition-all active:scale-95">
          <Megaphone className="h-4 w-4" />
          {selected.size > 0 ? `حملة للمحددين (${selected.size})` : "حملة جديدة"}
        </button>}
      </div>

      {/* ── Selection bar ──────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-50 px-4 py-2.5">
          <p className="text-xs font-black text-primary">تم تحديد {selected.size} جهة — الحملة القادمة ستُرسل لهم فقط</p>
          <button onClick={checkSelectedWhatsApp} disabled={waChecking}
            className="flex items-center gap-1.5 rounded-lg bg-success-bg px-3 py-1.5 text-[11px] font-black text-success-text hover:opacity-80 disabled:opacity-50 transition-all active:scale-95">
            {waChecking ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            التحقق من واتساب
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-[11px] font-black text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors">
            مسح التحديد
          </button>
        </div>
      )}

      {/* ── Meta Ads integration card ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-[24px] border border-border-normal bg-bg-surface p-6 shadow-sm hover:shadow-elevated transition-all duration-300 group">
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_50%,rgba(255,255,255,0)_100%)] pointer-events-none" />
        <div className={`absolute right-0 top-0 bottom-0 w-[4px] rounded-r-full ${metaEnabled ? "bg-success-text" : "bg-text-muted"
          }`} />
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm border ${metaEnabled ? "bg-success-bg border-success-border/30 text-success-text" : "bg-bg-base border-border-normal text-text-muted"
            }`}>
            <Globe className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-text-primary tracking-tight">Meta Ads</h3>
              <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black tracking-wide ${metaEnabled ? "bg-success-bg border-success-border/30 text-success-text" : "bg-bg-base border-border-normal text-text-muted"
                }`}>
                {metaEnabled ? "مربوط" : "غير مربوط"}
              </span>
            </div>
            <p className="text-[11px] font-bold text-text-secondary mt-1.5 leading-relaxed">إنشاء جماهير مخصصة من عملائك واستيراد العملاء المحتملين من إعلانات Meta</p>
          </div>
          <button onClick={() => setWizardChannel("meta")}
            className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black transition-all active:scale-[0.98] ${metaEnabled
                ? "border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"
                : "bg-primary text-white shadow-sm hover:opacity-90"
              }`}>
            {metaEnabled ? <Settings className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
            {metaEnabled ? "الإعدادات" : "ربط Meta"}
          </button>
        </div>
        <div className="mt-5 pt-4 border-t border-border-subtle/50 flex flex-wrap gap-1.5">
          {["إنشاء جماهير مخصصة من قائمة العملاء", "استيراد العملاء المحتملين من نماذج الإعلانات", "تتبع محمل الإعلانات"].map(tag => (
            <span key={tag} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-base border border-border-subtle/40 text-[10px] font-black text-text-secondary">
              <Zap className="h-3 w-3 text-text-muted" />{tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Running / past campaigns ───────────────────────────── */}
      {(campaigns.length > 0 || campaignsLoading) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-black text-text-primary">الحملات</h3>
            <span className="text-[11px] font-bold text-text-muted">{campaigns.length}</span>
          </div>
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-text-muted" /></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map(camp => {
                const total = Number(camp.total) || 0;
                const sent = Number(camp.sent_count) || 0;
                const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
                const isSending = camp.status === "active" && sent < total;
                return (
                  <div key={camp.id} className="rounded-xl border border-border-normal bg-bg-surface p-4 shadow-card hover:shadow-elevated transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-black text-text-primary truncate">{camp.name || "بدون اسم"}</p>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${camp.channel === "sms" ? "bg-info-bg text-info-text" : camp.channel === "email" ? "bg-danger-bg text-danger-text" : "bg-success-bg text-success-text"
                            }`}>
                            {camp.channel === "sms" ? "SMS" : camp.channel === "email" ? "بريد" : "واتساب"}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-text-muted mt-0.5">
                          {new Date(camp.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-black ${camp.status === "done" ? "bg-success-bg text-success-text"
                        : camp.status === "scheduled" ? "bg-info-bg text-info-text"
                          : isSending ? "bg-info-bg text-info-text animate-pulse"
                            : "bg-warning-bg text-warning-text"
                        }`}>
                        {camp.status === "done" ? "اكتملت" : camp.status === "scheduled" ? "مجدولة" : isSending ? "جاري الإرسال..." : "متوقفة"}
                      </span>
                    </div>
                    {camp.image_url && (
                      <div className="mb-2.5 rounded-lg overflow-hidden border border-border-subtle">
                        <img src={camp.image_url.startsWith("http") ? camp.image_url : `${api.defaults?.baseURL || ""}${camp.image_url}`} alt="" className="w-full h-24 object-cover" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                        <span>أُرسل {sent} من {total}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-bg-base overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isSending ? "bg-primary animate-pulse" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                      </div>
                      {isSending && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                          <span className="text-[10px] font-bold text-primary">جارٍ الإرسال — {total - sent} متبقي</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-text-secondary mt-2 line-clamp-1 leading-relaxed">
                      {camp.body?.slice(0, 80)}{camp.body?.length > 80 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border-subtle">
                      {perms.canEdit && camp.status === "active" && sent < total && (
                        <button onClick={() => setCampaignStatus(camp, "paused")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning-bg text-warning-text text-[11px] font-black hover:opacity-80 transition-all active:scale-95">
                          <Pause className="h-3 w-3" /> إيقاف مؤقت
                        </button>
                      )}
                      {perms.canEdit && camp.status === "paused" && (
                        <button onClick={() => setCampaignStatus(camp, "active")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success-bg text-success-text text-[11px] font-black hover:opacity-80 transition-all active:scale-95">
                          <Play className="h-3 w-3" /> استئناف
                        </button>
                      )}
                      {perms.canDelete && <button onClick={() => deleteCampaign(camp)}
                        className="mr-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-danger text-[11px] font-black hover:bg-danger-bg transition-all active:scale-95">
                        <Trash2 className="h-3 w-3" /> حذف
                      </button>}
                      {perms.canAdd && (
                        <button onClick={() => duplicateCampaign(camp)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-bg-base text-text-secondary text-[11px] font-black hover:bg-bg-overlay transition-all active:scale-95">
                          <Copy className="h-3 w-3" /> نسخ
                        </button>
                      )}
                      <button onClick={() => setAnalyticsCampaign(camp)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-info-bg text-info-text text-[11px] font-black hover:opacity-80 transition-all active:scale-95">
                        <BarChart3 className="h-3 w-3" /> تحليل
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Contacts table ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-black text-text-primary">جهات الاتصال</h3>
          <span className="text-[11px] font-bold text-text-muted">حدّد جهات من الجدول لإرسال حملة لهم فقط</span>
        </div>
        <div className="rounded-xl border border-border-normal bg-bg-surface shadow-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>
          ) : contacts.length === 0 ? (
            <EmptyState icon={Users} title="لا توجد جهات اتصال" description={
              search ? "لا توجد نتائج للبحث" : "أضف عملاء من نقطة البيع أو أضف جهة اتصال يدوياً"
            } action={
              perms.canAdd ? <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-black text-white">
                <UserPlus className="h-4 w-4" /> إضافة جهة اتصال
              </button> : undefined
            } />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-normal bg-bg-base">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll}
                        title="تحديد الكل"
                        className="h-4 w-4 rounded border-border-normal text-primary focus:ring-primary cursor-pointer" />
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">الاسم</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">الهاتف</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">واتساب</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">البريد</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">التاقات</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">النوع</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">التسويق</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">المصدر</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">آخر رسالة</th>
                    <th className="text-right px-4 py-3 text-[11px] font-black text-text-secondary">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => {
                    const selectable = Boolean(c.phone) && !c.whatsapp_opt_out;
                    return (
                      <tr key={keyOf(c)} className={`border-b border-border-subtle hover:bg-bg-overlay transition-colors ${selected.has(keyOf(c)) ? "bg-primary-50" : c.capture_source === "walk_in_wa" ? "bg-primary-50/40" : ""
                        }`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(keyOf(c))} disabled={!selectable}
                            onChange={() => toggleSelect(c)}
                            title={selectable ? "" : "لا يمكن التحديد — بدون رقم أو ملغي التسويق"}
                            className="h-4 w-4 rounded border-border-normal text-primary focus:ring-primary cursor-pointer disabled:opacity-30" />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-black text-text-primary">{c.name || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-text-muted font-mono" dir="ltr">{c.phone}</span>
                        </td>
                        <td className="px-4 py-3">
                          {c.phone && waStatusMap[c.phone] === true ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-bg text-success-text text-[11px] font-black">
                              <CheckCircle className="h-3 w-3" /> موجود
                            </span>
                          ) : c.phone && waStatusMap[c.phone] === false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger-bg text-danger text-[11px] font-black">
                              <X className="h-3 w-3" /> غير موجود
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.email ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-bg text-success-text text-[11px] font-black">
                              <Mail className="h-3 w-3" /> {c.email}
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {c.tags ? c.tags.split(",").map((tag, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-primary-50 text-primary text-[10px] font-black">{tag}</span>
                            )) : (
                              <span className="text-[11px] text-text-muted">—</span>
                            )}
                            {perms.canEdit && c.type === "customer" && (
                              <button onClick={() => setTagContact(c)} title="إدارة التاقات"
                                className="flex h-5 w-5 items-center justify-center rounded-md bg-bg-base border border-border-subtle text-text-muted hover:text-primary hover:border-primary transition-colors">
                                <Tags className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${c.type === "customer" ? "bg-info-bg text-info-text" : "bg-warning-bg text-warning-text"
                            }`}>
                            {c.type === "customer" ? "عميل" : "عميل محتمل"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.whatsapp_opt_out ? (
                            <span className="px-2 py-0.5 rounded-full bg-danger-bg text-danger text-[11px] font-black">ملغي</span>
                          ) : c.marketing_opt_in ? (
                            <span className="px-2 py-0.5 rounded-full bg-success-bg text-success-text text-[11px] font-black">مشترك</span>
                          ) : (
                            <span className="text-[11px] text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-text-muted">{c.capture_source === "walk_in_wa" ? "واتساب سريع" : c.capture_source === "pos_sale" ? "بيع" : c.capture_source === "quick_add" ? "إضافة سريعة" : c.type === "customer" ? "يدوي" : c.capture_source || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-text-muted">{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString("ar-EG") : "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          {c.phone && perms.canSend && (
                            <button onClick={() => setSendInvoiceContact(c)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-info-bg text-info-text hover:bg-info-bg/80 text-[11px] font-black transition-all active:scale-95">
                              <FileText className="h-3.5 w-3.5" /> إرسال فاتورة
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && contacts.length > 0 && (
            <div className="px-4 py-3 border-t border-border-normal bg-bg-base flex items-center justify-between">
              <p className="text-xs font-bold text-text-muted">إجمالي {totalContacts} جهة اتصال{selected.size > 0 ? ` — محدد ${selected.size}` : ""}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-border-normal bg-bg-surface text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
                  السابق
                </button>
                <span className="text-xs font-bold text-text-muted">صفحة {page} / {Math.max(1, Math.ceil(totalContacts / pageSize))}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={contacts.length < pageSize}
                  className="px-3 py-1.5 rounded-lg border border-border-normal bg-bg-surface text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && <AddContactModal onClose={() => { setShowAddModal(false); fetchContacts(); }} />}
      {sendInvoiceContact && (
        <SendInvoiceModal
          phone={sendInvoiceContact.phone}
          contactName={sendInvoiceContact.name}
          contactEmail={sendInvoiceContact.email}
          emailEnabled={emailEnabled}
          onClose={() => setSendInvoiceContact(null)}
        />
      )}
      {createOpen && (
        <CreateCampaignModal
          smsEnabled={smsEnabled}
          emailEnabled={emailEnabled}
          preselected={selectedRows}
          onClose={(created) => {
            setCreateOpen(false);
            if (created) { setSelected(new Set()); fetchCampaigns(); }
          }}
        />
      )}
      {analyticsCampaign && (
        <CampaignAnalyticsModal campaign={analyticsCampaign} onClose={() => setAnalyticsCampaign(null)} />
      )}
      {wizardChannel === "meta" && <MetaAdsWizard onClose={() => setWizardChannel(null)} onSaved={onConfigChanged} />}
      {tagContact && (
        <AssignTagModal
          contact={tagContact}
          currentTags={tagContact.tags}
          onClose={() => setTagContact(null)}
          onSaved={fetchContacts}
        />
      )}
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}

// ─── Add Contact Modal ───────────────────────────────────────────────────

function AddContactModal({ onClose }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolvedName, setResolvedName] = useState(null);

  async function resolveName() {
    if (!phone.trim() || phone.trim().length < 10) return;
    setResolving(true);
    try {
      const r = await api.post("/api/whatsapp/crm/contacts/resolve", { phone: phone.trim() });
      const resolved = r.data?.data;
      if (resolved) { setResolvedName(resolved); setName(resolved); }
    } catch { } finally { setResolving(false); }
  }

  useEffect(() => {
    setResolvedName(null);
    const timer = setTimeout(resolveName, 600);
    return () => clearTimeout(timer);
  }, [phone]);

  async function save() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("رقم الهاتف يجب أن يحتوي على 10 أرقام على الأقل"); return; }
    setSaving(true);
    try {
      await api.post("/api/leads", {
        phone: phone.trim(),
        name: name.trim() || undefined,
        source: "quick_add",
      });
      toast.success("تم حفظ جهة الاتصال");
      onClose();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-sm mx-4 rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> إضافة جهة اتصال
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block">رقم الهاتف *</label>
            <input type="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="01001234567"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold text-right outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
          </div>
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block flex items-center gap-1.5">
              الاسم
              {resolving && <RefreshCw className="h-3 w-3 animate-spin text-text-muted" />}
              {resolvedName && <Check className="h-3 w-3 text-success-text" />}
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="الاسم (اختياري)"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors placeholder:text-text-muted" />
            {resolvedName && <p className="text-[11px] font-bold text-success-text mt-1">تم العثور على الاسم من واتساب</p>}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base transition-all">
            إلغاء
          </button>
          <button onClick={save} disabled={!phone.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("telegram.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Tag Modal ─────────────────────────────────────────────────────

function AssignTagModal({ contact, currentTags, onClose, onSaved }) {
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set((currentTags || "").split(",").filter(Boolean)));
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/customer-tags");
      setAllTags(r.data?.data || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  function toggleTag(name) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/customer-tags", { name: newTagName.trim(), color: newTagColor });
      setNewTagName("");
      await fetchTags();
    } catch (e) { toast.error(e.response?.data?.message || "فشل إنشاء التاق"); }
    finally { setCreating(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const tagIds = allTags.filter(t => selected.has(t.name)).map(t => t.id);
      await api.post("/api/customer-tags/assign", { customer_id: contact.id, tag_ids: tagIds });
      toast.success("تم تحديث التاقات");
      onSaved?.();
      onClose();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-sm mx-4 rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" /> تاقات — {contact.name || contact.phone}
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-text-muted" /></div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-48 overflow-y-auto space-y-1">
              {allTags.length === 0 ? (
                <p className="text-xs font-bold text-text-muted text-center py-4">لا توجد تاقات — أنشئ تاقاً أولاً</p>
              ) : allTags.map(tag => (
                <button key={tag.id} onClick={() => toggleTag(tag.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-right ${selected.has(tag.name) ? "border-primary bg-primary-50" : "border-border-normal bg-bg-surface hover:border-border-strong"
                    }`}>
                  <div className="h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={{ borderColor: tag.color || "#6366f1", backgroundColor: selected.has(tag.name) ? (tag.color || "#6366f1") : "transparent" }}>
                    {selected.has(tag.name) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm font-black text-text-primary flex-1">{tag.name}</span>
                  <span className="text-[10px] font-bold text-text-muted">{tag.customer_count} عميل</span>
                </button>
              ))}
            </div>

            <div className="border-t border-border-normal pt-3">
              <p className="text-[11px] font-black text-text-secondary mb-2">إنشاء تاق جديد</p>
              <div className="flex gap-2">
                <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)}
                  className="h-9 w-9 rounded-lg border border-border-normal cursor-pointer shrink-0" />
                <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createTag()}
                  placeholder="اسم التاق..." dir="rtl"
                  className="flex-1 rounded-lg border border-border-normal bg-bg-input px-3 py-2 text-xs font-bold outline-none focus:border-primary transition-colors" />
                <button onClick={createTag} disabled={!newTagName.trim() || creating}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-success-bg text-success-text px-3 py-2 text-[11px] font-black hover:opacity-80 disabled:opacity-50 transition-all active:scale-95">
                  {creating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  إنشاء
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base transition-all">
            إلغاء
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  CREATE CAMPAIGN MODAL — guided: who → what → how. Shows the exact recipient
//  list, fills from templates, and inserts variables via chips (no need to
//  know the {name} syntax).
// ═══════════════════════════════════════════════════════════════════════════

const MESSAGE_VARS = [
  { token: "{name}", label: "اسم العميل", sample: "أحمد" },
  { token: "{phone}", label: "رقم الهاتف", sample: "01001234567" },
  { token: "{shop}", label: "اسم المتجر", sample: "متجرك" },
];

function renderMessagePreview(body, recipient) {
  return body
    .replace(/\{name\}/g, recipient?.name || "أحمد")
    .replace(/\{phone\}/g, recipient?.phone_normalized || recipient?.phone || "01001234567")
    .replace(/\{shop\}/g, "متجرك");
}

function VariableChips({ onInsert }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold text-text-muted">أدرج في الرسالة:</span>
      {MESSAGE_VARS.map(v => (
        <button key={v.token} type="button" onClick={() => onInsert(v.token)}
          title={`مثال: ${v.sample}`}
          className="px-2 py-1 rounded-full bg-primary-50 text-primary text-[10px] font-black hover:bg-primary hover:text-white transition-colors">
          + {v.label}
        </button>
      ))}
    </div>
  );
}

function CreateCampaignModal({ onClose, smsEnabled = false, emailEnabled = false, preselected = [] }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [audienceMode, setAudienceMode] = useState(preselected.length ? "custom" : "customers");
  const [audience, setAudience] = useState([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateKind, setTemplateKind] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);

  async function uploadCampaignImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/api/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url) setImageUrl(res.data.url);
      else toast.error("فشل رفع الصورة");
    } catch (e) { toast.error(e.response?.data?.message || "فشل رفع الصورة"); }
    finally { setImageUploading(false); }
  }

  function handleCampaignDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) uploadCampaignImage(file);
  }

  function handleCampaignFileChange(e) {
    const file = e.target.files?.[0];
    if (file) uploadCampaignImage(file);
    e.target.value = "";
  }

  useEffect(() => {
    api.get("/api/whatsapp/crm/templates").then(r => setTemplates(r.data?.data || [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (audienceMode === "custom") return;
    setAudienceLoading(true);
    api.get("/api/leads/audience", { params: { include: audienceMode } })
      .then(r => setAudience(r.data?.data || []))
      .catch(() => setAudience([]))
      .finally(() => setAudienceLoading(false));
  }, [audienceMode]);

  const recipients = audienceMode === "custom" ? preselected : audience;

  function insertVar(token) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  function applyTemplate(kind) {
    setTemplateKind(kind);
    if (!kind) return;
    const tpl = templates.find(t => t.kind === kind);
    if (tpl) setBody(tpl.body || "");
  }

  async function handleCreate() {
    if (!body.trim() || !recipients.length) return;
    if (channel === "email" && !emailSubject.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || undefined,
        body: body.trim(),
        channel,
        filters: { include: audienceMode },
        image_url: imageUrl || undefined,
        scheduled_at: scheduledAt || undefined,
      };
      if (channel === "email" && emailSubject.trim()) {
        payload.email_subject = emailSubject.trim();
      }
      if (audienceMode === "custom") {
        payload.recipients = preselected.map(c => ({
          customer_id: c.type === "customer" ? c.id : null,
          lead_id: c.type === "lead" ? c.id : null,
          name: c.name || null,
          phone: c.phone,
        }));
      }
      await api.post("/api/whatsapp/crm/campaigns", payload);
      toast.success(`تم إنشاء الحملة — ${recipients.length} رسالة في قائمة الإرسال`);
      onClose(true);
    } catch (e) { toast.error(e.response?.data?.message || "فشل إنشاء الحملة"); }
    finally { setSaving(false); }
  }

  const audienceOptions = [
    ...(preselected.length ? [{ id: "custom", label: `المحددون من الجدول (${preselected.length})`, hint: "الجهات التي حددتها بنفسك" }] : []),
    { id: "customers", label: "العملاء المشتركون", hint: "عملاء وافقوا على استلام التسويق" },
    { id: "both", label: "الكل — عملاء ومحتملون", hint: "يشمل أرقام الواتساب المحفوظة من الكاشير" },
  ];

  const usableForChannel = (tpl) => !tpl.channel || tpl.channel === "both" || tpl.channel === channel;
  const customTemplates = templates.filter(t => !t.is_system && usableForChannel(t));
  const systemTemplates = templates.filter(t => t.is_system && usableForChannel(t));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={() => onClose(false)}>
      <div dir="rtl" className="w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> حملة جديدة
          </h3>
          <button onClick={() => onClose(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* ── ١ الجمهور — who exactly gets it ─────────────────── */}
          <div className="rounded-xl border border-border-normal p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[11px] font-black">١</span>
              <p className="text-sm font-black text-text-primary">إلى من ستُرسل؟</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {audienceOptions.map(opt => (
                <button key={opt.id} type="button" onClick={() => setAudienceMode(opt.id)}
                  className={`rounded-xl border p-3 text-right transition-all ${audienceMode === opt.id ? "border-primary bg-primary-50" : "border-border-normal bg-bg-surface hover:border-border-strong"
                    }`}>
                  <p className={`text-xs font-black ${audienceMode === opt.id ? "text-primary" : "text-text-primary"}`}>{opt.label}</p>
                  <p className="text-[10px] font-bold text-text-muted mt-0.5">{opt.hint}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-lg bg-info-bg border border-info-border px-4 py-2.5">
              {audienceLoading ? (
                <p className="text-xs font-bold text-info-text flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> جارٍ حساب المستلمين...</p>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-info-text">
                    ستصل الرسالة إلى <span className="text-lg">{recipients.length}</span> مستلم
                  </p>
                  {recipients.length > 0 && (
                    <button type="button" onClick={() => setShowRecipients(s => !s)}
                      className="text-[11px] font-black text-info-text underline underline-offset-2 hover:opacity-80">
                      {showRecipients ? "إخفاء الأسماء" : "عرض الأسماء"}
                    </button>
                  )}
                </div>
              )}
              {showRecipients && recipients.length > 0 && (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-bg-surface border border-border-subtle divide-y divide-border-subtle">
                  {recipients.slice(0, 100).map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-xs font-bold text-text-primary truncate">{r.name || "بدون اسم"}</span>
                      <span className="text-[11px] font-mono text-text-muted shrink-0" dir="ltr">{r.phone_normalized || r.phone}</span>
                    </div>
                  ))}
                  {recipients.length > 100 && (
                    <p className="px-3 py-1.5 text-[11px] font-bold text-text-muted">و {recipients.length - 100} آخرون...</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── ٢ الرسالة — template + variables + live preview ──── */}
          <div className="rounded-xl border border-border-normal p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[11px] font-black">٢</span>
              <p className="text-sm font-black text-text-primary">{channel === "email" ? "موضوع الرسالة ومحتواها" : "ماذا ستقول؟"}</p>
            </div>
            <div className="space-y-3">
              {channel === "email" && (
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  placeholder="موضوع البريد الإلكتروني — مثال: عرض خاص لك"
                  className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select value={templateKind} onChange={e => applyTemplate(e.target.value)}
                  className="rounded-lg border border-border-normal bg-bg-surface px-3 py-2 text-xs font-bold text-text-secondary outline-none focus:border-primary">
                  <option value="">— ابدأ من قالب جاهز (اختياري) —</option>
                  {customTemplates.length > 0 && (
                    <optgroup label="قوالبي">
                      {customTemplates.map(t => <option key={t.kind} value={t.kind}>{t.label || t.kind}</option>)}
                    </optgroup>
                  )}
                  {systemTemplates.length > 0 && (
                    <optgroup label="القوالب التلقائية">
                      {systemTemplates.map(t => <option key={t.kind} value={t.kind}>{CATEGORY_META[t.kind]?.label || t.kind}</option>)}
                    </optgroup>
                  )}
                </select>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="اسم الحملة (اختياري) — مثال: عرض الجمعة"
                  className="flex-1 min-w-[180px] rounded-lg border border-border-normal bg-bg-input px-3 py-2 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
              </div>
              <textarea ref={bodyRef} rows={4} value={body} onChange={e => setBody(e.target.value)}
                placeholder="اكتب رسالتك... استخدم أزرار الإدراج بالأسفل لتخصيصها باسم كل عميل تلقائياً"
                className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface resize-none transition-colors" />
              <VariableChips onInsert={insertVar} />

              {/* Image upload with drag-and-drop */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCampaignFileChange} />
              {imageUrl ? (
                <div className="relative rounded-xl border border-border-normal overflow-hidden">
                  <img src={imageUrl.startsWith("http") ? imageUrl : `${api.defaults?.baseURL || ""}${imageUrl}`} alt="" className="w-full max-h-48 object-contain bg-bg-base" />
                  <button type="button" onClick={() => setImageUrl(null)}
                    className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow-lg hover:opacity-90 transition-all active:scale-90">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {imageUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <RefreshCw className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleCampaignDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all
                    ${dragOver ? "border-primary bg-primary-50" : "border-border-normal bg-bg-base hover:border-primary hover:bg-primary-50/50"}
                    ${imageUploading ? "pointer-events-none opacity-60" : ""}`}
                >
                  {imageUploading ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Image className="h-6 w-6 text-text-muted" />
                  )}
                  <p className="text-xs font-bold text-text-secondary">
                    {imageUploading ? "جارٍ رفع الصورة..." : "اسحب صورة هنا أو اضغط للاختيار"}
                  </p>
                  <p className="text-[10px] font-bold text-text-muted">اختياري — صورة مع الرسالة (JPEG, PNG, WebP)</p>
                </div>
              )}

              {body.trim() && (
                <div>
                  <p className="text-[10px] font-black text-text-muted mb-1">معاينة كما ستصل {recipients[0]?.name ? `لـ«${recipients[0].name}»` : "للعميل"}:</p>
                  <div className="rounded-xl rounded-br-md bg-success-bg border border-success-border px-4 py-3">
                    <p className="text-sm font-bold text-text-primary whitespace-pre-wrap leading-relaxed">{renderMessagePreview(body, recipients[0])}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── ٣ القناة والإرسال ─────────────────────────────────── */}
          <div className="rounded-xl border border-border-normal p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[11px] font-black">٣</span>
              <p className="text-sm font-black text-text-primary">كيف ستُرسل؟</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-border-normal overflow-hidden">
                <button type="button" onClick={() => setChannel("whatsapp")}
                  className={`px-4 py-2 text-xs font-black transition-colors ${channel === "whatsapp" ? "bg-primary text-white" : "bg-bg-surface text-text-secondary hover:bg-bg-base"
                    }`}>
                  واتساب
                </button>
                <button type="button" onClick={() => smsEnabled && setChannel("sms")} disabled={!smsEnabled}
                  title={smsEnabled ? "الإرسال عبر بوابة SMS المدفوعة" : "فعّل خدمة SMS من لوحة التحكم (بطاقة رسائل SMS) أولاً"}
                  className={`px-4 py-2 text-xs font-black transition-colors border-r border-border-normal ${channel === "sms" ? "bg-primary text-white" : "bg-bg-surface text-text-secondary hover:bg-bg-base"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}>
                  رسائل SMS
                </button>
                <button type="button" onClick={() => emailEnabled && setChannel("email")} disabled={!emailEnabled}
                  title={emailEnabled ? "الإرسال عبر البريد الإلكتروني" : "فعّل خدمة البريد الإلكتروني من لوحة التحكم (بطاقة البريد الإلكتروني) أولاً"}
                  className={`px-4 py-2 text-xs font-black transition-colors border-r border-border-normal ${channel === "email" ? "bg-primary text-white" : "bg-bg-surface text-text-secondary hover:bg-bg-base"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}>
                  البريد الإلكتروني
                </button>
              </div>
              <span className="text-[11px] font-bold text-text-muted">
                {channel === "email" ? (emailEnabled ? "مجانية — عبر SMTP" : "البريد غير مفعّل — فعّله من لوحة التحكم")
                  : channel === "sms" ? "مدفوعة — عبر بوابة المزوّد"
                    : smsEnabled ? "مجانية — عبر حساب واتساب المربوط" : "SMS غير مفعّلة — فعّلها من لوحة التحكم"}
              </span>
            </div>

            {/* Scheduling */}
            <div className="mt-4 pt-4 border-t border-border-subtle/50">
              <div className="flex items-center gap-2.5 mb-2">
                <CalendarDays className="h-4 w-4 text-text-muted" />
                <p className="text-xs font-black text-text-secondary">جدولة الإرسال</p>
              </div>
              <p className="text-[11px] font-bold text-text-muted mb-2">اتركه فارغاً للإرسال فوراً، أو اختر موعداً لاحقاً</p>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                dir="ltr"
                className="rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
              {scheduledAt && (
                <p className="text-[11px] font-bold text-primary mt-1.5">
                  سيُرسل تلقائياً في {new Date(scheduledAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={() => onClose(false)} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base">
            إلغاء
          </button>
          <button onClick={handleCreate} disabled={!body.trim() || !recipients.length || saving || (channel === "email" && !emailSubject.trim())}
            className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {saving ? "جارٍ الإنشاء..." : `إرسال إلى ${recipients.length} مستلم عبر ${channel === "email" ? "البريد الإلكتروني" : channel === "sms" ? "SMS" : "واتساب"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignAnalyticsModal({ campaign, onClose }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/whatsapp/crm/campaigns/${campaign.id}/analytics`)
      .then(r => setAnalytics(r.data?.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [campaign.id]);

  const c = analytics?.campaign || {};
  const emailStats = analytics?.emailStats;
  const total = Number(c.total) || 0;
  const sent = Number(c.sent) || 0;
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-info-text" /> تحليل الحملة
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-border-normal p-4">
              <p className="text-sm font-black text-text-primary mb-1">{c.name || "بدون اسم"}</p>
              <p className="text-[11px] font-bold text-text-muted">{new Date(c.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-border-normal p-3 text-center">
                <p className="text-2xl font-black text-text-primary">{total}</p>
                <p className="text-[10px] font-bold text-text-muted">إجمالي</p>
              </div>
              <div className="rounded-xl border border-border-normal p-3 text-center">
                <p className="text-2xl font-black text-success-text">{sent}</p>
                <p className="text-[10px] font-bold text-text-muted">أُرسل</p>
              </div>
              <div className="rounded-xl border border-border-normal p-3 text-center">
                <p className="text-2xl font-black text-info-text">{c.delivered || 0}</p>
                <p className="text-[10px] font-bold text-text-muted">وصل</p>
              </div>
              <div className="rounded-xl border border-border-normal p-3 text-center">
                <p className="text-2xl font-black text-danger-text">{c.failed || 0}</p>
                <p className="text-[10px] font-bold text-text-muted">فشل</p>
              </div>
            </div>

            <div className="rounded-xl border border-border-normal p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-secondary">نسبة الإرسال</span>
                <span className="text-sm font-black text-primary">{pct}%</span>
              </div>
              <div className="h-3 rounded-full bg-bg-base overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {emailStats && (
              <div className="rounded-xl border border-border-normal p-4">
                <p className="text-xs font-black text-text-secondary mb-3">إحصائيات البريد الإلكتروني</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xl font-black text-success-text">{emailStats.opened}</p>
                    <p className="text-[10px] font-bold text-text-muted">فتح</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-info-text">{emailStats.clicked}</p>
                    <p className="text-[10px] font-bold text-text-muted">نقر</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-danger-text">{emailStats.bounced}</p>
                    <p className="text-[10px] font-bold text-text-muted">ارتداد</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border-normal p-4">
              <p className="text-xs font-black text-text-secondary mb-2">محتوى الرسالة</p>
              <p className="text-xs text-text-muted whitespace-pre-wrap leading-relaxed">{c.body}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span className="group relative cursor-help shrink-0">
      <Info className="h-3 w-3 text-text-muted hover:text-text-secondary transition-colors" />
      <div className="absolute bottom-full right-0 mb-2 z-20 hidden w-56 rounded-lg bg-primary-700 p-3 text-xs font-bold text-white shadow-modal leading-relaxed group-hover:block">
        {text}
        <div className="absolute top-full right-3 -mt-1 h-2 w-2 rotate-45 bg-primary-700" />
      </div>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  TEMPLATES TAB
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
//  SMS SETUP MODAL (paid gateway — opened from the SMS channel card)
// ═══════════════════════════════════════════════════════════════════════════

function SmsSetupModal({ onClose, onSaved }) {
  const { sms, setSms, loading, loadError, saving, saved, testPhone, setTestPhone, testing, save, sendTest } = useSmsConnect(onSaved);

  const StepBadge = ({ n, done }) => (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${done ? "bg-success-text text-white" : "bg-primary text-white"
      }`}>
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> تفعيل رسائل SMS
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] font-bold text-text-muted mb-5">قناة مدفوعة عبر مزوّد خارجي — تصل رسائلها لأي هاتف حتى بدون واتساب</p>

        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>
        ) : loadError ? (
          <EmptyState icon={Settings} title="لا تملك صلاحية الإعدادات" description="تفعيل بوابة SMS يتطلب حساب مدير بصلاحية إعدادات النظام" />
        ) : (
          <div className="space-y-5">
            {/* Step 1 — provider credentials */}
            <div className="rounded-xl border border-border-normal p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <StepBadge n="١" done={Boolean(sms.sms_api_url.trim())} />
                <div>
                  <p className="text-sm font-black text-text-primary">بيانات مزوّد الخدمة</p>
                  <p className="text-[11px] font-bold text-text-muted">من حسابك لدى المزوّد (مثل SMS Misr أو Cequens)</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black text-text-secondary mb-1.5 block">رابط بوابة الإرسال (API URL) *</label>
                  <input type="url" dir="ltr" value={sms.sms_api_url}
                    onChange={e => setSms(s => ({ ...s, sms_api_url: e.target.value }))}
                    placeholder="https://smsmisr.com/api/SMS/..."
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-text-secondary mb-1.5 block">مفتاح API</label>
                    <input type="password" dir="ltr" value={sms.sms_api_key}
                      onChange={e => setSms(s => ({ ...s, sms_api_key: e.target.value }))}
                      className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-text-secondary mb-1.5 block">اسم المرسل (Sender ID)</label>
                    <input type="text" dir="ltr" value={sms.sms_sender}
                      onChange={e => setSms(s => ({ ...s, sms_sender: e.target.value }))}
                      placeholder="MyStore"
                      className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
                  </div>
                </div>
                <details className="group">
                  <summary className="text-[11px] font-black text-text-muted cursor-pointer hover:text-text-secondary transition-colors list-none flex items-center gap-1">
                    <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                    إعدادات متقدمة — قالب الطلب JSON
                  </summary>
                  <div className="mt-2">
                    <textarea rows={2} dir="ltr" value={sms.sms_body_template}
                      onChange={e => setSms(s => ({ ...s, sms_body_template: e.target.value }))}
                      placeholder='{"to":"{phone}","message":"{message}","sender":"{sender}","api_key":"{api_key}"}'
                      className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-[11px] font-mono outline-none focus:border-primary focus:bg-bg-surface resize-none transition-colors" />
                    <p className="text-[10px] font-bold text-text-muted mt-1">المتغيرات: {"{phone} {message} {sender} {api_key}"} — اتركه فارغاً للقالب الافتراضي</p>
                  </div>
                </details>
              </div>
            </div>

            {/* Step 2 — enable + save */}
            <div className="rounded-xl border border-border-normal p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <StepBadge n="٢" done={saved} />
                <p className="text-sm font-black text-text-primary">التفعيل</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 items-center justify-between rounded-lg border border-border-normal bg-bg-input px-4 py-2.5 cursor-pointer">
                  <span className="text-xs font-black text-text-primary">تشغيل قناة SMS</span>
                  <input type="checkbox" checked={sms.sms_enabled}
                    onChange={e => setSms(s => ({ ...s, sms_enabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-border-normal text-primary focus:ring-primary" />
                </label>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  حفظ
                </button>
              </div>
            </div>

            {/* Step 3 — test */}
            <div className={`rounded-xl border p-4 ${saved ? "border-border-normal" : "border-border-subtle opacity-60"}`}>
              <div className="flex items-center gap-2.5 mb-3">
                <StepBadge n="٣" done={false} />
                <div>
                  <p className="text-sm font-black text-text-primary">جرّب الإرسال</p>
                  <p className="text-[11px] font-bold text-text-muted">أرسل رسالة تجريبية لرقمك للتأكد من عمل البوابة</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="tel" dir="ltr" value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="01xxxxxxxxx" disabled={!saved}
                  className="flex-1 min-w-0 rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors disabled:opacity-50" />
                <button onClick={sendTest} disabled={testing || !testPhone.trim() || !saved}
                  title={!saved ? "فعّل الخدمة واحفظ أولاً" : "إرسال رسالة تجريبية"}
                  className="flex items-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-4 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95">
                  {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  إرسال تجريبي
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TelegramSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-bg-overlay"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-bg-surface shadow transition-transform ${checked ? "rtl:-translate-x-[14px] ltr:translate-x-[14px]" : "rtl:-translate-x-[2px] ltr:translate-x-[2px]"}`} />
      </button>
      {label ? <span className="text-[11px] font-black text-text-primary truncate">{label}</span> : null}
    </label>
  );
}

// ─── Telegram tab: module-scope building blocks ─────────────────────────────
// These are defined OUTSIDE TelegramTab on purpose: nested component functions
// get a new identity on every parent render, which makes React remount them
// and drop input focus/state on each keystroke.

// Each toggle field maps to the message_templates kind used for its preview.
const TG_EVENT_TEMPLATE_MAP = {
  notifyNewInvoice: "telegram_new_invoice",
  notifyDailyClose: "telegram_daily_close",
  notifyLargeAmounts: "telegram_large_invoice",
  notifyReturnsVoids: "telegram_sales_return",
  notifyPurchasesPayments: "telegram_purchase_created",
  notifyReturnPayment: "telegram_return_payment",
  notifyCustomerCreated: "telegram_customer_created",
  notifySupplierCreated: "telegram_supplier_created",
  notifyExpenseCreated: "telegram_expense_created",
  notifyLowStock: "telegram_low_stock",
  notifySystem: "telegram_backup_result",
  notifyWeekly: "telegram_weekly_digest",
  notifyMonthly: "telegram_monthly_digest",
  notifyYearly: "telegram_yearly_digest",
  notifyStockTransfer: "telegram_stock_transfer",
  notifyInventoryAdjustment: "telegram_inventory_adjustment",
  notifyNewProduct: "telegram_new_product",
  notifyPriceChange: "telegram_price_change",
  notifyBatchExpiry: "telegram_batch_expiry",
  notifyPhysicalCount: "telegram_physical_count",
  notifySupplierPayment: "telegram_supplier_payment",
  notifyDebtPayment: "telegram_debt_payment",
  notifyInstallmentPaid: "telegram_installment_paid",
  notifyPurchaseVoided: "telegram_purchase_voided",
  notifyPurchaseReturn: "telegram_purchase_return",
  notifyBranchTransfer: "telegram_branch_transfer",
  notifyPasswordChanged: "telegram_password_changed",
  notifyPermissionChanged: "telegram_permission_changed",
  notifySupervisorOverride: "telegram_supervisor_override",
  notifyRepairOrder: "telegram_repair_created",
  notifyRevenueCreated: "telegram_revenue_created",
  notifyWithdrawalCreated: "telegram_withdrawal_created",
  notifyEmployeeCreated: "telegram_employee_created",
  notifySalarySettled: "telegram_salary_settled",
  notifyAdvanceCreated: "telegram_advance_created",
  notifyDeductionCreated: "telegram_deduction_created",
  notifyBonusCreated: "telegram_bonus_created",
  // New edit/delete events (migration 201)
  notifyExpenseEdited: "telegram_expense_edited",
  notifyExpenseDeleted: "telegram_expense_deleted",
  notifyRevenueEdited: "telegram_revenue_edited",
  notifyRevenueDeleted: "telegram_revenue_deleted",
  // Edit/cancel sub-events have their own toggles + template categories.
  // Keys MUST be the recipient's notify* field names (useTelegramConnect) —
  // raw telegram_* keys here previously orphaned these toggles from the save
  // system entirely.
  notifySalesReturnEdited: "telegram_sales_return_edited",
  notifySalesReturnCancelled: "telegram_sales_return_cancelled",
  notifyPurchaseReturnEdited: "telegram_purchase_return_edited",
  notifyInvoiceEdited: "telegram_invoice_edited",
  notifyInvoiceAmended: "telegram_invoice_amended",
  notifyPurchaseEdited: "telegram_purchase_edited",
  notifyPurchaseReturnCancelled: "telegram_purchase_return_cancelled",
  notifyBranchTransferEdited: "telegram_branch_transfer_edited",
  notifyBranchTransferCancelled: "telegram_branch_transfer_cancelled",
  notifyWithdrawalEdited: "telegram_withdrawal_edited",
  notifyWithdrawalDeleted: "telegram_withdrawal_deleted",
  // Quit/logout events (migration 212)
  notifyAppQuit: "telegram_app_quit",
  notifyUserLogout: "telegram_user_logout",
  // Partial salary payout (migration 215)
  notifySalaryPartialPaid: "telegram_salary_partial_paid",
  // Money-channel + tamper coverage (migration 216)
  notifyTreasuryChanged: "telegram_treasury_changed",
  notifyPaymentMethodChanged: "telegram_payment_method_changed",
  notifyPromotionChanged: "telegram_promotion_changed",
  notifyUserAccount: "telegram_user_created",
  // Self-watching alert channel (migration 217)
  notifyTelegramRecipientChanged: "telegram_recipient_changed",
  // Employee edit + legacy adjustment (migration 218)
  notifyEmployeeEdited: "telegram_employee_edited",
  notifyAdjustmentCreated: "telegram_adjustment_created",
  // Backup export + settings change (migration 219)
  notifyBackupExported: "telegram_backup_exported",
  notifyBackupSettingsChanged: "telegram_backup_settings_changed",
  // Bulk settings change (migration 220)
  notifySettingsChanged: "telegram_settings_changed",
};

// Sample values for the preview — keys match the {tokens} in the seeded
// template variants exactly (see migrations 177/192/194).
const TG_SAMPLE_TIME = "١٤ يوليو ٢٠٢٦، ٦:٣٠ م";
const TG_SAMPLE_ITEMS =
  "1. [BT-HD-001] سماعة بلوتوث | الكمية: 2 | السعر: 250.00 ج | الإجمالي: 500.00 ج\n" +
  "2. [CHG-WL-003] شاحن لاسلكي | الكمية: 1 | السعر: 350.00 ج | الإجمالي: 350.00 ج";
const TG_SAMPLE_DATA = {
  telegram_new_invoice: { invoice_no: "12345", customer_name: "أحمد محمد", total: "850.00 ج", subtotal: "850.00 ج", tax: "0.00 ج", discount: "0.00 ج", payment_type: "نقداً", paid: "850.00 ج", balance: "0.00 ج", created_at: TG_SAMPLE_TIME, items_count: 2, items_table: TG_SAMPLE_ITEMS, payment_breakdown: "• نقداً: 500.00 ج\n• شبكة: 350.00 ج" },
  telegram_daily_close: { date: "2026-07-14", opening_balance: "1,000.00 ج", cash_sales: "5,000.00 ج", credit_sales: "2,000.00 ج", installment_cash: "500.00 ج", multi_cash: "300.00 ج", bank_sales: "700.00 ج", total_sales: "8,500.00 ج", invoices_count: 25, purchases_cash: "1,200.00 ج", purchases_payable: "800.00 ج", sales_returns_cash: "200.00 ج", sales_returns_account: "100.00 ج", purchase_returns_cash: "50.00 ج", purchase_returns_account: "0.00 ج", expenses_cash: "300.00 ج", expenses_count: 3, revenues_cash: "150.00 ج", revenues_count: 1, withdrawals: "500.00 ج", customer_payments: "1,000.00 ج", customer_payments_count: 4, supplier_payments: "600.00 ج", supplier_payments_count: 2, ajal_payments: "250.00 ج", cash_in: "9,900.00 ج", cash_out: "3,950.00 ج", expected_cash: "5,950.00 ج", actual_cash: "5,900.00 ج", discrepancy: "-50.00 ج", non_cash_total: "1,500.00 ج", payment_methods_summary: "━━━━ 💳 الوضع الدفع ━━━━\n💰 نقداً — وارد: 8,000 ج | صادر: 3,000 ج\n💳 شبكة — وارد: 1,500 ج | صادر: 500 ج\n📋 آجل — 250 ج" },
  telegram_large_invoice: { invoice_no: "12399", customer_name: "محمد سعيد", total: "50,000.00 ج" },
  telegram_large_discount: { invoice_no: "12400", discount_percent: "35" },
  telegram_sales_return: { original_invoice_id: "12350", total: "300.00 ج" },
  telegram_invoice_voided: { invoice_no: "12350", reason: "خطأ في الإدخال", user_name: "أحمد" },
  telegram_purchase_created: { kind_label: "فاتورة شراء", reference: "PUR-2026-001", supplier_name: "شركة النور للتوريدات", total: "25,000.00 ج" },
  telegram_customer_payment: { customer_name: "سعيد علي", amount: "500.00 ج", method: "نقداً" },
  telegram_return_payment: { customer_name: "خالد عبدالله", amount: "300.00 ج", method: "نقداً", date: "2026-07-14" },
  telegram_customer_created: { customer_name: "خالد عبدالله", phone: "01234567890", city: "القاهرة", opening_balance: "0.00 ج" },
  telegram_supplier_created: { supplier_name: "شركة النور للتوريدات", phone: "0221234567", opening_balance: "0.00 ج" },
  telegram_expense_created: { doc_no: "EXP-2026-043", category: "إيجار", amount: "10,000.00 ج", date: "2026-07-01", description: "إيجار شهر يوليو", notes: "إيجار شهر يوليو", method: "نقداً", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_salary_partial_paid: { kind_label: "صرف جزئي للراتب", employee_name: "محمد علي", period: "2026-06-01 → 2026-06-30", net_salary: "8,000.00 ج", paid_amount: "5,000.00 ج", remaining: "3,000.00 ج", remainder_plan: "يتنقل للصرف الجاي تلقائياً", method: "نقداً", user_name: "المحاسب", time: TG_SAMPLE_TIME },
  telegram_salary_settlement_deleted: { employee_name: "محمد علي", period: "2026-06-01 → 2026-06-30", paid_amount: "8,000.00 ج", net_salary: "8,000.00 ج", expense_deleted: "نعم", reversed_advances: 1, user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_advance_payment: { employee_name: "محمد علي", amount: "1,000.00 ج", remaining: "2,000.00 ج", notes: "قسط شهر يوليو", user_name: "المحاسب", time: TG_SAMPLE_TIME },
  telegram_advance_deleted: { employee_name: "محمد علي", amount: "3,000.00 ج", remaining: "2,000.00 ج", delete_kind: "حذف نهائي", expense_deleted: "لا", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_deduction_deleted: { employee_name: "محمد علي", amount: "200.00 ج", deduction_type: "تأخير", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_bonus_deleted: { employee_name: "محمد علي", amount: "500.00 ج", bonus_type: "أداء", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_user_deleted: { user_name: "كاشير 2", role: "cashier", deleted_by: "المدير", time: TG_SAMPLE_TIME },
  telegram_low_stock: { product_name: "[BT-HD-001] سماعة بلوتوث", current_quantity: 3, min_quantity: 10 },
  telegram_backup_result: { success_text: "✅ نسخة احتياطية ناجحة", reason: "نسخة تلقائية", file_path: "backups/retailer-2026-07-14.db", error: "" },
  telegram_stock_transfer: { from_warehouse: "المخزن الرئيسي", to_warehouse: "فرع القاهرة", items_table: TG_SAMPLE_ITEMS, items_count: 2, total_units: 3, time: TG_SAMPLE_TIME },
  telegram_inventory_adjustment: { product_name: "[BT-HD-001] سماعة بلوتوث", warehouse: "المخزن الرئيسي", old_quantity: 50, new_quantity: 48, difference: -2, reason: "تلف", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_new_product: { product_name: "شاحن لاسلكي", sku: "CHG-WL-003", price: "350.00 ج", warehouse: "المخزن الرئيسي", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_price_change: { product_name: "[BT-HD-001] سماعة بلوتوث", old_price: "300.00 ج", new_price: "250.00 ج", change_percent: "-16.7%", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_batch_expiry: { product_name: "[CHG-WL-003] شاحن لاسلكي", batch_no: "BATCH-001", expiry_date: "2026-12-31", remaining_quantity: 25, warehouse: "المخزن الرئيسي" },
  telegram_physical_count: { warehouse: "المخزن الرئيسي", matched_count: 150, mismatched_count: 5, total_items: 155, user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_supplier_payment: { supplier_name: "شركة النور للتوريدات", amount: "10,000.00 ج", method: "شيك", reference: "CHK-001", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_debt_payment: { customer_name: "سعيد علي", amount: "2,000.00 ج", method: "نقداً", remaining_debt: "3,000.00 ج", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_installment_paid: { customer_name: "سعيد علي", installment_no: 2, total_installments: 6, amount: "1,000.00 ج", remaining: "4,000.00 ج" },
  telegram_purchase_voided: { reference_no: "PUR-2026-001", supplier_name: "شركة النور للتوريدات", total: "25,000.00 ج", reason: "خطأ في الكمية", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_purchase_return: { reference_no: "PRT-2026-001", supplier_name: "شركة النور للتوريدات", total: "5,000.00 ج", items_table: TG_SAMPLE_ITEMS, items_count: 2, user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_sales_return_edited: { doc_no: "SRT-2026-011", customer_name: "أحمد محمد", old_total: "300.00 ج", new_total: "450.00 ج", old_items_table: TG_SAMPLE_ITEMS, new_items_table: TG_SAMPLE_ITEMS, user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_sales_return_cancelled: { doc_no: "SRT-2026-010", customer_name: "سعيد علي", total: "300.00 ج", reason: "خطأ في الإدخال", items_table: TG_SAMPLE_ITEMS, user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_purchase_return_edited: { reference_no: "PRT-2026-002", supplier_name: "شركة النور للتوريدات", old_total: "5,000.00 ج", new_total: "4,200.00 ج", old_items_table: TG_SAMPLE_ITEMS, new_items_table: TG_SAMPLE_ITEMS, user_name: "محمد", time: TG_SAMPLE_TIME },
  telegram_price_bulk_update: { operation_label: "تحديث أسعار جماعي", items_count: 24, field_label: "سعر البيع", adjustment_label: "زيادة 10%", reason: "تحديث موسمي", changes_table: "• سماعة بلوتوث: 250 ← 275\n• شاحن لاسلكي: 350 ← 385", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_item_deleted: { product_name: "سماعة بلوتوث", sku: "BT-HD-001", price: "250.00 ج", quantity: 3, user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_customer_deleted: { customer_name: "خالد عبدالله", phone: "01234567890", balance: "0.00 ج", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_supplier_deleted: { supplier_name: "شركة النور للتوريدات", phone: "0221234567", balance: "0.00 ج", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_employee_deleted: { employee_name: "محمد علي", job_title: "محاسب", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_branch_transfer: { reference_no: "BT-S-2026-001", from_branch: "الفرع الأول", to_warehouse: "الفرع الثاني", transfer_type: "إرسال", items_table: TG_SAMPLE_ITEMS, items_count: 2, total_units: 3, total_cost: "850.00 ج", time: TG_SAMPLE_TIME },
  telegram_password_changed: { user_name: "محمد أحمد", time: TG_SAMPLE_TIME, ip_address: "192.168.1.100" },
  telegram_permission_changed: { user_name: "محمد أحمد", action: "تم تغيير الصلاحيات", details: "إضافة صلاحية إدارة المخزون", changed_by: "المدير", time: TG_SAMPLE_TIME },
  telegram_supervisor_override: { user_name: "محمد أحمد", action: "إلغاء فاتورة", details: "فاتورة بقيمة 5,000.00 ج", supervisor: "المدير العام", time: TG_SAMPLE_TIME },
  telegram_repair_created: { order_no: "RPR-001", customer_name: "فاطمة حسن", device_type: "لابتوب", problem: "الشاشة لا تعمل", estimated_cost: "300.00 ج", time: TG_SAMPLE_TIME },
  telegram_revenue_created: { doc_no: "REV-001", amount: "5,000.00 ج", category: "إيراد مبيعات", description: "مبيعات يوم الجمعة", method: "نقداً", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_withdrawal_created: { doc_no: "WD-001", amount: "2,000.00 ج", category: "مصروفات تشغيل", note: "دفع فاتورة كهرباء", method: "نقداً", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_employee_created: { employee_name: "محمد علي", job_title: "محاسب", salary: "8,000.00 ج", phone: "01012345678", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_salary_settled: { employee_name: "محمد علي", period: "2026-06-01 → 2026-06-30", base_salary: "8,000.00 ج", bonuses: "500.00 ج", deductions: "200.00 ج", advance_deductions: "300.00 ج", net_salary: "8,000.00 ج", paid_amount: "8,000.00 ج", user_name: "المحاسب", time: TG_SAMPLE_TIME },
  telegram_advance_created: { employee_name: "محمد علي", amount: "3,000.00 ج", installment_count: 3, installment_amount: "1,000.00 ج", notes: "سلفة شخصية", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_deduction_created: { employee_name: "محمد علي", amount: "200.00 ج", deduction_type: "تأخير", is_recurring: "لا", notes: "تأخير عن العمل", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_bonus_created: { employee_name: "محمد علي", amount: "500.00 ج", bonus_type: "أداء", is_recurring: "لا", notes: "أداء ممتاز", user_name: "المدير", time: TG_SAMPLE_TIME },
  // New edit/delete events (migration 201)
  telegram_expense_edited: { doc_no: "EXP-2026-042", category: "إيجار", old_amount: "10,000.00 ج", new_amount: "11,500.00 ج", old_description: "إيجار يونيو", new_description: "إيجار يوليو", payment_method: "نقداً", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_expense_deleted: { doc_no: "EXP-2026-041", category: "كهرباء", amount: "2,500.00 ج", description: "فاتورة كهرباء يونيو", payment_method: "نقداً", date: "2026-06-30", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_revenue_edited: { doc_no: "REV-2026-015", category: "مبيعات", old_amount: "5,000.00 ج", new_amount: "5,500.00 ج", old_description: "مبيعات الجمعة", new_description: "مبيعات الجمعة والسبت", payment_method: "نقداً", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_revenue_deleted: { doc_no: "REV-2026-014", category: "مبيعات", amount: "3,200.00 ج", description: "مبيعات الخميس", payment_method: "نقداً", date: "2026-07-10", user_name: "أحمد", time: TG_SAMPLE_TIME },
  // New edit/cancel events (migration 202)
  telegram_invoice_edited: { invoice_no: "INV-2026-1201", old_customer_name: "أحمد محمد", new_customer_name: "أحمد محمد (تعديل)", old_total: "1,250.00 ج", new_total: "1,400.00 ج", old_payment_type: "نقداً — 1,250.00 ج", new_payment_type: "دفع متعدد\n• نقداً: 900.00 ج\n• شبكة: 500.00 ج", old_items_table: TG_SAMPLE_ITEMS, new_items_table: TG_SAMPLE_ITEMS, user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_invoice_amended: { old_invoice_no: "INV-2026-1200", new_invoice_no: "INV-2026-1201", customer_name: "سعيد علي", total: "980.00 ج", items_table: TG_SAMPLE_ITEMS, user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_purchase_edited: { reference_no: "PUR-2026-088", old_supplier_name: "شركة التوريد", new_supplier_name: "شركة التوريد (تعديل)", old_total: "15,000.00 ج", new_total: "15,800.00 ج", old_payment_method: "نقداً — 15,000.00 ج", new_payment_method: "آجل — 15,800.00 ج", old_items_table: "1. سماعة بلوتوث × 20 × 180.00 ج\n2. شاحن × 15 × 260.00 ج", new_items_table: "1. سماعة بلوتوث × 20 × 180.00 ج\n2. شاحن × 16 × 260.00 ج", user_name: "محمد", time: TG_SAMPLE_TIME },
  telegram_purchase_return_cancelled: { reference_no: "PRET-2026-022", supplier_name: "شركة التوريد", total: "3,600.00 ج", reason: "خطأ في الإدخال", user_name: "محمد", time: TG_SAMPLE_TIME },
  telegram_branch_transfer_edited: { reference_no: "BTR-2026-041", transfer_type: "إرسال", partner_branch: "فرع المعادي", items_table: "1. سماعة بلوتوث × 5\n2. شاحن × 3", user_name: "محمد", time: TG_SAMPLE_TIME },
  telegram_branch_transfer_cancelled: { reference_no: "BTR-2026-040", transfer_type: "استلام", partner_branch: "فرع السيدة زينب", reason: "خطأ في الكمية", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_withdrawal_edited: { doc_no: "WD-2026-019", category: "صيانة", old_amount: "500.00 ج", new_amount: "750.00 ج", note: "صيانة تكييف", payment_method: "نقداً", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_withdrawal_deleted: { doc_no: "WD-2026-018", category: "كهرباء", amount: "1,200.00 ج", note: "فاتورة كهرباء", payment_method: "نقداً", date: "2026-07-08", user_name: "أحمد", time: TG_SAMPLE_TIME },
  telegram_app_quit: { user_name: "أحمد", trigger_reason: "إغلاق التطبيق", time: TG_SAMPLE_TIME },
  telegram_user_logout: { user_name: "أحمد", trigger_reason: "تسجيل خروج", time: TG_SAMPLE_TIME },
  telegram_weekly_digest: { period_label: "الأسبوع 24 — 2026", sales_total: "45,000.00 ج", sales_delta: "+12%", sales_count: 180, avg_invoice: "250.00 ج", profit: "9,000.00 ج", products_table: "1. سماعة بلوتوث — 40 قطعة\n2. شاحن لاسلكي — 25 قطعة", customers_table: "1. أحمد محمد — 3,500.00 ج\n2. سعيد علي — 2,100.00 ج", liquidity: "60,000.00 ج", treasury_balance: "35,000.00 ج", bank_balance: "25,000.00 ج", debts: "12,000.00 ج", low_stock_count: 4 },
  // Self-watching alert channel (migration 217)
  telegram_recipient_changed: { action_label: "إضافة مستلم إشعارات جديد", recipient_name: "مستلم Telegram", chat_id: "123456789", changes_summary: "تمت إضافة مستلم جديد لاستقبال الإشعارات", user_name: "المدير", time: TG_SAMPLE_TIME },
  // Employee edit + legacy adjustment (migration 218)
  telegram_employee_edited: { employee_name: "محمد علي", old_salary: "8,000.00 ج", new_salary: "9,000.00 ج", old_job_title: "محاسب", new_job_title: "محاسب أول", phone: "01012345678", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_adjustment_created: { employee_name: "محمد علي", type_label: "حافز", amount: "500.00 ج", reason: "أداء ممتاز", user_name: "المدير", time: TG_SAMPLE_TIME },
  // Backup export + settings change (migration 219)
  telegram_backup_exported: { file_path: "D:/Backups/retailer-checkpoint-2026-07-19.zip", file_size: "2.5 MB", user_name: "المدير", time: TG_SAMPLE_TIME },
  telegram_backup_settings_changed: { setting_name: "النسخ الاحتياطي التلقائي", old_value: "مفعل", new_value: "معطّل", user_name: "المدير", time: TG_SAMPLE_TIME },
  // Bulk settings change (migration 220)
  telegram_settings_changed: { changes_count: 3, changes_summary: "tax_rate, discount_cap, store_name", user_name: "المدير", time: TG_SAMPLE_TIME },
};
TG_SAMPLE_DATA.telegram_monthly_digest = { ...TG_SAMPLE_DATA.telegram_weekly_digest, period_label: "يوليو 2026" };
TG_SAMPLE_DATA.telegram_yearly_digest = { ...TG_SAMPLE_DATA.telegram_weekly_digest, period_label: "سنة 2026" };

function buildTelegramEventCategories(t) {
  return [
    {
      key: "sales", label: t("telegram.catSales"), icon: Receipt,
      events: [
        { field: "notifyNewInvoice", label: t("telegram.toggleNewInvoice"), hint: t("telegram.hintNewInvoice") },
        { field: "notifyDailyClose", label: t("telegram.toggleDailyClose"), hint: t("telegram.hintDailyClose") },
        { field: "notifyLargeAmounts", label: t("telegram.toggleLargeAmounts"), hint: t("telegram.hintLargeAmounts") },
        { field: "notifyReturnsVoids", label: t("telegram.toggleReturnsVoids"), hint: t("telegram.hintReturnsVoids") },
        { field: "notifySalesReturnEdited", label: "تعديل مرتجع مبيعات", hint: "عند تعديل مرتجع مبيعات موجود" },
        { field: "notifySalesReturnCancelled", label: "إلغاء مرتجع مبيعات", hint: "عند إلغاء أو حذف مرتجع مبيعات" },
        { field: "notifyInvoiceEdited", label: "تعديل فاتورة مبيعات", hint: "عند تعديل فاتورة مبيعات" },
        { field: "notifyInvoiceAmended", label: "تعديل (أمندمنت) فاتورة", hint: "عند إلغاء وإعادة إنشاء فاتورة مبيعات (أمندمنت)" },
      ],
    },
    {
      key: "financial", label: t("telegram.catFinancial"), icon: CreditCard,
      events: [
        { field: "notifyPurchasesPayments", label: t("telegram.togglePurchasesPayments"), hint: t("telegram.hintPurchasesPayments") },
        { field: "notifyReturnPayment", label: t("telegram.toggleReturnPayment"), hint: t("telegram.hintReturnPayment") },
        { field: "notifySupplierPayment", label: t("telegram.toggleSupplierPayment"), hint: t("telegram.hintSupplierPayment") },
        { field: "notifyDebtPayment", label: t("telegram.toggleDebtPayment"), hint: t("telegram.hintDebtPayment") },
        { field: "notifyInstallmentPaid", label: t("telegram.toggleInstallmentPaid"), hint: t("telegram.hintInstallmentPaid") },
        { field: "notifyExpenseCreated", label: t("telegram.toggleExpenseCreated"), hint: t("telegram.hintExpenseCreated") },
        { field: "notifyExpenseEdited", label: "تعديل مصروف", hint: "عند تعديل مبلغ أو بيانات مصروف مسجّل" },
        { field: "notifyExpenseDeleted", label: "حذف مصروف", hint: "عند حذف مصروف نهائياً" },
        { field: "notifyRevenueCreated", label: t("telegram.toggleRevenueCreated"), hint: t("telegram.hintRevenueCreated") },
        { field: "notifyRevenueEdited", label: "تعديل إيراد", hint: "عند تعديل مبلغ أو بيانات إيراد مسجّل" },
        { field: "notifyRevenueDeleted", label: "حذف إيراد", hint: "عند حذف إيراد نهائياً" },
        { field: "notifyWithdrawalCreated", label: t("telegram.toggleWithdrawalCreated"), hint: t("telegram.hintWithdrawalCreated") },
        { field: "notifyWithdrawalEdited", label: "تعديل سحب نقدي", hint: "عند تعديل مبلغ أو بيانات سحب نقدي مسجّل" },
        { field: "notifyWithdrawalDeleted", label: "حذف سحب نقدي", hint: "عند حذف سحب نقدي نهائياً" },
        { field: "notifyTreasuryChanged", label: "تغيير خزينة", hint: "عند إضافة أو تعديل أو حذف خزينة — ويشمل التعديل اليدوي للرصيد" },
        { field: "notifyPaymentMethodChanged", label: "تغيير وسيلة دفع", hint: "عند إضافة/تعديل/حذف وسيلة دفع — ويشمل جعلها لا تدخل الخزينة" },
        { field: "notifyPromotionChanged", label: "تغيير العروض والخصومات", hint: "عند إضافة أو تفعيل أو تعديل عرض/خصم دائم" },
      ],
    },
    {
      key: "inventory", label: t("telegram.catInventory"), icon: Package,
      events: [
        { field: "notifyStockTransfer", label: t("telegram.toggleStockTransfer"), hint: t("telegram.hintStockTransfer") },
        { field: "notifyInventoryAdjustment", label: t("telegram.toggleInventoryAdjustment"), hint: t("telegram.hintInventoryAdjustment") },
        { field: "notifyNewProduct", label: t("telegram.toggleNewProduct"), hint: t("telegram.hintNewProduct") },
        { field: "notifyPriceChange", label: t("telegram.togglePriceChange"), hint: t("telegram.hintPriceChange") },
        { field: "notifyBatchExpiry", label: t("telegram.toggleBatchExpiry"), hint: t("telegram.hintBatchExpiry") },
        { field: "notifyPhysicalCount", label: t("telegram.togglePhysicalCount"), hint: t("telegram.hintPhysicalCount") },
      ],
    },
    {
      key: "purchases", label: t("telegram.catPurchases"), icon: ShoppingCart,
      events: [
        { field: "notifyPurchaseVoided", label: t("telegram.togglePurchaseVoided"), hint: t("telegram.hintPurchaseVoided") },
        { field: "notifyPurchaseEdited", label: "تعديل فاتورة مشتريات", hint: "عند تعديل فاتورة مشتريات" },
        { field: "notifyPurchaseReturn", label: t("telegram.togglePurchaseReturn"), hint: t("telegram.hintPurchaseReturn") },
        { field: "notifyPurchaseReturnEdited", label: "تعديل مرتجع مشتريات", hint: "عند تعديل مرتجع مشتريات موجود" },
        { field: "notifyPurchaseReturnCancelled", label: "إلغاء مرتجع مشتريات", hint: "عند إلغاء مرتجع مشتريات" },
        { field: "notifyBranchTransfer", label: t("telegram.toggleBranchTransfer"), hint: t("telegram.hintBranchTransfer") },
        { field: "notifyBranchTransferEdited", label: "تعديل حركة فرع", hint: "عند تعديل حركة تحويل بين الفروع" },
        { field: "notifyBranchTransferCancelled", label: "إلغاء حركة فرع", hint: "عند إلغاء حركة تحويل بين الفروع" },
      ],
    },
    {
      key: "people", label: t("telegram.catPeople"), icon: Users,
      events: [
        { field: "notifyCustomerCreated", label: t("telegram.toggleCustomerCreated"), hint: t("telegram.hintCustomerCreated") },
        { field: "notifySupplierCreated", label: t("telegram.toggleSupplierCreated"), hint: t("telegram.hintSupplierCreated") },
      ],
    },
    {
      key: "employees", label: t("telegram.catEmployees"), icon: UserCog,
      events: [
        { field: "notifyEmployeeCreated", label: t("telegram.toggleEmployeeCreated"), hint: t("telegram.hintEmployeeCreated") },
        { field: "notifyEmployeeEdited", label: "تعديل بيانات موظف", hint: "عند تعديل راتب أو منصب أو هاتف موظف" },
        { field: "notifyAdjustmentCreated", label: "تسجيل حافز/خصم", hint: "عند تسجيل حافز أو خصم (تسوية Legacy)" },
        { field: "notifySalarySettled", label: t("telegram.toggleSalarySettled"), hint: "عند صرف راتب كامل، ويشمل تنبيه إلغاء/حذف صرف راتب" },
        { field: "notifySalaryPartialPaid", label: "صرف جزئي للراتب", hint: "عند صرف جزء من الراتب (كله/جزء) وسداد المتبقي لاحقاً" },
        { field: "notifyAdvanceCreated", label: t("telegram.toggleAdvanceCreated"), hint: "عند تسجيل سلفة، ويشمل تسديد أقساطها وحذفها" },
        { field: "notifyDeductionCreated", label: t("telegram.toggleDeductionCreated"), hint: "عند تسجيل خصم، ويشمل تنبيه إلغاء الخصم" },
        { field: "notifyBonusCreated", label: t("telegram.toggleBonusCreated"), hint: "عند تسجيل مكافأة، ويشمل تنبيه إلغاء المكافأة" },
      ],
    },
    {
      key: "security", label: t("telegram.catSecurity"), icon: Shield,
      events: [
        { field: "notifyPasswordChanged", label: t("telegram.togglePasswordChanged"), hint: t("telegram.hintPasswordChanged") },
        { field: "notifyPermissionChanged", label: t("telegram.togglePermissionChanged"), hint: "عند تعديل صلاحيات مستخدم أو الصلاحيات الافتراضية أو الدور أو تفعيل/تعطيل حساب" },
        { field: "notifyUserAccount", label: "إنشاء/حذف حساب مستخدم", hint: "عند إضافة مستخدم جديد أو حذف حساب من النظام" },
        { field: "notifyTelegramRecipientChanged", label: "تغيير مستلم إشعارات", hint: "عند إضافة أو تعديل أو حذف مستلم Telegram — أو تغيير إشعاراته" },
        { field: "notifySupervisorOverride", label: t("telegram.toggleSupervisorOverride"), hint: t("telegram.hintSupervisorOverride") },
      ],
    },
    {
      key: "repair", label: t("telegram.catRepair"), icon: Wrench,
      events: [
        { field: "notifyRepairOrder", label: t("telegram.toggleRepairOrder"), hint: t("telegram.hintRepairOrder") },
      ],
    },
    {
      key: "system", label: t("telegram.catSystem"), icon: Monitor,
      events: [
        { field: "notifyLowStock", label: t("telegram.toggleLowStock"), hint: t("telegram.hintLowStock") },
        { field: "notifySystem", label: t("telegram.toggleSystem"), hint: "النسخ الاحتياطي التلقائي، محاولات الدخول الفاشلة، استعادة نسخة، تفريغ بيانات، وإيقاف الإشعارات" },
        { field: "notifyBackupExported", label: "تصدير نسخة احتياطية", hint: "عند تصدير checkpoint كملف .zip (متجه للنسخ خارج الجهاز)" },
        { field: "notifyBackupSettingsChanged", label: "تغيير إعدادات النسخ الاحتياطي", hint: "عند تعديل أو تعطيل النسخ الاحتياطي التلقائي" },
        { field: "notifySettingsChanged", label: "تغيير إعدادات النظام", hint: "عند تعديل أي إعدادات عبر الإعدادات المجمعة (سعر الضريبة، حد الخصم، etc.)" },
        { field: "notifyAppQuit", label: "إغلاق التطبيق", hint: "عند إغلاق التطبيق (إكسلت)" },
        { field: "notifyUserLogout", label: "تسجيل خروج المستخدم", hint: "عند تسجيل خروج أي مستخدم من النظام" },
      ],
    },
    {
      key: "reports", label: t("telegram.catReports"), icon: CalendarDays,
      events: [
        { field: "notifyWeekly", label: t("telegram.toggleWeekly"), hint: t("telegram.hintWeekly") },
        { field: "notifyMonthly", label: t("telegram.toggleMonthly"), hint: t("telegram.hintMonthly") },
        { field: "notifyYearly", label: t("telegram.toggleYearly"), hint: t("telegram.hintYearly") },
      ],
    },
  ];
}

// Renders a Telegram message body: *bold* segments and line breaks.
function TelegramMessageText({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <div dir="rtl" className="text-xs font-bold text-text-primary leading-relaxed">
      {lines.map((line, i) => {
        const parts = line.split(/(\*[^*\n]+\*)/g).filter(Boolean);
        return (
          <p key={i} className="min-h-[1.2em] break-words">
            {parts.map((p, j) =>
              p.length > 2 && p.startsWith("*") && p.endsWith("*")
                ? <strong key={j} className="font-black">{p.slice(1, -1)}</strong>
                : <React.Fragment key={j}>{p}</React.Fragment>
            )}
          </p>
        );
      })}
    </div>
  );
}

// معاينة الرسالة — a compact, Telegram-styled chat preview of the exact
// variant the recipient picked for this event.
// Renders template previews through the SERVER's buildMessage pipeline — the
// exact code path that produces delivered Telegram messages (token
// substitution, Markdown escaping, live accumulative day-footer). The client
// used to re-render templates from its own token map and a hardcoded footer,
// which is why previews drifted from what the owner actually received.
//
// `items` is [{ category, label?, body? }]. Returns { previews, loading }
// keyed by "category|label". A null value means the server has no sample for
// that category (digests) — callers fall back to the local renderer.
function useServerPreviews(items) {
  const [previews, setPreviews] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const key = JSON.stringify(items || []);

  React.useEffect(() => {
    let alive = true;
    const parsed = JSON.parse(key);
    if (!parsed.length) { setPreviews({}); setLoading(false); return () => {}; }
    setLoading(true);
    api.post("/api/telegram/previews", { items: parsed })
      .then((r) => { if (alive) setPreviews(r.data?.data || {}); })
      .catch(() => { if (alive) setPreviews({}); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [key]);

  return { previews, loading };
}

function TgEventPreviewModal({ eventLabel, templateKind, preset, onClose }) {
  const { t } = useTranslation();
  const items = React.useMemo(
    () => (templateKind ? [{ category: templateKind, label: preset }] : []),
    [templateKind, preset]
  );
  const { previews, loading } = useServerPreviews(items);
  const rendered = previews[`${templateKind}|${preset}`] || "";
  const presetShort = preset === TELEGRAM_PRESET_BRIEF ? t("telegram.presetBrief") : t("telegram.presetDetailed");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border-normal bg-bg-surface shadow-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("telegram.sampleMessage")}
      >
        {/* Chat header */}
        <div className="flex items-center gap-2.5 border-b border-border-normal bg-bg-base/70 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Send className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-text-primary">{t("telegram.botPreviewName")}</p>
            <p className="truncate text-[10px] font-bold text-text-muted">{eventLabel}</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black text-primary">{presetShort}</span>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-bg-overlay">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        {/* Chat canvas */}
        <div
          className="max-h-[55vh] overflow-y-auto bg-bg-base px-3 py-4"
          style={{ backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rendered ? (
            <div className="max-w-[94%] rounded-2xl rtl:rounded-tr-md ltr:rounded-tl-md border border-border-normal bg-bg-surface px-3.5 py-2.5 shadow-card">
              <TelegramMessageText text={rendered} />
              <div className="mt-1.5 flex items-center justify-end gap-0.5 text-[9px] font-bold text-text-muted">
                <span className="me-1">{t("telegram.previewTimeNow")}</span>
                <Check className="h-3 w-3 text-primary" />
                <Check className="-ms-2 h-3 w-3 text-primary" />
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-bold text-text-muted">{t("telegram.templateNotFound")}</div>
          )}
        </div>

        <div className="border-t border-border-normal bg-bg-surface px-4 py-2.5 text-center text-[10px] font-bold text-text-muted">
          {t("telegram.templatePreviewNote")}
        </div>
      </div>
    </div>
  );
}

function TgPresetDropdown({ value, onChange, eventLabel, templateKind, disabled }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const presetShort = value === TELEGRAM_PRESET_BRIEF ? t("telegram.presetBrief") : t("telegram.presetDetailed");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-normal bg-bg-base px-2.5 py-1.5 text-[10px] font-black text-text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
      >
        <span className="truncate max-w-[100px]">{presetShort}</span>
        <Pencil className="h-3 w-3 shrink-0 text-text-muted" />
      </button>

      {open && (
        <TgPresetPickerModal
          value={value}
          onChange={(v) => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)}
          eventLabel={eventLabel}
          templateKind={templateKind}
        />
      )}
    </>
  );
}

function TgPresetPickerModal({ value, onChange, onClose, eventLabel, templateKind }) {
  const { t } = useTranslation();
  const items = React.useMemo(
    () => (templateKind ? TELEGRAM_PRESET_OPTIONS.map((label) => ({ category: templateKind, label })) : []),
    [templateKind]
  );
  const { previews, loading } = useServerPreviews(items);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-normal bg-bg-surface shadow-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-border-normal bg-bg-base/70 px-4 py-3">
          <div>
            <p className="text-xs font-black text-text-primary">{t("telegram.choosePreset")}</p>
            <p className="text-[10px] font-bold text-text-muted">{eventLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-bg-overlay">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            TELEGRAM_PRESET_OPTIONS.map((preset) => {
              const isActive = preset === value;
              const presetLabel = preset === TELEGRAM_PRESET_BRIEF ? t("telegram.presetBrief") : t("telegram.presetDetailed");
              const rendered = previews[`${templateKind}|${preset}`] || "";

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={`w-full text-left rounded-xl border-2 transition-all ${isActive ? "border-primary bg-primary/5 shadow-card" : "border-border-normal bg-bg-surface hover:border-primary/40 hover:bg-bg-surface/80"}`}
                >
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[11px] font-black text-text-primary">{presetLabel}</span>
                    {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <div
                    className="mx-3 mb-3 overflow-hidden rounded-xl bg-bg-base px-3 py-3"
                    style={{ backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
                  >
                    {rendered ? (
                      <div className="max-w-[94%] rounded-2xl rtl:rounded-tr-md ltr:rounded-tl-md border border-border-normal bg-bg-surface px-3 py-2 shadow-card">
                        <TelegramMessageText text={rendered} />
                        <div className="mt-1.5 flex items-center justify-end gap-0.5 text-[9px] font-bold text-text-muted">
                          <span className="me-1">{t("telegram.previewTimeNow")}</span>
                          <Check className="h-3 w-3 text-primary" />
                          <Check className="-ms-2 h-3 w-3 text-primary" />
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-[10px] font-bold text-text-muted">{t("telegram.templateNotFound")}</div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-border-normal bg-bg-surface px-4 py-2.5 text-center text-[10px] font-bold text-text-muted">
          {t("telegram.templatePreviewNote")}
        </div>
      </div>
    </div>
  );
}

function TgEventRow({ event, checked, preset, onToggle, onPresetChange, disabled }) {
  const { t } = useTranslation();
  const templateKind = TG_EVENT_TEMPLATE_MAP[event.field];
  return (
    <div className={`rounded-lg border transition-colors ${checked ? "border-primary/30 bg-primary/5" : "border-border-subtle bg-bg-surface/40"}`}>
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <TelegramSwitch checked={checked} onChange={onToggle} disabled={disabled} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-text-primary">{event.label}</p>
          <p className="truncate text-[10px] font-bold text-text-muted">{event.hint}</p>
        </div>
      </div>
      {checked && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle/60 px-2.5 py-1.5">
          <TgPresetDropdown
            value={preset}
            onChange={disabled ? () => { } : onPresetChange}
            eventLabel={event.label}
            templateKind={templateKind}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function TgEventCategory({ category, recipient, onUpdate, expanded, onToggleExpand, canManageEvents }) {
  const { t } = useTranslation();
  const enabledCount = category.events.filter((e) => recipient[e.field]).length;
  const allChecked = enabledCount === category.events.length;
  const someChecked = enabledCount > 0;

  const patchFor = (field, val) => {
    if (field === "notifyRepairOrder") return { notifyRepairOrder: val, notifyRepairCreated: val, notifyRepairReady: val, notifyRepairDelivered: val };
    // Edit/cancel sub-events have their own server columns (migration 208) —
    // they no longer drag their parent toggle with them.
    return { [field]: val };
  };

  const toggleAll = (val) => {
    const patch = {};
    category.events.forEach((ev) => Object.assign(patch, patchFor(ev.field, val)));
    onUpdate(patch);
  };

  const getPreset = (field) => recipient.eventPresets?.[field] || TELEGRAM_PRESET_DETAILED;

  return (
    <div className="overflow-hidden rounded-xl border border-border-normal bg-bg-base">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-right transition-colors hover:bg-bg-surface/60"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <category.icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-[11px] font-black text-text-primary">{category.label}</span>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${allChecked ? "bg-success-bg text-success-text" : someChecked ? "bg-warning-bg text-warning-text" : "bg-bg-surface text-text-muted"}`}>
            {t("telegram.categoryEventsCount", { enabled: enabledCount, total: category.events.length })}
          </span>
          <ChevronDown className={`ms-auto h-4 w-4 shrink-0 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <div className="shrink-0 border-s border-border-normal px-3 py-2.5" title={allChecked ? t("telegram.deselectAll") : t("telegram.toggleAll")}>
          <TelegramSwitch checked={allChecked} onChange={toggleAll} disabled={!canManageEvents} />
        </div>
      </div>
      {expanded && (
        <div className="grid gap-1.5 border-t border-border-normal p-2.5 md:grid-cols-2">
          {category.events.map((e) => (
            <TgEventRow
              key={e.field}
              event={e}
              checked={Boolean(recipient[e.field])}
              preset={getPreset(e.field)}
              onToggle={(val) => onUpdate(patchFor(e.field, val))}
              onPresetChange={(p) => onUpdate({ eventPresets: { ...recipient.eventPresets, [e.field]: p } })}
              disabled={!canManageEvents}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TgRecipientTile({ recipient, index, selected, onSelect }) {
  const { t } = useTranslation();
  const name = recipient.name?.trim() || t("telegram.unnamedRecipient");
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2.5 rounded-xl border p-3 text-right transition-all ${selected ? "border-primary bg-primary/5 shadow-card" : "border-border-normal bg-bg-base hover:border-primary/40"}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${selected ? "bg-primary" : "bg-text-muted"}`}>
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-black text-text-primary">{name}</span>
          {index === 0 && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-black text-primary">{t("telegram.defaultRecipient")}</span>
          )}
        </span>
        <span dir="ltr" className="block truncate text-start text-[10px] font-bold text-text-muted">
          {recipient.chatId || t("telegram.recipientChatMissing")}
        </span>
      </span>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${recipient.enabled && recipient.chatId ? "bg-success-text" : "bg-text-muted"}`}
        title={recipient.enabled ? t("telegram.enabled") : t("telegram.disabled")}
      />
    </button>
  );
}

function TgRecipientEditor({
  recipient, index, eventCategories,
  onUpdate, onDetect, onTest, onAskDelete,
  testing, detecting, saving, justSaved, hasBotToken, canManageEvents,
}) {
  const { t } = useTranslation();
  const [expandedCats, setExpandedCats] = React.useState(() => new Set(["sales"]));

  const totalEnabled = eventCategories.reduce(
    (sum, cat) => sum + cat.events.filter((e) => recipient[e.field]).length, 0
  );
  const totalEvents = eventCategories.reduce((sum, cat) => sum + cat.events.length, 0);
  const allExpanded = expandedCats.size === eventCategories.length;

  const toggleCategory = (key) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const displayName = recipient.name?.trim() || t("telegram.unnamedRecipient");

  return (
    <div className="overflow-hidden rounded-xl border border-primary/40 bg-bg-surface shadow-card">
      {/* Recipient header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-normal bg-bg-base/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-white">
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-xs font-black text-text-primary">{displayName}</p>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${recipient.enabled ? "bg-success-bg text-success-text" : "bg-bg-base text-text-muted"}`}>
                {recipient.enabled ? t("telegram.enabled") : t("telegram.disabled")}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] font-bold text-text-muted">
              {recipient.chatId ? t("telegram.recipientChatSummary", { chatId: recipient.chatId }) : t("telegram.recipientChatMissing")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TelegramSwitch
            checked={recipient.enabled}
            onChange={(val) => onUpdate({ enabled: val })}
            label={t("telegram.notificationsOn")}
            disabled={!canManageEvents}
          />
          <button
            type="button"
            onClick={onTest}
            disabled={testing || !recipient.enabled || !recipient.chatId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] font-black text-primary transition-all hover:bg-primary/10 active:scale-95 disabled:opacity-50"
          >
            {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {t("telegram.testSend")}
          </button>
          <button
            type="button"
            onClick={() => onAskDelete(index, displayName)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-[11px] font-black text-danger-text transition-all hover:opacity-90 active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("telegram.deleteRecipient")}
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Identity */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-black text-text-secondary">{t("telegram.recipientName")}</label>
            <input
              type="text"
              value={recipient.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder={t("telegram.recipientNamePlaceholder")}
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2 text-xs font-bold outline-none transition-colors focus:border-primary focus:bg-bg-surface"
            />
            <p className="mt-1 text-[10px] font-bold text-text-muted">{t("telegram.recipientNameHint")}</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-black text-text-secondary">{t("telegram.chatId")} *</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                dir="ltr"
                value={recipient.chatId}
                onChange={(e) => onUpdate({ chatId: e.target.value })}
                placeholder={t("telegram.chatIdPlaceholder")}
                className="min-w-0 flex-1 rounded-lg border border-border-normal bg-bg-input px-3 py-2 text-xs font-bold outline-none transition-colors focus:border-primary focus:bg-bg-surface"
              />
              <button
                type="button"
                onClick={onDetect}
                disabled={detecting || saving || !hasBotToken}
                title={t("telegram.chatIdDetectHint")}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-2 text-[10px] font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {detecting || saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Scan className="h-3 w-3" />}
                <span className="hidden sm:inline">{detecting ? t("telegram.detecting") : t("telegram.detectButton")}</span>
              </button>
            </div>
            <details className="group mt-1">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-black text-primary hover:underline">
                <Info className="h-3 w-3" />
                {t("telegram.chatIdHintSummary")}
              </summary>
              <div className="mt-1.5 whitespace-pre-line rounded-lg bg-bg-base p-2.5 text-[10px] font-bold leading-relaxed text-text-secondary">
                {t("telegram.chatIdHintDetailed")}
              </div>
            </details>
          </div>
        </div>

        {/* Events */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black text-text-primary">{t("telegram.recipientEvents")}</p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                {t("telegram.categoryEventsCount", { enabled: totalEnabled, total: totalEvents })}
              </span>
              {justSaved && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-success-text">
                  <CheckCircle className="h-3.5 w-3.5" /> {t("telegram.saved")}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpandedCats(allExpanded ? new Set() : new Set(eventCategories.map((c) => c.key)))}
              className="inline-flex items-center gap-1 text-[10px] font-black text-primary hover:underline"
            >
              {allExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {allExpanded ? t("telegram.collapseAllCats") : t("telegram.expandAllCats")}
            </button>
          </div>
          <p className="text-[10px] font-bold text-text-muted">{t("telegram.eventsSaveHint")}</p>
          <div className="space-y-2">
            {eventCategories.map((cat) => (
              <TgEventCategory
                key={cat.key}
                category={cat}
                recipient={recipient}
                onUpdate={onUpdate}
                expanded={expandedCats.has(cat.key)}
                onToggleExpand={() => toggleCategory(cat.key)}
                canManageEvents={canManageEvents}
              />
            ))}
          </div>
          {!recipient.chatId && (
            <div className="flex items-center gap-1 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-[10px] font-bold text-warning-text">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {t("telegram.chatIdRequiredToSave")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TelegramTab({ telegramEnabled, onConfigChanged, perms }) {
  const { t } = useTranslation();
  const {
    config, setConfig, loading, loadError, saving, saved, dirty, testing,
    disconnecting,
    recipients, updateRecipientLocal, deleteRecipient, saveSingleRecipient, refreshRecipients,
    qrData, generatingQr, pollStatus,
    botInfo, validating,
    history, loadingHistory, fetchHistory,
    generateDeepLink, save, sendTest, disconnect,
    sendInsightsNow, sendingInsights,
  } = useTelegramConnect(onConfigChanged);

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [showConnectWizard, setShowConnectWizard] = useState(false);
  const [expandedToken, setExpandedToken] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [savingRecipientIdx, setSavingRecipientIdx] = useState(null);
  const [savedRecipientIdx, setSavedRecipientIdx] = useState(null);
  const [detectingRecipientIdx, setDetectingRecipientIdx] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingRecipient, setDeletingRecipient] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'failed' | 'pending'
  const [expandedErrorId, setExpandedErrorId] = useState(null);
  const [expandedTextId, setExpandedTextId] = useState(null);
  const [retryingQueue, setRetryingQueue] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedTextId, setCopiedTextId] = useState(null);
  const HISTORY_LIMIT = 30;
  const historyIntervalRef = React.useRef(null);

  const eventCategories = React.useMemo(() => buildTelegramEventCategories(t), [t]);

  // Fetch history on mount (once loading finishes) and after each save
  useEffect(() => {
    if (!loading) fetchHistory(HISTORY_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, saved]);

  // Auto-refresh history every 30s while tab is visible
  useEffect(() => {
    historyIntervalRef.current = setInterval(() => fetchHistory(HISTORY_LIMIT), 30_000);
    return () => clearInterval(historyIntervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRetryQueue() {
    setRetryingQueue(true);
    try {
      await api.post('/api/telegram/retry-queue');
      await fetchHistory(HISTORY_LIMIT);
      toast.success('تمت إعادة المحاولة');
    } catch { toast.error('تعذرت إعادة المحاولة'); }
    finally { setRetryingQueue(false); }
  }

  function copyError(row) {
    const text = `الحدث: ${row.event_type}\nالوقت: ${row.created_at}\nالخطأ: ${row.error || '—'}\nالرسالة: ${(row.text || '').slice(0, 300)}`;
    navigator.clipboard?.writeText(text).catch(() => { });
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function copyText(row) {
    navigator.clipboard?.writeText(row.text || '').catch(() => { });
    setCopiedTextId(row.id);
    setTimeout(() => setCopiedTextId(null), 2000);
  }

  const StepBadge = ({ n, done }) => (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${done ? "bg-success-text text-white" : "bg-primary text-white"}`}>
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  );

  const isBotConnected = Boolean(config.telegram_bot_token.trim());
  const hasEnabledRecipient = recipients.some(r => r.enabled && r.chatId);
  const safeIdx = recipients.length === 0 ? 0 : Math.min(selectedIdx, recipients.length - 1);
  const selectedRecipient = recipients[safeIdx];

  async function handleConfirmDeleteRecipient() {
    if (deleteConfirm == null) return;
    setDeletingRecipient(true);
    try {
      await deleteRecipient(deleteConfirm.index);
      toast.success(t("telegram.recipientDeleted"));
      setDeleteConfirm(null);
      setSelectedIdx(0);
    } catch { /* toast shown by hook */ }
    finally { setDeletingRecipient(false); }
  }

  async function detectForRecipient(index) {
    if (!config.telegram_bot_token.trim()) { toast.error(t("telegram.detectNeedsToken")); return; }
    setDetectingRecipientIdx(index);
    try {
      const r = await api.post("/api/telegram/detect-chat-id", {
        bot_token: config.telegram_bot_token.trim(),
        api_base: config.telegram_api_base?.trim() || undefined,
      }, { validateStatus: s => s < 500 });
      const body = r.data;
      if (body?.found === false) {
        toast.error(t("telegram.detectNothing"), { duration: 4000 });
      } else if (body?.data?.chatId) {
        const current = recipients[index];
        const patch = { chatId: String(body.data.chatId), name: current?.name || body.data.chatName || "" };
        updateRecipientLocal(index, patch);
        toast.success(body.data.chatName ? t("telegram.detectFound", { name: body.data.chatName }) : t("telegram.detectFoundNoName"));
        setSavingRecipientIdx(index);
        try {
          await saveSingleRecipient(index, { ...(current || {}), ...patch });
          setSavedRecipientIdx(index);
          setTimeout(() => setSavedRecipientIdx(null), 2000);
        } catch { /* toast shown by hook */ }
        finally { setSavingRecipientIdx(null); }
      } else if (body?.success === false) {
        toast.error(body.message || t("telegram.detectError"));
      }
    } catch (e) { toast.error(e.response?.data?.message || t("telegram.detectError")); }
    finally { setDetectingRecipientIdx(null); }
  }

  const EVENT_TYPE_MAP = {
    NEW_INVOICE: { icon: Receipt, label: t("telegram.toggleNewInvoice") },
    DAILY_CLOSE: { icon: BarChart3, label: t("telegram.toggleDailyClose") },
    SHIFT_CLOSE: { icon: BarChart3, label: t("telegram.toggleDailyClose") },
    LARGE_INVOICE: { icon: DollarSign, label: t("telegram.toggleLargeAmounts") },
    LARGE_DISCOUNT: { icon: DollarSign, label: t("telegram.toggleLargeAmounts") },
    SALES_RETURN: { icon: RotateCcw, label: t("telegram.toggleReturnsVoids") },
    INVOICE_VOIDED: { icon: RotateCcw, label: t("telegram.toggleReturnsVoids") },
    PURCHASE_CREATED: { icon: CreditCard, label: t("telegram.togglePurchasesPayments") },
    CUSTOMER_PAYMENT: { icon: Wallet, label: t("telegram.togglePurchasesPayments") },
    RETURN_PAYMENT: { icon: Wallet, label: t("telegram.toggleReturnPayment") },
    CUSTOMER_CREATED: { icon: UserPlus, label: t("telegram.toggleCustomerCreated") },
    SUPPLIER_CREATED: { icon: Building2, label: t("telegram.toggleSupplierCreated") },
    EXPENSE_CREATED: { icon: FileText, label: t("telegram.toggleExpenseCreated") },
    LOW_STOCK: { icon: AlertTriangle, label: t("telegram.toggleLowStock") },
    BACKUP_RESULT: { icon: Monitor, label: t("telegram.toggleSystem") },
    FAILED_LOGIN: { icon: Monitor, label: t("telegram.toggleSystem") },
    TEST: { icon: Send, label: t("telegram.test") },
    STOCK_TRANSFERRED: { icon: Package, label: t("telegram.toggleStockTransfer") },
    INVENTORY_ADJUSTED: { icon: ClipboardList, label: t("telegram.toggleInventoryAdjustment") },
    NEW_PRODUCT: { icon: Tags, label: t("telegram.toggleNewProduct") },
    PRICE_CHANGED: { icon: CircleDollarSign, label: t("telegram.togglePriceChange") },
    BATCH_EXPIRY_WARNING: { icon: Timer, label: t("telegram.toggleBatchExpiry") },
    PHYSICAL_COUNT_CONFIRMED: { icon: PackageCheck, label: t("telegram.togglePhysicalCount") },
    SUPPLIER_PAYMENT: { icon: Banknote, label: t("telegram.toggleSupplierPayment") },
    DEBT_PAYMENT_RECEIVED: { icon: HandCoins, label: t("telegram.toggleDebtPayment") },
    INSTALLMENT_PAID: { icon: BadgeAlert, label: t("telegram.toggleInstallmentPaid") },
    PURCHASE_VOIDED: { icon: ShoppingCart, label: t("telegram.togglePurchaseVoided") },
    PURCHASE_RETURN: { icon: RotateCcw, label: t("telegram.togglePurchaseReturn") },
    BRANCH_TRANSFER: { icon: ArrowRightLeft, label: t("telegram.toggleBranchTransfer") },
    PASSWORD_CHANGED: { icon: Key, label: t("telegram.togglePasswordChanged") },
    PERMISSION_CHANGED: { icon: UserCog, label: t("telegram.togglePermissionChanged") },
    SUPERVISOR_OVERRIDE: { icon: Lock, label: t("telegram.toggleSupervisorOverride") },
    REPAIR_ORDER_CREATED: { icon: Wrench, label: t("telegram.toggleRepairOrder") },
    REPAIR_ORDER_READY: { icon: Wrench, label: t("telegram.toggleRepairOrder") },
    REPAIR_ORDER_DELIVERED: { icon: Wrench, label: t("telegram.toggleRepairOrder") },
    REVENUE_CREATED: { icon: Banknote, label: t("telegram.toggleRevenueCreated") },
    WITHDRAWAL_CREATED: { icon: Landmark, label: t("telegram.toggleWithdrawalCreated") },
    EMPLOYEE_CREATED: { icon: UserCog, label: t("telegram.toggleEmployeeCreated") },
    SALARY_SETTLED: { icon: HandCoins, label: t("telegram.toggleSalarySettled") },
    ADVANCE_CREATED: { icon: Banknote, label: t("telegram.toggleAdvanceCreated") },
    DEDUCTION_CREATED: { icon: BadgeAlert, label: t("telegram.toggleDeductionCreated") },
    BONUS_CREATED: { icon: BadgeAlert, label: t("telegram.toggleBonusCreated") },
    // Edit / delete / cancel events (migrations 201 & 202) — labelled so the
    // history log renders them for every action instead of a raw English key.
    INVOICE_EDITED: { icon: Receipt, label: "تعديل فاتورة مبيعات" },
    INVOICE_AMENDED: { icon: Receipt, label: "تعديل (أمندمنت) فاتورة" },
    PURCHASE_EDITED: { icon: CreditCard, label: "تعديل فاتورة مشتريات" },
    PURCHASE_RETURN_CANCELLED: { icon: RotateCcw, label: "إلغاء مرتجع مشتريات" },
    BRANCH_TRANSFER_EDITED: { icon: ArrowRightLeft, label: "تعديل حركة فرع" },
    BRANCH_TRANSFER_CANCELLED: { icon: ArrowRightLeft, label: "إلغاء حركة فرع" },
    WITHDRAWAL_EDITED: { icon: Landmark, label: "تعديل سحب نقدي" },
    WITHDRAWAL_DELETED: { icon: Landmark, label: "حذف سحب نقدي" },
    EXPENSE_EDITED: { icon: FileText, label: "تعديل مصروف" },
    EXPENSE_DELETED: { icon: FileText, label: "حذف مصروف" },
    REVENUE_EDITED: { icon: Banknote, label: "تعديل إيراد" },
    REVENUE_DELETED: { icon: Banknote, label: "حذف إيراد" },
  };

  const STATUS_MAP = {
    sent: { label: t("telegram.statusSent"), cls: "bg-success-bg text-success-text" },
    failed: { label: t("telegram.statusFailed"), cls: "bg-danger-bg text-danger-text" },
    pending: { label: t("telegram.statusPending"), cls: "bg-warning-bg text-warning-text" },
  };

  const failedCount = history.filter(r => r.status === 'failed').length;
  const pendingCount = history.filter(r => r.status === 'pending').length;
  const alertCount = failedCount + pendingCount;

  const filteredHistory = history.filter(r => {
    if (historyFilter === 'failed') return r.status === 'failed';
    if (historyFilter === 'pending') return r.status === 'pending';
    return true;
  });

  function HistorySection() {
    return (
      <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center gap-2.5">
            <StepBadge n="٤" done={false} />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-text-primary">{t("telegram.historyTitle")}</p>
                {alertCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger-text text-[9px] font-black text-white">
                    {alertCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-text-muted">
                {loadingHistory ? 'جاري التحميل...' : history.length === 0 ? 'لا توجد رسائل بعد' : `${history.length} رسالة`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(failedCount > 0 || pendingCount > 0) && (
              <button
                type="button"
                onClick={handleRetryQueue}
                disabled={retryingQueue}
                className="flex items-center gap-1 rounded-lg border border-warning-border bg-warning-bg px-2.5 py-1.5 text-[10px] font-black text-warning-text hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {retryingQueue ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                إعادة المحاولة
              </button>
            )}
            <button
              type="button"
              onClick={() => { setHistoryPage(0); fetchHistory(HISTORY_LIMIT); }}
              disabled={loadingHistory}
              className="flex items-center gap-1 text-[11px] font-black text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loadingHistory ? 'animate-spin' : ''}`} />
              {t("telegram.historyRefresh")}
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 mb-3">
          {[
            { key: 'all', label: `الكل (${history.length})` },
            { key: 'failed', label: `فشل (${failedCount})`, cls: failedCount > 0 ? 'text-danger-text' : '' },
            { key: 'pending', label: `انتظار (${pendingCount})`, cls: pendingCount > 0 ? 'text-warning-text' : '' },
          ].map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setHistoryFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${historyFilter === f.key
                  ? 'bg-primary text-white'
                  : `bg-bg-base border border-border-normal text-text-muted hover:border-primary/40 ${f.cls || ''}`
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {filteredHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-normal bg-bg-base p-6 text-center">
            <Clock className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs font-black text-text-secondary">
              {loadingHistory ? 'جاري التحميل...' : historyFilter === 'all' ? 'لا توجد رسائل مسجلة بعد — ستظهر هنا بعد أول إشعار' : 'لا توجد رسائل بهذا الفلتر'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {filteredHistory.map((row) => {
              const meta = EVENT_TYPE_MAP[row.event_type] || { icon: Send, label: row.event_type };
              const IconComp = meta.icon;
              const status = STATUS_MAP[row.status] || STATUS_MAP.pending;
              const isExpanded = expandedErrorId === row.id;
              const isTextExpanded = expandedTextId === row.id;
              const hasError = row.status === 'failed' && row.error;
              return (
                <div key={row.id} className={`rounded-lg border bg-bg-base overflow-hidden transition-all ${hasError ? 'border-danger-border/50' : 'border-border-normal'
                  }`}>
                  <div className="flex items-center gap-2.5 px-3 py-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-surface">
                      <IconComp className="h-3.5 w-3.5 text-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-text-primary">{meta.label}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black ${status.cls}`}>{status.label}</span>
                        {row.retry_count > 0 && (
                          <span className="shrink-0 text-[9px] font-bold text-text-muted">× {row.retry_count} محاولة</span>
                        )}
                      </div>
                      {row.text && (
                        <button
                          type="button"
                          onClick={() => setExpandedTextId(isTextExpanded ? null : row.id)}
                          title="عرض نص الرسالة كاملاً"
                          className="block w-full text-right text-[10px] font-bold text-text-muted truncate mt-0.5 hover:text-primary transition-colors"
                        >
                          {row.text.slice(0, 90)}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-text-muted">{row.created_at?.slice(0, 16)?.replace('T', ' ')}</span>
                      {row.text && (
                        <button
                          type="button"
                          onClick={() => setExpandedTextId(isTextExpanded ? null : row.id)}
                          title="عرض نص الرسالة المُرسَل"
                          className="flex items-center justify-center h-6 w-6 rounded-md bg-bg-surface border border-border-normal text-text-secondary hover:border-primary/40 transition-all"
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform ${isTextExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      {hasError && (
                        <button
                          type="button"
                          onClick={() => setExpandedErrorId(isExpanded ? null : row.id)}
                          title="عرض تفاصيل الخطأ"
                          className="flex items-center justify-center h-6 w-6 rounded-md bg-danger-bg text-danger-text hover:opacity-80 transition-all"
                        >
                          <AlertTriangle className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isTextExpanded && row.text && (
                    <div className="border-t border-border-normal bg-bg-surface/60 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-medium text-text-secondary leading-relaxed flex-1 whitespace-pre-wrap break-words">{row.text}</p>
                        <button
                          type="button"
                          onClick={() => copyText(row)}
                          title="نسخ نص الرسالة"
                          className="shrink-0 flex items-center gap-1 rounded-md bg-bg-base border border-border-normal px-2 py-1 text-[9px] font-black text-text-secondary hover:border-primary/40 transition-all"
                        >
                          {copiedTextId === row.id ? <Check className="h-3 w-3 text-success-text" /> : <Copy className="h-3 w-3" />}
                          {copiedTextId === row.id ? 'تم النسخ' : 'نسخ'}
                        </button>
                      </div>
                    </div>
                  )}
                  {isExpanded && hasError && (
                    <div className="border-t border-danger-border/30 bg-danger-bg/30 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p dir="ltr" className="text-[10px] font-mono text-danger-text leading-relaxed flex-1 break-all">{row.error}</p>
                        <button
                          type="button"
                          onClick={() => copyError(row)}
                          title="نسخ تفاصيل الخطأ"
                          className="shrink-0 flex items-center gap-1 rounded-md bg-bg-surface border border-border-normal px-2 py-1 text-[9px] font-black text-text-secondary hover:border-primary/40 transition-all"
                        >
                          {copiedId === row.id ? <Check className="h-3 w-3 text-success-text" /> : <Copy className="h-3 w-3" />}
                          {copiedId === row.id ? 'تم النسخ' : 'نسخ'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {history.length >= HISTORY_LIMIT && (
          <button
            type="button"
            onClick={() => { setHistoryPage(p => p + 1); fetchHistory(HISTORY_LIMIT * (historyPage + 2)); }}
            disabled={loadingHistory}
            className="w-full mt-3 text-[11px] font-black text-primary hover:underline disabled:opacity-50"
          >
            {t("telegram.historyLoadMore")}
          </button>
        )}
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-16"><RefreshCw className="h-8 w-8 animate-spin text-text-muted" /></div>;
  if (loadError) return <EmptyState icon={Settings} title={t("telegram.loadError")} description={t("telegram.loadError")} />;

  return (
    <div className="space-y-5">
      {showAddWizard && <AddRecipientWizard onClose={() => setShowAddWizard(false)} onAdded={() => { setShowAddWizard(false); refreshRecipients(); toast.success(t("telegram.recipientAdded")); }} />}
      {showConnectWizard && <TelegramConnectWizard onClose={() => setShowConnectWizard(false)} onSaved={onConfigChanged} />}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !deletingRecipient && setDeleteConfirm(null)}>
          <div
            className="bg-bg-surface rounded-2xl shadow-modal w-full max-w-md overflow-hidden border border-danger-border"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="telegram-delete-recipient-title"
          >
            <div className="flex items-start gap-3 border-b border-danger-border bg-danger-bg px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-text/10">
                <Trash2 className="h-5 w-5 text-danger-text" />
              </div>
              <div className="min-w-0">
                <h3 id="telegram-delete-recipient-title" className="text-sm font-black text-danger-text">
                  {t("telegram.deleteRecipientConfirmTitle")}
                </h3>
                <p className="text-[11px] font-bold text-text-secondary mt-1 leading-relaxed">
                  {t("telegram.deleteRecipientConfirmMessage", { name: deleteConfirm.name })}
                </p>
                {recipients[deleteConfirm.index]?.chatId && (
                  <p className="text-[10px] font-bold text-text-muted mt-1" dir="ltr">
                    {t("telegram.recipientChatSummary", { chatId: recipients[deleteConfirm.index].chatId })}
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold text-text-muted leading-relaxed">{t("telegram.deleteRecipientConfirmHint")}</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border-normal px-5 py-4 bg-bg-base/60">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingRecipient}
                className="rounded-lg border border-border-normal bg-bg-surface px-4 py-2 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRecipient}
                disabled={deletingRecipient}
                className="inline-flex items-center gap-1.5 rounded-lg bg-danger-text px-4 py-2 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
              >
                {deletingRecipient ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deletingRecipient ? t("telegram.deletingRecipient") : t("telegram.deleteRecipientConfirmAction")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-card text-white ${telegramEnabled ? "bg-success-text" : "bg-text-muted"}`}>
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-text-primary flex items-center gap-2">
              {t("telegram.title")}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black text-white ${telegramEnabled ? "bg-success-text" : "bg-text-muted"}`}>
                {telegramEnabled ? t("telegram.statusEnabled") : t("telegram.statusDisabled")}
              </span>
            </h2>
            <p className="text-[11px] font-bold text-text-muted mt-0.5">{t("telegram.subtitle")}</p>
          </div>
        </div>
        {saved && (
          <button type="button" onClick={() => setShowDisconnectConfirm(true)} disabled={disconnecting}
            className="flex items-center gap-1.5 rounded-lg border border-danger-border bg-danger-bg px-4 py-2 text-xs font-black text-danger-text hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {disconnecting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
            {t("telegram.disconnect")}
          </button>
        )}
      </div>

      {showDisconnectConfirm && (
        <div className="rounded-xl border border-danger-border bg-danger-bg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Unlink className="h-4 w-4 text-danger-text shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-danger-text">{t("telegram.disconnectConfirmTitle")}</p>
              <p className="text-[11px] font-bold text-text-secondary mt-1 leading-relaxed">{t("telegram.disconnectConfirmMessage")}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowDisconnectConfirm(false)} disabled={disconnecting}
              className="rounded-lg border border-border-normal bg-bg-surface px-4 py-2 text-xs font-black text-text-secondary hover:bg-bg-base transition-all active:scale-95">
              {t("common.cancel")}
            </button>
            <button type="button" onClick={async () => { await disconnect(); setShowDisconnectConfirm(false); }} disabled={disconnecting}
              className="rounded-lg bg-danger-text px-4 py-2 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
              {disconnecting ? <RefreshCw className="h-3.5 w-3.5 animate-spin inline ml-1" /> : null}
              {t("telegram.disconnectConfirm")}
            </button>
          </div>
        </div>
      )}

      {/* Step 1 — Bot Connection */}
      <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2.5 mb-4">
          <StepBadge n="١" done={isBotConnected && saved} />
          <div>
            <p className="text-sm font-black text-text-primary">{t("telegram.step1")}</p>
            <p className="text-[11px] font-bold text-text-muted">{t("telegram.step1Hint")}</p>
          </div>
        </div>

        {!isBotConnected ? (
          <div className="space-y-3">
            <button type="button" onClick={() => setShowConnectWizard(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-black text-white shadow-card hover:opacity-90 transition-all active:scale-[0.98]">
              <QrCode className="h-5 w-5" />
              <div className="text-right">
                <p>{t("telegram.connectCta")}</p>
                <p className="text-[10px] font-bold opacity-80">{t("telegram.connectCtaHint")}</p>
              </div>
            </button>
            <button type="button" onClick={() => setExpandedToken(!expandedToken)}
              className="w-full text-[11px] font-black text-text-muted hover:text-text-secondary transition-colors flex items-center justify-center gap-1">
              <ChevronDown className={`h-3 w-3 transition-transform ${expandedToken ? "rotate-180" : ""}`} />
              {t("telegram.hasTokenPaste")}
            </button>
            {expandedToken && (
              <div className="space-y-2 animate-fade-in">
                <div className="relative">
                  <input type="password" dir="ltr" value={config.telegram_bot_token}
                    onChange={e => setConfig(c => ({ ...c, telegram_bot_token: e.target.value }))}
                    placeholder={t("telegram.botTokenPlaceholder")}
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
                  {validating && <RefreshCw className="absolute left-3 top-2.5 h-4 w-4 animate-spin text-text-muted" />}
                </div>
                {botInfo && (
                  <p className="text-[11px] font-black text-success-text flex items-center gap-1">
                    <Check className="h-3 w-3" /> {t("telegram.botInfoValid", { name: botInfo.name || botInfo.username })}
                  </p>
                )}
                {botInfo && !qrData && (
                  <button type="button" onClick={generateDeepLink} disabled={generatingQr}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[11px] font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                    {generatingQr ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                    {t("telegram.generateQr")}
                  </button>
                )}
                {qrData && (
                  <div className="flex flex-col items-center gap-2">
                    <img src={qrData.qr} alt="QR" className="h-36 w-36 rounded-xl border-2 border-primary/40" />
                    {pollStatus === "polling" && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                        <span className="text-[11px] font-black text-primary">{t("telegram.pollingStatus")}</span>
                      </div>
                    )}
                    <a href={qrData.url} target="_blank" rel="noreferrer" dir="ltr" className="text-[11px] font-black text-primary underline break-all text-center">{t("telegram.fallbackLink")}</a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-success-border bg-success-bg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-success-text" />
                <div>
                  <p className="text-xs font-black text-success-text">{t("telegram.botConnected")}</p>
                  {botInfo && <p className="text-[11px] font-bold text-text-secondary mt-0.5">@{botInfo.username || botInfo.name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={generateDeepLink} disabled={generatingQr}
                  className="text-[11px] font-black text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${generatingQr ? "animate-spin" : ""}`} />
                  {t("telegram.revalidate")}
                </button>
                <button type="button" onClick={async () => { await disconnect(); setShowConnectWizard(true); }}
                  className="text-[11px] font-black text-danger-text hover:underline flex items-center gap-1">
                  <Unlink className="h-3 w-3" />
                  {t("telegram.reconnect")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — Recipients */}
      <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center gap-2.5">
            <StepBadge n="٢" done={hasEnabledRecipient} />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-text-primary">{t("telegram.step2")}</p>
                {recipients.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                    {t("telegram.recipientsCountBadge", { count: recipients.length })}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-text-muted">{t("telegram.recipientsHint")}</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowAddWizard(true)}
            disabled={!isBotConnected}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-[11px] font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            <Plus className="h-3.5 w-3.5" /> {t("telegram.addRecipient")}
          </button>
        </div>

        {recipients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-normal bg-bg-base p-6 text-center">
            <Users className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs font-black text-text-secondary">{t("telegram.noRecipients")}</p>
            <p className="text-[11px] font-bold text-text-muted mt-1">{t("telegram.noRecipientsHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recipients.length > 1 && (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {recipients.map((recipient, index) => (
                  <TgRecipientTile
                    key={recipient.id ?? `recipient-${index}`}
                    recipient={recipient}
                    index={index}
                    selected={index === safeIdx}
                    onSelect={() => setSelectedIdx(index)}
                  />
                ))}
              </div>
            )}
            {selectedRecipient && (
              <TgRecipientEditor
                key={selectedRecipient.id ?? `editor-${safeIdx}`}
                recipient={selectedRecipient}
                index={safeIdx}
                eventCategories={eventCategories}
                onUpdate={(patch) => updateRecipientLocal(safeIdx, patch)}
                onDetect={() => detectForRecipient(safeIdx)}
                onTest={() => sendTest(selectedRecipient.chatId)}
                onAskDelete={(index, name) => setDeleteConfirm({ index, name })}
                testing={testing}
                detecting={detectingRecipientIdx === safeIdx}
                saving={savingRecipientIdx === safeIdx}
                justSaved={savedRecipientIdx === safeIdx}
                hasBotToken={Boolean(config.telegram_bot_token.trim())}
                canManageEvents={perms?.canManageEvents}
              />
            )}
          </div>
        )}
        {dirty && recipients.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning-border/40 bg-warning-bg/15 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-warning-text animate-pulse" />
            <p className="text-[11px] font-bold text-warning-text">{t("telegram.unsavedRecipientChanges", "تغييرات غير محفوظة — اضغط زر «حفظ التغييرات» في الأسفل")}</p>
          </div>
        )}
      </div>

      {/* Step 3 — Enable */}
      <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2.5 mb-4">
          <StepBadge n="٣" done={saved} />
          <div>
            <p className="text-sm font-black text-text-primary">{t("telegram.step3")}</p>
            <p className="text-[11px] font-bold text-text-muted">{t("telegram.step3Hint")}</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border-normal bg-bg-input px-4 py-3">
          <div>
            <span className="text-xs font-black text-text-primary block">{t("telegram.enable")}</span>
            <span className="text-[10px] font-bold text-text-muted">{t("telegram.enableHint")}</span>
          </div>
          <TelegramSwitch
            checked={config.telegram_enabled}
            onChange={(val) => setConfig(c => ({ ...c, telegram_enabled: val }))}
          />
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg border border-border-normal bg-bg-input px-4 py-3">
          <div>
            <span className="text-xs font-black text-text-primary block">{t("telegram.statusChip")}</span>
            <span className="text-[10px] font-bold text-text-muted">{t("telegram.statusChipHint")}</span>
          </div>
          <TelegramSwitch
            checked={config.telegram_status_chip_enabled !== false}
            onChange={(val) => setConfig(c => ({ ...c, telegram_status_chip_enabled: val }))}
          />
        </div>
        {!saved && isBotConnected && (
          <p className="mt-3 text-[11px] font-bold text-text-muted">{t("telegram.step4Hint")}</p>
        )}
      </div>

      {/* Smart decisions report — build & send the reorder / dead-stock /
          weak-margin / rising-products analytics to all recipients on demand.
          Sits with the weekly digest concept but fires instantly. */}
      {isBotConnected && (
        <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info-text">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-text-primary">تقرير القرارات الذكية</p>
                <p className="text-[11px] font-bold text-text-muted leading-relaxed">
                  اقتراحات الشراء، البضاعة الراكدة، الهوامش الضعيفة، والمنتجات الصاعدة — يُرسل تلقائياً أسبوعياً، أو أرسله الآن.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={sendInsightsNow}
              disabled={sendingInsights || !config.telegram_enabled}
              title={!config.telegram_enabled ? "فعّل تيليجرام أولاً" : undefined}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
            >
              {sendingInsights ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendingInsights ? "جاري الإرسال..." : "إرسال التقرير الآن"}
            </button>
          </div>
        </div>
      )}

      {/* Fixed save bar */}
      {(dirty || saving) && (
        <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-primary/30 bg-bg-surface/95 backdrop-blur shadow-elevated px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dirty ? "bg-warning-text animate-pulse" : "bg-success-text"}`} />
              <div className="min-w-0">
                <p className="text-xs font-black text-text-primary">{dirty ? t("telegram.unsavedChanges") : t("telegram.savingChanges")}</p>
                <p className="text-[10px] font-bold text-text-muted truncate">{t("telegram.unsavedChangesHint")}</p>
              </div>
            </div>
            <button onClick={save} disabled={saving || (config.telegram_enabled && !config.telegram_bot_token.trim())}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? t("telegram.savingChanges") : t("telegram.saveAll")}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — History */}
      <HistorySection />
    </div>
  );
}

const CHANNEL_BADGE = {
  whatsapp: { text: "واتساب فقط", cls: "bg-success-bg text-success-text" },
  sms: { text: "SMS فقط", cls: "bg-info-bg text-info-text" },
  both: { text: "واتساب و SMS", cls: "bg-bg-base text-text-secondary" },
  telegram: { text: "تيليجرام", cls: "bg-info-bg text-info-text" },
};
function ChannelBadge({ channel }) {
  const b = CHANNEL_BADGE[channel] || CHANNEL_BADGE.both;
  return <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${b.cls}`}>{b.text}</span>;
}

// ── Categories: automatic-trigger message purposes. Each can have several
// saved variants (drafts); exactly one is active/live at a time. Mirrors
// CATEGORY_CHANNEL in whatsappCrm.routes.js and the defaults in migration 177.
// Tokens exposed in the template editor chips for every Telegram event
// whose message auto-appends the accumulative "day so far" footer. These
// let the owner embed {daily_accumulative_footer} (or its individual
// parts) anywhere in the body instead of always getting it at the end.
const ACCUM_VAR_CHIPS = [
  { token: "{daily_accumulative_footer}", label: "ملخص اليوم الكامل" },
  { token: "{daily_cash_in}", label: "وارد الصندوق" },
  { token: "{daily_cash_out}", label: "صادر الصندوق" },
  { token: "{daily_cash_net}", label: "صافي الصندوق" },
  { token: "{daily_expected_cash}", label: "الرصيد المتوقع" },
  { token: "{daily_methods_summary}", label: "ملخص طرق الدفع" },
];

const CATEGORY_META = {
  receipt: {
    label: "إيصال البيع", hint: "يُرسل فور إتمام عملية بيع", vars: [
      { token: "{name}", label: "اسم العميل" }, { token: "{invoice_no}", label: "رقم الفاتورة" },
      { token: "{total}", label: "الإجمالي" }, { token: "{date}", label: "التاريخ والوقت" },
      { token: "{payment_type}", label: "طريقة الدفع" }, { token: "{discount}", label: "الخصم" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{payment_breakdown}", label: "تفصيل الدفع" },
      { token: "{cashier}", label: "الكاشير" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  return_receipt: {
    label: "إيصال المرتجع", hint: "يُرسل عند استلام مرتجع مبيعات", vars: [
      { token: "{name}", label: "اسم العميل" }, { token: "{invoice_no}", label: "رقم فاتورة المرتجع" },
      { token: "{total}", label: "إجمالي المسترد" }, { token: "{date}", label: "التاريخ والوقت" },
      { token: "{payment_type}", label: "طريقة الدفع" }, { token: "{discount}", label: "الخصم" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{payment_breakdown}", label: "تفصيل الدفع" },
      { token: "{cashier}", label: "الكاشير" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  birthday: {
    label: "عيد الميلاد", hint: "يُرسل صباح يوم ميلاد العميل", vars: [
      { token: "{name}", label: "اسم العميل" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  debt: {
    label: "تذكير الدين", hint: "يُرسل عند تذكير العميل برصيد مستحق", vars: [
      { token: "{name}", label: "اسم العميل" }, { token: "{amount}", label: "المبلغ" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  purchase_receipt: {
    label: "فاتورة شراء", hint: "تُرسل عند إتمام عملية شراء", vars: [
      { token: "{name}", label: "اسم المورد" }, { token: "{invoice_no}", label: "رقم الفاتورة" },
      { token: "{total}", label: "الإجمالي" }, { token: "{date}", label: "التاريخ والوقت" },
      { token: "{payment_type}", label: "طريقة الدفع" }, { token: "{discount}", label: "الخصم" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{payment_breakdown}", label: "تفصيل الدفع" },
      { token: "{cashier}", label: "المسؤول" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  purchase_return_receipt: {
    label: "مرتجع مشتريات", hint: "يُرسل عند استلام مرتجع مشتريات", vars: [
      { token: "{name}", label: "اسم المورد" }, { token: "{invoice_no}", label: "رقم فاتورة المرتجع" },
      { token: "{total}", label: "إجمالي المسترد" }, { token: "{date}", label: "التاريخ والوقت" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{cashier}", label: "المسؤول" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  transfer_send: {
    label: "تسليم بضاعة", hint: "يُرسل عند تسليم بضاعة لفرع آخر", vars: [
      { token: "{name}", label: "الفرع المُستلم" }, { token: "{invoice_no}", label: "رقم المستند" },
      { token: "{total}", label: "إجمالي التكلفة" }, { token: "{date}", label: "التاريخ والوقت" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{cashier}", label: "المسؤول" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  transfer_receive: {
    label: "استلام بضاعة", hint: "يُرسل عند استلام بضاعة من فرع آخر", vars: [
      { token: "{name}", label: "الفرع المُرسل" }, { token: "{invoice_no}", label: "رقم المستند" },
      { token: "{total}", label: "إجمالي التكلفة" }, { token: "{date}", label: "التاريخ والوقت" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{cashier}", label: "المسؤول" }, { token: "{shop}", label: "اسم المتجر" },
    ]
  },
  telegram_new_invoice: {
    label: "فاتورة مبيعات جديدة", hint: "تنبيه فوري بكل فاتورة بيع", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{customer_name}", label: "اسم العميل" },
      { token: "{total}", label: "الإجمالي" }, { token: "{subtotal}", label: "الصافي" },
      { token: "{tax}", label: "الضريبة" }, { token: "{discount}", label: "الخصم" },
      { token: "{paid}", label: "المدفوع" }, { token: "{balance}", label: "الباقي" },
      { token: "{payment_type}", label: "طريقة الدفع" }, { token: "{created_at}", label: "التوقيت" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{payment_breakdown}", label: "تفصيل الدفع" },
      ...ACCUM_VAR_CHIPS,
    ]
  },
  telegram_daily_close: {
    label: "إغلاق يومية", hint: "ملخص عند إغلاق اليومية", vars: [
      { token: "{date}", label: "التاريخ" }, { token: "{opening_balance}", label: "الرصيد الافتتاحي" },
      { token: "{cash_sales}", label: "المبيعات النقدية" }, { token: "{credit_sales}", label: "المبيعات الآجلة" },
      { token: "{installment_cash}", label: "أقساط نقدية" }, { token: "{multi_cash}", label: "متعدد نقدية" },
      { token: "{bank_sales}", label: "مبيعات بنكي/بطاقة" }, { token: "{total_sales}", label: "إجمالي المبيعات" },
      { token: "{purchases_cash}", label: "مشتريات نقدية" }, { token: "{purchases_payable}", label: "مشتريات آجلة" },
      { token: "{sales_returns_cash}", label: "مرتجع مبيعات نقدي" }, { token: "{sales_returns_account}", label: "مرتجع مبيعات آجل" },
      { token: "{purchase_returns_cash}", label: "مرتجع مشتريات نقدي" }, { token: "{purchase_returns_account}", label: "مرتجع مشتريات آجل" },
      { token: "{expenses_cash}", label: "مصروفات نقدية" }, { token: "{expenses_count}", label: "عدد المصروفات" },
      { token: "{revenues_cash}", label: "إيرادات نقدية" }, { token: "{revenues_count}", label: "عدد الإيرادات" },
      { token: "{withdrawals}", label: "سحوبات" },
      { token: "{customer_payments}", label: "تحصيل عملاء" }, { token: "{customer_payments_count}", label: "عدد تحصيلات العملاء" },
      { token: "{supplier_payments}", label: "دفع موردين" }, { token: "{supplier_payments_count}", label: "عدد دفعات الموردين" },
      { token: "{ajal_payments}", label: "تحصيل آجل" },
      { token: "{cash_in}", label: "الوارد" }, { token: "{cash_out}", label: "الصادر" },
      { token: "{non_cash_total}", label: "إجمالي غير النقدي" },
      { token: "{expected_cash}", label: "الرصيد المتوقع" }, { token: "{actual_cash}", label: "الرصيد الفعلي" },
      { token: "{discrepancy}", label: "الفرق" }, { token: "{invoices_count}", label: "عدد الفواتير" },
      { token: "{payment_methods_summary}", label: "ملخص طرق الدفع" },
    ]
  },
  telegram_large_invoice: {
    label: "فاتورة بمبلغ كبير", hint: "تنبيه عند تجاوز الفاتورة حداً معيناً", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{customer_name}", label: "اسم العميل" }, { token: "{total}", label: "الإجمالي" },
      ...ACCUM_VAR_CHIPS,
    ]
  },
  telegram_large_discount: {
    label: "خصم كبير", hint: "تنبيه عند تطبيق خصم كبير", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{discount_percent}", label: "نسبة الخصم" },
      ...ACCUM_VAR_CHIPS,
    ]
  },
  telegram_below_cost_sale: {
    label: "بيع تحت التكلفة", hint: "تنبيه عند بيع صنف بأقل من تكلفته", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{customer_name}", label: "اسم العميل" },
      { token: "{item_name}", label: "اسم الصنف" }, { token: "{selling_price}", label: "سعر البيع" },
      { token: "{cost_price}", label: "التكلفة" }, { token: "{loss_amount}", label: "مبلغ الخسارة" },
      { token: "{loss_percent}", label: "نسبة الخسارة" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{items_count}", label: "عدد الأصناف" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_sales_return: {
    label: "مرتجع مبيعات", hint: "تنبيه عند تسجيل مرتجع", vars: [
      { token: "{original_invoice_id}", label: "رقم الفاتورة الأصلية" }, { token: "{total}", label: "مبلغ المرتجع" },
    ]
  },
  telegram_invoice_voided: {
    label: "فاتورة ملغاة", hint: "تنبيه عند إلغاء فاتورة", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{reason}", label: "السبب" }, { token: "{user_name}", label: "بواسطة" },
    ]
  },
  telegram_purchase_created: {
    label: "عملية شراء جديدة", hint: "تنبيه عند تسجيل أمر أو فاتورة شراء", vars: [
      { token: "{kind_label}", label: "نوع العملية" }, { token: "{reference}", label: "الرقم" },
      { token: "{supplier_name}", label: "المورد" }, { token: "{total}", label: "الإجمالي" },
    ]
  },
  telegram_customer_payment: {
    label: "دفعة من عميل", hint: "تنبيه عند تحصيل دفعة", vars: [
      { token: "{customer_name}", label: "اسم العميل" }, { token: "{amount}", label: "المبلغ" }, { token: "{method}", label: "طريقة الدفع" },
    ]
  },
  telegram_low_stock: {
    label: "مخزون منخفض", hint: "تنبيه عند نفاد أو قرب نفاد صنف", vars: [
      { token: "{product_name}", label: "اسم المنتج" }, { token: "{current_quantity}", label: "الكمية الحالية" }, { token: "{min_quantity}", label: "الحد الأدنى" },
    ]
  },
  telegram_backup_result: {
    label: "نتيجة النسخ الاحتياطي", hint: "تنبيه بنجاح أو فشل النسخة الاحتياطية", vars: [
      { token: "{success_text}", label: "حالة النجاح" }, { token: "{reason}", label: "السبب" },
      { token: "{file_path}", label: "مسار الملف" }, { token: "{error}", label: "رسالة الخطأ" },
    ]
  },
  telegram_failed_login: {
    label: "محاولة دخول فاشلة", hint: "تنبيه أمني عند فشل تسجيل دخول", vars: [
      { token: "{username}", label: "اسم المستخدم" }, { token: "{time}", label: "التوقيت" }, { token: "{ip}", label: "IP" },
    ]
  },
  telegram_customer_created: {
    label: "عميل جديد", hint: "تنبيه عند إضافة عميل جديد", vars: [
      { token: "{customer_name}", label: "اسم العميل" }, { token: "{phone}", label: "الهاتف" },
      { token: "{city}", label: "المدينة" }, { token: "{opening_balance}", label: "الرصيد الافتتاحي" },
    ]
  },
  telegram_supplier_created: {
    label: "مورد جديد", hint: "تنبيه عند إضافة مورد جديد", vars: [
      { token: "{supplier_name}", label: "اسم المورد" }, { token: "{phone}", label: "الهاتف" },
      { token: "{opening_balance}", label: "الرصيد الافتتاحي" },
    ]
  },
  telegram_expense_created: {
    label: "مصروف جديد", hint: "تنبيه عند تسجيل مصروف", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{category}", label: "الفئة" },
      { token: "{amount}", label: "المبلغ" }, { token: "{method}", label: "طريقة الدفع" },
      { token: "{description}", label: "الوصف" }, { token: "{date}", label: "التاريخ" },
      { token: "{notes}", label: "ملاحظات" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_return_payment: {
    label: "دفعة مرتجعة", hint: "تنبيه عند إرجاع دفعة لعميل", vars: [
      { token: "{customer_name}", label: "اسم العميل" }, { token: "{amount}", label: "المبلغ" },
      { token: "{method}", label: "طريقة الدفع" }, { token: "{date}", label: "التاريخ" },
    ]
  },
  telegram_stock_transfer: {
    label: "تحويل مخزون", hint: "تنبيه عند نقل مخزون بين المستودعات", vars: [
      { token: "{from_warehouse}", label: "من مستودع" }, { token: "{to_warehouse}", label: "إلى مستودع" },
      { token: "{items_table}", label: "جدول الأصناف" }, { token: "{items_count}", label: "عدد الأصناف" },
      { token: "{total_units}", label: "إجمالي الوحدات" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_inventory_adjustment: {
    label: "تعديل مخزون", hint: "تنبيه عند تعديل كمية صنف يدوياً", vars: [
      { token: "{product_name}", label: "اسم المنتج" }, { token: "{warehouse}", label: "المستودع" },
      { token: "{old_quantity}", label: "الكمية القديمة" }, { token: "{new_quantity}", label: "الكمية الجديدة" },
      { token: "{difference}", label: "الفرق" }, { token: "{reason}", label: "السبب" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_new_product: {
    label: "منتج جديد", hint: "تنبيه عند إضافة منتج جديد", vars: [
      { token: "{product_name}", label: "اسم المنتج" }, { token: "{sku}", label: "الكود" },
      { token: "{price}", label: "السعر" }, { token: "{warehouse}", label: "المستودع" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_price_change: {
    label: "تغيير سعر", hint: "تنبيه عند تغيير سعر صنف", vars: [
      { token: "{product_name}", label: "اسم المنتج" }, { token: "{old_price}", label: "السعر القديم" },
      { token: "{new_price}", label: "السعر الجديد" }, { token: "{change_percent}", label: "نسبة التغيير" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_batch_expiry: {
    label: "انتهاء صلاحية دفعة", hint: "تنبيه عند اقتراب انتهاء صلاحية دفعة", vars: [
      { token: "{product_name}", label: "اسم المنتج" }, { token: "{batch_no}", label: "رقم الدفعة" },
      { token: "{expiry_date}", label: "تاريخ الانتهاء" }, { token: "{remaining_quantity}", label: "الكمية المتبقية" },
      { token: "{warehouse}", label: "المستودع" },
    ]
  },
  telegram_physical_count: {
    label: "جرد فعلي", hint: "تنبيه عند تأكيد الجرد الفعلي", vars: [
      { token: "{warehouse}", label: "المستودع" }, { token: "{matched_count}", label: "أصناف مطابقة" },
      { token: "{mismatched_count}", label: "أصناف غير مطابقة" }, { token: "{total_items}", label: "إجمالي الأصناف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_supplier_payment: {
    label: "دفعة مورد", hint: "تنبيه عند دفع مبلغ للمورد", vars: [
      { token: "{supplier_name}", label: "اسم المورد" }, { token: "{amount}", label: "المبلغ" },
      { token: "{method}", label: "طريقة الدفع" }, { token: "{reference}", label: "المرجع" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_debt_payment: {
    label: "دفعة دين", hint: "تنبيه عند تحصيل دفعة من عميل مدين", vars: [
      { token: "{customer_name}", label: "اسم العميل" }, { token: "{amount}", label: "المبلغ" },
      { token: "{method}", label: "طريقة الدفع" }, { token: "{remaining_debt}", label: "الدين المتبقي" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_installment_paid: {
    label: "دفعة قسط", hint: "تنبيه عند سداد قسط من عميل", vars: [
      { token: "{customer_name}", label: "اسم العميل" }, { token: "{installment_no}", label: "رقم القسط" },
      { token: "{total_installments}", label: "إجمالي الأقساط" }, { token: "{amount}", label: "المبلغ" },
      { token: "{remaining}", label: "المتبقي" },
    ]
  },
  telegram_purchase_voided: {
    label: "شراء ملغي", hint: "تنبيه عند إلغاء فاتورة شراء", vars: [
      { token: "{reference_no}", label: "رقم المرجع" }, { token: "{supplier_name}", label: "اسم المورد" },
      { token: "{total}", label: "الإجمالي" }, { token: "{reason}", label: "السبب" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_purchase_return: {
    label: "مرتجع شراء", hint: "تنبيه عند تسجيل مرتجع مشتريات", vars: [
      { token: "{reference_no}", label: "رقم المرجع" }, { token: "{supplier_name}", label: "اسم المورد" },
      { token: "{total}", label: "الإجمالي" }, { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{items_count}", label: "عدد الأصناف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_sales_return_edited: {
    label: "تعديل مرتجع مبيعات", hint: "تنبيه عند تعديل مرتجع مبيعات موجود", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{customer_name}", label: "اسم العميل" },
      { token: "{old_total}", label: "الإجمالي قبل" }, { token: "{new_total}", label: "الإجمالي بعد" },
      { token: "{old_items_table}", label: "الأصناف قبل" }, { token: "{new_items_table}", label: "الأصناف بعد" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_sales_return_cancelled: {
    label: "إلغاء مرتجع مبيعات", hint: "تنبيه عند إلغاء أو حذف مرتجع مبيعات", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{customer_name}", label: "اسم العميل" },
      { token: "{total}", label: "الإجمالي" }, { token: "{reason}", label: "السبب" },
      { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_purchase_return_edited: {
    label: "تعديل مرتجع مشتريات", hint: "تنبيه عند تعديل مرتجع مشتريات موجود", vars: [
      { token: "{reference_no}", label: "رقم المرجع" }, { token: "{supplier_name}", label: "اسم المورد" },
      { token: "{old_total}", label: "الإجمالي قبل" }, { token: "{new_total}", label: "الإجمالي بعد" },
      { token: "{old_items_table}", label: "الأصناف قبل" }, { token: "{new_items_table}", label: "الأصناف بعد" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_price_bulk_update: {
    label: "تحديث أسعار جماعي", hint: "تنبيه بملخص أي عملية تحديث أسعار جماعية أو استرجاعها", vars: [
      { token: "{operation_label}", label: "نوع العملية" }, { token: "{items_count}", label: "عدد الأصناف" },
      { token: "{field_label}", label: "حقل السعر" }, { token: "{adjustment_label}", label: "وصف التعديل" },
      { token: "{reason}", label: "السبب" }, { token: "{changes_table}", label: "أمثلة التغييرات" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_item_deleted: {
    label: "حذف صنف", hint: "تنبيه عند حذف صنف من الأصناف", vars: [
      { token: "{product_name}", label: "اسم الصنف" }, { token: "{sku}", label: "الكود" },
      { token: "{price}", label: "سعر البيع" }, { token: "{quantity}", label: "الكمية وقت الحذف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_customer_deleted: {
    label: "حذف عميل", hint: "تنبيه عند حذف أو أرشفة عميل", vars: [
      { token: "{customer_name}", label: "اسم العميل" }, { token: "{phone}", label: "الهاتف" },
      { token: "{balance}", label: "الرصيد وقت الحذف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_supplier_deleted: {
    label: "حذف مورد", hint: "تنبيه عند حذف أو أرشفة مورد", vars: [
      { token: "{supplier_name}", label: "اسم المورد" }, { token: "{phone}", label: "الهاتف" },
      { token: "{balance}", label: "الرصيد وقت الحذف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_employee_deleted: {
    label: "حذف موظف", hint: "تنبيه عند حذف أو أرشفة موظف", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{job_title}", label: "الوظيفة" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_branch_transfer: {
    label: "تحويل فرع", hint: "تنبيه عند إرسال أو استلام بضاعة بين الفروع", vars: [
      { token: "{reference_no}", label: "رقم المرجع" }, { token: "{from_branch}", label: "الفرع المُرسل" },
      { token: "{to_warehouse}", label: "الفرع المُستلم" }, { token: "{transfer_type}", label: "نوع التحويل" },
      { token: "{items_table}", label: "جدول الأصناف" }, { token: "{items_count}", label: "عدد الأصناف" },
      { token: "{total_units}", label: "إجمالي الوحدات" }, { token: "{total_cost}", label: "إجمالي التكلفة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_password_changed: {
    label: "تغيير كلمة مرور", hint: "تنبيه أمني عند تغيير كلمة مرور مستخدم", vars: [
      { token: "{user_name}", label: "اسم المستخدم" }, { token: "{time}", label: "التوقيت" },
      { token: "{ip_address}", label: "عنوان IP" },
    ]
  },
  telegram_permission_changed: {
    label: "تغيير صلاحيات", hint: "تنبيه أمني عند تغيير صلاحيات مستخدم", vars: [
      { token: "{user_name}", label: "اسم المستخدم" }, { token: "{action}", label: "الإجراء" },
      { token: "{details}", label: "التفاصيل" }, { token: "{changed_by}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_supervisor_override: {
    label: "تجاوز صلاحيات", hint: "تنبيه أمني عند تجاوز صلاحيات بواسطة المشرف", vars: [
      { token: "{user_name}", label: "اسم المستخدم" }, { token: "{action}", label: "الإجراء" },
      { token: "{details}", label: "التفاصيل" }, { token: "{supervisor}", label: "المشرف" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_repair_created: {
    label: "طلب صيانة جديد", hint: "تنبيه عند إنشاء طلب صيانة", vars: [
      { token: "{order_no}", label: "رقم الطلب" }, { token: "{customer_name}", label: "اسم العميل" },
      { token: "{device_type}", label: "نوع الجهاز" }, { token: "{problem}", label: "المشكلة" },
      { token: "{estimated_cost}", label: "التكلفة التقديرية" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_revenue_created: {
    label: "إيراد جديد", hint: "تنبيه عند تسجيل إيراد", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{amount}", label: "المبلغ" },
      { token: "{category}", label: "الفئة" }, { token: "{description}", label: "الوصف" },
      { token: "{method}", label: "طريقة الدفع" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_withdrawal_created: {
    label: "سحب نقدي", hint: "تنبيه عند سحب نقدي من الخزنة", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{amount}", label: "المبلغ" },
      { token: "{category}", label: "الفئة" }, { token: "{note}", label: "الملاحظة" },
      { token: "{method}", label: "طريقة الدفع" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_employee_created: {
    label: "موظف جديد", hint: "تنبيه عند إضافة موظف جديد", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{job_title}", label: "المسمى الوظيفي" },
      { token: "{salary}", label: "الراتب" }, { token: "{phone}", label: "الهاتف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_salary_settled: {
    label: "تسويات راتب", hint: "تنبيه عند تسويية راتب موظف", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{period}", label: "الفترة" },
      { token: "{base_salary}", label: "الراتب الأساسي" }, { token: "{bonuses}", label: "المكافآت" },
      { token: "{deductions}", label: "الخصومات" }, { token: "{advance_deductions}", label: "خصم السلف" },
      { token: "{net_salary}", label: "الراتب الصافي" }, { token: "{paid_amount}", label: "المبلغ المدفوع" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_advance_created: {
    label: "سلفة جديدة", hint: "تنبيه عند منح موظف سلفة", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{amount}", label: "المبلغ" },
      { token: "{installment_count}", label: "عدد الأقساط" }, { token: "{installment_amount}", label: "قيمة القسط" },
      { token: "{notes}", label: "ملاحظات" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_deduction_created: {
    label: "خصم جديد", hint: "تنبيه عند تسجيل خصم على موظف", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{amount}", label: "المبلغ" },
      { token: "{deduction_type}", label: "نوع الخصم" }, { token: "{is_recurring}", label: "دوري" },
      { token: "{notes}", label: "ملاحظات" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_bonus_created: {
    label: "مكافأة جديدة", hint: "تنبيه عند منح موظف مكافأة", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{amount}", label: "المبلغ" },
      { token: "{bonus_type}", label: "نوع المكافأة" }, { token: "{is_recurring}", label: "دوري" },
      { token: "{notes}", label: "ملاحظات" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_expense_edited: {
    label: "تعديل مصروف", hint: "تنبيه عند تعديل مصروف", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{category}", label: "الفئة" },
      { token: "{old_amount}", label: "المبلغ القديم" }, { token: "{new_amount}", label: "المبلغ الجديد" },
      { token: "{old_description}", label: "الوصف القديم" }, { token: "{new_description}", label: "الوصف الجديد" },
      { token: "{payment_method}", label: "الطريقة" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_expense_deleted: {
    label: "حذف مصروف", hint: "تنبيه عند حذف مصروف", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{category}", label: "الفئة" },
      { token: "{amount}", label: "المبلغ" }, { token: "{description}", label: "الوصف" },
      { token: "{payment_method}", label: "الطريقة" }, { token: "{date}", label: "تاريخ المصروف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_revenue_edited: {
    label: "تعديل إيراد", hint: "تنبيه عند تعديل إيراد", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{category}", label: "الفئة" },
      { token: "{old_amount}", label: "المبلغ القديم" }, { token: "{new_amount}", label: "المبلغ الجديد" },
      { token: "{old_description}", label: "الوصف القديم" }, { token: "{new_description}", label: "الوصف الجديد" },
      { token: "{payment_method}", label: "الطريقة" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_revenue_deleted: {
    label: "حذف إيراد", hint: "تنبيه عند حذف إيراد", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{category}", label: "الفئة" },
      { token: "{amount}", label: "المبلغ" }, { token: "{description}", label: "الوصف" },
      { token: "{payment_method}", label: "الطريقة" }, { token: "{date}", label: "تاريخ الإيراد" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_invoice_edited: {
    label: "تعديل فاتورة مبيعات", hint: "تنبيه عند تعديل فاتورة بيع", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" },
      { token: "{old_customer_name}", label: "العميل قبل" }, { token: "{new_customer_name}", label: "العميل بعد" },
      { token: "{old_total}", label: "إجمالي قبل" }, { token: "{new_total}", label: "إجمالي بعد" },
      { token: "{old_payment_type}", label: "طريقة دفع قبل" }, { token: "{new_payment_type}", label: "طريقة دفع بعد" },
      { token: "{old_items_table}", label: "الأصناف قبل" }, { token: "{new_items_table}", label: "الأصناف بعد" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_invoice_amended: {
    label: "أمندمنت فاتورة", hint: "تنبيه عند تعديل (أمندمنت) فاتورة مبيعات", vars: [
      { token: "{old_invoice_no}", label: "الرقم القديم" }, { token: "{new_invoice_no}", label: "الرقم الجديد" },
      { token: "{old_customer_name}", label: "العميل قبل" }, { token: "{new_customer_name}", label: "العميل بعد" },
      { token: "{old_total}", label: "إجمالي قبل" }, { token: "{new_total}", label: "إجمالي بعد" },
      { token: "{old_items_table}", label: "الأصناف قبل" }, { token: "{new_items_table}", label: "الأصناف بعد" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_purchase_edited: {
    label: "تعديل مشتريات", hint: "تنبيه عند تعديل فاتورة مشتريات", vars: [
      { token: "{reference_no}", label: "المرجع" },
      { token: "{old_supplier_name}", label: "المورد قبل" }, { token: "{new_supplier_name}", label: "المورد بعد" },
      { token: "{old_total}", label: "إجمالي قبل" }, { token: "{new_total}", label: "إجمالي بعد" },
      { token: "{old_payment_method}", label: "طريقة دفع قبل" }, { token: "{new_payment_method}", label: "طريقة دفع بعد" },
      { token: "{old_items_table}", label: "الأصناف قبل" }, { token: "{new_items_table}", label: "الأصناف بعد" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_purchase_return_cancelled: {
    label: "إلغاء مرتجع مشتريات", hint: "تنبيه عند إلغاء مرتجع مشتريات", vars: [
      { token: "{reference_no}", label: "المرجع" }, { token: "{supplier_name}", label: "المورد" },
      { token: "{total}", label: "المبلغ" }, { token: "{reason}", label: "السبب" },
      { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_branch_transfer_edited: {
    label: "تعديل حركة فرع", hint: "تنبيه عند تعديل حركة تحويل بين الفروع", vars: [
      { token: "{reference_no}", label: "المرجع" }, { token: "{transfer_type}", label: "النوع" },
      { token: "{old_partner_branch}", label: "الفرع قبل" }, { token: "{new_partner_branch}", label: "الفرع بعد" },
      { token: "{old_items_table}", label: "الأصناف قبل" }, { token: "{new_items_table}", label: "الأصناف بعد" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_branch_transfer_cancelled: {
    label: "إلغاء حركة فرع", hint: "تنبيه عند إلغاء/حذف حركة فرع", vars: [
      { token: "{reference_no}", label: "المرجع" }, { token: "{transfer_type}", label: "النوع" },
      { token: "{partner_branch}", label: "الفرع الآخر" }, { token: "{reason}", label: "السبب" },
      { token: "{items_table}", label: "جدول الأصناف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_withdrawal_edited: {
    label: "تعديل سحب نقدي", hint: "تنبيه عند تعديل سحب نقدي/شخصي", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{category}", label: "الفئة" },
      { token: "{old_amount}", label: "المبلغ القديم" }, { token: "{new_amount}", label: "المبلغ الجديد" },
      { token: "{note}", label: "الملاحظة" }, { token: "{payment_method}", label: "الطريقة" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_withdrawal_deleted: {
    label: "حذف سحب نقدي", hint: "تنبيه عند حذف سحب نقدي/شخصي", vars: [
      { token: "{doc_no}", label: "رقم المستند" }, { token: "{category}", label: "الفئة" },
      { token: "{amount}", label: "المبلغ" }, { token: "{note}", label: "الملاحظة" },
      { token: "{payment_method}", label: "الطريقة" }, { token: "{date}", label: "التاريخ" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_weekly_digest: {
    label: "ملخص أسبوعي", hint: "تقرير دوري يرسل تلقائياً بنهاية كل أسبوع", vars: [
      { token: "{title}", label: "عنوان التقرير" }, { token: "{period_label}", label: "فترة التقرير" },
      { token: "{sales_total}", label: "إجمالي المبيعات" }, { token: "{sales_count}", label: "عدد الفواتير" },
      { token: "{sales_delta}", label: "نسبة التغير" }, { token: "{avg_invoice}", label: "متوسط الفاتورة" },
      { token: "{profit}", label: "صافي الربح" }, { token: "{products_table}", label: "أكثر المنتجات" },
      { token: "{customers_table}", label: "أفضل العملاء" }, { token: "{liquidity}", label: "السيولة الحالية" },
      { token: "{treasury_balance}", label: "رصيد الخزنة" }, { token: "{bank_balance}", label: "رصيد البنك" },
      { token: "{debts}", label: "مديونيات العملاء" }, { token: "{low_stock_count}", label: "أصناف تحت الحد" },
    ]
  },
  telegram_monthly_digest: {
    label: "ملخص شهري", hint: "تقرير دوري يرسل تلقائياً بنهاية كل شهر", vars: [
      { token: "{title}", label: "عنوان التقرير" }, { token: "{period_label}", label: "فترة التقرير" },
      { token: "{sales_total}", label: "إجمالي المبيعات" }, { token: "{sales_count}", label: "عدد الفواتير" },
      { token: "{sales_delta}", label: "نسبة التغير" }, { token: "{avg_invoice}", label: "متوسط الفاتورة" },
      { token: "{profit}", label: "صافي الربح" }, { token: "{products_table}", label: "أكثر المنتجات" },
      { token: "{customers_table}", label: "أفضل العملاء" }, { token: "{liquidity}", label: "السيولة الحالية" },
      { token: "{treasury_balance}", label: "رصيد الخزنة" }, { token: "{bank_balance}", label: "رصيد البنك" },
      { token: "{debts}", label: "مديونيات العملاء" }, { token: "{low_stock_count}", label: "أصناف تحت الحد" },
    ]
  },
  telegram_yearly_digest: {
    label: "ملخص سنوي", hint: "تقرير دوري يرسل تلقائياً بنهاية كل سنة", vars: [
      { token: "{title}", label: "عنوان التقرير" }, { token: "{period_label}", label: "فترة التقرير" },
      { token: "{sales_total}", label: "إجمالي المبيعات" }, { token: "{sales_count}", label: "عدد الفواتير" },
      { token: "{sales_delta}", label: "نسبة التغير" }, { token: "{avg_invoice}", label: "متوسط الفاتورة" },
      { token: "{profit}", label: "صافي الربح" }, { token: "{products_table}", label: "أكثر المنتجات" },
      { token: "{customers_table}", label: "أفضل العملاء" }, { token: "{liquidity}", label: "السيولة الحالية" },
      { token: "{treasury_balance}", label: "رصيد الخزنة" }, { token: "{bank_balance}", label: "رصيد البنك" },
      { token: "{debts}", label: "مديونيات العملاء" }, { token: "{low_stock_count}", label: "أصناف تحت الحد" },
    ]
  },
  telegram_app_quit: {
    label: "إغلاق التطبيق", hint: "تنبيه عند إغلاق التطبيق (إكسلت) — مع ملخص يوم كامل", vars: [
      { token: "{user_name}", label: "المستخدم" }, { token: "{trigger_reason}", label: "سبب الإغلاق" },
      { token: "{time}", label: "التوقيت" },
      ...ACCUM_VAR_CHIPS,
    ]
  },
  telegram_user_logout: {
    label: "تسجيل خروج", hint: "تنبيه عند تسجيل خروج مستخدم من النظام — مع ملخص اليوم", vars: [
      { token: "{user_name}", label: "المستخدم" }, { token: "{trigger_reason}", label: "سبب الخروج" },
      { token: "{time}", label: "التوقيت" },
      ...ACCUM_VAR_CHIPS,
    ]
  },
  // Payroll partial payout + risky-deletion coverage (migration 215)
  telegram_salary_partial_paid: {
    label: "صرف جزئي للراتب", hint: "تنبيه عند صرف جزء من الراتب أو سداد المتبقي لاحقاً", vars: [
      { token: "{kind_label}", label: "نوع العملية" }, { token: "{employee_name}", label: "اسم الموظف" },
      { token: "{period}", label: "الفترة" }, { token: "{net_salary}", label: "المستحق" },
      { token: "{paid_amount}", label: "المدفوع الآن" }, { token: "{remaining}", label: "المتبقي" },
      { token: "{remainder_plan}", label: "مصير المتبقي" }, { token: "{method}", label: "طريقة الدفع" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_salary_settlement_deleted: {
    label: "إلغاء صرف راتب", hint: "تنبيه عند حذف/عكس صرف راتب مسجّل", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{period}", label: "الفترة" },
      { token: "{paid_amount}", label: "كان مدفوعاً" }, { token: "{net_salary}", label: "الصافي" },
      { token: "{expense_deleted}", label: "حذف المصروف المرتبط" }, { token: "{reversed_advances}", label: "أقساط سلف أُعيدت" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_advance_payment: {
    label: "تسديد قسط سلفة", hint: "تنبيه عند تسديد الموظف قسطاً من سلفته", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{amount}", label: "المبلغ المسدد" },
      { token: "{remaining}", label: "المتبقي من السلفة" }, { token: "{notes}", label: "ملاحظات" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_advance_deleted: {
    label: "حذف سلفة", hint: "تنبيه عند حذف أو إلغاء سلفة موظف", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{amount}", label: "قيمة السلفة" },
      { token: "{remaining}", label: "كان متبقياً" }, { token: "{delete_kind}", label: "نوع الحذف" },
      { token: "{expense_deleted}", label: "حذف المصروف المرتبط" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_deduction_deleted: {
    label: "إلغاء خصم موظف", hint: "تنبيه عند إلغاء خصم مسجّل على موظف", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{amount}", label: "قيمة الخصم" },
      { token: "{deduction_type}", label: "نوع الخصم" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_bonus_deleted: {
    label: "إلغاء مكافأة موظف", hint: "تنبيه عند إلغاء مكافأة مسجّلة لموظف", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{amount}", label: "قيمة المكافأة" },
      { token: "{bonus_type}", label: "نوع المكافأة" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_user_deleted: {
    label: "حذف مستخدم", hint: "تنبيه أمني عند حذف حساب مستخدم من النظام", vars: [
      { token: "{user_name}", label: "المستخدم المحذوف" }, { token: "{role}", label: "الدور" },
      { token: "{deleted_by}", label: "حذفه" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  // Money-channel + tamper coverage (migration 216)
  telegram_user_created: {
    label: "إنشاء مستخدم", hint: "تنبيه أمني عند إضافة حساب مستخدم جديد", vars: [
      { token: "{user_name}", label: "اسم المستخدم" }, { token: "{login_name}", label: "اسم الدخول" },
      { token: "{role}", label: "الدور" }, { token: "{permissions_summary}", label: "ملخص الصلاحيات" },
      { token: "{created_by}", label: "أنشأه" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_treasury_changed: {
    label: "تغيير خزينة", hint: "تنبيه عند إضافة/تعديل/حذف خزينة — يشمل التعديل اليدوي للرصيد", vars: [
      { token: "{action_label}", label: "نوع العملية" }, { token: "{treasury_name}", label: "اسم الخزينة" },
      { token: "{old_balance}", label: "الرصيد قبل" }, { token: "{new_balance}", label: "الرصيد بعد" },
      { token: "{details}", label: "التفاصيل" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_payment_method_changed: {
    label: "تغيير وسيلة دفع", hint: "تنبيه عند إضافة/تعديل/حذف وسيلة دفع", vars: [
      { token: "{action_label}", label: "نوع العملية" }, { token: "{method_name}", label: "اسم الوسيلة" },
      { token: "{details}", label: "التفاصيل" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_promotion_changed: {
    label: "تغيير عرض", hint: "تنبيه عند إضافة أو تفعيل أو تعديل عرض/خصم", vars: [
      { token: "{action_label}", label: "نوع العملية" }, { token: "{promotion_name}", label: "اسم العرض" },
      { token: "{details}", label: "التفاصيل" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_backup_restored: {
    label: "استعادة نسخة احتياطية", hint: "تنبيه أمني عند استعادة نسخة احتياطية فوق البيانات الحالية", vars: [
      { token: "{source}", label: "مصدر النسخة" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_data_wiped: {
    label: "تفريغ بيانات", hint: "تنبيه أمني عند حذف/تفريغ بيانات من النظام", vars: [
      { token: "{scope}", label: "النطاق المحذوف" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_notifications_disabled: {
    label: "إيقاف الإشعارات", hint: "تنبيه أمني يُرسل قبل إيقاف إشعارات تيليجرام أو فصل البوت", vars: [
      { token: "{change_label}", label: "نوع التغيير" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  // Self-watching alert channel (migration 217)
  telegram_recipient_changed: {
    label: "تغيير مستلم إشعارات", hint: "تنبيه عند إضافة أو تعديل أو حذف مستلم Telegram", vars: [
      { token: "{action_label}", label: "نوع الحدث" }, { token: "{recipient_name}", label: "اسم المستلم" },
      { token: "{chat_id}", label: "Chat ID" }, { token: "{changes_summary}", label: "ملخص التغييرات" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  // Employee edit + legacy adjustment (migration 218)
  telegram_employee_edited: {
    label: "تعديل موظف", hint: "تنبيه عند تعديل راتب أو منصب أو بيانات موظف", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{old_salary}", label: "الراتب القديم" },
      { token: "{new_salary}", label: "الراتب الجديد" }, { token: "{old_job_title}", label: "المنصب القديم" },
      { token: "{new_job_title}", label: "المنصب الجديد" }, { token: "{phone}", label: "الهاتف" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_adjustment_created: {
    label: "تسجيل حافز/خصم", hint: "تنبيه عند تسجيل حافز أو خصم (تسوية Legacy)", vars: [
      { token: "{employee_name}", label: "اسم الموظف" }, { token: "{type_label}", label: "النوع" },
      { token: "{amount}", label: "المبلغ" }, { token: "{reason}", label: "السبب" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  // Backup export + settings change (migration 219)
  telegram_backup_exported: {
    label: "تصدير نسخة احتياطية", hint: "تنبيه عند تصدير checkpoint كملف محمول", vars: [
      { token: "{file_path}", label: "المسار" }, { token: "{file_size}", label: "الحجم" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
  telegram_backup_settings_changed: {
    label: "تغيير إعدادات النسخ الاحتياطي", hint: "تنبيه عند تعديل أو تعطيل النسخ الاحتياطي التلقائي", vars: [
      { token: "{setting_name}", label: "الإعداد" }, { token: "{old_value}", label: "القيمة القديمة" },
      { token: "{new_value}", label: "القيمة الجديدة" }, { token: "{user_name}", label: "بواسطة" },
      { token: "{time}", label: "التوقيت" },
    ]
  },
  // Bulk settings change (migration 220)
  telegram_settings_changed: {
    label: "تغيير إعدادات النظام", hint: "تنبيه عند تعديل إعدادات عبر الإعدادات المجمعة", vars: [
      { token: "{changes_count}", label: "عدد التغييرات" }, { token: "{changes_summary}", label: "ملخص التغييرات" },
      { token: "{user_name}", label: "بواسطة" }, { token: "{time}", label: "التوقيت" },
    ]
  },
};
const WHATSAPP_CATEGORIES = ["receipt", "return_receipt", "birthday", "debt", "purchase_receipt", "purchase_return_receipt", "transfer_send", "transfer_receive"];
// telegram_shift_close is intentionally absent — this store runs one daily
// session (closed after 12pm), not cashier shifts.
const TELEGRAM_CATEGORIES = [
  "telegram_new_invoice", "telegram_daily_close", "telegram_large_invoice",
  "telegram_large_discount", "telegram_below_cost_sale",
  "telegram_sales_return", "telegram_invoice_voided", "telegram_purchase_created",
  "telegram_customer_payment", "telegram_low_stock", "telegram_backup_result", "telegram_failed_login",
  "telegram_customer_created", "telegram_supplier_created", "telegram_expense_created", "telegram_return_payment",
  "telegram_stock_transfer", "telegram_inventory_adjustment", "telegram_new_product", "telegram_price_change",
  "telegram_batch_expiry", "telegram_physical_count",
  "telegram_supplier_payment", "telegram_debt_payment", "telegram_installment_paid",
  "telegram_purchase_voided", "telegram_purchase_return", "telegram_branch_transfer",
  "telegram_sales_return_edited", "telegram_sales_return_cancelled", "telegram_purchase_return_edited",
  "telegram_price_bulk_update", "telegram_item_deleted",
  "telegram_customer_deleted", "telegram_supplier_deleted", "telegram_employee_deleted",
  "telegram_password_changed", "telegram_permission_changed", "telegram_supervisor_override",
  "telegram_repair_created",
  "telegram_revenue_created", "telegram_withdrawal_created",
  "telegram_employee_created", "telegram_salary_settled", "telegram_advance_created",
  "telegram_deduction_created", "telegram_bonus_created",
  "telegram_expense_edited", "telegram_expense_deleted",
  "telegram_revenue_edited", "telegram_revenue_deleted",
  "telegram_invoice_edited", "telegram_invoice_amended",
  "telegram_purchase_edited", "telegram_purchase_return_cancelled",
  "telegram_branch_transfer_edited", "telegram_branch_transfer_cancelled",
  "telegram_withdrawal_edited", "telegram_withdrawal_deleted",
  "telegram_app_quit", "telegram_user_logout",
  "telegram_salary_partial_paid", "telegram_salary_settlement_deleted",
  "telegram_advance_payment", "telegram_advance_deleted",
  "telegram_deduction_deleted", "telegram_bonus_deleted", "telegram_user_deleted",
  "telegram_user_created", "telegram_treasury_changed",
  "telegram_payment_method_changed", "telegram_promotion_changed",
  "telegram_backup_restored", "telegram_data_wiped", "telegram_notifications_disabled",
  "telegram_recipient_changed", "telegram_employee_edited", "telegram_adjustment_created",
  "telegram_backup_exported", "telegram_backup_settings_changed", "telegram_settings_changed",
  "telegram_weekly_digest", "telegram_monthly_digest", "telegram_yearly_digest",
];

const DEFAULT_BODIES = {
  "telegram_expense_edited|قياسي — مفصل": `✏️ *تعديل مصروف*

🔖 المستند: *{doc_no}*
📂 الفئة: {category}
💵 المبلغ القديم: ~{old_amount}~
💵 المبلغ الجديد: *{new_amount}*
📝 الوصف قبل: {old_description}
📝 الوصف بعد: {new_description}
💳 الطريقة: {payment_method}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_expense_edited|مختصر — سريع": `✏️ تعديل مصروف | {doc_no} | {category} | {old_amount} → {new_amount} | {user_name}`,
  "telegram_expense_deleted|قياسي — مفصل": `🗑️ *حذف مصروف*

🔖 المستند: *{doc_no}*
📂 الفئة: {category}
💰 المبلغ: *{amount}*
📝 الوصف: {description}
💳 الطريقة: {payment_method}
📅 تاريخ المصروف: {date}
👤 حذف بواسطة: {user_name}
⏰ وقت الحذف: {time}`,
  "telegram_expense_deleted|مختصر — سريع": `🗑️ حذف مصروف | {doc_no} | {category} | {amount} | {user_name}`,
  "telegram_revenue_edited|قياسي — مفصل": `✏️ *تعديل إيراد*

🔖 المستند: *{doc_no}*
📂 الفئة: {category}
💵 المبلغ القديم: ~{old_amount}~
💵 المبلغ الجديد: *{new_amount}*
📝 الوصف قبل: {old_description}
📝 الوصف بعد: {new_description}
💳 الطريقة: {payment_method}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_revenue_edited|مختصر — سريع": `✏️ تعديل إيراد | {doc_no} | {category} | {old_amount} → {new_amount} | {user_name}`,
  "telegram_revenue_deleted|قياسي — مفصل": `🗑️ *حذف إيراد*

🔖 المستند: *{doc_no}*
📂 الفئة: {category}
💵 المبلغ: *{amount}*
📝 الوصف: {description}
💳 الطريقة: {payment_method}
📅 تاريخ الإيراد: {date}
👤 حذف بواسطة: {user_name}
⏰ وقت الحذف: {time}`,
  "telegram_revenue_deleted|مختصر — سريع": `🗑️ حذف إيراد | {doc_no} | {category} | {amount} | {user_name}`,
  "telegram_invoice_edited|قياسي — مفصل": `✏️ *تعديل فاتورة مبيعات*

🔖 رقم الفاتورة: *#{invoice_no}*
👤 العميل: *{old_customer_name}* ➔ *{new_customer_name}*
💰 الإجمالي: *{old_total}* ➔ *{new_total}*
💳 الدفع: *{old_payment_type}* ➔ *{new_payment_type}*

📦 *الأصناف قبل التعديل:*
{old_items_table}

📦 *الأصناف بعد التعديل:*
{new_items_table}

👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_invoice_edited|مختصر — سريع": `✏️ تعديل فاتورة | #{invoice_no} | {old_total} → {new_total} | {user_name}`,
  "telegram_invoice_amended|قياسي — مفصل": `🔄 *تعديل (أمندمنت) فاتورة مبيعات*

📄 الفاتورة القديمة: *#{old_invoice_no}* (ملغاة)
📄 الفاتورة الجديدة: *#{new_invoice_no}*
👤 العميل: *{old_customer_name}* ➔ *{new_customer_name}*
💰 الإجمالي: *{old_total}* ➔ *{new_total}*

📦 *الأصناف قبل (الملغاة):*
{old_items_table}

📦 *الأصناف بعد (الجديدة):*
{new_items_table}

👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_invoice_amended|مختصر — سريع": `🔄 أمندمنت | #{old_invoice_no} → #{new_invoice_no} | {old_total} → {new_total} | {user_name}`,
  "telegram_purchase_edited|قياسي — مفصل": `✏️ *تعديل فاتورة مشتريات*

🔖 المرجع: *{reference_no}*
🏢 المورد: *{old_supplier_name}* ➔ *{new_supplier_name}*
💰 الإجمالي: *{old_total}* ➔ *{new_total}*
💳 الدفع: *{old_payment_method}* ➔ *{new_payment_method}*

📦 *الأصناف قبل التعديل:*
{old_items_table}

📦 *الأصناف بعد التعديل:*
{new_items_table}

👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_purchase_edited|مختصر — سريع": `✏️ تعديل مشتريات | {reference_no} | {old_total} → {new_total} | {user_name}`,
  "telegram_purchase_return_cancelled|قياسي — مفصل": `❌ *إلغاء مرتجع مشتريات*

🔖 المرجع: *{reference_no}*
🏢 المورد: *{supplier_name}*
💰 المبلغ: *{total}*
📝 السبب: {reason}

📦 *الأصناف المرتجعة التي أُلغيت:*
{items_table}

👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_purchase_return_cancelled|مختصر — سريع": `❌ إلغاء مرتجع مشتريات | {reference_no} | {supplier_name} | {reason} | {user_name}`,
  "telegram_sales_return_edited|قياسي — مفصل": `✏️ *تعديل مرتجع مبيعات*

🔖 المستند: *{doc_no}*
👤 العميل: {customer_name}
💰 الإجمالي قبل: {old_total}
💰 الإجمالي بعد: *{new_total}*
◀️ الأصناف قبل:
{old_items_table}
▶️ الأصناف بعد:
{new_items_table}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_sales_return_edited|مختصر — سريع": `✏️ تعديل مرتجع مبيعات {doc_no} | {old_total} → {new_total} | {user_name}`,
  "telegram_sales_return_cancelled|قياسي — مفصل": `❌ *إلغاء مرتجع مبيعات*

🔖 المستند: *{doc_no}*
👤 العميل: {customer_name}
💰 الإجمالي: *{total}*
📝 السبب: {reason}
📦 الأصناف:
{items_table}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_sales_return_cancelled|مختصر — سريع": `❌ إلغاء مرتجع مبيعات {doc_no} | {total} | {reason} | {user_name}`,
  "telegram_purchase_return_edited|قياسي — مفصل": `✏️ *تعديل مرتجع مشتريات*

🔖 المرجع: *{reference_no}*
🏭 المورد: {supplier_name}
💰 الإجمالي قبل: {old_total}
💰 الإجمالي بعد: *{new_total}*
◀️ الأصناف قبل:
{old_items_table}
▶️ الأصناف بعد:
{new_items_table}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_purchase_return_edited|مختصر — سريع": `✏️ تعديل مرتجع مشتريات {reference_no} | {old_total} → {new_total} | {user_name}`,
  "telegram_branch_transfer_edited|قياسي — مفصل": `✏️ *تعديل حركة فرع*

🔖 المرجع: *{reference_no}*
🔀 النوع: {transfer_type}
🏢 الفرع: *{old_partner_branch}* ➔ *{new_partner_branch}*

📦 *الأصناف قبل التعديل:*
{old_items_table}

📦 *الأصناف بعد التعديل:*
{new_items_table}

👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_branch_transfer_edited|مختصر — سريع": `✏️ تعديل حركة فرع | {reference_no} | {transfer_type} | {user_name}`,
  "telegram_branch_transfer_cancelled|قياسي — مفصل": `❌ *إلغاء حركة فرع*

🔖 المرجع: *{reference_no}*
🔀 النوع: {transfer_type}
🏢 الفرع: *{partner_branch}*
📝 السبب: {reason}

📦 *الأصناف الملغاة:*
{items_table}

👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_branch_transfer_cancelled|مختصر — سريع": `❌ إلغاء حركة فرع | {reference_no} | {transfer_type} | {reason} | {user_name}`,
  "telegram_withdrawal_edited|قياسي — مفصل": `✏️ *تعديل سحب نقدي*

🔖 المستند: *{doc_no}*
📂 الفئة: {category}
💰 المبلغ القديم: ~{old_amount}~
💰 المبلغ الجديد: *{new_amount}*
📝 الملاحظة: {note}
💳 الطريقة: {payment_method}
👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_withdrawal_edited|مختصر — سريع": `✏️ تعديل سحب | {doc_no} | {category} | {old_amount} → {new_amount} | {user_name}`,
  "telegram_withdrawal_deleted|قياسي — مفصل": `🗑️ *حذف سحب نقدي*

🔖 المستند: *{doc_no}*
📂 الفئة: {category}
💰 المبلغ: *{amount}*
📝 الملاحظة: {note}
💳 الطريقة: {payment_method}
📅 تاريخ السحب: {date}
👨‍💼 حذف بواسطة: {user_name}
⏰ وقت الحذف: {time}`,
  "telegram_withdrawal_deleted|مختصر — سريع": `🗑️ حذف سحب | {doc_no} | {category} | {amount} | {user_name}`,
  "receipt|قياسي — مفصل": `مرحباً {name}،

🛍️ فاتورة بيع
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

شكراً لتسوقك معنا ✨
{shop}`,
  "receipt|مختصر — سريع": `مرحباً {name}،
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 {total} جنيه
{shop}`,
  "receipt|بريميوم — فاخر": `┌─ {shop} ─┐

{name} العزيز،
شكراً لاختيارنا ❤️

📋 فاتورة رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

نتشرف بخدمتك دائماً ✨
{shop}`,
  "return_receipt|قياسي — مفصل": `مرحباً {name}،

✅ تم إتمام المرتجع
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 المسترد: {total} جنيه

نأسف للإزعاج 🙏
{shop}`,
  "return_receipt|مختصر — سريع": `مرحباً {name}،
✅ تم استلام المرتجع
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 المسترد: {total} جنيه
{shop}`,
  "return_receipt|بريميوم — فاخر": `┌─ {shop} ─┐

{name} العزيز،

✅ تمت معالجة المرتجع

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

المنتجات المسترجعة:
{items_table}

━━━ الدفع ━━━
{payment_breakdown}

💰 المسترد: {total} جنيه

نعتذر للإزعاج ❤️
{shop}`,
  "birthday|قياسي — مفصل": `🎂 كل عام وأنت بخير {name} 🎂

نهنئك بعيد ميلادك السعيد 🎉
نتمنى لك يوماً رائعاً 🎈

🎁 خصم خاص بمناسبة عيد ميلادك!
تفضل بزيارة {shop} اليوم

مع أطيب التمنيات 🎀
{shop}`,
  "birthday|مختصر — سريع": `🎂 كل عام وأنت بخير {name} 🎂🎉
🎁 خصم خاص بعيد ميلادك
تفضل بزيارة {shop} اليوم ❤️
{shop}`,
  "birthday|بريميوم — فاخر": `✨ {shop} ✨

بمناسبة عيد ميلاد {name} 🎂

نرسل لك أطيب التهاني ❤️
ونتمنى لك سنة رائعة 🎉🎈

🎁 هديتك بانتظارك في المعرض

مع فائق الاحترام 🎀
{shop}`,
  "debt|رسمي — مهذب": `مرحباً {name}،

⏰ تذكير برصيد مستحق
━━━━━━━━━━━━━━━━
💰 المبلغ: {amount} جنيه
━━━━━━━━━━━━━━━━

نأمل التكرم بتسويته قريباً

للتواصل: {shop}

مع الشكر والتقدير 🙏
{shop}`,
  "debt|مختصر — سريع": `مرحباً {name}،
⏰ تذكير: رصيد {amount} جنيه
نأمل التسوية 🙏
{shop}`,
  "debt|ودود — لطيف": `مرحباً {name} العزيز،

تحية طيبة 🌸

⏰ رصيد مستحق: {amount} جنيه

يسعدنا استقبالك في {shop}
لتسوية الرصيد بوقت مناسب لك

وجودكم شرف لنا ❤️
{shop}`,
  "purchase_receipt|قياسي — مفصل": `مرحباً {name}،

🛍️ فاتورة شراء
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━━ الدفع ━━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

شكراً لتعاملكم معنا ✨
{shop}`,
  "purchase_receipt|مختصر — سريع": `مرحباً {name}،
📋 {invoice_no} — {date}
{items_table}
💳 {payment_type}
💰 {total} جنيه
{shop}`,
  "purchase_receipt|بريميوم — فاخر": `┌─ {shop} ─┐

{name} العزيز،
شكراً لاختيارنا ❤️

📋 فاتورة شراء رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

━━━━ الدفع ━━━━
{payment_breakdown}

💰 الإجمالي: {total} جنيه
💸 الخصم: {discount}

نتشرف بخدمتك دائماً ✨
{shop}`,
  "purchase_return_receipt|قياسي — مفصل": `مرحباً {name}،

✅ تم إتمام مرتجع الشراء
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

{items_table}

💰 المسترد: {total} جنيه

شكراً لتعاملكم ✨
{shop}`,
  "purchase_return_receipt|مختصر — سريع": `مرحباً {name}،
✅ تم استلام مرتجع الشراء
📋 {invoice_no} — {date}
{items_table}
💰 المسترد: {total} جنيه
{shop}`,
  "purchase_return_receipt|بريميوم — فاخر": `┌─ {shop} ─┐

{name} العزيز،

✅ تمت معالجة مرتجع الشراء

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}

المنتجات المسترجعة:
{items_table}

💰 المسترد: {total} جنيه

نتشرف بخدمتك دائماً ❤️
{shop}`,
  "transfer_send|قياسي — مفصل": `📦 تم تسليم البضاعة
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُستلم: {name}

{items_table}

💰 إجمالي التكلفة: {total} جنيه
━━━━━━━━━━━━━━━━
{shop}`,
  "transfer_send|مختصر — سريع": `📦 تسليم بضاعة
📋 {invoice_no} — {date}
🏢 {name}
{items_table}
💰 {total} جنيه
{shop}`,
  "transfer_send|بريميوم — فاخر": `┌─ {shop} ─┐

📦 إشعار تسليم بضاعة

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُستلم: {name}

{items_table}

💰 الإجمالي: {total} جنيه

تم التسليم بنجاح ✅
{shop}`,
  "transfer_receive|قياسي — مفصل": `📦 تم استلام البضاعة
━━━━━━━━━━━━━━━━
📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُرسل: {name}

{items_table}

💰 إجمالي التكلفة: {total} جنيه
━━━━━━━━━━━━━━━━
{shop}`,
  "transfer_receive|مختصر — سريع": `📦 استلام بضاعة
📋 {invoice_no} — {date}
🏢 {name}
{items_table}
💰 {total} جنيه
{shop}`,
  "transfer_receive|بريميوم — فاخر": `┌─ {shop} ─┐

📦 إشعار استلام بضاعة

📋 رقم: {invoice_no}
📅 {date}
👤 {cashier}
🏢 الفرع المُرسل: {name}

{items_table}

💰 الإجمالي: {total} جنيه

تم الاستلام بنجاح ✅
{shop}`,
  // ── Telegram owner-alert presets ─────────────────────────────────
  "telegram_new_invoice|قياسي — مفصل": `🧾 *فاتورة جديدة* #{invoice_no}
━━━━━━━━━━━━━━
👤 العميل: {customer_name}
💰 الإجمالي: *{total}*
📊 الصافي: {subtotal} | الضريبة: {tax} | الخصم: {discount}
💳 الدفع: {payment_type} | المدفوع: {paid} | الباقي: {balance}
🕐 {created_at}

🛒 *الأصناف ({items_count})*
{items_table}

💳 *تفاصيل الدفع*
{payment_breakdown}`,
  "telegram_new_invoice|مختصر — سريع": `🧾 فاتورة #{invoice_no} | {customer_name} | {total} | {payment_type}`,
"telegram_daily_close|قياسي — مفصل": `📅 إغلاق يومية — {date}
━━━━━━━━━━━━━━━━
💰 الرصيد الافتتاحي: *{opening_balance}*
━━━━ 📥 المبيعات ━━━━
🧾 نقدية: *{cash_sales}*
📋 آجلة: *{credit_sales}*
🔄 أقساط: *{installment_cash}*
🔀 متعدد: *{multi_cash}*
🏦 بنكي/بطاقة: *{bank_sales}*
📊 الإجمالي: *{total_sales}* ({invoices_count} فاتورة)
━━━━ 📦 المشتريات ━━━━
💵 نقدية: *{purchases_cash}*
📋 آجلة: *{purchases_payable}*
━━━━ ↩️ المرتجعات ━━━━
↩️ مبيعات (نقدي): *{sales_returns_cash}*
↩️ مبيعات (آجل): *{sales_returns_account}*
↩️ مشتريات (نقدي): *{purchase_returns_cash}*
↩️ مشتريات (آجل): *{purchase_returns_account}*
━━━━ 💸 المصروفات ━━━━
💸 مصروفات: *{expenses_cash}* ({expenses_count})
💰 إيرادات: *{revenues_cash}* ({revenues_count})
🏧 سحوبات: *{withdrawals}*
━━━━ 💳 الدفعات ━━━━
💰 تحصيل عملاء: *{customer_payments}* ({customer_payments_count})
💰 دفع موردين: *{supplier_payments}* ({supplier_payments_count})
📋 تحصيل آجل: *{ajal_payments}*
━━━━━━━━━━━━━━━━
📥 الوارد: *{cash_in}*
📤 الصادر: *{cash_out}*
💰 الرصيد المتوقع: *{expected_cash}*
💵 الرصيد الفعلي: *{actual_cash}*
⚖️ الفرق: *{discrepancy}*
━━━━━━━━━━━━━━━━
{payment_methods_summary}`,
  "telegram_daily_close|مختصر — سريع": `📅 إغلاق يومية {date} | فرق: {discrepancy}`,
  "telegram_large_invoice|قياسي — مفصل": `🚨 *فاتورة بمبلغ كبير*
━━━━━━━━━━━━━━
📋 رقم: #{invoice_no}
👤 العميل: {customer_name}
💰 المجموع: *{total}*`,
  "telegram_large_invoice|مختصر — سريع": `🚨 فاتورة كبيرة #{invoice_no} | {customer_name} | {total}`,
  "telegram_large_discount|قياسي — مفصل": `💸 *خصم كبير مطبق*
━━━━━━━━━━━━━━
📋 الفاتورة: #{invoice_no}
📉 نسبة الخصم: *{discount_percent}*`,
  "telegram_large_discount|مختصر — سريع": `💸 خصم كبير #{invoice_no} | {discount_percent}`,
  "telegram_sales_return|قياسي — مفصل": `↩️ *مرتجع مبيعات*

📋 الفاتورة الأصلية: #{original_invoice_id}
👤 العميل: *{customer_name}*
💰 مبلغ المرتجع: *{total}*
💳 طريقة الاسترداد: *{refund_method}*
📝 السبب: {reason}
📦 الأصناف ({items_count}):
{items_table}
👤 بواسطة: {user_name}`,
  "telegram_sales_return|مختصر — سريع": `↩️ مرتجع #{original_invoice_id} | {total} | {reason}`,
  "telegram_invoice_voided|قياسي — مفصل": `⛔ *إلغاء فاتورة مبيعات #{invoice_no}*

👤 العميل: *{customer_name}*
💰 الإجمالي: *{total}*
💳 طريقة الدفع: *{payment_type}*
📝 السبب: *{reason}*
📦 أصناف الفاتورة الملغاة:
{items_table}
📊 عدد الأصناف: {items_count}
👤 بواسطة: *{user_name}*`,
  "telegram_invoice_voided|مختصر — سريع": `⛔ فاتورة ملغاة #{invoice_no} | {total} | {reason}`,
  "telegram_purchase_created|قياسي — مفصل": `📦 *عملية شراء جديدة*
━━━━━━━━━━━━━━
📝 النوع: {kind_label}
📋 الرقم: #{reference}
🏭 المورد: {supplier_name}
💰 المجموع: *{total}*`,
  "telegram_purchase_created|مختصر — سريع": `📦 {kind_label} #{reference} | {supplier_name} | {total}`,
  "telegram_customer_payment|قياسي — مفصل": `💰 *دفع من عميل*

👤 العميل: *{customer_name}*
💰 المبلغ: *{amount}*
💳 الطريقة: {method}`,
  "telegram_customer_payment|مختصر — سريع": `💰 دفع من {customer_name} | {amount} | {method}`,
  "telegram_low_stock|قياسي — مفصل": `⚠️ *تنبيه مخزون منخفض*
━━━━━━━━━━━━━━
📦 المنتج: {product_name}
📊 الكمية الحالية: {current_quantity}
📉 الحد الأدنى: {min_quantity}`,
  "telegram_low_stock|مختصر — سريع": `⚠️ مخزون منخفض: {product_name} | {current_quantity}/{min_quantity}`,
  "telegram_backup_result|قياسي — مفصل": `{success_text}
━━━━━━━━━━━━━━
📝 السبب: {reason}
📁 الملف: {file_path}
❌ الخطأ: {error}`,
  "telegram_backup_result|مختصر — سريع": `{success_text} | {reason}`,
  "telegram_failed_login|قياسي — مفصل": `🔒 *محاولة دخول فاشلة*
━━━━━━━━━━━━━━
👤 المستخدم: {username}
🕐 الوقت: {time}
🌐 IP: {ip}`,
  "telegram_failed_login|مختصر — سريع": `🔒 دخول فاشل: {username} | {ip}`,
  "telegram_customer_created|قياسي — مفصل": `👤 *عميل جديد*
━━━━━━━━━━━━━━
🏷️ الاسم: {customer_name}
📞 الهاتف: {phone}
🏙️ المدينة: {city}
💰 الرصيد الافتتاحي: {opening_balance}`,
  "telegram_customer_created|مختصر — سريع": `👤 عميل جديد: {customer_name} | {phone}`,
  "telegram_supplier_created|قياسي — مفصل": `🏭 *مورد جديد*
━━━━━━━━━━━━━━
🏷️ الاسم: {supplier_name}
📞 الهاتف: {phone}
💰 الرصيد الافتتاحي: {opening_balance}`,
  "telegram_supplier_created|مختصر — سريع": `🏭 مورد جديد: {supplier_name} | {phone}`,
  "telegram_expense_created|قياسي — مفصل": `💸 *مصروف جديد*
━━━━━━━━━━━━━━
📂 الفئة: {category}
💰 المبلغ: *{amount}*
📅 التاريخ: {date}
📝 ملاحظات: {notes}`,
  "telegram_expense_created|مختصر — سريع": `💸 مصروف: {category} | {amount} | {date}`,
  "telegram_return_payment|قياسي — مفصل": `↩️ *دفعة مرتجعة*

👤 العميل: *{customer_name}*
💰 المبلغ: *{amount}*
💳 الطريقة: *{method}*
📅 التاريخ: {date}
📝 السبب: {reason}`,
  "telegram_return_payment|مختصر — سريع": `↩️ دفعة مرتجعة | {customer_name} | {amount} | {method}`,
  // ── Telegram periodic digest presets ─────────────────────────────
  "telegram_weekly_digest|قياسي — مفصل": `{title} — {period_label}

💰 المبيعات: *{sales_total}*  {sales_delta}
🧾 عدد الفواتير: *{sales_count}*  (متوسط {avg_invoice})
📊 صافي الربح: *{profit}*

🏆 *أكثر المنتجات مبيعاً:*
{products_table}

⭐ *أفضل العملاء:*
{customers_table}

🏦 السيولة الحالية: *{liquidity}* (خزنة {treasury_balance} + بنك {bank_balance})
📌 مديونيات العملاء: *{debts}*
⚠️ أصناف تحت الحد الأدنى: *{low_stock_count}*`,
  "telegram_weekly_digest|مختصر — سريع": `{title} | {period_label}
💰 {sales_total} ({sales_delta}) | 🧾 {sales_count} | 📊 ربح {profit}`,
  "telegram_monthly_digest|قياسي — مفصل": `{title} — {period_label}

💰 المبيعات: *{sales_total}*  {sales_delta}
🧾 عدد الفواتير: *{sales_count}*  (متوسط {avg_invoice})
📊 صافي الربح: *{profit}*

🏆 *أكثر المنتجات مبيعاً:*
{products_table}

⭐ *أفضل العملاء:*
{customers_table}

🏦 السيولة الحالية: *{liquidity}* (خزنة {treasury_balance} + بنك {bank_balance})
📌 مديونيات العملاء: *{debts}*
⚠️ أصناف تحت الحد الأدنى: *{low_stock_count}*`,
  "telegram_monthly_digest|مختصر — سريع": `{title} | {period_label}
💰 {sales_total} ({sales_delta}) | 🧾 {sales_count} | 📊 ربح {profit}`,
  "telegram_yearly_digest|قياسي — مفصل": `{title} — {period_label}

💰 المبيعات: *{sales_total}*  {sales_delta}
🧾 عدد الفواتير: *{sales_count}*  (متوسط {avg_invoice})
📊 صافي الربح: *{profit}*

🏆 *أكثر المنتجات مبيعاً:*
{products_table}

⭐ *أفضل العملاء:*
{customers_table}

🏦 السيولة الحالية: *{liquidity}* (خزنة {treasury_balance} + بنك {bank_balance})
📌 مديونيات العملاء: *{debts}*
⚠️ أصناف تحت الحد الأدنى: *{low_stock_count}*`,
  "telegram_yearly_digest|مختصر — سريع": `{title} | {period_label}
💰 {sales_total} ({sales_delta}) | 🧾 {sales_count} | 📊 ربح {profit}`,
  "telegram_stock_transfer|قياسي — مفصل": `📦 *تم نقل مخزون*

📤 من: {from_warehouse}
📥 إلى: {to_warehouse}
⏰ {time}

📋 *الأصناف:*
{items_table}

📊 عدد الأصناف: *{items_count}* | إجمالي الوحدات: *{total_units}*`,
  "telegram_stock_transfer|مختصر — سريع": `📦 نقل مخزون: {from_warehouse} → {to_warehouse}
📊 {items_count} أصناف | {total_units} وحدة | ⏰ {time}`,
  "telegram_inventory_adjustment|قياسي — مفصل": `📋 *تم تعديل المخزون*

🏷️ المنتج: *{product_name}*
🏢 المستودع: {warehouse}
📦 الكمية: {old_quantity} → {new_quantity} (فرق: {difference})
📝 السبب: {reason}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_inventory_adjustment|مختصر — سريع": `📋 تعديل مخزون: {product_name} | {old_quantity}→{new_quantity} ({difference}) | {reason}`,
  "telegram_new_product|قياسي — مفصل": `🆕 *تم إضافة منتج جديد*

🏷️ المنتج: *{product_name}*
🔖 الكود: {sku}
💰 السعر: {price}
🏢 المستودع: {warehouse}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_new_product|مختصر — سريع": `🆕 منتج جديد: {product_name} ({sku}) | {price} | {warehouse}`,
  "telegram_price_change|قياسي — مفصل": `💲 *تم تغيير سعر منتج*

🏷️ المنتج: *{product_name}*
📉 السعر القديم: {old_price}
📈 السعر الجديد: *{new_price}*
📊 نسبة التغيير: {change_percent}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_price_change|مختصر — سريع": `💲 تغيير سعر: {product_name} | {old_price} → {new_price} ({change_percent})`,
  "telegram_batch_expiry|قياسي — مفصل": `⚠️ *انتهاء صلاحية دفعة قادم*

🏷️ المنتج: *{product_name}*
🔢 رقم الدفعة: {batch_no}
📅 تاريخ الانتهاء: *{expiry_date}*
📦 الكمية المتبقية: {remaining_quantity}
🏢 المستودع: {warehouse}`,
  "telegram_batch_expiry|مختصر — سريع": `⚠️ انتهاء صلاحية: {product_name} | دفعة {batch_no} | تنتهي {expiry_date} | كمية {remaining_quantity}`,
  "telegram_physical_count|قياسي — مفصل": `📊 *تأكيد جرد فعلي*

🏢 المستودع: {warehouse}
✅ أصناف مطابقة: *{matched_count}*
❌ أصناف غير مطابقة: *{mismatched_count}*
📦 إجمالي الأصناف: {total_items}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_physical_count|مختصر — سريع": `📊 جرد {warehouse}: {matched_count} مطابق | {mismatched_count} غير مطابق | {total_items} إجمالي`,
  "telegram_supplier_payment|قياسي — مفصل": `💸 *دفعة مورد*

🏢 المورد: *{supplier_name}*
💰 المبلغ: *{amount}*
💳 الطريقة: {method}
🔖 المرجع: {reference}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_supplier_payment|مختصر — سريع": `💸 دفعة مورد: {supplier_name} | {amount} | {method}`,
  "telegram_debt_payment|قياسي — مفصل": `💰 *تحصيل دفعة دين*

👤 العميل: *{customer_name}*
💵 المبلغ: *{amount}*
💳 الطريقة: {method}
📊 الدين المتبقي: {remaining_debt}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_debt_payment|مختصر — سريع": `💰 تحصيل دين: {customer_name} | {amount} | متبقي {remaining_debt}`,
  "telegram_installment_paid|قياسي — مفصل": `📋 *تسديد قسط*

👤 العميل: *{customer_name}*
🔢 القسط رقم: {installment_no} / {total_installments}
💵 المبلغ: *{amount}*
📊 المتبقي: {remaining}`,
  "telegram_installment_paid|مختصر — سريع": `📋 قسط مسدّد: {customer_name} | قسط {installment_no}/{total_installments} | {amount}`,
  "telegram_purchase_voided|قياسي — مفصل": `🚫 *تم إلغاء فاتورة شراء*

🔖 المرجع: {reference_no}
🏢 المورد: *{supplier_name}*
💰 الإجمالي: {total}
📝 السبب: {reason}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_purchase_voided|مختصر — سريع": `🚫 شراء ملغي: {reference_no} | {supplier_name} | {total} | {reason}`,
  "telegram_purchase_return|قياسي — مفصل": `↩️ *مرتجع مشتريات*

📋 المرجع: *{reference_no}*
🏭 المورد: *{supplier_name}*
💰 الإجمالي: *{total}*
📦 الأصناف ({items_count}):
{items_table}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_purchase_return|مختصر — سريع": `↩️ مرتجع شراء #{reference_no} | {total} | {user_name}`,
  "telegram_branch_transfer|قياسي — مفصل": `🔄 *تحويل بين الفروع*

🔖 المرجع: {reference_no}
📤 من: {from_branch}
📥 إلى: {to_warehouse}
🔀 النوع: {transfer_type}
⏰ {time}

📋 *الأصناف:*
{items_table}

📊 عدد الأصناف: {items_count} | إجمالي الوحدات: {total_units}
💰 إجمالي التكلفة: *{total_cost}*`,
  "telegram_branch_transfer|مختصر — سريع": `🔄 تحويل فرع: {reference_no} | {from_branch}→{to_warehouse} | {items_count} أصناف | {total_cost}`,
  "telegram_password_changed|قياسي — مفصل": `🔐 *تم تغيير كلمة المرور*

👤 المستخدم: *{user_name}*
⏰ التوقيت: {time}
🌐 عنوان IP: {ip_address}`,
  "telegram_password_changed|مختصر — سريع": `🔐 تغيير كلمة مرور: {user_name} | {time} | IP: {ip_address}`,
  "telegram_permission_changed|قياسي — مفصل": `🛡️ *تم تغيير صلاحيات*

👤 المستخدم: *{user_name}*
📝 الإجراء: {action}
📋 التفاصيل: {details}
👤 بواسطة: {changed_by}
⏰ {time}`,
  "telegram_permission_changed|مختصر — سريع": `🛡️ تغيير صلاحيات: {user_name} | {action} | بواسطة {changed_by}`,
  "telegram_supervisor_override|قياسي — مفصل": `⚠️ *تجاوز صلاحيات*

👤 المستخدم: *{user_name}*
📝 الإجراء: {action}
📋 التفاصيل: {details}
👨‍💼 المشرف: {supervisor}
⏰ {time}`,
  "telegram_supervisor_override|مختصر — سريع": `⚠️ تجاوز صلاحيات: {user_name} | {action} | مشرف: {supervisor}`,
  "telegram_repair_created|قياسي — مفصل": `🔧 *طلب صيانة جديد*

🔖 رقم الطلب: *{order_no}*
👤 العميل: *{customer_name}*
📱 الجهاز: {device_type}
📝 المشكلة: {problem}
💰 التكلفة التقديرية: {estimated_cost}
⏰ {time}`,
  "telegram_repair_created|مختصر — سريع": `🔧 صيانة جديدة: {order_no} | {customer_name} | {device_type} | {estimated_cost}`,
  "telegram_revenue_created|قياسي — مفصل": `💵 *تم تسجيل إيراد*

🔖 المستند: *{doc_no}*
💰 المبلغ: *{amount}*
📂 الفئة: {category}
📝 الوصف: {description}
💳 الطريقة: {method}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_revenue_created|مختصر — سريع": `💵 إيراد جديد: {doc_no} | {amount} | {category}`,
  "telegram_withdrawal_created|قياسي — مفصل": `🏦 *تم سحب نقدي*

🔖 المستند: *{doc_no}*
💰 المبلغ: *{amount}*
📂 الفئة: {category}
📝 الملاحظة: {note}
💳 الطريقة: {method}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_withdrawal_created|مختصر — سريع": `🏦 سحب نقدي: {doc_no} | {amount} | {category}`,
  "telegram_employee_created|قياسي — مفصل": `👤 *تم إضافة موظف جديد*

🏷️ اسم الموظف: *{employee_name}*
💼 المسمى: {job_title}
💰 الراتب: {salary}
📞 الهاتف: {phone}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_employee_created|مختصر — سريع": `👤 موظف جديد: {employee_name} | {job_title} | {salary}`,
  "telegram_salary_settled|قياسي — مفصل": `💰 *تسويات راتب*

👤 الموظف: *{employee_name}*
📅 الفترة: {period}

💵 الراتب الأساسي: {base_salary}
🏆 المكافآت: {bonuses}
📉 الخصومات: {deductions}
💳 خصم السلف: {advance_deductions}
━━━━━━━━━━━━━━━
✅ الصافي: *{net_salary}*
💰 المدفوع: *{paid_amount}*

👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_salary_settled|مختصر — سريع": `💰 تسويات راتب: {employee_name} | صافي {net_salary} | مدفوع {paid_amount}`,
  "telegram_advance_created|قياسي — مفصل": `💳 *تم منح سلفة*

👤 الموظف: *{employee_name}*
💰 المبلغ: *{amount}*
🔢 عدد الأقساط: {installment_count}
📊 قيمة القسط: {installment_amount}
📝 ملاحظات: {notes}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_advance_created|مختصر — سريع": `💳 سلفة جديدة: {employee_name} | {amount} | {installment_count} أقساط × {installment_amount}`,
  "telegram_deduction_created|قياسي — مفصل": `📉 *تم تسجيل خصم*

👤 الموظف: *{employee_name}*
💰 المبلغ: *{amount}*
📋 نوع الخصم: {deduction_type}
🔄 دوري: {is_recurring}
📝 ملاحظات: {notes}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_deduction_created|مختصر — سريع": `📉 خصم جديد: {employee_name} | {amount} | {deduction_type}`,
  "telegram_bonus_created|قياسي — مفصل": `🏆 *تم منح مكافأة*

👤 الموظف: *{employee_name}*
💰 المبلغ: *{amount}*
📋 نوع المكافأة: {bonus_type}
🔄 دوري: {is_recurring}
📝 ملاحظات: {notes}
👤 بواسطة: {user_name}
⏰ {time}`,
  "telegram_bonus_created|مختصر — سريع": `🏆 مكافأة جديدة: {employee_name} | {amount} | {bonus_type}`,
  "telegram_app_quit|قياسي — مفصل": `🛑 *إغلاق التطبيق*

👤 المستخدم: *{user_name}*
📝 السبب: *{trigger_reason}*
⏰ الوقت: {time}

{daily_accumulative_footer}`,
  "telegram_app_quit|مختصر — سريع": `🛑 إغلاق التطبيق | {user_name} | {trigger_reason} | {time}
{daily_accumulative_footer}`,
  "telegram_user_logout|قياسي — مفصل": `🚪 *تسجيل خروج*

👤 المستخدم: *{user_name}*
📝 السبب: *{trigger_reason}*
⏰ الوقت: {time}

{daily_accumulative_footer}`,
  "telegram_user_logout|مختصر — سريع": `🚪 تسجيل خروج | {user_name} | {trigger_reason} | {time}
{daily_accumulative_footer}`,
  "telegram_below_cost_sale|قياسي — مفصل": `⚠️ *بيع تحت التكلفة*

🧾 الفاتورة: *#{invoice_no}*
👤 العميل: *{customer_name}*
📦 الصنف: *{item_name}*
💵 سعر البيع: *{selling_price}*
🏭 التكلفة: *{cost_price}*
📉 الخسارة: *{loss_amount}* ({loss_percent})
👨‍💼 بواسطة: {user_name}
⏰ {time}`,
  "telegram_below_cost_sale|مختصر — سريع": `⚠️ بيع تحت التكلفة | #{invoice_no} | {item_name} | {loss_amount} | {user_name}`,
};

function renderCategoryPreview(body, vars) {
  const filled = (vars || []).reduce((acc, v) => acc.replaceAll(v.token, `«${v.label}»`), body || "");
  // Telegram renders *bold* as bold — preview strips the markers so the owner
  // sees what the message actually looks like instead of literal asterisks.
  return filled.replace(/\*(.+?)\*/g, "$1");
}

function renderFakePreview(body, category) {
  if (!body) return "";
  const fakeItemsTable = `━━━ الأصناف ━━━
• منتج ١
  ٣ × ١٠٠ = ٣٠٠
• منتج ٢
  ٢ × ٢٠٠ = ٤٠٠
━━━━━━━━━━━━━━━━`;
  const fakePaymentBreakdown = `نقداً: ١٥٠ جنيه\nبطاقة: ١٠٠ جنيه`;
  const fakeAccumulativeFooter = `━━━━━━━━━━━━━━━━━━━━
📊 ملخص اليوم حتى الآن:
💵 الصندوق: +٥٬٢٠٠ ج / -٨٠٠ ج = *٤٬٤٠٠ ج*
📋 آجل: *١٬٥٠٠ ج*
🏦 بنكي/بطاقة: *٢٬٣٠٠ ج*
━━━━━━━━━━━━━━━━━━━━
💰 الرصيد المتوقع: *٧٬٩٠٠ ج*`;
  const fakeMap = {
    "{name}": "أحمد محمد",
    "{invoice_no}": "INV-20260710-0001",
    "{total}": "٢٥٠",
    "{subtotal}": "٢٢٥",
    "{tax}": "٠",
    "{paid}": "٢٥٠",
    "{balance}": "٠",
    "{shop}": "متجر النخبة",
    "{date}": "١٠ يوليو ٢٠٢٦",
    "{payment_type}": "نقداً",
    "{payment_breakdown}": fakePaymentBreakdown,
    "{discount}": "٢٥",
    "{items_count}": "٣",
    "{items_table}": fakeItemsTable,
    "{cashier}": "أحمد",
    "{amount}": "١٬٢٠٠",
    "{customer_name}": "أحمد محمد",
    "{created_at}": "١٠ يوليو ٢٠٢٦ ١٠:٣٠ ص",
    "{opening_balance}": "٥٬٠٠٠",
    "{cash_sales}": "٣٬٢٠٠",
    "{credit_sales}": "٨٠٠",
    "{installment_cash}": "٥٠٠",
    "{multi_cash}": "٣٠٠",
    "{bank_sales}": "١٬٢٠٠",
    "{total_sales}": "٦٬٠٠٠",
    "{purchases_cash}": "١٬٥٠٠",
    "{purchases_payable}": "٨٠٠",
    "{sales_returns_cash}": "٢٠٠",
    "{sales_returns_account}": "١٠٠",
    "{purchase_returns_cash}": "١٥٠",
    "{purchase_returns_account}": "٥٠",
    "{expenses_cash}": "٤٠٠",
    "{expenses_count}": "٣",
    "{revenues_cash}": "٦٠٠",
    "{revenues_count}": "٢",
    "{withdrawals}": "٣٠٠",
    "{customer_payments}": "١٬٢٠٠",
    "{customer_payments_count}": "٥",
    "{supplier_payments}": "٨٠٠",
    "{supplier_payments_count}": "٢",
    "{ajal_payments}": "٥٠٠",
    "{cash_in}": "٥٬٢٠٠",
    "{cash_out}": "٨٠٠",
    "{non_cash_total}": "٣٬٥٠٠",
    "{expected_cash}": "٣٬٢٠٠",
    "{actual_cash}": "٣٬١٠٠",
    "{discrepancy}": "١٠٠-",
    "{invoices_count}": "١٥",
    "{shift_id}": "SH-005",
    "{opening_cash}": "١٬٠٠٠",
    "{closing_cash}": "٤٬٠٠٠",
    "{discount_percent}": "٢٠%",
    "{original_invoice_id}": "INV-20260710-0001",
    "{reason}": "خطأ في الفاتورة",
    "{refund_method}": "نقداً",
    "{user_name}": "أحمد",
    "{kind_label}": "فاتورة شراء",
    "{reference}": "PO-20260710-0002",
    "{supplier_name}": "المورد للتجارة",
    "{method}": "نقداً",
    "{product_name}": "منتج ١",
    "{current_quantity}": "٥",
    "{min_quantity}": "١٠",
    "{success_label}": "نجاح",
    "{reason_or_label}": "تم بنجاح",
    "{file_path}": "/backups/retailer.db",
    "{error_message}": "لا يوجد",
    "{username}": "أحمد",
    "{ip}": "192.168.1.100",
    "{partner_branch}": "الفرع الثاني",
    "{phone}": "٠١٠٠٠٠٠٠٠٠٠",
    "{city}": "القاهرة",
    "{success_text}": "✅ نسخة احتياطية ناجحة",
    "{error}": "لا يوجد",
    "{notes}": "مصروف تشغيلي",
    "{title}": "📊 الملخص الأسبوعي",
    "{period_label}": "أسبوع ٢٠٢٦-W28",
    "{sales_total}": "١٥٬٠٠٠ جنيه",
    "{sales_count}": "٤٥",
    "{sales_delta}": "📈 +١٢٪",
    "{avg_invoice}": "٣٣٣ جنيه",
    "{profit}": "٤٬٥٠٠ جنيه",
    "{products_table}": "1. منتج ١ — ١٠ قطع (٥٬٠٠٠ جنيه)\n2. منتج ٢ — ٥ قطع (٢٬٥٠٠ جنيه)",
    "{customers_table}": "1. أحمد محمد — ٣٬٠٠٠ جنيه\n2. محمد علي — ٢٬٠٠٠ جنيه",
    "{liquidity}": "٢٥٬٠٠٠ جنيه",
    "{treasury_balance}": "١٥٬٠٠٠ جنيه",
    "{bank_balance}": "١٠٬٠٠٠ جنيه",
    "{trigger_reason}": "إغلاق التطبيق",
    // Accumulative-day tokens (used by migration 214's quit/logout bodies
    // and exposed as chips for every telegram event that auto-appends the
    // footer). When the template body references {daily_accumulative_footer}
    // explicitly, render the same fake footer the preview would otherwise
    // append automatically.
    "{daily_accumulative_footer}": fakeAccumulativeFooter,
    "{daily_cash_in}": "٥٬٢٠٠ ج",
    "{daily_cash_out}": "٨٠٠ ج",
    "{daily_cash_net}": "٤٬٤٠٠ ج",
    "{daily_expected_cash}": "٧٬٩٠٠ ج",
    "{daily_methods_summary}": "نقداً: ٤٬٤٠٠ | بنكي: ٢٬٣٠٠ | آجل: ١٬٥٠٠",
    // below_cost_sale tokens (added when the category became visible in the UI)
    "{item_name}": "منتج ١",
    "{selling_price}": "١٥٠ ج",
    "{cost_price}": "٢٠٠ ج",
    "{loss_amount}": "٥٠ ج",
    "{loss_percent}": "٢٥٪",
    "{old_customer_name}": "أحمد محمد",
    "{new_customer_name}": "أحمد محمد (تعديل)",
    "{old_payment_type}": "نقداً",
    "{new_payment_type}": "دفع متعدد",
    "{old_payment_method}": "نقداً",
    "{new_payment_method}": "آجل",
    "{old_items_table}": fakeItemsTable,
    "{new_items_table}": fakeItemsTable,
    "{old_total}": "١٬٢٥٠",
    "{new_total}": "١٬٤٠٠",
    "{old_supplier_name}": "المورد للتجارة",
    "{new_supplier_name}": "المورد للتجارة (تعديل)",
    "{reference_no}": "PUR-20260710-0002",
    "{doc_no}": "INV-20260710-0001",
    "{operation_label}": "تحديث أسعار جماعي",
    "{field_label}": "سعر البيع",
    "{adjustment_label}": "زيادة ١٠٪",
    "{changes_table}": "• منتج ١: ٢٥٠ ← ٢٧٥\n• منتج ٢: ٣٥٠ ← ٣٨٥",
    "{sku}": "BT-HD-001",
    "{price}": "٢٥٠",
    "{quantity}": "٣",
    "{job_title}": "محاسب",
    "{employee_name}": "محمد علي",
    "{payment_methods_summary}": "💵 الصندوق: +٥٬٢٠٠ / -٨٠٠ = ٤٬٤٠٠ | 🏦 بنكي: ٢٬٣٠٠ | 📋 آجل: ١٬٥٠٠",
    "{old_invoice_no}": "INV-20260710-0001",
    "{new_invoice_no}": "INV-20260710-0002",
    "{time}": "١٠ يوليو ٢٠٢٦ ١٠:٣٠ ص",
    "{remaining_debt}": "٥٠٠",
    "{installment_no}": "٢",
    "{total_installments}": "٦",
    "{remaining}": "١٬٥٠٠",
    "{employee_name}": "محمد علي",
    "{period}": "يوليو ٢٠٢٦",
    "{base_salary}": "٥٬٠٠٠",
    "{bonuses}": "٥٠٠",
    "{deductions}": "٢٠٠",
    "{advance_deductions}": "١٥٠",
    "{net_salary}": "٥٬١٥٠",
    "{paid_amount}": "٥٬١٥٠",
    "{installment_count}": "٦",
    "{installment_amount}": "٨٣٣",
    "{deduction_type}": "سلفة",
    "{is_recurring}": "لا",
    "{bonus_type}": "عائد إنتاج",
    "{expense_id}": "EXP-001",
    "{revenue_id}": "REV-001",
    "{old_amount}": "٥٠٠",
    "{new_amount}": "٦٠٠",
    "{old_description}": "مصروف قديم",
    "{new_description}": "مصروف جديد",
    "{payment_method}": "نقداً",
    "{description}": "إيراد تشغيلي",
    "{transfer_type}": "إرسال",
    "{old_partner_branch}": "الفرع الأول",
    "{new_partner_branch}": "الفرع الثاني",
    "{items_count}": "٣",
    "{total_units}": "١٠",
    "{total_cost}": "٥٬٠٠٠",
    "{ip_address}": "192.168.1.100",
    "{action}": "تعديل صلاحيات",
    "{details}": "إضافة صلاحية إدارة المخزون",
    "{changed_by}": "المدير",
    "{supervisor}": "المدير العام",
    "{order_no}": "REP-001",
    "{device_type}": "لابتوب",
    "{problem}": "شاشة مكسورة",
    "{estimated_cost}": "١٬٥٠٠",
    "{final_cost}": "١٬٢٠٠",
    "{amount_paid}": "١٬٢٠٠",
    "{category}": "مصاريف إدارية",
    "{description}": "إيراد تشغيلي",
  };
  let result = body.replace(/\{(\w+)\}/g, (_, key) => fakeMap[`{${key}}`] || `{${key}}`);
  // Telegram renders *bold* as bold — preview strips the markers so the owner
  // sees what the message actually looks like instead of literal asterisks.
  result = result.replace(/\*(.+?)\*/g, "$1");
  // Append fake accumulative footer for Telegram events EXCEPT daily_close
  // (which already carries its own structured daily report body) and test.
  // Quit/logout now also receive the footer — matches the backend behaviour
  // introduced alongside the "day details" report on close/logout.
  const noFooterCategories = ["telegram_daily_close", "telegram_test"];
  if (category && category.startsWith("telegram_") && !noFooterCategories.includes(category) && !result.includes(fakeAccumulativeFooter)) {
    result += `\n${fakeAccumulativeFooter}`;
  }
  return result;
}

function TemplatesTab({ perms }) {
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [templates, setTemplates] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null); // null | "new" | template row
  const [manageCategory, setManageCategory] = useState(null); // null | category key

  const fetchTemplates = useCallback(async () => {
    try {
      const r = await api.get("/api/whatsapp/crm/templates");
      setTemplates(r.data?.data || []);
    } catch { } finally { setLoading(false); }
  }, []);

  const fetchVariants = useCallback(async () => {
    try {
      const r = await api.get("/api/whatsapp/crm/template-variants");
      setVariants(r.data?.data || []);
    } catch { }
  }, []);

  useEffect(() => { fetchTemplates(); fetchVariants(); }, [fetchTemplates, fetchVariants]);

  const customTemplates = templates.filter(t => !t.is_system);

  function CategoryCard({ category }) {
    const meta = CATEGORY_META[category];
    const catVariants = variants.filter(v => v.category === category);
    const active = catVariants.find(v => v.is_active);
    const [activatingId, setActivatingId] = useState(null);
    const isTelegram = category.startsWith("telegram_");
    const DEFAULT_PRESETS = ["قياسي — مفصل", "مختصر — سريع"];

    // Telegram cards preview through the server's real send pipeline so this
    // card, the event-preset picker, and the delivered message are identical.
    // WhatsApp categories have no owner-event equivalent and keep the local
    // token renderer.
    const previewItems = React.useMemo(
      () => (isTelegram && active ? [{ category, label: active.label }] : []),
      [isTelegram, category, active?.label]
    );
    const { previews: serverPreviews } = useServerPreviews(previewItems);
    const activePreview = active ? serverPreviews[`${category}|${active.label}`] : null;

    if (!meta) return null;

    async function activateVariant(variant) {
      setActivatingId(variant.id);
      try {
        await api.post(`/api/whatsapp/crm/template-variants/${variant.id}/activate`);
        await fetchVariants();
      } catch (e) {
        toast.error(e.response?.data?.message || "فشل التفعيل");
      } finally {
        setActivatingId(null);
      }
    }

    async function ensureDefaultVariants() {
      try {
        for (const preset of DEFAULT_PRESETS) {
          const exists = catVariants.find(v => v.label === preset);
          if (!exists) {
            const body = DEFAULT_BODIES[`${category}|${preset}`] || `— ${meta.label} — ${preset}`;
            await api.post("/api/whatsapp/crm/template-variants", { category, label: preset, body });
          }
        }
        await fetchVariants();
      } catch (e) {
        toast.error(e.response?.data?.message || "فشل إنشاء القوالب الافتراضية");
      }
    }

    const showPresetChooser = isTelegram && catVariants.length >= 1;

    return (
      <div className="rounded-xl border border-border-normal bg-bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-bg text-warning-text shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-black text-text-primary">{meta.label}</p>
              <ChannelBadge channel={isTelegram ? "telegram" : "whatsapp"} />
            </div>
            <p className="text-[11px] font-bold text-text-muted">{meta.hint}</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap rounded-lg bg-bg-base p-3 font-mono mb-3 max-h-80 overflow-y-auto">
          {activePreview ?? (active ? renderFakePreview(active.body, category) : "—")}
        </div>
        {showPresetChooser && perms.canManageTemplates && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {catVariants.map(v => (
              <button key={v.id} onClick={() => activateVariant(v)} disabled={activatingId === v.id}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all active:scale-95 ${v.is_active
                  ? "bg-primary text-white border-primary"
                  : "bg-bg-surface text-text-secondary border-border-normal hover:border-primary hover:text-primary"
                  } ${activatingId === v.id ? "opacity-50" : ""}`}>
                {activatingId === v.id ? "..." : v.label || "بدون اسم"}
              </button>
            ))}
          </div>
        )}
        {isTelegram && catVariants.length === 0 && perms.canManageTemplates && (
          <div className="mb-3">
            <button onClick={ensureDefaultVariants}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-primary bg-primary/5 text-primary text-[11px] font-black hover:bg-primary/10 transition-all active:scale-95">
              <Plus className="h-3 w-3" /> إنشاء القوالب الافتراضية (تفصيلي + مختصر)
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-text-muted">{catVariants.length} قالب{catVariants.length !== 1 ? "ات" : ""} محفوظ</span>
          {perms.canManageTemplates && <button onClick={() => setManageCategory(category)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-base text-text-secondary text-[11px] font-black hover:bg-bg-overlay transition-all active:scale-95">
            <Settings className="h-3.5 w-3.5" /> إدارة القوالب
          </button>}
        </div>
      </div>
    );
  }

  async function deleteCustom(tpl) {
    const ok = await confirm({ title: "حذف القالب", message: `حذف قالب «${tpl.label || tpl.kind}»؟` });
    if (!ok) return;
    try {
      await api.delete(`/api/whatsapp/crm/templates/${tpl.kind}`);
      toast.success("تم حذف القالب");
      fetchTemplates();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحذف"); }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>;

  return (
    <div className="space-y-8">
      {/* ── Custom templates — full control, usable in campaigns ── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-black text-text-primary">قوالبي</h3>
            <p className="text-[11px] font-bold text-text-muted">قوالب من تصميمك — تظهر كخيار جاهز عند إنشاء الحملات</p>
          </div>
          {perms.canManageTemplates && <button onClick={() => setEditor("new")}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
            <Plus className="h-4 w-4" /> قالب جديد
          </button>}
        </div>
        {customTemplates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-normal bg-bg-surface p-6 text-center">
            <p className="text-sm font-bold text-text-muted">لا توجد قوالب مخصصة بعد — أنشئ قالباً لعروضك المتكررة بدلاً من كتابتها كل مرة</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {customTemplates.map(tpl => (
              <div key={tpl.kind} className="rounded-xl border border-border-normal bg-bg-surface p-4 shadow-card hover:shadow-elevated transition-shadow flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-black text-text-primary truncate flex-1">{tpl.label || "بدون اسم"}</p>
                  <ChannelBadge channel={tpl.channel} />
                </div>
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 flex-1 whitespace-pre-wrap">{tpl.body}</p>
                <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border-subtle">
                  {perms.canManageTemplates && <button onClick={() => setEditor(tpl)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-bg-base text-text-secondary text-[11px] font-black hover:bg-bg-overlay transition-all active:scale-95">
                    تعديل
                  </button>}
                  {perms.canManageTemplates && <button onClick={() => deleteCustom(tpl)}
                    className="mr-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-danger text-[11px] font-black hover:bg-danger-bg transition-all active:scale-95">
                    <Trash2 className="h-3 w-3" /> حذف
                  </button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── WhatsApp system templates — auto-send triggers ────────── */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-black text-text-primary">قوالب واتساب التلقائية</h3>
          <p className="text-[11px] font-bold text-text-muted">تُرسل تلقائياً عند حدث معين — احفظ عدة صيغ واختر أيها نشط</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {WHATSAPP_CATEGORIES.map(category => <CategoryCard key={category} category={category} />)}
        </div>
      </div>

      {/* ── Telegram templates — owner alerts, same multi-variant control ── */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-black text-text-primary">قوالب تيليجرام</h3>
          <p className="text-[11px] font-bold text-text-muted">نص كل تنبيه يُرسل للمالك على تيليجرام — قابل للتخصيص بنفس الطريقة</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TELEGRAM_CATEGORIES.map(category => <CategoryCard key={category} category={category} />)}
        </div>
      </div>

      {editor && (
        <TemplateEditorModal
          template={editor === "new" ? null : editor}
          onClose={(changed) => { setEditor(null); if (changed) fetchTemplates(); }}
        />
      )}

      {manageCategory && (
        <CategoryManagerModal
          category={manageCategory}
          variants={variants.filter(v => v.category === manageCategory)}
          onClose={() => setManageCategory(null)}
          onChanged={fetchVariants}
        />
      )}
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}

// ─── Category template manager — list variants, activate/edit/delete, add new ──
function CategoryManagerModal({ category, variants, onClose, onChanged }) {
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const meta = CATEGORY_META[category];
  const [editor, setEditor] = useState(null); // null | "new" | variant row
  const [busyId, setBusyId] = useState(null);

  // Preview every variant through the server's real send pipeline (Telegram
  // categories only — WhatsApp ones have no owner-event equivalent). The
  // variant's own body is sent so unsaved edits preview accurately too.
  const isTelegram = category.startsWith("telegram_");
  const previewItems = React.useMemo(
    () => (isTelegram ? variants.map((v) => ({ category, label: v.label, body: v.body })) : []),
    [isTelegram, category, variants]
  );
  const { previews: serverPreviews } = useServerPreviews(previewItems);

  async function activate(variant) {
    setBusyId(variant.id);
    try {
      await api.post(`/api/whatsapp/crm/template-variants/${variant.id}/activate`);
      toast.success("تم التفعيل");
      onChanged();
    } catch (e) { toast.error(e.response?.data?.message || "فشل التفعيل"); }
    finally { setBusyId(null); }
  }

  async function remove(variant) {
    const ok = await confirm({ title: "حذف القالب", message: `حذف قالب «${variant.label || "بدون اسم"}»؟` });
    if (!ok) return;
    setBusyId(variant.id);
    try {
      await api.delete(`/api/whatsapp/crm/template-variants/${variant.id}`);
      toast.success("تم الحذف");
      onChanged();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحذف"); }
    finally { setBusyId(null); }
  }

  async function resetToDefault(variant) {
    const defaultBody = DEFAULT_BODIES[`${category}|${variant.label}`];
    if (!defaultBody) return;
    const ok = await confirm({ title: "استعادة القالب", message: `استعادة القالب «${variant.label}» إلى الإعدادات الافتراضية؟` });
    if (!ok) return;
    setBusyId(variant.id);
    try {
      await api.put(`/api/whatsapp/crm/template-variants/${variant.id}`, { label: variant.label, body: defaultBody });
      toast.success("تمت الاستعادة");
      onChanged();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الاستعادة"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-5xl mx-4 max-h-[95vh] overflow-y-auto rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> {meta.label}
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] font-bold text-text-muted mb-5">{meta.hint}</p>

        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-black text-text-secondary">القوالب المحفوظة ({variants.length})</h4>
          <button onClick={() => setEditor("new")}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-black text-white hover:opacity-90 transition-all active:scale-95">
            <Plus className="h-3.5 w-3.5" /> قالب جديد
          </button>
        </div>

        <div className="space-y-3">
          {variants.map(v => (
            <div key={v.id} className={`rounded-xl border p-4 ${v.is_active ? "border-primary bg-primary-50" : "border-border-normal bg-bg-surface"}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-black text-text-primary truncate">{v.label || "بدون اسم"}</p>
                  {v.is_active && <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black bg-primary text-white">نشط</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!v.is_active && (
                    <button onClick={() => activate(v)} disabled={busyId === v.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success-bg text-success-text text-[11px] font-black hover:opacity-80 disabled:opacity-50 transition-all active:scale-95">
                      <Check className="h-3 w-3" /> تفعيل
                    </button>
                  )}
                  <button onClick={() => setEditor(v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-bg-base text-text-secondary text-[11px] font-black hover:bg-bg-overlay transition-all active:scale-95">
                    تعديل
                  </button>
                  {DEFAULT_BODIES[`${category}|${v.label}`] && (
                    <button onClick={() => resetToDefault(v)} disabled={busyId === v.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning-bg text-warning-text text-[11px] font-black hover:opacity-80 disabled:opacity-50 transition-all active:scale-95">
                      <RefreshCw className="h-3 w-3" /> استعادة
                    </button>
                  )}
                  {!v.is_active && variants.length > 1 && (
                    <button onClick={() => remove(v)} disabled={busyId === v.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-danger text-[11px] font-black hover:bg-danger-bg disabled:opacity-50 transition-all active:scale-95">
                      <Trash2 className="h-3 w-3" /> حذف
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black text-text-muted mb-1">نص القالب</p>
                  <pre className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap rounded-lg bg-bg-base p-3 font-mono max-h-48 overflow-y-auto border border-border-subtle">
                    {v.body}
                  </pre>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted mb-1">معاينة بالبيانات</p>
                  <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap rounded-lg bg-bg-surface p-3 font-mono max-h-80 overflow-y-auto border border-border-subtle shadow-sm">
                    {serverPreviews[`${category}|${v.label}`] ?? renderFakePreview(v.body, category)}
                  </div>
                </div>
              </div>


            </div>
          ))}
        </div>

        {editor && (
          <CategoryVariantEditorModal
            category={category}
            variant={editor === "new" ? { isNew: true } : editor}
            onClose={(changed) => { setEditor(null); if (changed) onChanged(); }}
          />
        )}
      </div>
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}

// ─── Category variant editor (create / edit one variant within a category) ──
function CategoryVariantEditorModal({ category, variant, onClose }) {
  const meta = CATEGORY_META[category];
  const [label, setLabel] = useState(variant?.label || "");
  const [body, setBodyText] = useState(variant?.body || "");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);
  const initial = useRef({ label: variant?.label || "", body: variant?.body || "" });
  const dirty = label !== initial.current.label || body !== initial.current.body;

  function insertVar(token) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBodyText(body.slice(0, start) + token + body.slice(end));
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  async function save() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      if (variant) {
        await api.put(`/api/whatsapp/crm/template-variants/${variant.id}`, { label: label.trim(), body: body.trim() });
      } else {
        await api.post("/api/whatsapp/crm/template-variants", { category, label: label.trim(), body: body.trim() });
      }
      toast.success("تم حفظ القالب");
      onClose(true);
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={() => onClose(false)}>
      <div dir="rtl" className="w-full max-w-lg mx-4 rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> {variant ? "تعديل القالب" : "قالب جديد"} — {meta.label}
          </h3>
          <button onClick={() => onClose(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block">اسم مساعد (اختياري)</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="مثال: صيغة رسمية / صيغة ودّية"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
          </div>
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block">نص الرسالة *</label>
            <textarea ref={bodyRef} rows={6} value={body} onChange={e => setBodyText(e.target.value)}
              placeholder="اكتب نص القالب... استخدم أزرار الإدراج لتخصيصه تلقائياً"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface resize-none transition-colors" dir="rtl" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-text-muted">أدرج في الرسالة:</span>
            {meta.vars.map(v => (
              <button key={v.token} type="button" onClick={() => insertVar(v.token)}
                className="px-2 py-1 rounded-full bg-primary-50 text-primary text-[10px] font-black hover:bg-primary hover:text-white transition-colors">
                + {v.label}
              </button>
            ))}
          </div>
          {body.trim() && (
            <div>
              <p className="text-[10px] font-black text-text-muted mb-1">معاينة:</p>
              <div className="rounded-xl rounded-br-md bg-success-bg border border-success-border px-4 py-3">
                <p className="text-sm font-bold text-text-primary whitespace-pre-wrap leading-relaxed">{renderCategoryPreview(body, meta.vars)}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => onClose(false)} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base">
            إلغاء
          </button>
          <button onClick={save} disabled={!body.trim() || saving || (!dirty && !variant?.isNew)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {dirty || variant?.isNew ? "حفظ القالب" : "محفوظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Custom template editor (create / edit) ────────────────────────────────
function TemplateEditorModal({ template, onClose }) {
  const [label, setLabel] = useState(template?.label || "");
  const [body, setBodyText] = useState(template?.body || "");
  const [channel, setChannel] = useState(template?.channel || "both");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);
  const initial = useRef({ label: template?.label || "", body: template?.body || "", channel: template?.channel || "both" });
  const dirty = label !== initial.current.label || body !== initial.current.body || channel !== initial.current.channel;

  function insertVar(token) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBodyText(body.slice(0, start) + token + body.slice(end));
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  async function save() {
    if (!label.trim() || !body.trim()) return;
    setSaving(true);
    try {
      if (template) {
        await api.put(`/api/whatsapp/crm/templates/${template.kind}`, { label: label.trim(), body: body.trim(), channel });
      } else {
        await api.post("/api/whatsapp/crm/templates", { label: label.trim(), body: body.trim(), channel });
      }
      toast.success("تم حفظ القالب");
      onClose(true);
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={() => onClose(false)}>
      <div dir="rtl" className="w-full max-w-lg mx-4 rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> {template ? "تعديل القالب" : "قالب جديد"}
          </h3>
          <button onClick={() => onClose(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block">اسم القالب *</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="مثال: عرض نهاية الأسبوع"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
          </div>
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block">القناة *</label>
            <div className="flex rounded-lg border border-border-normal overflow-hidden">
              {[
                { id: "whatsapp", label: "واتساب" },
                { id: "sms", label: "SMS" },
                { id: "both", label: "كلاهما" },
              ].map((opt, i) => (
                <button key={opt.id} type="button" onClick={() => setChannel(opt.id)}
                  className={`flex-1 px-3 py-2 text-xs font-black transition-colors ${i > 0 ? "border-r border-border-normal" : ""} ${channel === opt.id ? "bg-primary text-white" : "bg-bg-surface text-text-secondary hover:bg-bg-base"
                    }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-bold text-text-muted mt-1">يحدد أين يظهر هذا القالب كخيار جاهز عند إنشاء حملة</p>
          </div>
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block">نص الرسالة *</label>
            <textarea ref={bodyRef} rows={5} value={body} onChange={e => setBodyText(e.target.value)}
              placeholder="اكتب نص القالب... استخدم أزرار الإدراج لتخصيصه تلقائياً"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface resize-none transition-colors" />
          </div>
          <VariableChips onInsert={insertVar} />
          {body.trim() && (
            <div>
              <p className="text-[10px] font-black text-text-muted mb-1">معاينة:</p>
              <div className="rounded-xl rounded-br-md bg-success-bg border border-success-border px-4 py-3">
                <p className="text-sm font-bold text-text-primary whitespace-pre-wrap leading-relaxed">{renderMessagePreview(body, null)}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => onClose(false)} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base">
            إلغاء
          </button>
          <button onClick={save} disabled={!label.trim() || !body.trim() || saving || (!dirty && !template?.isNew)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {dirty || template?.isNew ? t("telegram.saveTemplate", "حفظ القالب") : t("telegram.saved", "محفوظ")}
          </button>
        </div>
      </div>
    </div>
  );
}
