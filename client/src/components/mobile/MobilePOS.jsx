import React from "react";

export default function MobilePOS({ children }) {
  return (
    <div className="space-y-4 px-3 pb-24 pt-3">
      <div className="glass-panel px-4 py-3">
        <div className="text-sm text-text-secondary">وضع الجوال</div>
        <div className="text-lg font-semibold text-text-primary">نقطة البيع السريعة</div>
      </div>
      {children}
    </div>
  );
}
