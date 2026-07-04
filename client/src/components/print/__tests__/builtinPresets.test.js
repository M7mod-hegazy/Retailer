import { describe, it, expect } from "vitest";
import { BUILTIN_PRESETS, presetsForSize, DEFAULT_PRESET_ID } from "../presets/builtinPresets";
import { applyPreset } from "../presets/presetEngine";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { TAG_LABELS } from "../studio/PresetsGallery";
import { colorLuminance } from "../blocks/blockUtils";

const SIZES = ["58mm", "80mm", "A5", "A4"];
const ROLL_SIZES = new Set(["80mm", "58mm"]);
const PAGE_SIZES = new Set(["A4", "A5"]);

describe("builtinPresets library", () => {
  it("ships at least 25 presets per paper size", () => {
    SIZES.forEach((sz) => {
      expect(presetsForSize(sz).length, `presets for ${sz}`).toBeGreaterThanOrEqual(25);
    });
  });

  it("all preset ids are unique", () => {
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("default preset ids exist", () => {
    expect(BUILTIN_PRESETS.some((p) => p.id === DEFAULT_PRESET_ID.roll)).toBe(true);
    expect(BUILTIN_PRESETS.some((p) => p.id === DEFAULT_PRESET_ID.page)).toBe(true);
  });

  it("every preset has family, Arabic name, and family-consistent sizes", () => {
    BUILTIN_PRESETS.forEach((p) => {
      expect(["roll", "page"]).toContain(p.family);
      expect(typeof p.name).toBe("string");
      expect(p.name.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(p.sizes)).toBe(true);
      expect(p.sizes.length).toBeGreaterThan(0);
      const allowed = p.family === "roll" ? ROLL_SIZES : PAGE_SIZES;
      p.sizes.forEach((s) => expect(allowed.has(s), `${p.id}: size ${s} invalid for ${p.family}`).toBe(true));
    });
  });

  it("presets are structurally DISTINCT per size (no near-duplicates)", () => {
    SIZES.forEach((sz) => {
      const sigs = presetsForSize(sz).map((p) => JSON.stringify({
        order: p.layout.order,
        perBlock: p.layout.perBlock,
        inserted: p.layout.inserted,
        headerStyle: p.layout.headerStyle,
        flat: p.flat,
      }));
      expect(new Set(sigs).size, `distinct signatures for ${sz}`).toBe(sigs.length);
    });
  });

  it("every ordered block / insert type is valid for the preset family", () => {
    BUILTIN_PRESETS.forEach((p) => {
      (p.layout.order || []).forEach((t) => {
        const entry = BLOCK_REGISTRY[t];
        expect(entry, `${p.id}: unknown block ${t}`).toBeTruthy();
        expect(entry.families.includes(p.family), `${p.id}: ${t} not valid on ${p.family}`).toBe(true);
      });
      (p.layout.inserted || []).forEach((ins) => {
        expect(BLOCK_REGISTRY[ins.type], `${p.id}: unknown insert type ${ins.type}`).toBeTruthy();
        expect(ins.id, `${p.id}: insert without id`).toBeTruthy();
        expect(ins.after, `${p.id}: insert without anchor`).toBeTruthy();
      });
    });
  });

  it("roll presets stay thermal-safe (black-only, readable sizes)", () => {
    BUILTIN_PRESETS.filter((p) => p.family === "roll").forEach((p) => {
      Object.entries(p.layout.perBlock || {}).forEach(([key, ov]) => {
        if (ov.color) {
          expect(colorLuminance(ov.color), `${p.id}.${key} color too light for thermal`).toBeLessThanOrEqual(0.55);
        }
        expect(ov.background, `${p.id}.${key} background not allowed on roll`).toBeUndefined();
        if (ov.borderColor) expect(ov.borderColor).toBe("#000");
        if (key === "items_table" && ov.fontSize != null) {
          expect(ov.fontSize, `${p.id} table font below thermal floor`).toBeGreaterThanOrEqual(9);
        }
      });
      const flat = p.flat || {};
      if (flat.item_font_size != null) expect(flat.item_font_size).toBeGreaterThanOrEqual(9);
      if (flat.body_font_size != null) expect(flat.body_font_size).toBeGreaterThanOrEqual(10);
    });
  });

  it("every tag has an Arabic label in the gallery", () => {
    BUILTIN_PRESETS.forEach((p) => {
      (p.tags || []).forEach((t) => {
        expect(TAG_LABELS[t], `missing Arabic label for tag "${t}" (preset ${p.id})`).toBeTruthy();
      });
    });
  });

  it("applyPreset produces a usable layout for every preset", () => {
    BUILTIN_PRESETS.forEach((p) => {
      const next = applyPreset({}, p);
      const fam = next.layout[p.family];
      expect(Array.isArray(fam.order)).toBe(true);
      expect(fam.order.length).toBeGreaterThan(2);
      expect(fam.perBlock).toBeTruthy();
    });
  });

  it("insert ids are unique within each preset", () => {
    BUILTIN_PRESETS.forEach((p) => {
      const ids = (p.layout.inserted || []).map((b) => b.id);
      expect(new Set(ids).size, `${p.id} duplicate insert ids`).toBe(ids.length);
    });
  });
});
