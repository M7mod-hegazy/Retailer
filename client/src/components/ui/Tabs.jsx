import React from "react";

export function Tabs({ tabs = [], active, onChange }) {
  return (
    <div className="flex gap-2 border-b border-border-normal/8">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          data-help-tab={tab.value}
          className={`rounded-t-2xl px-4 py-2 text-sm transition ${active === tab.value ? "border-b-2 border-primary font-bold text-text-primary" : "text-text-secondary hover:text-text-primary"}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
