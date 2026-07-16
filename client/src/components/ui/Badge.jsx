import React, { useEffect, useRef } from "react";

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
  const prevLabelRef = useRef(label);
  const spanRef = useRef(null);

  useEffect(() => {
    if (prevLabelRef.current !== label && spanRef.current) {
      spanRef.current.style.animation = "none";
      // Force reflow
      void spanRef.current.offsetHeight;
      spanRef.current.style.animation = "badgePulse 0.4s ease-out";
    }
    prevLabelRef.current = label;
  }, [label]);

  return (
    <>
      <style>{`@keyframes badgePulse { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }`}</style>
      <span ref={spanRef} className={`badge ${variantClass}`}>
        {label}
      </span>
    </>
  );
}
