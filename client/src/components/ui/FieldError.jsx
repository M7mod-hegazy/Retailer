import React from "react";
import { AlertCircle } from "lucide-react";

export default function FieldError({ error, className = "" }) {
  if (!error) return null;
  return (
    <p className={`flex items-center gap-1.5 text-xs font-bold text-danger-text mt-1 ${className}`}>
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {error}
    </p>
  );
}
