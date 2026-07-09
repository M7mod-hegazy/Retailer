import React from "react";
import { g } from "./blockUtils";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";

export default function LogoBlock({ settings: s, props = {}, family, editing }) {
  const showLogo = g(s, "show_logo") !== false;
  if (!showLogo) return null;

  const align = props.align || s.logo_alignment || "center";
  const maxHeight = props.maxHeight || s.logo_max_height || 48;
  const borderWidth = props.borderWidth != null ? Number(props.borderWidth) : 0;
  const borderStyle = props.borderStyle || "solid";
  const borderColor = props.borderColor || "#000";
  const borderRadius = props.borderRadius != null ? Number(props.borderRadius) : 0;
  const shadow = props.shadow || "none";
  const shadowMap = {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.15)"
  };

  const imgStyle = {
    maxHeight: `${maxHeight}px`,
    objectFit: "contain",
    display: "block",
    ...(borderWidth > 0 ? { border: `${borderWidth}px ${borderStyle} ${borderColor}` } : {}),
    ...(borderRadius > 0 ? { borderRadius: `${borderRadius}px` } : {}),
    boxShadow: shadowMap[shadow] || "none"
  };

  const alignMap = { right: "flex-end", center: "center", left: "flex-start" };
  const justifyContent = alignMap[align] || "center";

  if (!s.logo_url) {
    if (editing) {
      return (
        <div style={{ display: "flex", justifyContent, width: "100%", marginBottom: "4px" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "2px dashed #7c3aed",
            background: "#f5f3ff",
            color: "#7c3aed",
            fontSize: "10px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center"
          }}>
            شعار
          </div>
        </div>
      );
    }
    return null;
  }
  return (
    <div style={{ display: "flex", justifyContent, width: "100%", marginBottom: "4px" }}>
      <img src={resolveImageUrl(s.logo_url)} alt="" style={imgStyle} />
    </div>
  );
}
