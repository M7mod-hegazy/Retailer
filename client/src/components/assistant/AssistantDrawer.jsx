import React, { useEffect, useRef, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, LifeBuoy, Trash2, Loader2, Bot, ShieldCheck, ArrowLeft, ThumbsUp, ThumbsDown, Clock, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { useAssistantStore } from "../../stores/assistantStore";
import { useAuthStore } from "../../stores/authStore";
import { getIntentById } from "../../help/helpIndex";
import SupportThread from "./SupportThread";
import DevConsole from "./DevConsole";

const SUGGESTIONS_BY_PAGE = {
  "/pos": ["ازاي اعمل خصم على الفاتورة؟", "ازاي اطبع إيصال؟", "ازاي اقفل الوردية؟"],
  "/pos/": ["ازاي اعمل خصم على الفاتورة؟", "ازاي اطبع إيصال؟", "ازاي اقفل الوردية؟"],
  "/stock": ["ازاي انقل بضاعة بين المخازن؟", "ازاي اعمل جرد مخزون؟", "ازاي اشوف رصيد صنف؟"],
  "/stock/": ["ازاي انقل بضاعة بين المخازن؟", "ازاي اعمل جرد مخزون؟", "ازاي اشوف رصيد صنف؟"],
  "/purchases": ["ازاي اعمل أمر شراء؟", "ازاي استقبل شحنة؟", "ازاي اعمل مرتجع مشتريات؟"],
  "/purchases/": ["ازاي اعمل أمر شراء؟", "ازاي استقبل شحنة؟", "ازاي اعمل مرتجع مشتريات؟"],
  "/sales": ["ازاي اعمل مرتجع مبيعات؟", "ازاي اشوف تقرير مبيعات؟", "ازاي احسب عمولة كاشير؟"],
  "/sales/": ["ازاي اعمل مرتجع مبيعات؟", "ازاي اشوف تقرير مبيعات؟", "ازاي احسب عمولة كاشير؟"],
  "/reports": ["ازاي اشوف تقرير الأرباح؟", "ازاي اطلب تقرير شهرين؟", "ازاي اسحب تقرير اكسل؟"],
  "/reports/": ["ازاي اشوف تقرير الأرباح؟", "ازاي اطلب تقرير شهرين؟", "ازاي اسحب تقرير اكسل؟"],
};

const DEFAULT_SUGGESTIONS = [
  "ازاي اقفل الوردية؟",
  "ازاي اعمل خصم على الفاتورة؟",
  "ازاي اعمل مرتجع مبيعات؟",
  "ازاي انقل بضاعة بين المخازن؟",
];

function RatingButtons({ messageId, currentRating, onRate, t }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 px-1">
      <span className="text-[9px] font-bold" style={{ color: "var(--text-muted)" }}>هل كان الرد مفيداً؟</span>
      <button onClick={() => onRate(messageId, currentRating === "up" ? null : "up")}
        className={`rounded-lg p-1 transition-colors ${currentRating === "up" ? "text-primary" : ""}`}
        style={{ color: currentRating === "up" ? "var(--primary)" : "var(--text-muted)" }}>
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button onClick={() => onRate(messageId, currentRating === "down" ? null : "down")}
        className={`rounded-lg p-1 transition-colors ${currentRating === "down" ? "text-red-500" : ""}`}
        style={{ color: currentRating === "down" ? "var(--danger)" : "var(--text-muted)" }}>
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}

function RichCard({ entry, onNavigate, onAsk, t }) {
  const followups = (entry.followups || [])
    .map((id) => getIntentById(id))
    .filter(Boolean)
    .slice(0, 3);

  if (entry.display === "guide" && entry.steps) {
    return <GuideCard entry={entry} onNavigate={onNavigate} t={t} />;
  }

  return (
    <div className="rounded-2xl border p-3.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-black text-primary">{entry.title}</span>
      </div>
      <p className="whitespace-pre-wrap text-[12px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {entry.answer}
      </p>
      {entry.route && (
        <button onClick={() => onNavigate(entry.route)}
          className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[12px] font-black text-white shadow-sm transition-transform hover:scale-[1.02]">
          <ArrowLeft strokeWidth={2.4} className="h-3.5 w-3.5" />
          {t("assistant.goToPage")}
        </button>
      )}
      {followups.length > 0 && (
        <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--border-normal)" }}>
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            {t("assistant.relatedQuestions")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {followups.map((f) => (
              <button key={f.id} onClick={() => onAsk(f.title)}
                className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors hover:border-primary"
                style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
                {f.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GuideCard({ entry, onNavigate, t }) {
  const [step, setStep] = useState(0);
  const steps = entry.steps || [];

  return (
    <div className="rounded-2xl border p-3.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="mb-2 flex items-center gap-1.5">
        <ListChecks className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-black text-primary">{entry.title}</span>
      </div>
      <div className="mb-2 flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-black/10"}`} />
        ))}
      </div>
      <p className="text-[13px] font-black mb-1" style={{ color: "var(--text-primary)" }}>
        {t("assistant.step")} {step + 1}/{steps.length}
      </p>
      <p className="whitespace-pre-wrap text-[12px] font-semibold leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
        {steps[step]}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold disabled:opacity-30"
          style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
          <ChevronRight className="h-3 w-3" /> {t("assistant.previous")}
        </button>
        <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-30">
          {t("assistant.next")} <ChevronLeft className="h-3 w-3" />
        </button>
        {step === steps.length - 1 && entry.route && (
          <button onClick={() => onNavigate(entry.route)}
            className="mr-auto rounded-xl bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            {t("assistant.goToPage")}
          </button>
        )}
      </div>
    </div>
  );
}

function AiMessage({ message, t, onRate }) {
  if (message.loading) {
    return (
      <div className="flex items-center gap-2 px-1 text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
        <div className="flex gap-0.5">
          <motion.span className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
          <motion.span className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
          <motion.span className="h-1.5 w-1.5 rounded-full bg-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
        </div>
        <span>{t("assistant.aiThinking")}</span>
      </div>
    );
  }
  if (message.error || !message.text) {
    return (
      <div className="text-[12px] font-bold leading-relaxed px-1" style={{ color: "var(--text-muted)" }}>
        {t("assistant.aiError")}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border p-3.5" style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Bot className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t("assistant.aiBadge")}</span>
      </div>
      <p className="whitespace-pre-wrap text-[12px] font-semibold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {message.text}
      </p>
      {onRate && <RatingButtons messageId={message.id} currentRating={message.rating} onRate={onRate} t={t} />}
    </div>
  );
}

function BotMessage({ message, t, onNavigate, onAsk, onRate }) {
  if (message.kind === "ai") return <AiMessage message={message} t={t} onRate={onRate} />;

  const results = message.results || [];
  if (results.length === 0) {
    return (
      <div className="text-[12px] font-bold leading-relaxed px-1" style={{ color: "var(--text-muted)" }}>
        {t("assistant.noAnswer")}
      </div>
    );
  }

  const [top, ...rest] = results;
  return (
    <div className="flex flex-col gap-2">
      <RichCard entry={top} onNavigate={onNavigate} onAsk={onAsk} t={t} />
      {onRate && <RatingButtons messageId={message.id} currentRating={message.rating} onRate={onRate} t={t} />}
      {rest.length > 0 && (
        <div className="px-1">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            {t("assistant.didYouMean")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {rest.map((e) => (
              <button key={e.id} onClick={() => onAsk(e.title)}
                className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors hover:border-primary"
                style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
                {e.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssistantDrawer() {
  const { t } = useTranslation();
  const location = useLocation();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const activeTab = useAssistantStore((s) => s.activeTab);
  const messages = useAssistantStore((s) => s.messages);
  const searchHistory = useAssistantStore((s) => s.searchHistory);
  const close = useAssistantStore((s) => s.close);
  const setTab = useAssistantStore((s) => s.setTab);
  const ask = useAssistantStore((s) => s.ask);
  const clearConversation = useAssistantStore((s) => s.clearConversation);
  const clearHistory = useAssistantStore((s) => s.clearHistory);
  const rateMessage = useAssistantStore((s) => s.rateMessage);
  const devMode = useAssistantStore((s) => s.devMode);
  const toggleDevMode = useAssistantStore((s) => s.toggleDevMode);
  const currentUser = useAuthStore((s) => s.user);
  const isDevAccount = currentUser?.username === "m7mod";

  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = useMemo(() => {
    const path = Object.keys(SUGGESTIONS_BY_PAGE).find((p) => location.pathname.startsWith(p));
    return path ? SUGGESTIONS_BY_PAGE[path] : DEFAULT_SUGGESTIONS;
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const submit = (text) => {
    const q = (text ?? input).trim();
    if (!q) return;
    ask(q, location.pathname);
    setInput("");
  };

  const handleNavigate = (route) => {
    if (route) navigate(route);
    close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px]"
          />

          <motion.aside
            dir="rtl"
            initial={{ x: "-105%" }}
            animate={{ x: 0 }}
            exit={{ x: "-105%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 start-0 z-[61] flex w-[400px] max-w-[92vw] flex-col p-4"
          >
            <div
              className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl"
              style={{ background: "var(--bg-topbar)", borderColor: "var(--border-normal)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: "var(--border-normal)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                    <Sparkles strokeWidth={2.2} className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-sm font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {t("assistant.title")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {isDevAccount && (
                  <button
                    onClick={toggleDevMode}
                    aria-label={t("dev.title")}
                    title={t("dev.title")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                    style={{ color: devMode ? "var(--primary)" : "var(--text-muted)" }}
                  >
                    <ShieldCheck strokeWidth={2.2} className="h-4 w-4" />
                  </button>
                  )}
                  <button
                    onClick={close}
                    aria-label={t("assistant.dismiss")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X strokeWidth={2.2} className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {devMode ? (
                <DevConsole />
              ) : (
              <>
              {/* Tabs */}
              <div className="flex gap-1 px-3 pt-3">
                {[
                  { id: "assistant", label: t("assistant.tabAssistant"), icon: Sparkles },
                  { id: "support", label: t("assistant.tabSupport"), icon: LifeBuoy },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setTab(tab.id)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-all ${
                        active ? "bg-primary text-white shadow-md" : "hover:bg-black/5"
                      }`}
                      style={active ? undefined : { color: "var(--text-secondary)" }}
                    >
                      <tab.icon strokeWidth={2.2} className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              {activeTab === "assistant" ? (
                <>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex flex-col gap-4 pt-2">
                        <p className="px-1 text-[13px] font-bold leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          {t("assistant.greeting")}
                        </p>

                        {/* Search history */}
                        {searchHistory.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between px-1 mb-2">
                              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                                <Clock className="inline h-3 w-3 ml-1" />
                                {t("assistant.recent")}
                              </span>
                              <button onClick={clearHistory} className="text-[9px] font-bold text-primary hover:underline">
                                {t("assistant.clear")}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {searchHistory.slice(0, 5).map((q) => (
                                <button key={q} onClick={() => submit(q)}
                                  className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors hover:border-primary"
                                  style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggestions */}
                        <div className="flex flex-col gap-2">
                          <span className="px-1 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                            {t("assistant.suggestionsTitle")}
                          </span>
                          {suggestions.map((q) => (
                            <button
                              key={q}
                              onClick={() => submit(q)}
                              className="rounded-xl border px-3.5 py-2.5 text-right text-[12px] font-bold transition-all hover:shadow-sm"
                              style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-primary)" }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      messages.map((m) =>
                        m.role === "user" ? (
                          <div key={m.id} className="flex justify-start">
                            <div className="max-w-[85%] rounded-2xl rounded-bs-sm bg-primary px-3.5 py-2 text-[12px] font-bold text-white shadow-sm">
                              {m.text}
                            </div>
                          </div>
                        ) : (
                          <div key={m.id} className="flex justify-end">
                            <div className="w-[92%]">
                              <BotMessage message={m} t={t} onNavigate={handleNavigate} onAsk={submit} onRate={rateMessage} />
                            </div>
                          </div>
                        ),
                      )
                    )}
                  </div>

                  {/* Composer */}
                  <div className="border-t p-3" style={{ borderColor: "var(--border-normal)" }}>
                    {messages.length > 0 && (
                      <button
                        onClick={clearConversation}
                        className="mb-2 flex items-center gap-1 px-1 text-[10px] font-black uppercase tracking-widest transition-colors hover:text-primary"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Trash2 className="h-3 w-3" /> {t("assistant.clear")}
                      </button>
                    )}
                    <div
                      className="flex items-center gap-2 rounded-2xl border px-3 py-1.5"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}
                    >
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                        placeholder={t("assistant.placeholder")}
                        className="flex-1 bg-transparent py-1.5 text-[13px] font-bold outline-none"
                        style={{ color: "var(--text-primary)" }}
                      />
                      <button
                        onClick={() => submit()}
                        disabled={!input.trim()}
                        aria-label={t("assistant.send")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-all disabled:opacity-40"
                      >
                        <Send strokeWidth={2.2} className="h-4 w-4 -scale-x-100" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <SupportThread />
              )}
              </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
