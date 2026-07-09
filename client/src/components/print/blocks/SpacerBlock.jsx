export default function SpacerBlock({ props = {} }) {
  const bg = props.background || props.bg || "transparent";
  const width = props.width || "100%";
  return <div style={{ height: `${props.height ?? 8}px`, background: bg, width, margin: "0 auto" }} />;
}
