import React from "react";

export default function Textarea({ label, value, onChange, placeholder, rows = 3, required, disabled, error }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-text-primary">{label}</label>}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        disabled={disabled}
        className={`input w-full text-sm transition-colors ${error ? "border-danger/50 bg-danger/10 focus:border-danger/60 focus:ring-danger/30" : ""}`}
      />
      {error ? <p className="text-xs text-danger-DEFAULT">{error}</p> : null}
    </div>
  );
}
