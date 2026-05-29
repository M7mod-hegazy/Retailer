import React from "react";
import LayoutRenderer from "./LayoutRenderer";

/**
 * Real-print thermal receipt (58mm / 80mm).
 * Thin shim over the shared block library (LayoutRenderer, roll family).
 * Respects all settings toggles, custom text blocks, fonts, colors.
 */
export function PrintThermalDoc({ invoice = {}, settings = {} }) {
  return <LayoutRenderer family="roll" invoice={invoice} settings={settings} layout={settings.layout || null} />;
}

/**
 * Real-print A4/A5 document.
 * Thin shim over the shared block library (LayoutRenderer, page family + zones).
 * Respects all settings toggles, custom text blocks, fonts, colors.
 */
export function PrintA4Doc({ invoice = {}, settings = {}, size = "A4" }) {
  return <LayoutRenderer family="page" invoice={invoice} settings={settings} layout={settings.layout || null} size={size} />;
}
