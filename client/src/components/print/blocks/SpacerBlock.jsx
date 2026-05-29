import React from "react";

export default function SpacerBlock({ props = {} }) {
  return <div style={{ height: `${props.height ?? 8}px` }} />;
}
