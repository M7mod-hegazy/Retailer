import React from "react";
import { useFeatureEnabled } from "../../hooks/useFeature";
import { Lock } from "lucide-react";

export default function FeatureRoute({ featureKey, children }) {
  const enabled = useFeatureEnabled(featureKey);
  if (enabled) return children;
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="flex flex-col items-center gap-4 text-slate-400 max-w-xs text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Lock className="h-6 w-6 text-slate-400" />
        </div>
        <div>
          <h2 className="text-base font-black text-slate-700 mb-1">الميزة غير مفعّلة</h2>
          <p className="text-sm font-bold text-slate-400 leading-relaxed">
            يمكنك تفعيل هذه الميزة من{" "}
            <a href="/settings?tab=features" className="text-emerald-600 underline">
              الإعدادات &rarr; الميزات
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
