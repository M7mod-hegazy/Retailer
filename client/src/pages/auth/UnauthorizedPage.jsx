import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowRight } from "lucide-react";

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="flex min-h-[70vh] w-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldAlert strokeWidth={1.75} className="h-7 w-7" />
        </div>
        <h1 className="text-[20px] font-black tracking-tight text-zinc-900">
          ليس لديك صلاحية للوصول لهذه الصفحة
        </h1>
        <p className="mt-2 text-[13px] font-semibold text-zinc-500">
          يرجى التواصل مع مدير النظام إذا كنت تحتاج لهذه الصلاحية.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-[13px] font-black text-white shadow-md shadow-zinc-900/10 transition-colors hover:bg-zinc-800"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </div>
    </div>
  );
}
