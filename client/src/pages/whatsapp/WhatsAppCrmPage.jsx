import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageSquare, Wifi, WifiOff, Smartphone, RefreshCw, Link, Unlink, Send, Users,
  BarChart3, Inbox, Megaphone, FileText, ChevronDown, ChevronUp,
  Search, X, CheckCircle, AlertCircle, Clock, Zap, Info, Archive,
  MessageCircle, UserPlus,
  Bot, Check, Loader2, Image, Settings,
  Pause, Play, Trash2, Plus, Paperclip, Camera, Mic, MicOff,
  Download, Eye, File, FileType, Headphones, Maximize, Minimize,
  Upload, Reply, Smile, Copy,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import html2canvas from "html2canvas";
import LayoutRenderer from "../../components/print/LayoutRenderer";
import ConnectGuide from "../../components/whatsapp/ConnectGuide";

// ─── Shared components ───────────────────────────────────────────────────

function StatusDot({ status, size = "w-2 h-2" }) {
  const colors = {
    connected: "bg-success-text", sent: "bg-success-text", active: "bg-success-text",
    qr: "bg-warning-text", pending: "bg-warning-text",
    connecting: "bg-text-muted", loading: "bg-text-muted",
    disconnected: "bg-text-muted", failed: "bg-danger", error: "bg-danger",
    unavailable: "bg-danger", archived: "bg-text-muted",
  };
  return <span className={`inline-block ${size} rounded-full ${colors[status] || "bg-text-muted"}`} />;
}

