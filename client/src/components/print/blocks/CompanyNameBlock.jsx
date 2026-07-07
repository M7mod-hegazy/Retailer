import React from "react";
import { g } from "./blockUtils";

/**
 * Company name block — variants:
 *  "standard"          Plain colored name text (default)
 *  "retro-brutalist"   Solid accent banner with white text, uppercase
 *  "underline-accent"  Name with thick left accent border (pull-quote style)
 *  "stacked-bilingual" Arabic name bold top, English name small below
 *  "initial-cap"       First letter rendered huge, rest follows inline
 */
export default function CompanyNameBlock({ settings: s, props = {}, family, editing }) {
  const name = s.company_name || (editing ? "مؤسسة النجم الذهبي للتجارة" : "");
  if (!name) return null;

  const size = `${Math.max(15, Number(g(s, "header_font_size")) || 18)}px`;
  const variant = props.variant || "standard";
  const accentColor = g(s, "accent_color") || "#1e3a5f";
  const isRoll = family === "roll";

  const slogan = props.slogan || props.subtitle || "";
  const sloganSize = props.sloganSize || 11;
  const sloganAlign = props.sloganAlign || (isRoll ? "center" : "right");
  const sloganBold = props.sloganBold === true;
  const sloganItalic = props.sloganItalic === true;

  const renderSlogan = () => {
    if (!slogan) return null;
    return (
      <div style={{
        fontSize: `${sloganSize}px`,
        fontWeight: sloganBold ? 800 : 500,
        fontStyle: sloganItalic ? "italic" : "normal",
        textAlign: sloganAlign,
        color: isRoll ? "#000" : "#64748b",
        marginTop: "3px",
        width: "100%",
      }}>
        {slogan}
      </div>
    );
  };

  const renderContent = () => {
    /* ── retro-brutalist: solid filled banner ── */
    if (variant === "retro-brutalist") {
      const bg = isRoll ? "#000" : accentColor;
      return (
        <div
          style={{
            background: bg,
            color: "#fff",
            padding: "8px 12px",
            textAlign: "center",
            fontWeight: 900,
            fontSize: size,
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "8px",
            border: isRoll ? "2px solid #000" : "none",
          }}
        >
          {name}
        </div>
      );
    }

    /* ── underline-accent: thick left border pull-quote ── */
    if (variant === "underline-accent") {
      return (
        <div style={{
          borderRight: isRoll ? `4px solid #000` : `4px solid ${accentColor}`,
          paddingRight: "10px",
          marginBottom: "6px",
          display: "inline-block",
          maxWidth: "100%",
        }}>
          <div style={{ fontSize: size, fontWeight: 900, color: isRoll ? "#000" : accentColor, lineHeight: 1.2 }}>{name}</div>
        </div>
      );
    }

    /* ── stacked-bilingual: Arabic bold + English small below ── */
    if (variant === "stacked-bilingual") {
      const enName = props.englishName || s.company_name_en || "";
      return (
        <div style={{ marginBottom: "6px" }}>
          <div style={{ fontSize: size, fontWeight: 900, color: isRoll ? "#000" : accentColor, lineHeight: 1.2 }}>{name}</div>
          {enName && (
            <div style={{ fontSize: `${Math.max(10, Number(g(s, "header_font_size")) - 5 || 11)}px`, fontWeight: 600, color: isRoll ? "#000" : "#64748b", fontFamily: "monospace", letterSpacing: "0.5px", marginTop: "1px" }}>{enName}</div>
          )}
        </div>
      );
    }

    /* ── initial-cap: giant first letter + rest inline ── */
    if (variant === "initial-cap") {
      const first = name.charAt(0);
      const rest = name.slice(1);
      return (
        <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "6px" }}>
          <span style={{
            fontSize: `${Number(g(s, "header_font_size") || 18) + 12}px`,
            fontWeight: 900,
            color: isRoll ? "#000" : accentColor,
            lineHeight: 1,
          }}>{first}</span>
          <span style={{ fontSize: size, fontWeight: 700, color: isRoll ? "#000" : "#334155" }}>{rest}</span>
        </div>
      );
    }

    /* ── roll standard ── */
    if (isRoll) {
      const underline = props.underline !== false;
      return (
        <div style={{
          textAlign: "center",
          marginBottom: "8px",
          ...(underline ? { paddingBottom: "6px", borderBottom: "1px solid #000" } : {}),
        }}>
          <div style={{ fontSize: size, fontWeight: 900, letterSpacing: "1px", color: "#000" }}>{name}</div>
        </div>
      );
    }

    /* ── page standard ── */
    return (
      <div style={{ fontSize: size, fontWeight: 900, color: accentColor }}>
        {name}
      </div>
    );
  };

  return (
    <div style={{ width: "100%" }}>
      {renderContent()}
      {renderSlogan()}
    </div>
  );
}
