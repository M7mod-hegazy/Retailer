import React from "react";

export default function ChatBubble({ from = "bot", children, accent = "var(--primary)" }) {
  const isMe = from === "me";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[11px] font-bold leading-snug ${isMe ? "text-white" : "bg-bg-surface text-text-primary border border-border-normal"}`}
        style={isMe ? { background: accent } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
