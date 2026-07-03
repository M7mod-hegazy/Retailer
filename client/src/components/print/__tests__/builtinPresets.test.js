import { describe, it, expect } from "vitest";
import { BUILTIN_PRESETS, presetsForSize, DEFAULT_PRESET_ID } from "../presets/builtinPresets";
import { applyPreset } from "../presets/presetEngine";
import { BLOCK_REGISTRY } from "../blocks/registry";
import { colorLuminance } from "../blocks/blockUtils";

const KNOWN_TYPES = new Set(Object.keys(BLOCK_REGISTRY));
const ROLL_SIZES = new Set(["80mm", "58mm"]);
const PAGE_SIZES = new Set(["A4", "A5"]);

describe("builtinPresets — size coverage", () => {
  it.each(["80mm", "58mm", "A4", "A5"])("has at least 20 presets for %s", (size) => {
    expect(presetsForSize(size).length).toBeGreaterThanOrEqual(20);
  });
});

describe("builtinPresets — structural integrity", () => {
  it("has no duplicate ids", () => {
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a valid family, non-empty Arabic name, and sizes consistent with family", () => {
    BUILTIN_PRESETS.forEach((p) => {
      expect(["roll", "page"]).toContain(p.family);
      expect(typeof p.name).toBe("string");
      expect(p.name.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(p.sizes)).toBe(true);
      expect(p.sizes.length).toBeGreaterThan(0);
      const allowed = p.family === "roll" ? ROLL_SIZES : PAGE_SIZES;
      p.sizes.forEach((s) => expect(allowed.has(s)).toBe(true));
    });
  });

  it("every layout.order (when present) contains only known block types", () => {
    BUILTIN_PRESETS.forEach((p) => {
      const order = p.layout && p.layout.order;
      if (!order) return;
      order.forEach((type) => expect(KNOWN_TYPES.has(type)).toBe(true));
    });
  });

  it("every inserted entry has a unique id (per preset) and a known type", () => {
    BUILTIN_PRESETS.forEach((p) => {
      const inserted = (p.layout && p.layout.inserted) || [];
      const ids = inserted.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
      inserted.forEach((b) => {
        expect(KNOWN_TYPES.has(b.type)).toBe(true);
        expect(typeof b.id).toBe("string");
        expect(b.id.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("builtinPresets — applyPreset safety", () => {
  it("applies cleanly for every preset and yields a perBlock object for its family", () => {
    BUILTIN_PRESETS.forEach((p) => {
      expect(() => applyPreset({}, p)).not.toThrow();
      const result = applyPreset({}, p);
      const fam = result.layout[p.family];
      expect(fam).toBeTruthy();
      expect(typeof fam.perBlock).toBe("object");
      expect(fam.perBlock).not.toBeNull();
    });
  });

  it("does not mutate the source preset object", () => {
    BUILTIN_PRESETS.forEach((p) => {
      const before = JSON.stringify(p);
      applyPreset({}, p);
      expect(JSON.stringify(p)).toBe(before);
    });
  });
});

describe("builtinPresets — thermal-safe colors", () => {
  it("keeps any flat.accent_color dark enough to print (luminance <= 0.55)", () => {
    BUILTIN_PRESETS.forEach((p) => {
      const color = p.flat && p.flat.accent_color;
      if (!color) return;
      expect(colorLuminance(color)).toBeLessThanOrEqual(0.55);
    });
  });
});

describe("builtinPresets — DEFAULT_PRESET_ID", () => {
  it("points at ids that actually exist in the library", () => {
    const ids = new Set(BUILTIN_PRESETS.map((p) => p.id));
    expect(ids.has(DEFAULT_PRESET_ID.roll)).toBe(true);
    expect(ids.has(DEFAULT_PRESET_ID.page)).toBe(true);
  });
});
