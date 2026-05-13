import React from "react";

const variants = {
  primary: "badge--primary",
  success: "badge--success",
  danger: "badge--danger",
  warning: "badge--warning",
  info: "badge--info",
  neutral: "badge--neutral",
};

const colors = {
  blue: "info",
  green: "success",
  red: "danger",
  yellow: "warning",
  gray: "neutral",
  purple: "primary",
};

export default function Badge({ label, color = "blue", variant }) {
  const variantClass = variant || variants[colors[color]] || "badge--neutral";
  
  return (
    <span className={`badge ${variantClass}`}>
      {label}
    </span>
  );
}