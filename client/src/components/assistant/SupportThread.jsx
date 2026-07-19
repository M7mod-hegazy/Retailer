import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, ShieldCheck, ThumbsUp, Pencil, Trash2, Check, X, Paperclip, Mic, Square } from "lucide-react";
import { useCommsStore } from "../../stores/commsStore";
import { isCommsConfigured } from "../../services/comms";
import Attachments from "./Attachments";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  return new Date(iso).toLocaleDateString("ar-EG");
}

function Reactions({ list }) {
  if (!list || list.length === 0) return null;
  return (
    <div className="mt-1 flex gap-1">
      {list.map((r, i) => (
        <span key={i} className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px]">
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

function Bubble({ m, t }) {
  const isDev = m.sender_type === "dev";
  const { reactSupport, editSupport, removeSupport } = useCommsStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body || "");

  if (m.deleted_at) {
    return (
      <div className={`flex ${isDev ? "justify-end" : "justify-start"}`}>
        <div className="rounded-2xl px-3 py-1.5 text-[12px] font-bold italic" style={{ color: "var(--text-muted)" }}>
          {t("assistant.deleted")}
        </div>
      </div>
    );
  }

  const saveEdit = async () => {
    const text = draft.trim();
    if (text && text !== m.body) await editSupport(m.id, text);
    setEditing(false);
  };

  return (
    <div className={`group flex flex-col ${isDev ? "items-end" : "items-start"}`}>
      {isDev && (
        <div className="mb-0.5 flex items-center gap-1 px-1">
          <ShieldCheck className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-black text-primary">{t("assistant.developer")}</span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[12px] font-bold shadow-sm ${
          isDev ? "bg-primary/10 text-[color:var(--text-primary)]" : "bg-primary text-white"
        }`}
        title={`${timeAgo(m.created_at)}${m.seen_at ? " · " + t("assistant.seen") : ""}${m.edited_at ? " · ✎" : ""}`}
      >
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              className="w-40 rounded-lg bg-bg-surface/90 px-2 py-1 text-[12px] text-zinc-900 outline-none"
            />
            <button onClick={saveEdit} aria-label="save"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditing(false)} aria-label="cancel"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <span className="whitespace-pre-wrap leading-relaxed">{m.body}</span>
        )}
      </div>
      {m.attachments?.length > 0 && (
        <div className="max-w-[85%]">
          <Attachments list={m.attachments} />
        </div>
      )}
      <Reactions list={m.reactions} />

      {/* Action row (hover) */}
      {!editing && (
        <div className="mt-0.5 flex gap-2 px-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button onClick={() => reactSupport(m.id, "👍")} title={t("assistant.react")} style={{ color: "var(--text-muted)" }}>
            <ThumbsUp className="h-3 w-3" />
          </button>
          {!isDev && (
            <>
              <button onClick={() => { setDraft(m.body || ""); setEditing(true); }} title={t("assistant.edit")} style={{ color: "var(--text-muted)" }}>
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={() => removeSupport(m.id)} title={t("assistant.delete")} style={{ color: "var(--text-muted)" }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupportThread() {
  const { t } = useTranslation();
  const configured = isCommsConfigured();
  const messages = useCommsStore((s) => s.messages);
  const supportError = useCommsStore((s) => s.supportError);
  const syncSupport = useCommsStore((s) => s.syncSupport);
  const sendSupport = useCommsStore((s) => s.sendSupport);
  const sendSupportWithFiles = useCommsStore((s) => s.sendSupportWithFiles);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState([]); // File[]
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const recorderRef = useRef(null);

  useEffect(() => {
    if (!configured) return;
    syncSupport();
    const id = setInterval(syncSupport, 15000);
    return () => clearInterval(id);
  }, [configured, syncSupport]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!configured) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[13px] font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {t("assistant.supportNotConfigured")}
        </p>
      </div>
    );
  }

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length) setPending((p) => [...p, ...files].slice(0, 6));
  };

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" });
        setPending((p) => [...p, file].slice(0, 6));
        stream.getTracks().forEach((tk) => tk.stop());
        setRecording(false);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      alert(t("assistant.micDenied"));
    }
  };

  const submit = async () => {
    const text = input.trim();
    if (!text && pending.length === 0) return;
    const files = pending;
    setInput("");
    setPending([]);
    try {
      if (files.length) await sendSupportWithFiles(text, files);
      else await sendSupport(text);
    } catch {
      /* surfaced via supportError on next sync */
    }
  };

  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4">
        {supportError && (
          <p className="px-1 text-[11px] font-bold" style={{ color: "var(--danger, #dc2626)" }}>
            {t("assistant.supportError")}
          </p>
        )}
        {messages.length === 0 ? (
          <p className="px-1 pt-2 text-[13px] font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {t("assistant.supportEmpty")}
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} t={t} />)
        )}
      </div>
      <div className="border-t p-3" style={{ borderColor: "var(--border-normal)" }}>
        {/* pending attachments preview */}
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pending.map((f, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold" style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
                {f.type.startsWith("audio/") ? "🎙" : f.type.startsWith("image/") ? "🖼" : "📎"}
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} aria-label={t("assistant.dismiss")}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-2xl border px-2.5 py-1.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} title={t("assistant.attach")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
            <Paperclip className="h-4 w-4" />
          </button>
          <button onClick={toggleRecord} title={recording ? t("assistant.stopRecording") : t("assistant.recordVoice")} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${recording ? "bg-red-500 text-white animate-pulse" : "hover:bg-black/5"}`} style={recording ? undefined : { color: "var(--text-muted)" }}>
            {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={recording ? t("assistant.recording") : t("assistant.supportPlaceholder")}
            className="flex-1 bg-transparent py-1.5 text-[13px] font-bold outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() && pending.length === 0}
            aria-label={t("assistant.send")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-all disabled:opacity-40"
          >
            <Send strokeWidth={2.2} className="h-4 w-4 -scale-x-100" />
          </button>
        </div>
      </div>
    </>
  );
}
