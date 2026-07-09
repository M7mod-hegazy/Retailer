import React from "react";
import { g } from "./blockUtils";

export default function DocTitleBlock({ settings: s, props = {}, family }) {
  if (family === "roll") return null;
  if (props.show === false) return null;
  const title = props.text !== undefined && props.text !== "" ? props.text : (props.title || "عنوان المستند");
  if (!title) return null;
  return <div style={{ fontSize: "18px", fontWeight: 900, color: g(s, "accent_color") }}>{title}</div>;
}
