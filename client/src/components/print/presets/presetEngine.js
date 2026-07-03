/**
 * presetEngine.js — data-driven print design presets.
 *
 * A preset is pure data describing one complete look for one family
 * (roll = 58/80mm thermal, page = A4/A5): block order, per-block styling,
 * inserted decorative blocks, page knobs (headerStyle), and the flat settings
 * it needs (fonts, toggles). Applying a preset produces a NEW per-doc settings
 * object — it never mutates, and it only touches the family it targets, so a
 * roll preset can't wreck an A4 design.
 *
 * Built-in presets live in builtinPresets.js (curated matrix — 20+ per paper
 * size). User presets are the same shape, stored in localStorage by the
 * Studio. Everything a preset sets remains fully editable afterwards.
 *
 * Preset shape:
 * {
 *   id: "modern-grid",            // stable unique id
 *   family: "roll" | "page",
 *   sizes: ["80mm", "58mm"],      // which paper sizes it suits (gallery filter)
 *   name: "عصري — شبكة",          // Arabic display name
 *   nameEn: "Modern grid",
 *   tags: ["bilingual", "ticket", "compact", ...],   // gallery filters
 *   layout: { order?, perBlock?, inserted?, margins?, headerStyle? },
 *   flat: { show_*, *_font_size, print_font, accent_color, ... },  // optional
 *   parts?: [ ... ]               // multi-part order-ticket presets (printMultipart)
 * }
 */

import { seedFamilyLayout } from "../layout/layoutModel";

/** Deep-clone plain preset data (presets are JSON-safe by construction). */
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/**
 * Apply a preset to a per-doc settings object → new settings object.
 * The target family's layout is REPLACED by the preset layout (seeded first so
 * missing fields stay sane); other families and unrelated flat fields are
 * preserved. Flat fields in the preset overwrite same-named settings.
 */
export function applyPreset(settings = {}, preset) {
  if (!preset || !preset.family) return settings;
  const seeded = seedFamilyLayout(preset.family);
  const presetLayout = clone(preset.layout || {});
  const nextFamily = {
    ...seeded,
    ...presetLayout,
    perBlock: { ...(presetLayout.perBlock || {}) },
    inserted: [...(presetLayout.inserted || [])],
    margins: { ...(presetLayout.margins || {}) },
    order: presetLayout.order ? [...presetLayout.order] : seeded.order,
  };
  return {
    ...settings,
    ...(clone(preset.flat) || {}),
    layout: {
      ...(settings.layout || {}),
      [preset.family]: nextFamily,
    },
  };
}

/**
 * Capture the current design as a user preset (inverse of applyPreset).
 * `flatKeys` lists which flat settings to freeze into the preset (the Studio
 * passes the typography/visibility keys it exposes).
 */
export function captureAsPreset(settings = {}, { id, name, family, sizes = [], tags = [], flatKeys = [] }) {
  const fam = (settings.layout || {})[family] || seedFamilyLayout(family);
  const flat = {};
  flatKeys.forEach((k) => { if (settings[k] !== undefined) flat[k] = settings[k]; });
  return {
    id: id || `user_${Date.now().toString(36)}`,
    family,
    sizes,
    name: name || "قالب مخصص",
    tags: [...tags, "user"],
    layout: clone(fam),
    flat,
  };
}

/* ---------------- user presets (localStorage) ---------------- */

const USER_PRESETS_KEY = "retailer_print_user_presets";

export function getUserPresets() {
  try {
    const arr = JSON.parse(localStorage.getItem(USER_PRESETS_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveUserPreset(preset) {
  const list = getUserPresets().filter((p) => p.id !== preset.id);
  list.unshift(preset);
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(list));
  return list;
}

export function deleteUserPreset(id) {
  const list = getUserPresets().filter((p) => p.id !== id);
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(list));
  return list;
}

/** Export/import user presets as a JSON blob (Studio share action). */
export function exportUserPresets() {
  return { version: 1, exported_at: new Date().toISOString(), presets: getUserPresets() };
}

export function importUserPresets(blob) {
  const incoming = blob && Array.isArray(blob.presets) ? blob.presets : null;
  if (!incoming) throw new Error("invalid_presets_file");
  const current = getUserPresets();
  const ids = new Set(current.map((p) => p.id));
  const merged = [...current, ...incoming.filter((p) => p && p.id && !ids.has(p.id))];
  localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(merged));
  return merged;
}
