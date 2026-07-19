import React from "react";

export default function StatusDot({ status }) {
  const colors = {
    active: "bg-primary",
    inactive: "bg-bg-surface/20",
    warning: "bg-warning-DEFAULT",
    error: "bg-danger-DEFAULT",
  };
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status] || colors.inactive}`} />
  );
}
