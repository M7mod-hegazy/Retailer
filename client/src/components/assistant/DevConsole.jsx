import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, ArrowRight, LogOut, Megaphone, Send, ThumbsUp, Trash2 } from "lucide-react";
import { useDevStore } from "../../stores/devStore";
import Attachments from "./Attachments";

function DevLogin({ t }) {
  const login = useDevStore((s) => s.login);
  const loggingIn = useDevStore((s) => s.loggingIn);
  const loginError = useDevStore((s) => s.loginError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <ShieldCheck className="h-6 w-6 text-primary" />
      </div>
      <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{t("dev.login")}</span>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("dev.email")}
        className="w-full rounded-xl border px-3 py-2 text-[13px] font-bold outline-none"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && login(email, password)}
        placeholder={t("dev.password")}
        className="w-full rounded-xl border px-3 py-2 text-[13px] font-bold outline-none"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
      />
      {loginError && (
        <p className="text-[11px] font-bold" style={{ color: "var(--danger, #dc2626)" }}>
          {loginError === "not_configured" ? t("dev.notConfigured") : t("dev.badCredentials")}
        </p>
      )}
      <button
        onClick={() => login(email, password)}
        disabled={loggingIn || !email || !password}
        className="w-full rounded-xl bg-primary py-2.5 text-[13px] font-black text-white shadow-sm disabled:opacity-40"
      >
        {t("dev.signIn")}
      </button>
    </div>
  );
}

function StoreList({ t }) {
  const conversations = useDevStore((s) => s.conversations);
  const select = useDevStore((s) => s.selectConversation);
  const loadConversations = useDevStore((s) => s.loadConversations);

  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, 20000);
    return () => clearInterval(id);
  }, [loadConversations]);

  if (conversations.length === 0) {
    return <p className="px-4 pt-6 text-center text-[13px] font-bold" style={{ color: "var(--text-muted)" }}>{t("dev.noStores")}</p>;
  }
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {conversations.map((c) => (
        <button
          key={c.license_id}
          onClick={() => select(c.license_id)}
          className="flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-all hover:shadow-sm"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
                {c.store_name || c.license_id}
              </span>
              {Number(c.unread) > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-black text-white">
                  {c.unread}
                </span>
              )}
            </div>
            {c.last_body && (
              <p className="truncate text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{c.last_body}</p>
            )}
          </div>
          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
        </button>
      ))}
    </div>
  );
}

