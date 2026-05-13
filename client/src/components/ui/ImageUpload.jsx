import React, { useRef, useState } from "react";
import { Image, Loader2, Trash2, Upload } from "lucide-react";
import api from "../../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

/**
 * ImageUpload — click to pick a file, uploads immediately, calls onUpload(url) with the
 * server-relative URL (/uploads/xxx.jpg). Pass `url` for the current value.
 *
 * Props:
 *   url         — current image URL (server-relative or absolute)
 *   onUpload    — called with the new relative URL after upload
 *   onRemove    — called when the user clears the image
 *   size        — "sm" | "md" | "lg"  (default "md")
 *   className   — extra wrapper classes
 */
export default function ImageUpload({ url, onUpload, onRemove, size = "md", className = "" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const sizeCls = {
    sm: "h-10 w-10",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  }[size] || "h-16 w-16";

  const iconCls = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }[size] || "h-6 w-6";

  function resolveUrl(u) {
    if (!u) return null;
    if (u.startsWith("http")) return u;
    return `${BASE}${u}`;
  }

  async function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/api/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.url) {
        onUpload?.(res.data.url);
      } else {
        setError("فشل الرفع");
      }
    } catch (err) {
      setError(err.response?.data?.message || "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  const resolved = resolveUrl(url);

  return (
    <div className={`relative inline-block ${className}`}>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="اضغط لرفع صورة"
        className={`group relative flex items-center justify-center overflow-hidden rounded-xl border-2 transition-colors
          ${sizeCls}
          ${resolved
            ? "border-slate-200 hover:border-emerald-400"
            : "border-dashed border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50"}`}
      >
        {uploading ? (
          <Loader2 className={`animate-spin text-emerald-500 ${iconCls}`} />
        ) : resolved ? (
          <>
            <img src={resolved} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Upload className="h-4 w-4 text-white" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-emerald-500">
            <Image className={iconCls} />
            {size !== "sm" && <span className="text-[10px] font-bold">صورة</span>}
          </div>
        )}
      </button>

      {resolved && onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="إزالة الصورة"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-rose-500 text-white shadow hover:bg-rose-600"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      )}

      {error && <p className="mt-1 text-[10px] text-rose-600">{error}</p>}
    </div>
  );
}
