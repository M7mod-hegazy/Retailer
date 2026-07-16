import React, { useId } from "react";

/**
 * The ElHegazi (الحجازي) app mark — same shape/gradient as build/electron/assets
 * icon.png and client/public/favicon.svg, as an inline React SVG so it can be
 * sized, animated, and dark/light-composited freely in UI (login, dashboard).
 * Keep this shape in sync with favicon.svg if that ever changes.
 */
export default function ElHegaziMark({ size = 40, rounded = true, glow = false, className = "" }) {
  const uid = useId().replace(/[:]/g, "");
  const bgId = `ehg-bg-${uid}`;
  const glassId = `ehg-glass-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      className={className}
      style={glow ? { filter: "drop-shadow(0 6px 18px rgba(16,185,129,0.45))" } : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgId} x1="16" y1="8" x2="112" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#065F46" />
        </linearGradient>
        <linearGradient id={glassId} x1="30" y1="24" x2="96" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" stopOpacity=".95" />
          <stop offset="1" stopColor="#D1FAE5" stopOpacity=".76" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="104" height="104" rx={rounded ? 30 : 8} fill="#07111F" />
      <rect x="16" y="16" width="96" height="96" rx={rounded ? 26 : 6} fill={`url(#${bgId})`} />
      <path d="M36 38c0-3.314 2.686-6 6-6h44c3.314 0 6 2.686 6 6v52c0 3.314-2.686 6-6 6H42c-3.314 0-6-2.686-6-6V38Z" fill="#081423" fillOpacity=".22" />
      <path d="M40 34c0-2.21 1.79-4 4-4h40c2.21 0 4 1.79 4 4v50c0 2.21-1.79 4-4 4H44c-2.21 0-4-1.79-4-4V34Z" fill={`url(#${glassId})`} />
      <path d="M50 48h28" stroke="#065F46" strokeWidth="8" strokeLinecap="round" />
      <path d="M50 64h20" stroke="#10B981" strokeWidth="8" strokeLinecap="round" />
      <path d="M50 80h32" stroke="#064E3B" strokeWidth="8" strokeLinecap="round" />
      <circle cx="90" cy="42" r="7" fill="#F59E0B" />
      <path d="M32 24c12-10 34-12 52-6" stroke="#ECFDF5" strokeOpacity=".35" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
