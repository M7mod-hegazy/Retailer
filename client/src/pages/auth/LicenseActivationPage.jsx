import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import Button from "../../components/ui/Button";

async function fetchHardwareIdWithRetry(maxAttempts = 8) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await api.get("/api/settings/hardware-id");
      const id = String(response.data?.data?.hardware_id || "").trim();
      if (id) return id;
      throw new Error("hardware id empty");
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 500 + attempt * 300));
      }
    }
  }
  throw lastError || new Error("hardware id unavailable");
}

export default function LicenseActivationPage() {
  const [activationInput, setActivationInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [hardwareId, setHardwareId] = useState("");
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [hardwareError, setHardwareError] = useState("");
  const [protectionMode, setProtectionMode] = useState("hybrid_license");
  const [loadingMode, setLoadingMode] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/settings/setup-status")
      .then((response) => {
        if (!mounted) return;
        setProtectionMode(String(response?.data?.data?.protection_mode || "hybrid_license"));
      })
      .catch(() => {
        if (!mounted) return;
        setProtectionMode("hybrid_license");
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingMode(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (protectionMode !== "hybrid_license") return undefined;
    let mounted = true;
    setHardwareLoading(true);
    setHardwareError("");
    fetchHardwareIdWithRetry()
      .then((id) => {
        if (!mounted) return;
        setHardwareId(id);
      })
      .catch(() => {
        if (!mounted) return;
        setHardwareError("تعذر قراءة معرف الجهاز حالياً.");
      })
      .finally(() => {
        if (!mounted) return;
        setHardwareLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [protectionMode]);

  async function retryHardware() {
    setHardwareLoading(true);
    setHardwareError("");
    try {
      const id = await fetchHardwareIdWithRetry();
      setHardwareId(id);
    } catch (_error) {
      setHardwareError("لا يمكن قراءة معرف الجهاز الآن.");
    } finally {
      setHardwareLoading(false);
    }
  }

  async function activate(event) {
    event.preventDefault();
    setStatus("checking");
    setMessage("");
    try {
      const response = await api.post("/api/license/activate", { signed_license: activationInput.trim() });
      const result = response.data?.data || {};
      setStatus("success");
      setMessage(result.message || "تم التفعيل بنجاح.");
      toast.success("تم التفعيل بنجاح");
    } catch (error) {
      setStatus("error");
      setMessage(error.response?.data?.message || "تعذر التفعيل حالياً.");
    }
  }

  function copyHardwareId() {
    if (!hardwareId) return;
    navigator.clipboard.writeText(hardwareId);
    toast.success("تم نسخ معرف الجهاز");
  }

  if (loadingMode) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10 text-center text-slate-600" dir="rtl">
        جاري التحميل...
      </div>
    );
  }

  if (protectionMode === "windows_managed") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-lg md:p-8">
        <h1 className="text-3xl font-black text-slate-900">تفعيل الترخيص</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">ألصق مفتاح ELH1 أو ملف الترخيص الموقع ثم نفذ التفعيل.</p>

        <form onSubmit={activate} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-slate-700">
            مفتاح التفعيل
            <textarea
              value={activationInput}
              onChange={(event) => setActivationInput(event.target.value)}
              className="mt-2 min-h-[180px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-emerald-200 transition focus:ring-4"
              required
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-slate-700">معرف الجهاز</div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={retryHardware}>
                  إعادة المحاولة
                </Button>
                <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={copyHardwareId} disabled={!hardwareId}>
                  <Copy className="h-4 w-4" />
                  نسخ
                </Button>
              </div>
            </div>
            <code className="mt-2 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
              {hardwareLoading ? "جاري القراءة..." : hardwareId || "غير متاح"}
            </code>
            {hardwareError ? <div className="mt-2 text-xs text-red-600">{hardwareError}</div> : null}
          </div>

          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {message || "أدخل المفتاح ثم اضغط تفعيل الآن."}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="btn btn-ghost flex-1 justify-center">
              العودة لتسجيل الدخول
            </Link>
            <Button type="submit" className="flex-1 justify-center" disabled={!activationInput || status === "checking" || hardwareLoading}>
              {status === "checking" ? "جاري التحقق..." : "تفعيل الآن"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

