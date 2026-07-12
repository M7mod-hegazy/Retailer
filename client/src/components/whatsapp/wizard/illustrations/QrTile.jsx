import React from "react";
import { QrCode } from "lucide-react";

export default function QrTile({ src, alt = "QR", accent = "var(--primary)", size = 160 }) {
  if (src) {
    return (
      <img src={src} alt={alt} className="rounded-xl border-2 shadow-card" style={{ borderColor: accent, width: size, height: size }} />
    );
  }
  return (
    <div className="flex items-center justify-center rounded-xl border-2 border-dashed bg-bg-base" style={{ borderColor: accent, width: size, height: size }}>
      <QrCode className="h-10 w-10 text-text-muted" />
    </div>
  );
}
