import React, { useEffect, useState } from "react";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";
import { toThermalBitmap } from "../../../utils/thermalImage";

const ALIGN_MAP = { right: "flex-end", center: "center", left: "flex-start" };

// Generic image/banner block (promo banners, restaurant logos, kitchen
// stamps, …). On roll (thermal) output the image is pre-processed into a
// high-contrast 1-bit bitmap before printing, since 1-bit heads can't dither
// grayscale — unless the caller explicitly opts out via props.thermalProcess.
export default function ImageBlock({ props = {}, family }) {
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

  if (!src) return null;

  const maxHeight = props.maxHeight != null ? props.maxHeight : 60;
  const justifyContent = ALIGN_MAP[props.align] || ALIGN_MAP.center;

  return (
    <div style={{ display: "flex", justifyContent, margin: "2mm 0" }}>
      <img src={displaySrc} alt="" style={{ maxHeight: `${maxHeight}px`, objectFit: "contain", display: "block" }} />
    </div>
  );
}
