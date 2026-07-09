import React from "react";
import { g } from "./blockUtils";

export default function DocTitleBlock({ settings: s, props = {}, family }) {
  if (family === "roll") return null;
  if (props.show === false) return null;
  const title = props.text !== undefined && props.text !== "" ? props.text : (props.title || "عنوان المستند");
  if (!title) return null;

  const accentColor = g(s, "accent_color") || "#1e3a8a";
  const variant = props.variant || "standard";

  if (variant === "badge") {
    return (
      <div style={{
        display: "inline-block",
        background: accentColor,
        color: "#ffffff",
        padding: "4px 16px",
        borderRadius: "30px",
        fontSize: "14px",
        fontWeight: 900,
        textAlign: "center",
        marginBottom: "6px"
      }}>
        {title}
      </div>
    );
  }

  if (variant === "ruled") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        width: "100%",
        margin: "6px 0"
      }}>
        <div style={{ flex: 1, height: "1px", background: "#cbd5e1" }} />
        <span style={{ fontSize: "15px", fontWeight: 900, color: accentColor, whiteSpace: "nowrap" }}>
          {title}
        </span>
        <div style={{ flex: 1, height: "1px", background: "#cbd5e1" }} />
      </div>
    );
  }

  if (variant === "brutalist") {
    return (
      <div style={{
        border: "3px solid #000000",
        padding: "6px 12px",
        background: "#ffffff",
        boxShadow: "3px 3px 0px #000000",
        display: "inline-block",
        fontSize: "16px",
        fontWeight: 900,
        textTransform: "uppercase",
        color: "#000000",
        marginBottom: "8px"
      }}>
        {title}
      </div>
    );
  }

  return (
    <div style={{
      fontSize: "18px",
      fontWeight: 900,
      color: accentColor,
      borderBottom: `2px solid ${accentColor}`,
      paddingBottom: "4px",
      marginBottom: "8px",
      display: "inline-block"
    }}>
      {title}
    </div>
  );
}
