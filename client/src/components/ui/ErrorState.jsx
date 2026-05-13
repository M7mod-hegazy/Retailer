import React from "react";

export function ErrorState({ message = "حدث خطأ أثناء التحميل" }) {
  return (
    <div className="glass-panel rounded-[16px] border border-danger/40 bg-danger/10 p-4 text-danger-DEFAULT shadow-glow-red">
      {message}
    </div>
  );
}
