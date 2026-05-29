import React from "react";
import { g } from "./blockUtils";

export default function BranchBlock({ settings: s }) {
  if (g(s, "show_branch") === false || !s.branch_name) return null;
  return <div>{s.branch_name}</div>;
}
