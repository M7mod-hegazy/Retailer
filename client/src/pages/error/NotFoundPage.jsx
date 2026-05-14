import React from "react";
import { Link } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] p-6" dir="rtl">
      <div className="relative w-full max-w-lg mx-auto">
        <div className="absolute top-[-20%] left-[50%] w-[500px] h-[500px] bg-amber-200/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative bg-white/95 backdrop-blur-3xl border border-slate-200/60 rounded-[2.5rem] p-12 md:p-16 shadow-[0_20px_60px_-10px_rgba(15,23,42,0.08)] text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 shadow-[0_8px_30px_-6px_rgba(245,158,11,0.15)] mb-8">
            <AlertTriangle className="h-12 w-12" strokeWidth={1.5} />
          </div>
          <h1 className="text-[100px] font-black leading-none text-slate-900 tracking-tight">404</h1>
          <h2 className="mt-4 text-2xl font-black text-slate-800">الصفحة غير موجودة</h2>
          <p className="mt-3 text-[15px] font-medium text-slate-500 leading-relaxed">
            عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.
            <br />
            تحقق من الرابط أو عد إلى لوحة التحكم.
          </p>
          <Link
            to="/dashboard"
            className="group mt-8 inline-flex items-center gap-3 rounded-2xl bg-slate-900 px-8 py-4 text-[15px] font-black text-white shadow-[0_8px_30px_-8px_rgba(15,23,42,0.4)] transition-all hover:bg-slate-800 hover:shadow-[0_12px_40px_-10px_rgba(15,23,42,0.5)] active:scale-95"
          >
            <Home className="h-5 w-5" />
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
