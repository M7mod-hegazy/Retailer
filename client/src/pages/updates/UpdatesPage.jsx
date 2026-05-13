import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import {
  CheckCircle2,
  ArrowDownCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUpCircle,
} from "lucide-react";
import { useUpdateStore } from "../../stores/updateStore";
import { toast } from "react-hot-toast";

export default function UpdatesPage() {
  const { t } = useTranslation();
  const { available, downloaded, info, progress, error, checking, setChecking, reset } =
    useUpdateStore();

  const [currentVersion, setCurrentVersion] = useState("...");
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  useEffect(() => {
    window.electronAPI?.invoke?.("system:get-version").then((v) => {
      if (v) setCurrentVersion(v);
    });
  }, []);

  const handleCheckNow = async () => {
    setChecking(true);
    setLastCheckedAt(Date.now());
    await window.electronAPI?.invoke("update:check");
  };

  const handleDownload = async () => {
    setChecking(true);
    await window.electronAPI?.invoke("update:download");
    setChecking(false);
  };

  const handleInstallNow = async () => {
    await window.electronAPI?.invoke("update:install-now");
  };

  const handleInstallOnRestart = () => {
    toast.success("سيتم التثبيت عند إعادة التشغيل التالي");
  };

  // Determine banner state
  const getBannerProps = () => {
    if (checking) {
      return {
        colorClasses: "bg-slate-100 text-slate-600 border-slate-200",
        icon: <Loader2 className="w-5 h-5 animate-spin shrink-0" />,
        message: "جاري التحقق عن التحديثات...",
        buttons: null,
      };
    }
    if (error) {
      return {
        colorClasses: "bg-red-50 text-red-800 border-red-200",
        icon: <AlertCircle className="w-5 h-5 shrink-0" />,
        message: typeof error === "string" ? error : "حدث خطأ أثناء التحقق من التحديثات",
        buttons: (
          <button
            onClick={handleCheckNow}
            className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        ),
      };
    }
    if (downloaded) {
      return {
        colorClasses: "bg-indigo-50 text-indigo-800 border-indigo-200",
        icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
        message: `التحديث جاهز للتثبيت — الإصدار ${info?.version ?? ""}`,
        buttons: (
          <div className="flex gap-2">
            <button
              onClick={handleInstallNow}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              تثبيت الآن
            </button>
            <button
              onClick={handleInstallOnRestart}
              className="px-4 py-1.5 border border-indigo-400 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              تثبيت عند إعادة التشغيل
            </button>
          </div>
        ),
      };
    }
    if (progress) {
      return {
        colorClasses: "bg-amber-50 text-amber-800 border-amber-200",
        icon: <Loader2 className="w-5 h-5 animate-spin shrink-0" />,
        message: `جاري التحميل... ${progress.percent?.toFixed(0) ?? 0}%`,
        buttons: null,
        showProgress: true,
      };
    }
    if (available && !downloaded) {
      return {
        colorClasses: "bg-blue-50 text-blue-800 border-blue-200",
        icon: <ArrowDownCircle className="w-5 h-5 shrink-0" />,
        message: `تحديث متاح — الإصدار ${info?.version ?? ""}`,
        buttons: (
          <button
            onClick={handleDownload}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            تحميل التحديث
          </button>
        ),
      };
    }
    // Up to date
    return {
      colorClasses: "bg-green-50 text-green-800 border-green-200",
      icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
      message: `التطبيق محدث — الإصدار ${currentVersion}`,
      buttons: (
        <button
          onClick={handleCheckNow}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          تحقق الآن
        </button>
      ),
    };
  };

  const banner = getBannerProps();

  return (
    <div dir="rtl" className="min-h-full bg-gray-50 p-6">
      {/* Page Title */}
      <div className="flex items-center gap-2 mb-6">
        <ArrowUpCircle className="w-6 h-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">التحديثات</h1>
      </div>

      {/* Status Banner */}
      <div
        className={`w-full border rounded-xl p-4 mb-6 flex flex-col gap-3 ${banner.colorClasses}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            {banner.icon}
            <span>{banner.message}</span>
          </div>
          {banner.buttons && <div>{banner.buttons}</div>}
        </div>
        {banner.showProgress && (
          <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Right column — App Info Card (fixed width) */}
        <div className="w-80 shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              معلومات التطبيق
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">الإصدار الحالي</dt>
                <dd className="font-mono font-semibold text-gray-800">{currentVersion}</dd>
              </div>
              {available && info?.version && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">الإصدار المتاح</dt>
                  <dd className="font-mono font-semibold text-blue-700">{info.version}</dd>
                </div>
              )}
              {info?.releaseDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">تاريخ الإصدار</dt>
                  <dd className="text-gray-800">
                    {new Date(info.releaseDate).toLocaleDateString("ar")}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">آخر فحص</dt>
                <dd className="text-gray-800">
                  {lastCheckedAt
                    ? new Date(lastCheckedAt).toLocaleTimeString("ar")
                    : "—"}
                </dd>
              </div>
            </dl>

            <button
              onClick={handleCheckNow}
              disabled={checking}
              className="mt-5 w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
              تحقق عن تحديثات
            </button>
          </div>
        </div>

        {/* Left column — Release Notes */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              ملاحظات الإصدار {info?.version ?? currentVersion}
            </h2>
            <div
              dir="rtl"
              className="max-h-96 overflow-y-auto text-sm text-gray-700 prose prose-sm max-w-none"
            >
              {info?.releaseNotes ? (
                <ReactMarkdown>{info.releaseNotes}</ReactMarkdown>
              ) : (
                <p className="text-gray-400 italic">لا توجد ملاحظات متاحة</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
