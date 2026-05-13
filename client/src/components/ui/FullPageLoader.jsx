import React from "react";
import LoadingSpinner from "./LoadingSpinner";

export default function FullPageLoader({ text = "جاري التحميل..." }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/70 backdrop-blur-md">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
