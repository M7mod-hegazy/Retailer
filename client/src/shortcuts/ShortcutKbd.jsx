import React from "react";
import { useShortcutStore } from "./shortcutStore";
import { formatKeys } from "./registry";

// Renders the <kbd> badge for a shortcut from its CURRENT binding, so on-screen hints
// always match the user's chosen keys. Subscribes to the store → re-renders on rebind.
//
//   <ShortcutKbd id="pos.save" />
//   <ShortcutKbd id="pos.save" className="..." />   // override default styling
export default function ShortcutKbd({ id, className }) {
  const keys = useShortcutStore((s) => s.keysFor(id));
  if (!keys || !keys.length) return null;
  return (
    <kbd
      className={
        className ??
        "inline-flex items-center justify-center rounded bg-zinc-100 px-1 text-[9px] font-mono text-zinc-600"
      }
    >
      {formatKeys(keys)}
    </kbd>
  );
}

// Plain-text label for tooltips/title attributes: shortcutLabel("global.search") -> "Ctrl + K".
export function shortcutLabel(id) {
  return formatKeys(useShortcutStore.getState().keysFor(id));
}
