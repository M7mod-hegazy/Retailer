import React from "react";

export default function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-3 ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-bg-surface/15"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-bg-surface shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  );
}
