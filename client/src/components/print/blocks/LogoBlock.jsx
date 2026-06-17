import React from "react";
import { g } from "./blockUtils";
import { resolveImageUrl } from "../../../utils/resolveImageUrl";

export default function LogoBlock({ settings: s }) {
  if (g(s, "show_logo") === false || !s.logo_url) return null;
  return <img src={resolveImageUrl(s.logo_url)} alt="" style={{ maxHeight: `${g(s, "logo_max_height")}px`, objectFit: "contain", display: "block", margin: "0 auto 4px" }} />;
}
