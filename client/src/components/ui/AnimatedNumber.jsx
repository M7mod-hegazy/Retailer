import React, { useEffect, useState } from "react";
import { formatNumber } from "../../utils/currency";

export default function AnimatedNumber({ value = 0, duration = 600, className = "", formatter = (next) => formatNumber(next) }) {
  const numericValue = Number(value || 0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frameId;
    let startTime;
    const start = display;
    const delta = numericValue - start;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + delta * eased));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      }
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [numericValue]);

  return <span className={className}>{formatter(display)}</span>;
}
