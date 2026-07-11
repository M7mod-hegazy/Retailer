import React, { useEffect, useState } from "react";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";
import { toThermalBitmap } from "../../../utils/thermalImage";

const ALIGN_MAP = { right: "flex-end", center: "center", left: "flex-start" };

// Generic image/banner block (promo banners, restaurant logos, kitchen
// stamps, …). On roll (thermal) output the image is pre-processed into a
// high-contrast 1-bit bitmap before printing, since 1-bit heads can't dither
// grayscale — unless the caller explicitly opts out via props.thermalProcess.
export default function ImageBlock({ props = {}, family, editing }) {
  const src = props.src;
  const resolved = src ? resolveImageUrl(src) : null;
  const [displaySrc, setDisplaySrc] = useState(resolved);

  useEffect(() => {
    setDisplaySrc(resolved);
    if (!resolved) return undefined;
    if (family !== "roll" || props.thermalProcess === false) return undefined;
    let cancelled = false;
    toThermalBitmap(resolved).then((out) => {
      if (!cancelled) setDisplaySrc(out);
    });
    return () => { cancelled = true; };
  }, [resolved, family, props.thermalProcess]);

  if (!src) {
    if (editing) {
      return (
        <div style={{
          height: "40px",
          border: "2px dashed #7c3aed",
          background: "#f5f3ff",
          color: "#7c3aed",
          fontSize: "11px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "4px 0",
          borderRadius: "4px"
        }}>
          [صورة إضافية / بنر إعلاني]
        </div>
      );
    }
    return null;
  }

  const variant = props.variant || "standard";
  const maxHeight = props.maxHeight != null ? props.maxHeight : (variant === "banner" ? 120 : 60);
  const justifyContent = ALIGN_MAP[props.align] || ALIGN_MAP.center;

  const isRoll = family === "roll";

  // Thermal heads can't render box-shadow (1-bit, no grayscale) — roll
  // substitutes a double border ("card") or dashed top/bottom rules
  // ("banner") for the elevation effect page paper gets via shadow.
  const borderWidth = props.borderWidth != null
    ? Number(props.borderWidth)
    : (isRoll ? (variant === "card" ? 3 : 0) : (variant === "card" ? 1 : 0));
  const borderStyle = props.borderStyle || (isRoll && variant === "card" ? "double" : "solid");
  const borderColor = props.borderColor || (isRoll ? "#000" : (variant === "card" ? "#e2e8f0" : "#000"));
  const borderRadius = props.borderRadius != null
    ? Number(props.borderRadius)
    : (isRoll ? 0 : (variant === "card" ? 8 : variant === "banner" ? 4 : 0));
  const shadow = isRoll ? "none" : (props.shadow || (variant === "card" ? "md" : "none"));
  const shadowMap = {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.15)"
  };

  const imgStyle = {
    maxHeight: `${maxHeight}px`,
    objectFit: variant === "banner" ? "cover" : "contain",
    display: "block",
    ...(variant === "banner" ? { width: "100%" } : {}),
    ...(variant === "card" && !isRoll ? { padding: "4px", background: "#fff" } : {}),
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}` } : {}),
    ...(isRoll && variant === "banner" ? { borderTop: "1px dashed #000", borderBottom: "1px dashed #000" } : {}),
    ...(borderRadius > 0 ? { borderRadius: `${borderRadius}px` } : {}),
    boxShadow: shadowMap[shadow] || "none"
  };

  return (
    <div style={{ display: "flex", justifyContent, margin: "2mm 0", width: "100%" }}>
      <img src={displaySrc} alt="" style={imgStyle} />
    </div>
  );
}
