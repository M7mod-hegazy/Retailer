import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageSquare, Wifi, WifiOff, Smartphone, RefreshCw, Link, Unlink, Send, Users,
  BarChart3, Inbox, Megaphone, FileText, ChevronDown, ChevronUp,
  Search, X, CheckCircle, AlertCircle, Clock, Zap, Info, Archive,
  MessageCircle, UserPlus,
  Bot, Check, Loader2, Image,
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import LayoutRenderer from "../../components/print/LayoutRenderer";

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
      } catch {} finally { setLoading(false); }
    })();
  }, [phone]);

  async function selectInvoice(invoice) {
    setSelectedInvoice(invoice);
    setFullInvoice(null);
    try {
      const [ir, sr] = await Promise.all([
        api.get(`/api/invoices/${invoice.id}`),
        api.get("/api/print-settings-per-doc/sales_invoice"),
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
          api.get("/api/print-settings-per-doc/sales_invoice"),
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
                  className={`w-full text-right flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedInvoice?.id === inv.id ? "border-primary bg-primary-50" : "border-border-normal bg-bg-surface hover:border-border-strong"
                  }`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-text-primary">{inv.invoice_no || `#${inv.id}`}</p>
                    <p className="text-[11px] font-bold text-text-muted">{new Date(inv.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="text-left shrink-0 mr-3">
                    <p className="text-sm font-black text-text-primary">{Number(inv.total).toLocaleString("ar-EG")} ج</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      inv.status === "paid" ? "bg-success-bg text-success-text" : inv.status === "partial" ? "bg-warning-bg text-warning-text" : "bg-bg-surface text-text-muted"
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
  { id: "contacts", label: "جهات الاتصال", icon: Users },
  { id: "campaigns", label: "الحملات", icon: Megaphone },
  { id: "templates", label: "القوالب", icon: FileText },
];

export default function WhatsAppCrmPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [waStatus, setWaStatus] = useState({ status: "loading" });

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
                <h1 className="text-lg font-black">واتساب للأعمال</h1>
                <p className="text-[12px] font-bold text-white/80">منصة متكاملة لإدارة العملاء والتواصل عبر واتساب</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-white/15 backdrop-blur">
                <span className={`inline-block w-2 h-2 rounded-full ${bgStatus} ${waStatus.status === "qr" ? "animate-pulse" : ""}`} />
                {statusText}
                {isConnected && waStatus.phone && <span dir="ltr" className="text-white/70 mr-1">{waStatus.phone}</span>}
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
          <div className="flex gap-1 py-2">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-card"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-base"
                }`}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === "dashboard" && <DashboardTab stats={stats} loading={statsLoading} waStatus={waStatus} onRefresh={fetchStats} setActiveTab={setActiveTab} />}
          {activeTab === "inbox" && <InboxTab />}
          {activeTab === "contacts" && <ContactsTab />}
          {activeTab === "campaigns" && <CampaignsTab />}
          {activeTab === "templates" && <TemplatesTab />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════

function DashboardTab({ stats, loading, waStatus, onRefresh, setActiveTab }) {
  const [linking, setLinking] = useState(false);
  const [engine, setEngine] = useState(waStatus);
  const pollRef = useRef(null);

  useEffect(() => { setEngine(waStatus); }, [waStatus]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (["connecting", "qr"].includes(engine.status)) {
      pollRef.current = setInterval(async () => {
        try {
          const r = await api.get("/api/whatsapp/engine-status");
          setEngine(r.data?.data || { status: "unavailable" });
        } catch {}
      }, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [engine.status]);

  async function handleLink() {
    setLinking(true);
    try {
      await api.post("/api/whatsapp/engine-connect");
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الاتصال");
    } finally { setLinking(false); }
  }

  async function handleUnlink() {
    if (!window.confirm("هل أنت متأكد من فصل واتساب؟")) return;
    try {
      await api.post("/api/whatsapp/engine-disconnect");
      setEngine({ status: "disconnected" });
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الفصل");
    }
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
      {/* Connection hero */}
      <div className={`relative overflow-hidden rounded-2xl border p-6 ${
        state === "connected" ? "bg-success-bg border-success-border"
        : state === "qr" ? "bg-warning-bg border-warning-border"
        : "bg-bg-surface border-border-normal"
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-elevated ${theme.bg} ${theme.badgeText}`}>
              {state === "connected" ? <Wifi className="h-6 w-6" /> :
               state === "qr" ? <Smartphone className="h-6 w-6 animate-pulse" /> :
               state === "connecting" ? <RefreshCw className="h-6 w-6 animate-spin" /> :
               <WifiOff className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-text-primary">حالة الاتصال</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${theme.badgeText} ${theme.bg}`}>{theme.text}</span>
                </div>
                <p className="text-xs font-bold text-text-muted">حالة اتصال واتساب وإحصائيات سريعة</p>
              {state === "connected" ? (
                <p className="text-sm font-bold text-success-text font-mono mt-1" dir="ltr">{engine.phone ? `+${engine.phone}` : "متصل"}</p>
              ) : state === "qr" ? (
                <p className="text-xs font-bold text-warning-text mt-1 animate-pulse">افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز جديد</p>
              ) : isUnavailable ? (
                <p className="text-xs font-bold text-danger mt-1">تأكد من تشغيل التطبيق عبر Electron</p>
              ) : (
                <p className="text-xs font-bold text-text-muted mt-1">اربط حسابك لبدء إرسال الرسائل</p>
              )}
            </div>
          </div>

          {!isUnavailable && (
            <div className="flex items-center gap-2 shrink-0">
              {state !== "connected" ? (
                <button onClick={handleLink} disabled={linking || state === "connecting" || state === "qr"}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-elevated hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
                  <Link className="h-4 w-4" />
                  {state === "qr" ? "في انتظار..." : "ربط واتساب"}
                </button>
              ) : (
                <button onClick={handleUnlink}
                  className="flex items-center gap-2 rounded-xl border border-danger-border bg-bg-surface px-5 py-2.5 text-sm font-black text-danger hover:bg-danger-bg transition-all active:scale-95">
                  <Unlink className="h-4 w-4" /> فصل
                </button>
              )}
            </div>
          )}
        </div>

        {state === "qr" && engine.qr && (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-warning-border bg-bg-surface p-6">
            <img src={engine.qr} alt="QR" className="h-48 w-48 rounded-lg border border-border-normal" />
            <p className="text-xs font-bold text-text-secondary">امسح الرمز من تطبيق واتساب لربط الحساب</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "الجلسة محفوظة — لا تحتاج QR عند كل تشغيل",
            "الرد بكلمة 'إلغاء' يوقف الرسائل التسويقية تلقائياً",
            "حتى 200 رسالة يومياً مع فاصل 8–20 ثانية",
          ].map(t => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-base text-[11px] font-bold text-text-secondary">
              <Zap className="h-3 w-3 text-text-muted" />{t}
            </span>
          ))}
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
            <SectionCard title="آخر النشاطات" icon={Clock} accent="var(--primary)" open={true} onToggle={() => {}}>
              <div className="space-y-1.5 mt-2 max-h-72 overflow-y-auto">
                {stats.recentMessages?.length > 0 ? stats.recentMessages.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-bg-overlay transition-colors">
                    <StatusDot status={m.direction === "inbound" ? "connected" : "sent"} />
                    <span className={`text-xs font-bold ${m.direction === "inbound" ? "text-success-text" : "text-primary"} shrink-0 w-14`}>
                      {m.direction === "inbound" ? "وارد" : "صادر"}
                    </span>
                    <span className="text-xs font-bold text-text-muted w-24 truncate shrink-0">{m.contact_name || m.remote_jid?.split("@")[0]}</span>
                    <span className="text-xs font-bold text-text-primary flex-1 truncate">{m.body || "—"}</span>
                    <span className="text-[11px] text-text-muted shrink-0">{m.created_at ? new Date(m.created_at).toLocaleDateString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}</span>
                  </div>
                )) : (
                  <EmptyState icon={MessageSquare} title="لا توجد رسائل بعد" description="عند بدء المحادثات ستظهر هنا" />
                )}
              </div>
            </SectionCard>

            <SectionCard title="آخر 14 يوم" icon={BarChart3} accent="var(--success-text)" open={true} onToggle={() => {}}>
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
            <button onClick={() => setActiveTab("campaigns")} className="flex items-center gap-3 rounded-xl border border-border-normal bg-bg-surface p-5 hover:border-primary hover:shadow-elevated transition-all text-right">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-bg text-success-text"><Megaphone className="h-5 w-5" /></div>
              <div><p className="text-sm font-black text-text-primary">حملة جديدة</p><p className="text-[11px] font-bold text-text-muted">أرسل رسائل جماعية</p></div>
            </button>
            <button onClick={() => setActiveTab("contacts")} className="flex items-center gap-3 rounded-xl border border-border-normal bg-bg-surface p-5 hover:border-primary hover:shadow-elevated transition-all text-right">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-bg text-warning-text"><UserPlus className="h-5 w-5" /></div>
              <div><p className="text-sm font-black text-text-primary">جهات الاتصال</p><p className="text-[11px] font-bold text-text-muted">{stats.totalContacts} عميل، {stats.totalLeads} عميل محتمل</p></div>
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
//  INBOX TAB
// ═══════════════════════════════════════════════════════════════════════════

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

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/whatsapp/crm/conversations");
      setConversations(r.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const selectConversation = useCallback(async (jid) => {
    setSelectedJid(jid);
    setMessagesLoading(true);
    try {
      await api.post(`/api/whatsapp/crm/conversations/${encodeURIComponent(jid)}/read`);
      const r = await api.get(`/api/whatsapp/crm/conversations/${encodeURIComponent(jid)}/messages`);
      setMessages(r.data?.data || []);
      setConversations(prev => prev.map(c => c.remote_jid === jid ? { ...c, unread_count: 0 } : c));
    } catch {} finally { setMessagesLoading(false); }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!sendText.trim() || !selectedJid || sending) return;
    setSending(true);
    try {
      await api.post("/api/whatsapp/crm/send", { jid: selectedJid, text: sendText.trim() });
      setMessages(prev => [...prev, {
        direction: "outbound", body: sendText.trim(), message_type: "text",
        status: "sent", created_at: new Date().toISOString(),
      }]);
      setSendText("");
      setConversations(prev => prev.map(c => c.remote_jid === selectedJid ? {
        ...c, last_message: sendText.trim(), last_message_at: new Date().toISOString(), last_direction: "outbound",
      } : c));
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الإرسال");
    } finally { setSending(false); }
  }

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
                  className={`w-full text-right px-4 py-3 border-b border-border-subtle hover:bg-bg-overlay transition-colors ${
                    selectedJid === conv.remote_jid ? "bg-primary-50 border-r-2 border-r-primary" : ""
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-base text-sm font-black text-text-secondary">
                      {(conv.contact_name || conv.phone_normalized || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-text-primary truncate">{conv.contact_name || conv.phone_normalized}</span>
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
        <div className="flex-1 flex flex-col">
          {selectedJid ? (
            <>
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border-normal bg-bg-base">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-sm font-black text-primary">
                  {currConv?.contact_name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-text-primary truncate">{currConv?.contact_name || selectedJid.split("@")[0]}</p>
                  <p className="text-[11px] font-bold text-text-muted font-mono truncate" dir="ltr">{selectedJid.split("@")[0]}</p>
                </div>
                <div className="flex items-center gap-1">
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

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-text-muted" /></div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="h-10 w-10 text-text-muted mb-2" />
                    <p className="text-sm font-bold text-text-muted">لا توجد رسائل بعد</p>
                    <p className="text-xs text-text-muted">أرسل أول رسالة لبدء المحادثة</p>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.direction === "outbound" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm font-bold leading-relaxed ${
                        msg.direction === "outbound"
                          ? "bg-primary text-white rounded-br-md"
                          : "bg-bg-base text-text-primary rounded-bl-md"
                      }`}>
                        {msg.message_type === "image" ? (
                          <div className="flex items-center gap-2 text-white/80">
                            <Image className="h-4 w-4" />
                            <span>صورة</span>
                          </div>
                        ) : (
                          <p>{msg.body}</p>
                        )}
                        <div className={`flex items-center gap-1 mt-1 ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                          <span className={`text-[10px] ${msg.direction === "outbound" ? "text-white/60" : "text-text-muted"}`}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}
                          </span>
                          {msg.direction === "outbound" && (
                            <span className="text-[10px] text-white/60">{msg.status === "sent" ? "✓" : msg.status === "delivered" ? "✓✓" : "⏳"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex items-center gap-2 p-3 border-t border-border-normal">
                <button onClick={() => setShowInvoiceModal(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary hover:bg-primary/20 transition-all active:scale-95"
                  title="إرسال فاتورة">
                  <FileText className="h-4 w-4" />
                </button>
                <input type="text" value={sendText} onChange={e => setSendText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="اكتب رسالتك..." dir="rtl"
                  className="flex-1 rounded-xl border border-border-normal bg-bg-input px-4 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors placeholder:text-text-muted" />
                <button onClick={handleSend} disabled={!sendText.trim() || sending}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-40 transition-all active:scale-95">
                  {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={MessageCircle} title="اختر محادثة" description="اختر محادثة من القائمة لعرض الرسائل وإرسال الفواتير" />
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
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONTACTS TAB
// ═══════════════════════════════════════════════════════════════════════════

function ContactsTab() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOptedOut, setFilterOptedOut] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [sendInvoiceContact, setSendInvoiceContact] = useState(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { q: search || undefined };
      if (filterOptedOut === "opted_out") params.opted_out = "1";
      else if (filterOptedOut === "opted_in") params.marketing = "1";
      const r = await api.get("/api/whatsapp/crm/contacts", { params });
      setContacts(r.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, [search, filterOptedOut]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[250px]">
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
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
          <UserPlus className="h-4 w-4" /> إضافة جهة
        </button>
        <button onClick={fetchContacts}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-normal bg-bg-surface text-text-secondary hover:bg-bg-base">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="rounded-xl border border-border-normal bg-bg-surface shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>
        ) : contacts.length === 0 ? (
          <EmptyState icon={Users} title="لا توجد جهات اتصال" description={
            search ? "لا توجد نتائج للبحث" : "أضف عملاء من نقطة البيع أو استورد جهات اتصال"
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
                {contacts.map((c, i) => (
                  <tr key={`${c.type}-${c.id}`} className={`border-b border-border-subtle hover:bg-bg-overlay transition-colors ${
                    c.capture_source === "walk_in_wa" ? "bg-primary-50" : ""
                  }`}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-black text-text-primary">{c.name || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-text-muted font-mono" dir="ltr">{c.phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${
                        c.type === "customer" ? "bg-info-bg text-info-text" : "bg-warning-bg text-warning-text"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && contacts.length > 0 && (
          <div className="px-4 py-3 border-t border-border-normal bg-bg-base">
            <p className="text-xs font-bold text-text-muted">إجمالي {contacts.length} جهة اتصال</p>
          </div>
        )}
      </div>

      {showAddModal && <AddContactModal onClose={() => { setShowAddModal(false); fetchContacts(); }} />}
      {sendInvoiceContact && (
        <SendInvoiceModal
          phone={sendInvoiceContact.phone}
          contactName={sendInvoiceContact.name}
          onClose={() => setSendInvoiceContact(null)}
        />
      )}
    </div>
  );
}

// ─── Add Contact Modal ───────────────────────────────────────────────────

function AddContactModal({ onClose }) {
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
    } catch {} finally { setResolving(false); }
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
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  CAMPAIGNS TAB
// ═══════════════════════════════════════════════════════════════════════════

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/api/whatsapp/crm/campaigns");
      setCampaigns(r.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-text-muted">{campaigns.length} حملة</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:opacity-90 transition-all active:scale-95">
          <Megaphone className="h-4 w-4" /> حملة جديدة
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="لا توجد حملات" description="أنشئ حملة تسويقية جديدة للتواصل مع عملائك" action={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-black text-white">
            <Megaphone className="h-4 w-4" /> حملة جديدة
          </button>
        } />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map(camp => {
            const total = Number(camp.total) || 0;
            const sent = Number(camp.sent_count) || 0;
            const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
            return (
              <div key={camp.id} className="rounded-xl border border-border-normal bg-bg-surface p-5 shadow-card hover:shadow-elevated transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-black text-text-primary">{camp.name || "بدون اسم"}</p>
                    <p className="text-[11px] font-bold text-text-muted mt-0.5">
                      {new Date(camp.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    camp.status === "done" ? "bg-success-bg text-success-text"
                    : camp.status === "active" ? "bg-info-bg text-info-text"
                    : "bg-warning-bg text-warning-text"
                  }`}>
                    {camp.status === "done" ? "تم" : camp.status === "active" ? "نشط" : "متوقف"}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs font-bold text-text-secondary">
                    <span>المستلمون: {total}</span>
                    <span>أُرسل: {sent}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-bg-base overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <p className="text-xs text-text-secondary mt-3 line-clamp-2 leading-relaxed">
                  {camp.body?.slice(0, 120)}{camp.body?.length > 120 ? "..." : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateCampaignModal onClose={() => { setShowCreate(false); fetchCampaigns(); }} />}
    </div>
  );
}

function CreateCampaignModal({ onClose }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [includeLeads, setIncludeLeads] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  async function handleCreate() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const filters = { include: includeLeads ? "both" : "customers" };
      await api.post("/api/whatsapp/crm/campaigns", { name: name.trim() || undefined, body: body.trim(), filters });
      toast.success("تم إنشاء الحملة ووضع الرسائل في قائمة الإرسال");
      onClose();
    } catch (e) { toast.error(e.response?.data?.message || "فشل إنشاء الحملة"); }
    finally { setSaving(false); }
  }

  async function checkAudience() {
    try {
      const r = await api.get("/api/leads/audience", { params: { include: includeLeads ? "both" : "customers" } });
      setPreview(r.data?.count || 0);
    } catch { setPreview(null); }
  }

  useEffect(() => { checkAudience(); }, [includeLeads]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay" onMouseDown={onClose}>
      <div dir="rtl" className="w-full max-w-lg mx-4 rounded-2xl bg-bg-surface p-6 shadow-modal animate-fade-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black text-text-primary flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> حملة جديدة
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-bg-base">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block">اسم الحملة (اختياري)</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="مثال: عرض الجمعة البيضاء"
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface transition-colors" />
          </div>
          <div>
            <label className="text-xs font-black text-text-secondary mb-1.5 block flex items-center gap-2">
              نص الرسالة *
              <InfoTip text="استخدم {name} لاسم العميل" />
            </label>
            <textarea rows={5} value={body} onChange={e => setBody(e.target.value)}
              placeholder="مرحباً {name}، لدينا عرض خاص لك..."
              className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold outline-none focus:border-primary focus:bg-bg-surface resize-none transition-colors" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeLeads} onChange={e => setIncludeLeads(e.target.checked)}
                className="rounded border-border-normal text-primary focus:ring-primary" />
              <span className="text-xs font-bold text-text-secondary">يشمل العملاء المحتملين</span>
            </label>
          </div>
          {preview !== null && (
            <div className="rounded-lg bg-info-bg border border-info-border px-4 py-3">
              <p className="text-sm font-black text-info-text">
                ستُرسل إلى <span className="text-lg">{preview}</span> مستلم
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border-normal py-2.5 text-xs font-black text-text-secondary hover:bg-bg-base">
            إلغاء
          </button>
          <button onClick={handleCreate} disabled={!body.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            إنشاء وإرسال
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

const TEMPLATE_LABELS = { receipt: "إيصال الشراء", birthday: "عيد الميلاد", debt: "تذكير الدين" };
const TEMPLATE_HINTS = {
  receipt: "يُرسل فور إتمام البيع — {name} {total} {shop} {date}",
  birthday: "يُرسل صباح يوم الميلاد — {name} {shop}",
  debt: "يُرسل عند التذكير بالديون — {name} {amount} {shop}",
};

function TemplatesTab() {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/api/whatsapp/crm/templates");
        const map = {};
        (r.data?.data || []).forEach(t => { map[t.kind] = t.body; });
        setTemplates(map);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  async function saveTemplate(kind) {
    setSaving(s => ({ ...s, [kind]: true }));
    try {
      await api.put(`/api/whatsapp/crm/templates/${kind}`, { body: templates[kind] || "" });
      toast.success("تم حفظ القالب");
    } catch { toast.error("فشل الحفظ"); }
    finally { setSaving(s => ({ ...s, [kind]: false })); }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-text-muted" /></div>;

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {["receipt", "birthday", "debt"].map(kind => (
        <div key={kind} className="rounded-xl border border-border-normal bg-bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black text-text-primary">{TEMPLATE_LABELS[kind]}</p>
              <p className="text-[11px] font-bold text-text-muted">{TEMPLATE_HINTS[kind]}</p>
            </div>
          </div>
          <textarea rows={4} value={templates[kind] || ""}
            onChange={e => setTemplates(t => ({ ...t, [kind]: e.target.value }))}
            className="w-full rounded-lg border border-border-normal bg-bg-input px-3 py-2.5 text-sm font-bold text-text-primary outline-none focus:border-primary focus:bg-bg-surface resize-none transition-colors mb-3" dir="rtl" />
          <button onClick={() => saveTemplate(kind)} disabled={saving[kind]}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-black text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">
            {saving[kind] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            حفظ
          </button>
        </div>
      ))}
    </div>
  );
}
