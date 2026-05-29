import React from "react";
import { g } from "./blockUtils";

export default function BranchBlock({ settings: s, family }) {
  if (g(s, "show_branch") === false || !s.branch_name) return null;
  if (family === "page") {
    return <div style={{ fontSize: "11px", color: "#64748b" }}>{s.branch_name}</div>;
  }
  return <div>{s.branch_name}</div>;
}