function DevThread({ t }) {
  const messages = useDevStore((s) => s.messages);
  const closeThread = useDevStore((s) => s.closeThread);
  const sendReply = useDevStore((s) => s.sendReply);
  const reactMessage = useDevStore((s) => s.reactMessage);
  const deleteMessage = useDevStore((s) => s.deleteMessage);
  const refreshThread = useDevStore((s) => s.refreshThread);
  const [input, setInput] = useState("");

  useEffect(() => {
    const id = setInterval(refreshThread, 15000);
    return () => clearInterval(id);
  }, [refreshThread]);

  const submit = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try { await sendReply(text); } catch { /* ignore */ }
  };

  return (
    <>
      <button onClick={closeThread} className="flex items-center gap-1 px-4 pt-2 text-[11px] font-black text-primary">
        <ArrowRight className="h-3.5 w-3.5" /> {t("dev.back")}
      </button>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {messages.map((m) => {
          const isDev = m.sender_type === "dev";
          if (m.deleted_at) {
            return (
              <div key={m.id} className={`flex ${isDev ? "justify-end" : "justify-start"}`}>
                <div className="rounded-2xl px-3 py-1.5 text-[12px] font-bold italic" style={{ color: "var(--text-muted)" }}>{t("assistant.deleted")}</div>
              </div>
            );
          }
          return (
            <div key={m.id} className={`group flex flex-col ${isDev ? "items-end" : "items-start"}`}>
              {!isDev && (
                <span className="mb-0.5 px-1 text-[10px] font-black" style={{ color: "var(--text-muted)" }}>
                  {m.sender_name || ""}{m.app_version ? ` · ${t("dev.version")} ${m.app_version}` : ""}
                </span>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[12px] font-bold shadow-sm ${isDev ? "bg-primary text-white" : "bg-primary/10"}`}
                style={isDev ? undefined : { color: "var(--text-primary)" }}
                title={`${m.created_at ? new Date(m.created_at).toLocaleString("ar-EG") : ""}${m.seen_at ? " · " + t("assistant.seen") : ""}`}
              >
                <span className="whitespace-pre-wrap leading-relaxed">{m.body}</span>
              </div>
              {m.attachments?.length > 0 && (
                <div className="max-w-[85%]"><Attachments list={m.attachments} mode="dev" /></div>
              )}
              {m.reactions?.length > 0 && (
                <div className="mt-1 flex gap-1">
                  {m.reactions.map((r, i) => <span key={i} className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px]">{r.emoji}</span>)}
                </div>
              )}
              <div className="mt-0.5 flex gap-2 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => reactMessage(m.id, "👍")} title={t("assistant.react")} style={{ color: "var(--text-muted)" }}><ThumbsUp className="h-3 w-3" /></button>
                <button onClick={() => deleteMessage(m.id)} title={t("assistant.delete")} style={{ color: "var(--text-muted)" }}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t p-3" style={{ borderColor: "var(--border-normal)" }}>
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-1.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("dev.reply")}
            className="flex-1 bg-transparent py-1.5 text-[13px] font-bold outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          <button onClick={submit} disabled={!input.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm disabled:opacity-40">
            <Send strokeWidth={2.2} className="h-4 w-4 -scale-x-100" />
          </button>
        </div>
      </div>
    </>
  );
}

function AnnouncementComposer({ t, onDone }) {
  const postAnnouncement = useDevStore((s) => s.postAnnouncement);
  const selected = useDevStore((s) => s.selected);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [audience, setAudience] = useState("all");
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await postAnnouncement({
        title: title.trim() || null,
        body: body.trim(),
        type,
        targetKind: audience === "license" ? "license" : "all",
        targetLicenseId: audience === "license" ? selected : null,
      });
      onDone(true);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("dev.announcementTitleField")}
        className="w-full rounded-xl border px-3 py-2 text-[13px] font-bold outline-none"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("dev.announcementBody")} rows={4}
        className="w-full rounded-xl border px-3 py-2 text-[13px] font-bold outline-none"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }} />
      <div>
        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t("dev.type")}</span>
        <div className="flex gap-1.5">
          {[["info", t("dev.typeInfo")], ["critical", t("dev.typeCritical")], ["update", t("dev.typeUpdate")]].map(([v, label]) => (
            <button key={v} onClick={() => setType(v)} className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-black ${type === v ? "bg-primary text-white" : "border"}`}
              style={type === v ? undefined : { borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>{label}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{t("dev.audience")}</span>
        <div className="flex gap-1.5">
          <button onClick={() => setAudience("all")} className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-black ${audience === "all" ? "bg-primary text-white" : "border"}`}
            style={audience === "all" ? undefined : { borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>{t("dev.audienceAll")}</button>
          {selected && (
            <button onClick={() => setAudience("license")} className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-black ${audience === "license" ? "bg-primary text-white" : "border"}`}
              style={audience === "license" ? undefined : { borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>{t("dev.audienceLicense")}</button>
          )}
        </div>
      </div>
      <button onClick={publish} disabled={busy || !body.trim()} className="w-full rounded-xl bg-primary py-2.5 text-[13px] font-black text-white shadow-sm disabled:opacity-40">
        {t("dev.announce")}
      </button>
    </div>
  );
}

export default function DevConsole() {
  const { t } = useTranslation();
  const selected = useDevStore((s) => s.selected);
  const logout = useDevStore((s) => s.logout);
  const [composing, setComposing] = useState(false);


  return (
    <>
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--border-normal)" }}>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-black" style={{ color: "var(--text-primary)" }}>{t("dev.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setComposing((c) => !c)} title={t("dev.newAnnouncement")} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5" style={{ color: composing ? "var(--primary)" : "var(--text-muted)" }}>
            <Megaphone className="h-4 w-4" />
          </button>
          <button onClick={logout} title={t("dev.logout")} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      {composing ? (
        <AnnouncementComposer t={t} onDone={() => setComposing(false)} />
      ) : selected ? (
        <DevThread t={t} />
      ) : (
        <StoreList t={t} />
      )}
    </>
  );
}
