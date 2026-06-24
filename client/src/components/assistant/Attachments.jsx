import React, { useEffect, useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { loadAttachment } from "../../services/comms";
import { loadAttachmentDev } from "../../services/devComms";

// Loads an attachment's bytes via auth headers → blob URL (no secret in URL),
// and revokes the URL on unmount to avoid leaks.
function useBlobUrl(id, mode) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    let made = null;
    const loader = mode === "dev" ? loadAttachmentDev : loadAttachment;
    loader(id)
      .then((u) => {
        if (active) {
          made = u;
          setUrl(u);
        } else {
          URL.revokeObjectURL(u);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, mode]);
  return url;
}

function AttachmentItem({ att, mode }) {
  const url = useBlobUrl(att.id, mode);

  if (att.kind === "image") {
    if (!url) {
      return (
        <div className="flex h-24 w-32 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-normal)" }}>
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      );
    }
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={att.filename || "image"} className="max-h-44 w-auto rounded-xl border object-cover" style={{ borderColor: "var(--border-normal)" }} />
      </a>
    );
  }

  if (att.kind === "voice") {
    return url ? (
      <audio controls src={url} className="h-9 w-full max-w-[240px]" />
    ) : (
      <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> …
      </div>
    );
  }

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noreferrer"
      download={att.filename || "file"}
      className="flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-bold"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{att.filename || "ملف"}</span>
      {url ? <Download className="h-3.5 w-3.5 shrink-0" /> : <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
    </a>
  );
}

// mode: "store" (default) uses app-key+license headers; "dev" uses owner bearer.
export default function Attachments({ list, mode = "store" }) {
  if (!list || list.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {list.map((a) => (
        <AttachmentItem key={a.id} att={a} mode={mode} />
      ))}
    </div>
  );
}
