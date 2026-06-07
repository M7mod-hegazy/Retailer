import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Smartphone, Link, Unlink, RefreshCw, CheckCircle, AlertCircle, Clock,
  MessageSquare, Users, Send, ChevronDown, ChevronUp, Wifi, WifiOff, Zap
} from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

const TEMPLATE_LABELS = { receipt: "إيصال الشراء", birthday: "عيد الميلاد", debt: "تذكير الدين" };
const TEMPLATE_HINTS = {
  receipt: "يُرسل فور إتمام البيع — متغيرات: {name} {total} {shop} {date}",
  birthday: "يُرسل صباح يوم الميلاد — متغيرات: {name} {shop}",
  debt: "يُرسل عند التذكير بالديون — متغيرات: {name} {amount} {shop}",
};

function SectionCard({ title, icon: Icon, accent = "#1e293b", open, onToggle, badge, children }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-slate-50/60 transition-colors">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: accent }}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-black text-slate-800 flex-1">{title}</span>
        {badge && (
          <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">{badge}</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2 border-t border-slate-100">{children}</div>}
    </div>
  );
}

export default function WhatsAppSettingsTab() {
  const [waStatus, setWaStatus] = useState({ status: "loading" });
  const [openSection, setOpenSection] = useState("connection");
  const [linking, setLinking] = useState(false);
  const pollRef = useRef(null);

  const [templates, setTemplates] = useState({});
  const [savingTemplate, setSavingTemplate] = useState({});

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [outbox, setOutbox] = useState([]);
  const [outboxLoading, setOutboxLoading] = useState(false);

  const [broadcastText, setBroadcastText] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await api.get("/api/whatsapp/engine-status");
      setWaStatus(r.data?.data || { status: "unavailable" });
    } catch {
      setWaStatus({ status: "error" });
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (["connecting", "qr"].includes(waStatus.status)) {
      pollRef.current = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [waStatus.status, fetchStatus]);

  const fetchTemplates = useCallback(async () => {
    try {
      const r = await api.get("/api/whatsapp/templates");
      const map = {};
      (r.data?.data || []).forEach(t => { map[t.kind] = t.body; });
      setTemplates(map);
    } catch { }
  }, []);

  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const r = await api.get("/api/whatsapp/contacts");
      setContacts(r.data?.data || []);
    } catch { } finally { setContactsLoading(false); }
  }, []);

  const fetchOutbox = useCallback(async () => {
    setOutboxLoading(true);
    try {
      const r = await api.get("/api/whatsapp/outbox?limit=30");
      setOutbox(r.data?.data || []);
    } catch { } finally { setOutboxLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    if (openSection === "contacts") fetchContacts();
    if (openSection === "outbox") fetchOutbox();
  }, [openSection, fetchContacts, fetchOutbox]);

  async function handleLink() {
    setLinking(true);
    try {
      await api.post("/api/whatsapp/engine-connect");
      fetchStatus();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الاتصال");
    } finally { setLinking(false); }
  }

  async function handleUnlink() {
    if (!window.confirm("هل أنت متأكد من فصل واتساب؟")) return;
    try {
      await api.post("/api/whatsapp/engine-disconnect");
      setWaStatus({ status: "disconnected" });
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الفصل");
    }
  }

  async function saveTemplate(kind) {
    setSavingTemplate(s => ({ ...s, [kind]: true }));
    try {
      await api.put(`/api/whatsapp/templates/${kind}`, { body: templates[kind] || "" });
      toast.success("تم حفظ النموذج");
    } catch { toast.error("فشل الحفظ"); }
    finally { setSavingTemplate(s => ({ ...s, [kind]: false })); }
  }

  async function sendBroadcast() {
    if (!broadcastText.trim()) return;
    if (!window.confirm("إرسال رسالة لجميع العملاء المشتركين في التسويق؟")) return;
    setBroadcasting(true);
    try {
      const r = await api.post("/api/whatsapp/broadcast", { text: broadcastText.trim() });
      toast.success(`تم وضع ${r.data?.queued || 0} رسالة في قائمة الإرسال`);
      setBroadcastText("");
    } catch (e) { toast.error(e.response?.data?.message || "فشل"); }
    finally { setBroadcasting(false); }
  }

  const toggle = (id) => setOpenSection(o => o === id ? null : id);
  const state = waStatus.status || "loading";
  const isUnavailable = state === "unavailable" || state === "error";

  const optedIn = contacts.filter(c => c.marketing_opt_in && !c.whatsapp_opt_out).length;
  const outboxPending = outbox.filter(o => o.status === "pending").length;

  // ── Status color theme ─────────────────────────────────────
  const statusTheme = {
    connected: { bg: "bg-emerald-500", text: "متصل", ring: "ring-emerald-200", dot: "bg-emerald-400" },
    qr:        { bg: "bg-amber-400",   text: "انتظار المسح", ring: "ring-amber-200", dot: "bg-amber-400" },
    connecting:{ bg: "bg-slate-400",   text: "جاري الاتصال...", ring: "ring-slate-200", dot: "bg-slate-400" },
    loading:   { bg: "bg-slate-300",   text: "تحميل...", ring: "ring-slate-100", dot: "bg-slate-300" },
    disconnected:{ bg: "bg-slate-300", text: "غير متصل", ring: "ring-slate-100", dot: "bg-slate-300" },
    unavailable: { bg: "bg-rose-400",  text: "غير متاح", ring: "ring-rose-200", dot: "bg-rose-400" },
    error:     { bg: "bg-rose-400",    text: "خطأ", ring: "ring-rose-200", dot: "bg-rose-400" },
  };
  const theme = statusTheme[state] || statusTheme.disconnected;

  return (
    <div className="w-full space-y-4">

      {/* ── Hero connection strip ───────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-xl border p-6 ${
        state === "connected" ? "bg-gradient-to-l from-emerald-50 to-white border-emerald-200"
        : state === "qr" ? "bg-gradient-to-l from-amber-50 to-white border-amber-200"
        : "bg-gradient-to-l from-slate-50 to-white border-slate-200"
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">

          {/* Status indicator */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${theme.bg}`}>
              {state === "connected" ? <Wifi className="h-6 w-6" /> :
               state === "qr" ? <Smartphone className="h-6 w-6 animate-pulse" /> :
               state === "connecting" ? <RefreshCw className="h-6 w-6 animate-spin" /> :
               <WifiOff className="h-6 w-6" />}
              {state === "connected" && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">واتساب للمتجر</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${theme.bg}`}>{theme.text}</span>
              </div>
              {state === "connected" && waStatus.phone ? (
                <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5" dir="ltr">+{waStatus.phone}</p>
              ) : state === "qr" ? (
                <p className="text-xs font-bold text-amber-600 mt-0.5 animate-pulse">افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز جديد</p>
              ) : isUnavailable ? (
                <p className="text-xs font-bold text-rose-600 mt-0.5">تأكد من تشغيل التطبيق عبر Electron ومن تثبيت Baileys</p>
              ) : (
                <p className="text-xs font-bold text-slate-400 mt-0.5">اربط حسابك لبدء إرسال الرسائل</p>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {state === "connected" && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-white border border-emerald-100 shadow-sm">
                <span className="text-lg font-black text-emerald-700">{optedIn}</span>
                <span className="text-[10px] font-bold text-slate-400">مشترك تسويق</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-white border border-slate-100 shadow-sm">
                <span className="text-lg font-black text-slate-700">{outboxPending}</span>
                <span className="text-[10px] font-bold text-slate-400">رسائل معلقة</span>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isUnavailable && (
            <div className="flex items-center gap-2 shrink-0">
              {state !== "connected" ? (
                <button onClick={handleLink}
                  disabled={linking || state === "connecting" || state === "qr"}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95">
                  <Link className="h-4 w-4" />
                  {state === "qr" ? "في انتظار المسح..." : "ربط واتساب"}
                </button>
              ) : (
                <button onClick={handleUnlink}
                  className="flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-5 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-50 transition-all active:scale-95">
                  <Unlink className="h-4 w-4" />
                  فصل
                </button>
              )}
              <button onClick={fetchStatus}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all active:scale-95">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* QR code */}
        {state === "qr" && waStatus.qr && (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-white p-6">
            <img src={waStatus.qr} alt="QR واتساب" className="h-52 w-52 rounded-lg border border-slate-200" />
            <p className="text-center text-xs font-bold text-slate-500">
              امسح هذا الرمز من تطبيق واتساب لربط حساب المتجر
            </p>
            <p className="text-[10px] text-slate-400 animate-pulse">يتم التحديث تلقائياً...</p>
          </div>
        )}

        {/* Info pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "الجلسة محفوظة — لا تحتاج QR عند كل تشغيل",
            "رد بـ 'إلغاء' يوقف الرسائل التسويقية تلقائياً",
            "حتى 200 رسالة تسويقية يومياً مع فاصل 8–20 ثانية",
          ].map(t => (
            <span key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
              <Zap className="h-2.5 w-2.5 text-slate-400" />{t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Sections grid ─────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Templates */}
        <SectionCard title="نماذج الرسائل" icon={MessageSquare} accent="#4f46e5"
          open={openSection === "templates"} onToggle={() => toggle("templates")}>
          <div className="space-y-5 pt-3">
            {["receipt", "birthday", "debt"].map(kind => (
              <div key={kind} className="space-y-2">
                <div>
                  <p className="text-sm font-black text-slate-800">{TEMPLATE_LABELS[kind]}</p>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">{TEMPLATE_HINTS[kind]}</p>
                </div>
                <textarea rows={3} value={templates[kind] || ""}
                  onChange={e => setTemplates(t => ({ ...t, [kind]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-colors"
                  dir="rtl" />
                <button onClick={() => saveTemplate(kind)} disabled={savingTemplate[kind]}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95">
                  {savingTemplate[kind] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  حفظ النموذج
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Broadcast */}
        <SectionCard title="إرسال رسالة جماعية" icon={Send} accent="#059669"
          open={openSection === "broadcast"} onToggle={() => toggle("broadcast")}>
          <div className="space-y-4 pt-3">
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-[11px] font-bold text-amber-700">تُرسل للعملاء الذين وافقوا على استلام التسويق فقط</p>
            </div>
            <textarea rows={5} value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 focus:bg-white resize-none transition-colors"
              dir="rtl" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400">{broadcastText.length} حرف</span>
              <button onClick={sendBroadcast} disabled={broadcasting || !broadcastText.trim()}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95">
                {broadcasting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {broadcasting ? "جاري الإرسال..." : "إرسال للمشتركين"}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Contacts */}
        <SectionCard title="جهات الاتصال" icon={Users} accent="#d97706"
          badge={contacts.length || null}
          open={openSection === "contacts"} onToggle={() => toggle("contacts")}>
          {contactsLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-300"><RefreshCw className="h-5 w-5 animate-spin" /></div>
          ) : contacts.length === 0 ? (
            <p className="text-sm font-bold text-slate-400 text-center py-10">لا توجد جهات اتصال بعد</p>
          ) : (
            <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 sticky top-0 bg-white">
                <span>الاسم</span><span>الهاتف</span><span>النوع</span><span>التسويق</span><span>آخر رسالة</span>
              </div>
              {contacts.map(c => (
                <div key={c.id} className={`grid grid-cols-5 gap-2 px-3 py-2 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-colors ${c.capture_source === "walk_in_wa" ? "bg-green-50/50" : ""}`}>
                  <span className="text-slate-800 truncate">{c.name || "—"}</span>
                  <span className="text-slate-500 font-mono truncate" dir="ltr">{c.phone}</span>
                  <span>
                    {c.capture_source === "walk_in_wa"
                      ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-black border border-green-200">⚡ سريع</span>
                      : <span className="text-slate-300 text-[10px]">عميل</span>}
                  </span>
                  <span>
                    {c.whatsapp_opt_out
                      ? <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black">إلغاء</span>
                      : c.marketing_opt_in
                      ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black">مشترك</span>
                      : <span className="text-slate-300">—</span>}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString("ar-EG") : "—"}
                    {c.last_message_status === "sent" ? " ✓" : c.last_message_status === "failed" ? " ✗" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Outbox */}
        <SectionCard title="صندوق الصادر" icon={Clock} accent="#e11d48"
          badge={outboxPending || null}
          open={openSection === "outbox"} onToggle={() => toggle("outbox")}>
          <div className="mt-3">
            <div className="flex justify-end mb-3">
              <button onClick={fetchOutbox}
                className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-slate-800 transition-colors">
                <RefreshCw className="h-3 w-3" /> تحديث
              </button>
            </div>
            {outboxLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-300"><RefreshCw className="h-5 w-5 animate-spin" /></div>
            ) : outbox.length === 0 ? (
              <p className="text-sm font-bold text-slate-400 text-center py-8">لا توجد رسائل</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {outbox.map(msg => (
                  <div key={msg.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${msg.status === "sent" ? "bg-emerald-500" : msg.status === "failed" ? "bg-rose-500" : "bg-amber-400"}`} />
                    <span className="text-[11px] font-mono text-slate-500 w-28 shrink-0" dir="ltr">{msg.recipient_phone}</span>
                    <span className="text-[11px] font-bold text-slate-400 w-14 shrink-0">{msg.kind}</span>
                    <span className="text-[11px] font-bold text-slate-700 flex-1 truncate">
                      {(() => { try { return JSON.parse(msg.payload || "{}").text?.slice(0, 50) || "—"; } catch { return "—"; } })()}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {msg.status === "sent" ? "✓ أُرسل" : msg.status === "failed" ? "✗ فشل" : "⏳ معلق"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
