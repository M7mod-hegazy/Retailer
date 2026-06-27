import toast from "react-hot-toast";

/**
 * Shows an API error as a toast. When the server attached diagnostic detail
 * (e.g. a foreign-key violation report), the toast includes a "نسخ التفاصيل"
 * button that copies a full, support-ready report to the clipboard.
 */
export function showApiError(e, fallback = "حدث خطأ غير متوقع") {
  const data = e?.response?.data || {};
  const message = data.message || e?.message || fallback;
  const detail = data.detail || null;

  if (!detail) {
    toast.error(message);
    return;
  }

  const report = [
    `الخطأ: ${message}`,
    data.code ? `الكود: ${data.code}` : null,
    e?.config?.method && e?.config?.url ? `الطلب: ${String(e.config.method).toUpperCase()} ${e.config.url}` : null,
    "",
    detail,
  ]
    .filter((l) => l !== null)
    .join("\n");

  toast.error(
    (t) => (
      <div className="flex flex-col gap-2 text-right" style={{ maxWidth: 360 }}>
        <div className="font-semibold">{message}</div>
        <pre className="whitespace-pre-wrap text-xs opacity-80" style={{ maxHeight: 160, overflow: "auto" }}>
          {detail}
        </pre>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="px-2 py-1 rounded text-xs"
            style={{ background: "var(--danger, #e11d48)", color: "#fff" }}
            onClick={() => {
              navigator.clipboard?.writeText(report).then(
                () => toast.success("تم نسخ تفاصيل الخطأ"),
                () => {}
              );
            }}
          >
            نسخ التفاصيل
          </button>
          <button type="button" className="px-2 py-1 rounded text-xs opacity-70" onClick={() => toast.dismiss(t.id)}>
            إغلاق
          </button>
        </div>
      </div>
    ),
    { duration: 12000 }
  );
}

export default showApiError;
