import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  Copy,
  Check,
  QrCode,
  FileKey,
  Loader2,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

// Full-screen lock / activation screen shown by LicenseGate whenever this PC is
// not activated. It talks to the Electron main process over IPC:
//   license:getHardwareId -> { hardwareId, machineCode, qrDataUrl, configured }
//   license:submit        -> { ok, reason }
// The actual crypto verification happens in the main process; this screen only
// collects the machine code (to send to the seller) and ingests the signed
// license that comes back.

const ipc = () => (typeof window !== "undefined" ? window.electronAPI : null);

export default function ActivationPage({ status, onActivated }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blob, setBlob] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const api = ipc();
      if (!api) return;
      try {
        const result = await api.invoke("license:getHardwareId");
        if (alive) setInfo(result);
      } catch (_e) {
        /* leave info null -> shows unreadable state */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reasonMessage = useCallback(
    (reason) => {
      switch (reason) {
        case "wrong_machine":
          return t("license.error.wrong_machine");
        case "expired":
          return t("license.error.expired");
        case "clock_rollback":
          return t("license.error.clock_rollback");
        case "bad_signature":
        case "malformed_token":
        case "invalid_payload":
          return t("license.error.invalid");
        case "hardware_unreadable":
          return t("license.error.hardware");
        case "file_unreadable":
          return t("license.error.file");
        case "empty":
          return t("license.error.empty");
        default:
          return t("license.error.generic");
      }
    },
    [t],
  );

  // Headline describing WHY the app is locked (from the gate status).
  const lockReason = status?.reason;
  const isExpiredLock = lockReason === "expired";

  async function copyCode() {
    const code = info?.machineCode || info?.hardwareId || "";
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (_e) {
      /* clipboard may be blocked; ignore */
    }
  }

  async function pickFile() {
    const api = ipc();
    if (!api) return;
    try {
      const res = await api.invoke("dialog:open-file", {
        title: t("license.pickFile"),
        properties: ["openFile"],
        filters: [{ name: "License", extensions: ["key", "lic", "txt", "dat"] }],
      });
      const filePath = res && !res.canceled ? res.filePaths?.[0] : null;
      if (filePath) await activate({ filePath });
    } catch (_e) {
      setError(reasonMessage("file_unreadable"));
    }
  }

  async function activate(payload) {
    const api = ipc();
    if (!api) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api.invoke("license:submit", payload);
      if (result?.ok) {
        setSuccess(true);
        window.setTimeout(() => onActivated?.(), 1300);
      } else {
        setError(reasonMessage(result?.reason));
      }
    } catch (_e) {
      setError(reasonMessage("generic"));
    } finally {
      setSubmitting(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file?.path) activate({ filePath: file.path });
  }

  const machineCode = info?.machineCode || info?.hardwareId || "";

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-base)]" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-11 h-11 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-text-primary">{t("license.success.title")}</h2>
          {info?.issuedTo || status?.issuedTo ? (
            <p className="text-text-secondary font-bold">
              {t("license.success.welcome", { name: info?.issuedTo || status?.issuedTo })}
            </p>
          ) : null}
          <p className="text-text-muted text-sm">{t("license.success.opening")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto bg-[var(--bg-base)] text-text-primary font-sans"
      dir="rtl"
    >
      <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-[560px] bg-bg-surface rounded-[2rem] border border-border-normal/70 shadow-[0_20px_60px_-10px_rgba(15,23,42,0.10)] p-8 md:p-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl text-emerald-600 mb-5">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-[26px] font-black text-text-primary mb-2">{t("license.title")}</h1>
          <p className="text-[15px] text-text-secondary font-medium leading-relaxed">
            {isExpiredLock ? t("license.subtitle.expired") : t("license.subtitle.locked")}
          </p>
        </div>

        {/* Machine code block */}
        <div className="rounded-2xl border border-border-normal bg-bg-overlay/70 p-5 mb-6">
          <div className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">
            {t("license.machineCode")}
          </div>
          {machineCode ? (
            <div className="font-mono text-lg font-bold text-text-primary break-all leading-relaxed" dir="ltr">
              {machineCode}
            </div>
          ) : (
            <div className="text-red-600 font-bold text-sm">{t("license.error.hardware")}</div>
          )}

          {/* Code actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={copyCode}
              disabled={!machineCode}
              className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl bg-bg-surface border border-border-normal hover:border-emerald-300 hover:text-emerald-700 transition-colors disabled:opacity-40"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? t("license.copied") : t("license.copy")}
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              disabled={!info?.qrDataUrl}
              className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl bg-bg-surface border border-border-normal hover:border-emerald-300 hover:text-emerald-700 transition-colors disabled:opacity-40"
            >
              <QrCode className="w-4 h-4" />
              {t("license.showQr")}
            </button>
          </div>

          {showQr && info?.qrDataUrl ? (
            <div className="flex justify-center mt-4">
              <img
                src={info.qrDataUrl}
                alt={t("license.machineCode")}
                className="w-44 h-44 rounded-xl border border-border-normal bg-bg-surface p-2"
              />
            </div>
          ) : null}

          <p className="text-[13px] text-text-secondary font-medium mt-4 leading-relaxed">
            {t("license.instructions")}
          </p>
        </div>

        {/* Activation input */}
        <div
          className="rounded-2xl border border-border-normal p-5 mb-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <div className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-3">
            {t("license.activateSection")}
          </div>
          <p className="text-[13px] text-emerald-700 font-semibold mb-3 leading-relaxed">
            {t("license.filePreferred")}
          </p>
          <textarea
            value={blob}
            onChange={(e) => setBlob(e.target.value)}
            rows={3}
            dir="ltr"
            placeholder={t("license.pastePlaceholder")}
            className="w-full rounded-xl border-2 border-border-normal focus:border-emerald-500 bg-bg-overlay/80 focus:bg-bg-surface p-3 font-mono text-[13px] text-text-primary focus:outline-none resize-none transition-colors"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={pickFile}
              className="flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl bg-bg-surface border border-border-normal hover:border-emerald-300 hover:text-emerald-700 transition-colors"
            >
              <FileKey className="w-4 h-4" />
              {t("license.chooseFile")}
            </button>
            <span className="text-[12px] text-text-muted font-medium">{t("license.orDrop")}</span>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="mb-5 p-4 rounded-xl flex items-center gap-3 bg-red-50 border border-red-200 text-red-800">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold leading-relaxed">{error}</p>
          </div>
        ) : null}

        {/* Activate button */}
        <button
          type="button"
          onClick={() => activate({ blob })}
          disabled={submitting || (!blob.trim())}
          className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-black text-[17px] py-[18px] rounded-2xl hover:bg-[var(--primary-600)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("license.verifying")}
            </>
          ) : (
            t("license.activate")
          )}
        </button>

        {/* Contact footnote */}
        <p className="text-center text-text-muted text-[13px] font-semibold mt-6">
          {t("license.contact")}
        </p>
      </div>
      </div>
    </div>
  );
}