const CONTACT_TYPE_BADGE = {
  customer: { text: "عميل", cls: "bg-info-bg text-info-text" },
  lead: { text: "عميل محتمل", cls: "bg-warning-bg text-warning-text" },
};
function ContactTypeBadge({ type, className = "" }) {
  const b = CONTACT_TYPE_BADGE[type] || { text: "رقم غير مسجل", cls: "bg-bg-base text-text-muted" };
  return <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${b.cls} ${className}`}>{b.text}</span>;
}

function StatCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <div className="rounded-xl border border-border-normal bg-bg-surface p-5 shadow-card hover:shadow-elevated transition-shadow">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-card" style={{ background: accent }}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black text-text-primary">{value ?? "—"}</p>
          <p className="text-xs font-bold text-text-secondary">{label}</p>
          {sub && <p className="text-[11px] font-bold text-text-muted">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, accent, open, onToggle, badge, children }) {
  return (
    <div className="rounded-xl border border-border-normal bg-bg-surface shadow-card overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-right hover:bg-bg-overlay transition-colors">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: accent }}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-black text-text-primary flex-1">{title}</span>
        {badge != null && badge !== false && (
          <span className="flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full bg-bg-surface text-text-secondary text-[11px] font-black">{badge}</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>
      {open && <div className="px-5 pb-5 pt-3 border-t border-border-subtle">{children}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-surface mb-4">
        <Icon className="h-8 w-8 text-text-muted" />
      </div>
      <p className="text-base font-black text-text-muted">{title}</p>
      {description && <p className="text-[13px] font-bold text-text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Invoice Preview (uses global print system) ──────────────────────────

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

function SendInvoiceModal({ phone, contactName, onClose }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [fullInvoice, setFullInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [sending, setSending] = useState(false);
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/api/invoices/by-phone", { params: { phone } });
        setInvoices(r.data?.data || []);
      } catch { } finally { setLoading(false); }
    })();
  }, [phone]);

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

  async function handleSend(invoiceId) {
    const inv = selectedInvoice || invoices.find(i => i.id === invoiceId);
    if (!inv) return;
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
      toast.success("تم إرسال الفاتورة");
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل إرسال الفاتورة");
    } finally { setSending(false); setSendingInvoiceId(null); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> إرسال فاتورة
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        {contactName && (
          <p className="text-xs font-bold text-text-secondary mb-4">إلى: <span className="text-text-primary">{contactName}</span></p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>
        ) : invoices.length === 0 ? (
          <EmptyState icon={FileText} title="لا توجد فواتير" description="لا توجد فواتير لهذا العميل" />
        ) : (
          <>
            <div className="space-y-2 mb-5 max-h-60 overflow-y-auto">
              {invoices.map(inv => (
                <button key={inv.id} onClick={() => selectInvoice(inv)}
                  className={`w-full text-right flex items-center justify-between p-3 rounded-xl border transition-all ${selectedInvoice?.id === inv.id ? "border-primary bg-primary-50" : "border-border-normal bg-bg-surface hover:border-border-strong"
                    }`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-text-primary">{inv.invoice_no || `#${inv.id}`}</p>
                    <p className="text-[11px] font-bold text-text-muted">{new Date(inv.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="text-left shrink-0 mr-3">
                    <p className="text-sm font-black text-text-primary">{Number(inv.total).toLocaleString("ar-EG")} ج</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-success-bg text-success-text" : inv.status === "partial" ? "bg-warning-bg text-warning-text" : "bg-bg-surface text-text-muted"
                      }`}>
                      {inv.status === "paid" ? "مدفوع" : inv.status === "partial" ? "مدفوع جزئياً" : "غير مدفوع"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {fullInvoice && (
              <div ref={previewRef} className="mb-5">
                <InvoicePreview invoice={fullInvoice} settings={settings} />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base transition-all">
                إلغاء
              </button>
              <button onClick={() => handleSend(selectedInvoice?.id)} disabled={!selectedInvoice || sending}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "جارٍ الإرسال..." : "إرسال الفاتورة"}
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [waStatus, setWaStatus] = useState({ status: "loading" });
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);

  const refreshConfig = useCallback(() => {
    api.get("/api/whatsapp/crm/config")
      .then(r => setSmsEnabled(Boolean(r.data?.data?.sms_enabled)))
      .catch(() => { });
    api.get("/api/telegram/config")
      .then(r => setTelegramEnabled(Boolean(r.data?.data?.enabled)))
      .catch(() => { });
  }, []);

  useEffect(() => { refreshConfig(); }, [refreshConfig]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [sr, wr] = await Promise.all([
        api.get("/api/whatsapp/crm/stats"),
        api.get("/api/whatsapp/engine-status"),
      ]);
      setStats(sr.data?.data || null);
      setWaStatus(wr.data?.data || { status: "unavailable" });
    } catch { setStats(null); } finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const isConnected = waStatus.status === "connected";
  const statusText = isConnected ? "متصل" : waStatus.status === "qr" ? "انتظار المسح" : waStatus.status === "connecting" ? "جارٍ الاتصال..." : "غير متصل";
  const bgStatus = isConnected ? "bg-success-text" : waStatus.status === "qr" ? "bg-warning-text" : "bg-text-muted";

  return (
    <div dir="rtl" className="flex h-full flex-col bg-bg-base">
      {/* ── Full-width Header ─────────────────────────────────── */}
      <div className="bg-primary text-white">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur shadow-elevated">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-black">مركز الرسائل والحملات</h1>
                <p className="text-[12px] font-bold text-white/80">تواصل مع عملائك عبر واتساب ورسائل SMS — محادثات وحملات وقوالب من مكان واحد</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-white/15 backdrop-blur">
                <span className={`inline-block w-2 h-2 rounded-full ${bgStatus} ${waStatus.status === "qr" ? "animate-pulse" : ""}`} />
                واتساب: {statusText}
                {isConnected && waStatus.phone && <span dir="ltr" className="text-white/70 mr-1">{waStatus.phone}</span>}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-white/15 backdrop-blur">
                <span className={`inline-block w-2 h-2 rounded-full ${smsEnabled ? "bg-white" : "bg-white/30"}`} />
                SMS: {smsEnabled ? "مفعّلة" : "غير مفعّلة"}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-white/15 backdrop-blur">
                <span className={`inline-block w-2 h-2 rounded-full ${telegramEnabled ? "bg-white" : "bg-white/30"}`} />
                {t("telegram.channelName")}: {telegramEnabled ? t("telegram.statusEnabled") : t("telegram.statusDisabled")}
              </div>
              <button onClick={fetchStats}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-all active:scale-95 backdrop-blur">
                <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Tab Bar ─────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-bg-surface border-b border-border-normal shadow-card">
        <div className="px-6">
          <div className="flex items-center gap-1 py-2">
            {TABS.map(tab => (
              <React.Fragment key={tab.id}>
                {tab.group === "alerts" && (
                  <span className="mx-1 h-6 w-px shrink-0 bg-border-normal" aria-hidden="true" />
                )}
                <button onClick={() => setActiveTab(tab.id)}
                  title={tab.group === "alerts" ? "تنبيهات للمالك فقط — مختلفة عن قنوات مراسلة العملاء" : undefined}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                      ? "bg-primary text-white shadow-card"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-base"
                    }`}>
                  <tab.icon className="h-4 w-4" />
                  {tab.id === "telegram" ? t("telegram.channelName") : tab.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === "dashboard" && <DashboardTab stats={stats} loading={statsLoading} waStatus={waStatus} smsEnabled={smsEnabled} telegramEnabled={telegramEnabled} onRefresh={fetchStats} onConfigChanged={refreshConfig} setActiveTab={setActiveTab} />}
          {activeTab === "inbox" && <InboxTab />}
          {activeTab === "marketing" && <MarketingTab smsEnabled={smsEnabled} />}
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "telegram" && <TelegramTab telegramEnabled={telegramEnabled} onConfigChanged={refreshConfig} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════

function DashboardTab({ stats, loading, waStatus, smsEnabled, telegramEnabled, onRefresh, onConfigChanged, setActiveTab }) {
  const { t } = useTranslation();
  const [linking, setLinking] = useState(false);
  const [engine, setEngine] = useState(waStatus);
  const [smsSetupOpen, setSmsSetupOpen] = useState(false);
  const [connectError, setConnectError] = useState(null);
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
    if (!window.confirm("هل أنت متأكد من فصل واتساب؟")) return;
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
    <div className="space-y-6">
      {/* ── Sending channels — one panel, both services, clear activation ── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-black text-text-primary">{t("messaging.channelsTitle")}</h2>
          <p className="text-[11px] font-bold text-text-muted">{t("messaging.channelsSubtitle")}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">

          {/* WhatsApp channel */}
          <div className={`relative overflow-hidden rounded-2xl border p-5 ${state === "connected" ? "bg-success-bg border-success-border"
              : state === "qr" ? "bg-warning-bg border-warning-border"
                : state === "error" ? "bg-danger-bg border-danger-border"
                  : "bg-bg-surface border-border-normal"
            }`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-card ${theme.bg} ${theme.badgeText}`}>
                {state === "connected" ? <Wifi className="h-5 w-5" /> :
                  state === "qr" ? <Smartphone className="h-5 w-5 animate-pulse" /> :
                    state === "connecting" ? <RefreshCw className="h-5 w-5 animate-spin" /> :
                      <WifiOff className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-text-primary">{t("whatsapp.title")}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${theme.badgeText} ${theme.bg}`}>{theme.text}</span>
                </div>
                <p className="text-[11px] font-bold text-text-muted mt-0.5">{t("whatsapp.desc")}</p>
                {state === "connected" && (
                  <p className="text-sm font-bold text-success-text font-mono mt-1" dir="ltr">{engine.phone ? `+${engine.phone}` : ""}</p>
                )}
                {isUnavailable && (
                  <p className="text-xs font-bold text-danger mt-1">تأكد من تشغيل التطبيق عبر Electron</p>
                )}
              </div>
              {!isUnavailable && (
                state !== "connected" ? (
                  <button onClick={handleLink} disabled={linking}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white shadow-card hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 min-w-[130px] justify-center">
                    {linking ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                    {linking ? t("whatsapp.connecting") : state === "qr" ? t("whatsapp.waitingScan") : t("whatsapp.title")}
                  </button>
                ) : (
                  <button onClick={handleUnlink}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl border border-danger-border bg-bg-surface px-4 py-2 text-xs font-black text-danger hover:bg-danger-bg transition-all active:scale-95">
                    <Unlink className="h-3.5 w-3.5" /> فصل
                  </button>
                )
              )}
            </div>

            {/* What you get — always visible, before or after connecting */}
            <div className="mt-3 flex flex-wrap gap-2">
              {t("whatsapp.connectedTags").split("|").map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-base text-[11px] font-bold text-text-secondary">
                  <Zap className="h-3 w-3 text-text-muted" />{tag}
                </span>
              ))}
            </div>

            {/* Loading / QR / Error states */}
            {!isUnavailable && state !== "connected" && (
              <div className="mt-4">
                {linking && state !== "qr" && (
                  <div className="rounded-xl bg-bg-base p-4 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm font-black text-text-primary">{t("whatsapp.connecting")}</p>
                    <p className="text-[11px] font-bold text-text-muted mt-1">{t("whatsapp.qrHint")}</p>
                  </div>
                )}

                {state === "qr" && engine.qr && (
                  <div className="rounded-xl border border-warning-border bg-bg-surface p-4">
                    <div className="flex flex-col items-center gap-3">
                      <img src={engine.qr} alt="QR" className="h-48 w-48 rounded-xl border-2 border-warning-border" />
                      <p className="text-sm font-black text-warning-text text-center">{t("whatsapp.waitingScan")}</p>
                      <p className="text-[11px] font-bold text-text-secondary text-center max-w-xs">{t("whatsapp.qrHint")}</p>
                      <p className="text-[10px] font-bold text-text-muted text-center">{t("whatsapp.qrRefreshing")}</p>
                    </div>
                  </div>
                )}

                {connectError && (
                  <div className="rounded-xl border border-danger-border bg-danger-bg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-danger">{t("whatsapp.connectFailed")}</p>
                        <p className="text-[11px] font-bold text-danger-text mt-1">{connectError}</p>
                        <p className="text-[11px] font-bold text-text-muted mt-2">{t("whatsapp.errorHint")}</p>
                        <button onClick={handleClearAndRetry}
                          className="mt-3 flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
                          <RefreshCw className="h-3.5 w-3.5" />
                          {t("whatsapp.clearSession")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {engine.error && !connectError && (
                  <div className="rounded-xl border border-danger-border bg-danger-bg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-danger">{t("whatsapp.connectFailed")}</p>
                        <p className="text-[11px] font-bold text-danger-text mt-1">{engine.error}</p>
                        <p className="text-[11px] font-bold text-text-muted mt-2">{t("whatsapp.errorHint")}</p>
                        <button onClick={handleClearAndRetry}
                          className="mt-3 flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
                          <RefreshCw className="h-3.5 w-3.5" />
                          {t("whatsapp.clearSession")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!linking && state !== "qr" && !connectError && !engine.error && (
                  <details className="rounded-xl bg-bg-base p-3">
                    <summary className="text-[11px] font-black text-text-secondary cursor-pointer list-none flex items-center gap-1.5">
                      <ChevronDown className="h-3 w-3" /> كيف أبدأ الربط؟
                    </summary>
                    <div className="mt-2.5">
                      <ConnectGuide channel="whatsapp" />
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* SMS channel */}
          <div className={`relative overflow-hidden rounded-2xl border p-5 ${smsEnabled ? "bg-success-bg border-success-border" : "bg-bg-surface border-border-normal"
            }`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-card text-white ${smsEnabled ? "bg-success-text" : "bg-text-muted"}`}>
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-text-primary">{t("sms.title")}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black text-white ${smsEnabled ? "bg-success-text" : "bg-text-muted"}`}>
                    {smsEnabled ? "مفعّلة" : "غير مفعّلة"}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-text-muted mt-0.5">{t("sms.desc")}</p>
              </div>
              <button onClick={() => setSmsSetupOpen(true)}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all active:scale-95 ${smsEnabled
                    ? "border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"
                    : "bg-primary text-white shadow-card hover:opacity-90"
                  }`}>
                {smsEnabled ? <Settings className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
                {smsEnabled ? "الإعدادات" : "تفعيل SMS"}
              </button>
            </div>

            {/* What you get — always visible, before or after activating */}
            <div className="mt-3 flex flex-wrap gap-2">
              {t("sms.connectedTags").split("|").map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-base text-[11px] font-bold text-text-secondary">
                  <Zap className="h-3 w-3 text-text-muted" />{tag}
                </span>
              ))}
            </div>
            {!smsEnabled && (
              <details className="mt-4 rounded-xl bg-bg-base p-3">
                <summary className="text-[11px] font-black text-text-secondary cursor-pointer list-none flex items-center gap-1.5">
                  <ChevronDown className="h-3 w-3" /> كيف أبدأ التفعيل؟
                </summary>
                <ol className="space-y-2 mt-2.5">
                  {t("sms.steps").split("|").map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] font-bold text-text-secondary">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>

          {/* Telegram channel */}
          <div className={`relative overflow-hidden rounded-2xl border p-5 ${telegramEnabled ? "bg-success-bg border-success-border" : "bg-bg-surface border-border-normal"
            }`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-card text-white ${telegramEnabled ? "bg-success-text" : "bg-text-muted"}`}>
                <Send className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-text-primary">{t("telegram.channelName")}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black text-white ${telegramEnabled ? "bg-success-text" : "bg-text-muted"}`}>
                    {telegramEnabled ? t("telegram.statusEnabled") : t("telegram.statusDisabled")}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-text-muted mt-0.5">{t("telegram.channelDesc")}</p>
              </div>
              <button onClick={() => setActiveTab("telegram")}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all active:scale-95 ${telegramEnabled
                    ? "border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base"
                    : "bg-primary text-white shadow-card hover:opacity-90"
                  }`}>
                {telegramEnabled ? <Settings className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
                {telegramEnabled ? t("telegram.settings") : t("telegram.activate")}
              </button>
            </div>

            {/* What you get — always visible, before or after activating */}
            <div className="mt-3 flex flex-wrap gap-2">
              {t("telegram.connectedTags").split("|").map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-base text-[11px] font-bold text-text-secondary">
                  <Zap className="h-3 w-3 text-text-muted" />{tag}
                </span>
              ))}
            </div>
            {!telegramEnabled && (
              <details className="mt-4 rounded-xl bg-bg-base p-3">
                <summary className="text-[11px] font-black text-text-secondary cursor-pointer list-none flex items-center gap-1.5">
                  <ChevronDown className="h-3 w-3" /> كيف أبدأ التفعيل؟
                </summary>
                <ol className="space-y-2 mt-2.5">
                  {t("telegram.steps").split("|").map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] font-bold text-text-secondary">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </div>
      </div>

      {smsSetupOpen && (
        <SmsSetupModal
          onClose={() => setSmsSetupOpen(false)}
          onSaved={() => { onConfigChanged?.(); }}
        />
      )}

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

            <SectionCard title="آخر 14 يوم" icon={BarChart3} accent="var(--success-text)" open={true} onToggle={() => { }}>
              <div className="mt-2">
                {stats.sentByDay?.length > 0 ? (
                  <div className="flex items-end gap-2 h-32">
                    {stats.sentByDay.map((d, i) => {
                      const max = Math.max(...stats.sentByDay.map(x => x.count), 1);
                      const h = (d.count / max) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[11px] font-black text-text-secondary">{d.count}</span>
                          <div className="w-full rounded-t-md bg-primary-200 hover:bg-primary transition-colors" style={{ height: `${Math.max(h, 5)}%` }} />
                          <span className="text-[9px] font-bold text-text-muted -rotate-45 origin-right whitespace-nowrap">
                            {d.day?.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={BarChart3} title="لا توجد إحصائيات بعد" description="عند إرسال الرسائل ستظهر هنا" />
                )}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <button onClick={() => setActiveTab("inbox")} className="flex items-center gap-3 rounded-xl border border-border-normal bg-bg-surface p-5 hover:border-primary hover:shadow-elevated transition-all text-right">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-bg text-info-text"><Inbox className="h-5 w-5" /></div>
              <div><p className="text-sm font-black text-text-primary">صندوق الوارد</p><p className="text-[11px] font-bold text-text-muted">{stats.unreadCount || 0} غير مقروءة</p></div>
            </button>
            <button onClick={() => setActiveTab("marketing")} className="flex items-center gap-3 rounded-xl border border-border-normal bg-bg-surface p-5 hover:border-primary hover:shadow-elevated transition-all text-right">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-bg text-success-text"><Megaphone className="h-5 w-5" /></div>
              <div><p className="text-sm font-black text-text-primary">العملاء والحملات</p><p className="text-[11px] font-bold text-text-muted">{stats.totalContacts} عميل — أرسل حملة جماعية</p></div>
            </button>
            <button onClick={() => setActiveTab("templates")} className="flex items-center gap-3 rounded-xl border border-border-normal bg-bg-surface p-5 hover:border-primary hover:shadow-elevated transition-all text-right">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-bg text-warning-text"><FileText className="h-5 w-5" /></div>
              <div><p className="text-sm font-black text-text-primary">القوالب</p><p className="text-[11px] font-bold text-text-muted">رسائل جاهزة للحملات والإرسال التلقائي</p></div>
            </button>
          </div>
        </>
      ) : (
        <EmptyState icon={BarChart3} title="تعذر تحميل الإحصائيات" description="تأكد من اتصال الخادم" action={
          <button onClick={onRefresh} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-white hover:opacity-90">إعادة المحاولة</button>
        } />
      )}
    </div>
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 mr-0.5" />}
      </button>
      <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
        <div className="h-full rounded-full bg-white/60 transition-all" style={{ width: `${progress}%` }} />
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

function InboxTab() {
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
    if (!window.confirm("حذف الرسالة؟")) return;
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
      ? "bg-primary text-white rounded-br-md"
      : "bg-bg-base text-text-primary rounded-bl-md";
    const reaction = reactions[msg.id || index];

    return (
      <div className={`flex ${isOut ? "justify-start" : "justify-end"} group animate-fade-in`}>
        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm font-bold leading-relaxed ${bubbleClass} relative`}>

          {/* Reply context (body starts with ↩) */}
          {msg.body?.startsWith("↩") && (
            <div className={`text-[10px] ${isOut ? "text-white/50" : "text-text-muted"} mb-1 border-r-2 ${isOut ? "border-white/30" : "border-primary/30"} pr-2 line-clamp-1`}>
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
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${isOut ? "hover:bg-white/20" : "hover:bg-bg-overlay"} transition-colors`}>
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
            {msg.direction === "outbound" && (
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
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border-normal bg-bg-base">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-sm font-black text-primary">
                  {currConv?.contact_name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-text-primary truncate flex items-center gap-1.5">
                    {currConv?.contact_name || selectedJid.split("@")[0]}
                    <ContactTypeBadge type={currConv?.contact_type} />
                  </p>
                  <p className="text-[11px] font-bold text-text-muted font-mono truncate" dir="ltr">{selectedJid.split("@")[0]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowContactInfo(prev => !prev)}
                    title="معلومات الاتصال"
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${showContactInfo ? "bg-primary-50 text-primary" : "text-text-muted hover:bg-bg-overlay"}`}>
                    <Info className="h-4 w-4" />
                  </button>
                  <button onClick={() => setShowInvoiceModal(true)}
                    title="إرسال فاتورة"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-primary-50 hover:text-primary transition-colors">
                    <FileText className="h-4 w-4" />
                  </button>
                  <button onClick={() => {
                    if (window.confirm("أرشفة المحادثة؟")) api.post(`/api/whatsapp/crm/conversations/${encodeURIComponent(selectedJid)}/archive`).then(() => {
                      setConversations(prev => prev.filter(c => c.remote_jid !== selectedJid));
                      setSelectedJid(null);
                      toast.success("تم الأرشفة");
                    });
                  }} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-bg-overlay transition-colors">
                    <Archive className="h-4 w-4" />
                  </button>
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
                  <div className="flex items-center gap-2 p-3 border-t border-border-normal relative">
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
                    <button onClick={handleSend} disabled={!sendText.trim() || sending || uploadingMedia || recording}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-40 transition-all active:scale-95">
                      {sending || uploadingMedia ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
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
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MARKETING TAB — contacts + campaigns merged: pick people, send campaigns,
//  and watch progress from one place.
// ═══════════════════════════════════════════════════════════════════════════

function MarketingTab({ smsEnabled }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOptedOut, setFilterOptedOut] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [sendInvoiceContact, setSendInvoiceContact] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const keyOf = (c) => `${c.type}-${c.id}`;

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { q: search || undefined };
      if (filterOptedOut === "opted_out") params.opted_out = "1";
      else if (filterOptedOut === "opted_in") params.marketing = "1";
      const r = await api.get("/api/whatsapp/crm/contacts", { params });
      setContacts(r.data?.data || []);
    } catch { } finally { setLoading(false); }
  }, [search, filterOptedOut]);

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const r = await api.get("/api/whatsapp/crm/campaigns");
      setCampaigns(r.data?.data || []);
    } catch { } finally { setCampaignsLoading(false); }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Poll campaign progress while any campaign is still sending
  useEffect(() => {
    if (!campaigns.some(c => c.status === "active" && Number(c.sent_count) < Number(c.total))) return;
    const t = setInterval(fetchCampaigns, 10000);
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

  async function setCampaignStatus(camp, status) {
    try {
      await api.put(`/api/whatsapp/crm/campaigns/${camp.id}`, { status });
      toast.success(status === "paused" ? "تم إيقاف الحملة مؤقتاً" : "تم استئناف الحملة");
      fetchCampaigns();
    } catch (e) { toast.error(e.response?.data?.message || "فشل تحديث الحملة"); }
  }

  async function deleteCampaign(camp) {
    if (!window.confirm(`حذف حملة «${camp.name || "بدون اسم"}»؟ ستتوقف الرسائل غير المرسلة.`)) return;
    try {
      await api.delete(`/api/whatsapp/crm/campaigns/${camp.id}`);
      toast.success("تم حذف الحملة وإيقاف رسائلها المعلقة");
      fetchCampaigns();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحذف"); }
  }

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
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl border border-border-normal bg-bg-surface px-4 py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base transition-all active:scale-95">
          <UserPlus className="h-4 w-4" /> إضافة جهة
        </button>
        <button onClick={() => { fetchContacts(); fetchCampaigns(); }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base">
          <RefreshCw className={`h-4 w-4 ${loading || campaignsLoading ? "animate-spin" : ""}`} />
        </button>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-black text-white shadow-card hover:opacity-90 transition-all active:scale-95">
          <Megaphone className="h-4 w-4" />
          {selected.size > 0 ? `حملة للمحددين (${selected.size})` : "حملة جديدة"}
        </button>
      </div>

      {/* ── Selection bar ──────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-50 px-4 py-2.5">
          <p className="text-xs font-black text-primary">تم تحديد {selected.size} جهة — الحملة القادمة ستُرسل لهم فقط</p>
          <button onClick={() => setSelected(new Set())}
            className="text-[11px] font-black text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors">
            مسح التحديد
          </button>
        </div>
      )}

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
                return (
                  <div key={camp.id} className="rounded-xl border border-border-normal bg-bg-surface p-4 shadow-card hover:shadow-elevated transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-black text-text-primary truncate">{camp.name || "بدون اسم"}</p>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${camp.channel === "sms" ? "bg-info-bg text-info-text" : "bg-success-bg text-success-text"
                            }`}>
                            {camp.channel === "sms" ? "SMS" : "واتساب"}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-text-muted mt-0.5">
                          {new Date(camp.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-black ${camp.status === "done" ? "bg-success-bg text-success-text"
                          : camp.status === "active" ? "bg-info-bg text-info-text"
                            : "bg-warning-bg text-warning-text"
                        }`}>
                        {camp.status === "done" ? "اكتملت" : camp.status === "active" ? "جارية" : "متوقفة"}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                        <span>أُرسل {sent} من {total}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-bg-base overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-2 line-clamp-1 leading-relaxed">
                      {camp.body?.slice(0, 80)}{camp.body?.length > 80 ? "..." : ""}
                    </p>
                    <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border-subtle">
                      {camp.status === "active" && sent < total && (
                        <button onClick={() => setCampaignStatus(camp, "paused")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning-bg text-warning-text text-[11px] font-black hover:opacity-80 transition-all active:scale-95">
                          <Pause className="h-3 w-3" /> إيقاف مؤقت
                        </button>
                      )}
                      {camp.status === "paused" && (
                        <button onClick={() => setCampaignStatus(camp, "active")}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success-bg text-success-text text-[11px] font-black hover:opacity-80 transition-all active:scale-95">
                          <Play className="h-3 w-3" /> استئناف
                        </button>
                      )}
                      <button onClick={() => deleteCampaign(camp)}
                        className="mr-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-danger text-[11px] font-black hover:bg-danger-bg transition-all active:scale-95">
                        <Trash2 className="h-3 w-3" /> حذف
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
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-black text-white">
                <UserPlus className="h-4 w-4" /> إضافة جهة اتصال
              </button>
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
                          {c.phone && (
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
            <div className="px-4 py-3 border-t border-border-normal bg-bg-base">
              <p className="text-xs font-bold text-text-muted">إجمالي {contacts.length} جهة اتصال{selected.size > 0 ? ` — محدد ${selected.size}` : ""}</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && <AddContactModal onClose={() => { setShowAddModal(false); fetchContacts(); }} />}
      {sendInvoiceContact && (
        <SendInvoiceModal
          phone={sendInvoiceContact.phone}
          contactName={sendInvoiceContact.name}
          onClose={() => setSendInvoiceContact(null)}
        />
      )}
      {createOpen && (
        <CreateCampaignModal
          smsEnabled={smsEnabled}
          preselected={selectedRows}
          onClose={(created) => {
            setCreateOpen(false);
            if (created) { setSelected(new Set()); fetchCampaigns(); }
          }}
        />
      )}
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay" onMouseDown={onClose}>
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

function CreateCampaignModal({ onClose, smsEnabled = false, preselected = [] }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [audienceMode, setAudienceMode] = useState(preselected.length ? "custom" : "customers");
  const [audience, setAudience] = useState([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateKind, setTemplateKind] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

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
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || undefined,
        body: body.trim(),
        channel,
        filters: { include: audienceMode },
      };
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay" onMouseDown={() => onClose(false)}>
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
              <p className="text-sm font-black text-text-primary">ماذا ستقول؟</p>
            </div>
            <div className="space-y-3">
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
              </div>
              <span className="text-[11px] font-bold text-text-muted">
                {channel === "sms" ? "مدفوعة — عبر بوابة المزوّد" : smsEnabled ? "مجانية — عبر حساب واتساب المربوط" : "SMS غير مفعّلة — فعّلها من لوحة التحكم"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={() => onClose(false)} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base">
            إلغاء
          </button>
          <button onClick={handleCreate} disabled={!body.trim() || !recipients.length || saving}
            className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {saving ? "جارٍ الإنشاء..." : `إرسال إلى ${recipients.length} مستلم عبر ${channel === "sms" ? "SMS" : "واتساب"}`}
          </button>
        </div>
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
  const [sms, setSms] = useState({ sms_enabled: false, sms_api_url: "", sms_api_key: "", sms_sender: "", sms_body_template: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get("/api/settings").then(r => {
      const d = r.data?.data || {};
      const loaded = {
        sms_enabled: Boolean(d.sms_enabled),
        sms_api_url: d.sms_api_url || "",
        sms_api_key: d.sms_api_key || "",
        sms_sender: d.sms_sender || "",
        sms_body_template: d.sms_body_template || "",
      };
      setSms(loaded);
      setSaved(loaded.sms_enabled && Boolean(loaded.sms_api_url));
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, []);

  async function save() {
    if (sms.sms_enabled && !sms.sms_api_url.trim()) {
      toast.error("أدخل رابط بوابة الإرسال أولاً");
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/settings", sms);
      setSaved(sms.sms_enabled && Boolean(sms.sms_api_url.trim()));
      toast.success(sms.sms_enabled ? "تم تفعيل خدمة SMS — جرّب الإرسال لرقمك" : "تم حفظ الإعدادات");
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الحفظ"); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      await api.post("/api/whatsapp/sms-test", { phone: testPhone.trim() });
      toast.success("وصلت؟ ✓ تم الإرسال عبر بوابة SMS بنجاح");
    } catch (e) { toast.error(e.response?.data?.message || "فشل إرسال الرسالة التجريبية"); }
    finally { setTesting(false); }
  }

  const StepBadge = ({ n, done }) => (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${done ? "bg-success-text text-white" : "bg-primary text-white"
      }`}>
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay" onMouseDown={onClose}>
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

function TelegramTab({ telegramEnabled, onConfigChanged }) {
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

  // Generate a connect deep-link + QR for the store's own bot (username derived
  // from the token server-side). The owner scans it from their phone.
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

  // While the QR is showing and we haven't captured a chat yet, poll for the
  // owner's /start tap and auto-fill the chat id (no manual copy needed).
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
      onConfigChanged?.();
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

  const StepBadge = ({ n, done }) => (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${done ? "bg-success-text text-white" : "bg-primary text-white"
      }`}>
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  );

  function Toggle({ label, hint, checked, onChange, disabled }) {
    return (
      <label className={`block rounded-lg border border-border-normal bg-bg-input px-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-text-primary">{label}</span>
          <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
            className="h-4 w-4 rounded border-border-normal text-primary focus:ring-primary" />
        </div>
        {hint && <p className="mt-1 text-[11px] font-bold text-text-muted">{hint}</p>}
      </label>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-16"><RefreshCw className="h-8 w-8 animate-spin text-text-muted" /></div>;
  if (loadError) return <EmptyState icon={Settings} title={t("telegram.loadError")} description={t("telegram.loadError")} />;

  return (
    <div className="space-y-5">
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
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column — settings */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1 — bot credentials */}
          <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2.5 mb-4">
              <StepBadge n="١" done={Boolean(config.telegram_bot_token.trim()) && Boolean(config.telegram_chat_id.trim())} />
              <div>
                <p className="text-sm font-black text-text-primary">{t("telegram.step1")}</p>
                <p className="text-[11px] font-bold text-text-muted">{t("telegram.step1Hint")}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-text-secondary mb-1.5 block">{t("telegram.botToken")} *</label>
                <input type="password" dir="ltr" value={config.telegram_bot_token}
                  onChange={e => setConfig(c => ({ ...c, telegram_bot_token: e.target.value }))}
                  placeholder={t("telegram.botTokenPlaceholder")}
                  className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
              </div>

              {/* Easy connect — generate a QR the owner scans from their phone */}
              <div className={`rounded-xl border p-4 ${scanConnected ? "border-success-border bg-success-bg" : "border-primary/40 bg-bg-base"}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-black text-text-primary flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-primary" /> {t("telegram.easyConnectTitle")}
                  </p>
                  <button type="button" onClick={generateDeepLink} disabled={generatingQr || !config.telegram_bot_token.trim()}
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                    {generatingQr ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                    {qrData ? t("telegram.regenerateQr") : t("telegram.generateQr")}
                  </button>
                </div>
                {!qrData && <p className="text-[11px] font-bold text-text-muted">{t("telegram.easyConnectHint")}</p>}
                {qrData && (
                  scanConnected ? (
                    <div className="flex items-center gap-2 text-success-text">
                      <Check className="h-5 w-5" />
                      <span className="text-xs font-black">{t("telegram.scanConnected")}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5">
                      <img src={qrData.qr} alt="QR" className="h-44 w-44 rounded-xl border-2 border-primary/40" />
                      <p className="text-[11px] font-black text-text-primary text-center max-w-xs">{t("telegram.scanHint")}</p>
                      <p className="text-[10px] font-bold text-text-muted text-center">{t("telegram.groupHint")}</p>
                      <a href={qrData.url} target="_blank" rel="noreferrer" dir="ltr"
                        className="text-[11px] font-black text-primary underline break-all text-center">{t("telegram.fallbackLink")}</a>
                    </div>
                  )
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-text-secondary mb-1.5 block">{t("telegram.chatId")} *</label>
                  <div className="flex gap-1.5">
                    <input type="text" dir="ltr" value={config.telegram_chat_id}
                      onChange={e => setConfig(c => ({ ...c, telegram_chat_id: e.target.value }))}
                      placeholder={t("telegram.chatIdPlaceholder")}
                      className="flex-1 min-w-0 rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
                    <button type="button" onClick={detectChatId} disabled={detecting || !config.telegram_bot_token.trim()}
                      title={t("telegram.detectHint")}
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-border-normal bg-bg-surface px-3 py-2.5 text-[11px] font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95">
                      {detecting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      {t("telegram.detectButton")}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-text-secondary mb-1.5 block">{t("telegram.apiBase")}</label>
                  <input type="url" dir="ltr" value={config.telegram_api_base}
                    onChange={e => setConfig(c => ({ ...c, telegram_api_base: e.target.value }))}
                    placeholder={t("telegram.apiBasePlaceholder")}
                    className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-xs font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
                </div>
              </div>
              <details className="group">
                <summary className="text-[11px] font-black text-text-muted cursor-pointer hover:text-text-secondary transition-colors list-none flex items-center gap-1">
                  <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                  {t("telegram.guideTitle")}
                </summary>
                <div className="mt-2 rounded-lg bg-bg-base p-3">
                  <ConnectGuide channel="telegram" />
                </div>
              </details>
            </div>
          </div>

          {/* Step 2 — event toggles */}
          <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2.5 mb-4">
              <StepBadge n="٢" done={saved} />
              <p className="text-sm font-black text-text-primary">{t("telegram.step2")}</p>
            </div>
            <div className="space-y-2">
              <Toggle label={t("telegram.toggleNewInvoice")} checked={config.telegram_notify_new_invoice} onChange={e => setConfig(c => ({ ...c, telegram_notify_new_invoice: e.target.checked }))} />
              <Toggle label={t("telegram.toggleDailyClose")} checked={config.telegram_notify_daily_close} onChange={e => setConfig(c => ({ ...c, telegram_notify_daily_close: e.target.checked }))} />
              <Toggle label={t("telegram.toggleLargeAmounts")} checked={config.telegram_notify_large_amounts} onChange={e => setConfig(c => ({ ...c, telegram_notify_large_amounts: e.target.checked }))} />
              <Toggle label={t("telegram.toggleReturnsVoids")} checked={config.telegram_notify_returns_voids} onChange={e => setConfig(c => ({ ...c, telegram_notify_returns_voids: e.target.checked }))} />
              <Toggle label={t("telegram.togglePurchasesPayments")} checked={config.telegram_notify_purchases_payments} onChange={e => setConfig(c => ({ ...c, telegram_notify_purchases_payments: e.target.checked }))} />
              <Toggle label={t("telegram.toggleLowStock")} checked={config.telegram_notify_low_stock} onChange={e => setConfig(c => ({ ...c, telegram_notify_low_stock: e.target.checked }))} />
              <Toggle label={t("telegram.toggleSystem")} hint={t("telegram.toggleSystemHint")} checked={config.telegram_notify_system} onChange={e => setConfig(c => ({ ...c, telegram_notify_system: e.target.checked }))} />
            </div>
            {/* Scheduled analytics digests */}
            <div className="mt-4 pt-4 border-t border-border-normal">
              <p className="text-xs font-black text-text-primary mb-1">{t("telegram.digestsTitle")}</p>
              <p className="text-[11px] font-bold text-text-muted mb-2.5">{t("telegram.digestsHint")}</p>
              <div className="space-y-2">
                <Toggle label={t("telegram.toggleWeekly")} checked={config.telegram_notify_weekly} onChange={e => setConfig(c => ({ ...c, telegram_notify_weekly: e.target.checked }))} />
                <Toggle label={t("telegram.toggleMonthly")} checked={config.telegram_notify_monthly} onChange={e => setConfig(c => ({ ...c, telegram_notify_monthly: e.target.checked }))} />
                <Toggle label={t("telegram.toggleYearly")} checked={config.telegram_notify_yearly} onChange={e => setConfig(c => ({ ...c, telegram_notify_yearly: e.target.checked }))} />
              </div>
            </div>
          </div>

          {/* Step 3 — enable + save + test */}
          <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2.5 mb-4">
              <StepBadge n="٣" done={saved} />
              <p className="text-sm font-black text-text-primary">{t("telegram.step3")}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <label className="flex flex-1 items-center justify-between rounded-lg border border-border-normal bg-bg-input px-4 py-3 cursor-pointer">
                <span className="text-xs font-black text-text-primary">{t("telegram.enable")}</span>
                <input type="checkbox" checked={config.telegram_enabled}
                  onChange={e => setConfig(c => ({ ...c, telegram_enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-border-normal text-primary focus:ring-primary" />
              </label>
              <button onClick={save} disabled={saving}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("telegram.save")}
              </button>
              <button onClick={sendTest} disabled={testing || !saved}
                title={!saved ? t("telegram.testTooltip") : t("telegram.step4")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border-normal bg-bg-surface px-6 py-3 text-xs font-black text-text-secondary hover:bg-bg-base disabled:opacity-50 transition-all active:scale-95">
                {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("telegram.test")}
              </button>
            </div>
            {!saved && (
              <p className="mt-3 text-[11px] font-bold text-text-muted">{t("telegram.step4Hint")}</p>
            )}
          </div>
        </div>

        {/* Right column — info */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
            <h3 className="text-sm font-black text-text-primary mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> {t("telegram.infoTitle")}
            </h3>
            <ul className="space-y-2 text-[11px] font-bold text-text-secondary leading-relaxed">
              <li className="flex items-start gap-2"><span className="text-primary">•</span><span>{t("telegram.info1")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary">•</span><span>{t("telegram.info2")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary">•</span><span>{t("telegram.info3")}</span></li>
              <li className="flex items-start gap-2"><span className="text-primary">•</span><span>{t("telegram.info4")}</span></li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border-normal bg-bg-surface p-5 shadow-card">
            <h3 className="text-sm font-black text-text-primary mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning-text" /> {t("telegram.eventsTitle")}
            </h3>
            <ul className="space-y-2 text-[11px] font-bold text-text-secondary leading-relaxed">
              {t("telegram.eventsList").split("|").map((item, i) => (
                <li key={i} className="flex items-start gap-2"><Check className="h-3 w-3 text-success-text shrink-0 mt-0.5" /><span>{item}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
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
  telegram_new_invoice: {
    label: "فاتورة مبيعات جديدة", hint: "تنبيه فوري بكل فاتورة بيع", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{customer_name}", label: "اسم العميل" },
      { token: "{total}", label: "الإجمالي" }, { token: "{payment_type}", label: "طريقة الدفع" }, { token: "{created_at}", label: "التوقيت" },
    ]
  },
  telegram_daily_close: {
    label: "إغلاق يومية", hint: "ملخص عند إغلاق اليومية", vars: [
      { token: "{date}", label: "التاريخ" }, { token: "{opening_balance}", label: "الرصيد الافتتاحي" },
      { token: "{cash_sales}", label: "المبيعات النقدية" }, { token: "{credit_sales}", label: "المبيعات الآجلة" },
      { token: "{expected_cash}", label: "الرصيد المتوقع" }, { token: "{actual_cash}", label: "الرصيد الفعلي" },
      { token: "{discrepancy}", label: "الفرق" }, { token: "{invoices_count}", label: "عدد الفواتير" },
    ]
  },
  telegram_shift_close: {
    label: "إغلاق وردية", hint: "ملخص عند إغلاق وردية كاشير", vars: [
      { token: "{shift_id}", label: "رقم الوردية" }, { token: "{opening_cash}", label: "الرصيد الافتتاحي" },
      { token: "{expected_cash}", label: "الرصيد المتوقع" }, { token: "{closing_cash}", label: "الرصيد الفعلي" },
      { token: "{discrepancy}", label: "الفرق" }, { token: "{invoices_count}", label: "عدد الفواتير" },
    ]
  },
  telegram_large_invoice: {
    label: "فاتورة بمبلغ كبير", hint: "تنبيه عند تجاوز الفاتورة حداً معيناً", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{customer_name}", label: "اسم العميل" }, { token: "{total}", label: "الإجمالي" },
    ]
  },
  telegram_large_discount: {
    label: "خصم كبير", hint: "تنبيه عند تطبيق خصم كبير", vars: [
      { token: "{invoice_no}", label: "رقم الفاتورة" }, { token: "{discount_percent}", label: "نسبة الخصم" },
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
};
const WHATSAPP_CATEGORIES = ["receipt", "return_receipt", "birthday", "debt"];
const TELEGRAM_CATEGORIES = [
  "telegram_new_invoice", "telegram_daily_close", "telegram_shift_close", "telegram_large_invoice",
  "telegram_large_discount", "telegram_sales_return", "telegram_invoice_voided", "telegram_purchase_created",
  "telegram_customer_payment", "telegram_low_stock", "telegram_backup_result", "telegram_failed_login",
];

const DEFAULT_BODIES = {
  "receipt|قياسي — مفصل": `مرحباً {name}،

🛍️ فاتورة شراء
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
};

function renderCategoryPreview(body, vars) {
  return (vars || []).reduce((acc, v) => acc.replaceAll(v.token, `«${v.label}»`), body || "");
}

function renderFakePreview(body) {
  if (!body) return "";
  const fakeItemsTable = `━━━ الأصناف ━━━
• منتج ١
  ٣ × ١٠٠ = ٣٠٠
• منتج ٢
  ٢ × ٢٠٠ = ٤٠٠
━━━━━━━━━━━━━━━━`;
  const fakePaymentBreakdown = `نقداً: ١٥٠ جنيه\nبطاقة: ١٠٠ جنيه`;
  const fakeMap = {
    "{name}": "أحمد محمد",
    "{invoice_no}": "INV-20260710-0001",
    "{total}": "٢٥٠",
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
  };
  return body.replace(/\{(\w+)\}/g, (_, key) => fakeMap[`{${key}}`] || `{${key}}`);
}

function TemplatesTab() {
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

    return (
      <div className="rounded-xl border border-border-normal bg-bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-bg text-warning-text shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-black text-text-primary">{meta.label}</p>
              <ChannelBadge channel={category.startsWith("telegram_") ? "telegram" : "whatsapp"} />
            </div>
            <p className="text-[11px] font-bold text-text-muted">{meta.hint}</p>
          </div>
        </div>
        <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap rounded-lg bg-bg-base p-3 font-mono mb-3 max-h-36 overflow-y-auto">
          {active ? renderFakePreview(active.body) : "—"}
        </div>
        {catVariants.length > 1 && (
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-text-muted">{catVariants.length} قالب{catVariants.length !== 1 ? "ات" : ""} محفوظ</span>
          <button onClick={() => setManageCategory(category)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-base text-text-secondary text-[11px] font-black hover:bg-bg-overlay transition-all active:scale-95">
            <Settings className="h-3.5 w-3.5" /> إدارة القوالب
          </button>
        </div>
      </div>
    );
  }

  async function deleteCustom(tpl) {
    if (!window.confirm(`حذف قالب «${tpl.label || tpl.kind}»؟`)) return;
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
          <button onClick={() => setEditor("new")}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
            <Plus className="h-4 w-4" /> قالب جديد
          </button>
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
                  <button onClick={() => setEditor(tpl)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-bg-base text-text-secondary text-[11px] font-black hover:bg-bg-overlay transition-all active:scale-95">
                    تعديل
                  </button>
                  <button onClick={() => deleteCustom(tpl)}
                    className="mr-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-danger text-[11px] font-black hover:bg-danger-bg transition-all active:scale-95">
                    <Trash2 className="h-3 w-3" /> حذف
                  </button>
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
    </div>
  );
}

// ─── Category template manager — list variants, activate/edit/delete, add new ──
function CategoryManagerModal({ category, variants, onClose, onChanged }) {
  const meta = CATEGORY_META[category];
  const [editor, setEditor] = useState(null); // null | "new" | variant row
  const [busyId, setBusyId] = useState(null);

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
    if (!window.confirm(`حذف قالب «${variant.label || "بدون اسم"}»؟`)) return;
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
    if (!window.confirm(`استعادة القالب «${variant.label}» إلى الإعدادات الافتراضية؟`)) return;
    setBusyId(variant.id);
    try {
      await api.put(`/api/whatsapp/crm/template-variants/${variant.id}`, { label: variant.label, body: defaultBody });
      toast.success("تمت الاستعادة");
      onChanged();
    } catch (e) { toast.error(e.response?.data?.message || "فشل الاستعادة"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay" onMouseDown={onClose}>
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
                  <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap rounded-lg bg-white p-3 font-mono max-h-48 overflow-y-auto border border-border-subtle shadow-sm">
                    {renderFakePreview(v.body)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {editor && (
          <CategoryVariantEditorModal
            category={category}
            variant={editor === "new" ? null : editor}
            onClose={(changed) => { setEditor(null); if (changed) onChanged(); }}
          />
        )}
      </div>
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
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-bg-overlay" onMouseDown={() => onClose(false)}>
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
          <button onClick={save} disabled={!body.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            حفظ القالب
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay" onMouseDown={() => onClose(false)}>
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
          <button onClick={save} disabled={!label.trim() || !body.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            حفظ القالب
          </button>
        </div>
      </div>
    </div>
  );
}
