import { describe, it, expect } from "vitest";
import { normalizeLayout, mergeFamilyLayouts } from "@shared/printLayout";

const COLS = [
  { key: "name", label: "الصنف", visible: true, align: "right" },
  { key: "qty", label: "كمية", visible: true, align: "center" },
];

describe("normalizeLayout", () => {
  it("moves legacy layout.fam.columns.items_table into perBlock.items_table.columns", () => {
    const legacy = {
      show_logo: true,
      layout: { roll: { order: ["logo"], inserted: [], perBlock: {}, columns: { items_table: COLS }, margins: {} } },
    };
    const { changed, settings } = normalizeLayout(legacy);
    expect(changed).toBe(true);
    expect(settings.layout.roll.perBlock.items_table.columns).toEqual(COLS);
    expect(settings.layout.roll.columns).toBeUndefined();
    expect(settings.show_logo).toBe(true);
    expect(settings.layout.roll.order).toEqual(["logo"]);
  });

  it("legacy columns win over stale perBlock columns (designer state was the visible truth)", () => {
    const older = [{ key: "total", label: "إجمالي", visible: true, align: "left" }];
    const legacy = {
      layout: { page: { perBlock: { items_table: { columns: older, zebra: true } }, columns: { items_table: COLS } } },
    };
    const { settings } = normalizeLayout(legacy);
    expect(settings.layout.page.perBlock.items_table.columns).toEqual(COLS);
    expect(settings.layout.page.perBlock.items_table.zebra).toBe(true); // untouched sibling prop
  });

  it("is idempotent", () => {
    const legacy = { layout: { roll: { columns: { items_table: COLS }, perBlock: {} } } };
    const once = normalizeLayout(legacy).settings;
    const twice = normalizeLayout(once);
    expect(twice.changed).toBe(false);
    expect(twice.settings).toEqual(once);
  });

  it("leaves canonical, empty, and layout-less objects unchanged", () => {
    expect(normalizeLayout({}).changed).toBe(false);
    expect(normalizeLayout({ receipt_header: "x" }).changed).toBe(false);
    const canonical = { layout: { roll: { order: [], perBlock: { items_table: { columns: COLS } } } } };
    const res = normalizeLayout(canonical);
    expect(res.changed).toBe(false);
    expect(res.settings).toBe(canonical); // same reference — non-mutating fast path
  });

  it("does not mutate its input", () => {
    const legacy = { layout: { roll: { columns: { items_table: COLS }, perBlock: {} } } };
    const snapshot = JSON.parse(JSON.stringify(legacy));
    normalizeLayout(legacy);
    expect(legacy).toEqual(snapshot);
  });

  it("survives malformed family entries", () => {
    const weird = { layout: { roll: null, page: "junk", extra: { columns: { items_table: COLS } } } };
    const { settings } = normalizeLayout(weird);
    expect(settings.layout.roll).toBeNull();
    expect(settings.layout.page).toBe("junk");
    expect(settings.layout.extra.perBlock.items_table.columns).toEqual(COLS);
  });
});

describe("mergeFamilyLayouts (global scope + per-doc)", () => {
  it("doc explicit values win, global fills the gaps", () => {
    const globalFam = {
      order: ["logo", "items_table"],
      perBlock: { items_table: { zebra: true, columns: COLS }, footer_text: { fontSize: 9 } },
      inserted: [{ id: "g1", type: "divider", after: "logo" }],
      margins: { top: 4 },
    };
    const docFam = {
      perBlock: { items_table: { zebra: false } },
      inserted: [{ id: "d1", type: "spacer", after: "items_table" }],
      margins: { top: 2 },
    };
    const m = mergeFamilyLayouts(globalFam, docFam);
    expect(m.order).toEqual(["logo", "items_table"]); // inherited
    expect(m.perBlock.items_table.zebra).toBe(false); // doc wins
    expect(m.perBlock.items_table.columns).toEqual(COLS); // global fills
    expect(m.perBlock.footer_text.fontSize).toBe(9);
    expect(m.inserted.map((b) => b.id)).toEqual(["g1", "d1"]);
    expect(m.margins.top).toBe(2);
  });

  it("doc order overrides global order; id clashes resolve to the doc insert", () => {
    const m = mergeFamilyLayouts(
      { order: ["a"], inserted: [{ id: "x", type: "divider" }] },
      { order: ["b"], inserted: [{ id: "x", type: "spacer" }] },
    );
    expect(m.order).toEqual(["b"]);
    expect(m.inserted).toEqual([{ id: "x", type: "spacer" }]);
  });

  it("handles null/undefined sides", () => {
    expect(mergeFamilyLayouts(null, null)).toEqual({ perBlock: {}, inserted: [], margins: {} });
    const m = mergeFamilyLayouts({ order: ["a"] }, undefined);
    expect(m.order).toEqual(["a"]);
  });
});
