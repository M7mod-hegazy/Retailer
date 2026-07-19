import { COLOR_THEMES, DEFAULT_THEME, DEFAULT_THEME_VARS } from "../constants/colorThemes";
// Imported as a string (not injected) so we can toggle it per-theme.
import overrideCss from "./colorThemeOverrides.css?inline";

const OVERRIDE_STYLE_ID = "color-theme-overrides";
const ALL_VAR_KEYS = Object.keys(DEFAULT_THEME_VARS);

// Inject or remove the global Tailwind-color override stylesheet.
function setOverrideEnabled(enabled) {
  const existing = document.getElementById(OVERRIDE_STYLE_ID);
  if (enabled) {
    if (existing) return;
    const style = document.createElement("style");
    style.id = OVERRIDE_STYLE_ID;
    style.textContent = overrideCss;
    document.head.appendChild(style);
  } else if (existing) {
    existing.remove();
  }
}

// Push the active theme's base colour to the native Electron window so there is
// never a white edge/flash behind a dark or tinted theme. No-op in the browser
// (web build) where electronAPI is absent.
function syncWindowBgColor(hex) {
  try {
    if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) {
      window.electronAPI?.setWindowBgColor?.(hex);
    }
  } catch {
    /* not in Electron — ignore */
  }
}

export function applyColorTheme(settings = {}) {
  // Normalise unknown/removed theme ids (e.g. a retired palette still saved in
  // settings) back to the default so they render the clean native theme rather
  // than the override path with fallback vars.
  const requested = settings.color_theme || DEFAULT_THEME;
  const themeName = COLOR_THEMES[requested] ? requested : DEFAULT_THEME;
  const preset = COLOR_THEMES[themeName] || COLOR_THEMES[DEFAULT_THEME];
  const root = document.documentElement;

  // Persist for the pre-React splash screen (index.html reads this).
  try {
    window.localStorage.setItem("app_theme", themeName);
  } catch {
    /* localStorage unavailable — ignore */
  }

  // Default theme = the original pre-theme-system design, exactly.
  // Strip all inline theme vars so index.css :root governs, and disable
  // the global override so native Tailwind utility colors render as before.
  if (themeName === DEFAULT_THEME) {
    ALL_VAR_KEYS.forEach((key) => root.style.removeProperty(key));
    setOverrideEnabled(false);
    root.dataset.colorTheme = DEFAULT_THEME;
    syncWindowBgColor(DEFAULT_THEME_VARS["--bg-base"]);
    // "global" (not "light") so the index.css [data-theme="light"] remaps stay
    // dormant — the default theme renders with native Tailwind colours. Setting
    // "light" here would activate `[data-theme="light"] .text-white → text-primary`
    // and turn every white button label dark, since the override stylesheet that
    // normally counters that rule is NOT injected for the default theme.
    root.dataset.theme = "global";
    return;
  }

  let vars;
  if (themeName === "custom" && settings.custom_theme_vars) {
    try {
      const parsed = JSON.parse(settings.custom_theme_vars);
      vars = { ...DEFAULT_THEME_VARS, ...parsed };
    } catch {
      vars = preset.vars;
    }
  } else {
    vars = preset.vars;
  }

  setOverrideEnabled(true);
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.dataset.colorTheme = themeName;
  root.dataset.theme = (themeName === "custom")
    ? (settings.custom_theme_mode || preset.mode || "light")
    : (preset.mode || "light");
  syncWindowBgColor(vars["--bg-base"]);
}
