// Migration 162 logic test (runs in the client vitest suite because the
// repo's better-sqlite3 binary is Electron-compiled and can't load under the
// system-Node Jest run — see CLAUDE.md). Uses a tiny fake of the
// better-sqlite3 surface the migration touches: prepare().get/all/run.
import { describe, it, expect } from "vitest";
import { up } from "../../../../../electron/migrations/162_normalize_print_layouts";
import { normalizeLayout } from "@shared/printLayout";
import { DOC_TYPES, LAYOUT_SCOPES } from "@shared/docTypes";

const COLS = [{ key: "name", label: "الصنف", visible: true, align: "right" }];

function fakeDb(rows, { hasTable = true } = {}) {
  const store = new Map(Object.entries(rows));
  return {
    store,
    prepare(sql) {
      if (/FROM sqlite_master/.test(sql)) {
        return { get: () => (hasTable ? { name: "print_settings_per_doc" } : undefined) };
      }
      if (/^SELECT doc_type, settings/.test(sql)) {
        return { all: () => [...store.entries()].map(([doc_type, settings]) => ({ doc_type, settings })) };
      }
      if (/^UPDATE print_settings_per_doc/.test(sql)) {
        return { run: (settings, docType) => store.set(docType, settings) };
      }
      throw new Error(`unexpected sql in migration: ${sql}`);
    },
  };
}

describe("migration 162_normalize_print_layouts", () => {
  it("moves legacy columns into perBlock; canonical and unparseable rows untouched", () => {
    const legacy = JSON.stringify({
      show_logo: 1,
      layout: { roll: { order: ["logo"], perBlock: {}, columns: { items_table: COLS }, margins: {} } },
    });
    const canonical = JSON.stringify({
      layout: { page: { order: [], perBlock: { items_table: { columns: COLS } } } },
    });
    const db = fakeDb({ pos_receipt: legacy, sales_invoice: canonical, quotation: "{not json}" });

    up(db);

    const migrated = JSON.parse(db.store.get("pos_receipt"));
    expect(migrated.layout.roll.perBlock.items_table.columns).toEqual(COLS);
    expect(migrated.layout.roll.columns).toBeUndefined();
    expect(migrated.show_logo).toBe(1);
    expect(db.store.get("sales_invoice")).toBe(canonical); // no gratuitous rewrite
    expect(db.store.get("quotation")).toBe("{not json}");  // preserved, not destroyed
  });

  it("re-running is a no-op (idempotent)", () => {
    const legacy = JSON.stringify({ layout: { roll: { columns: { items_table: COLS }, perBlock: {} } } });
    const db = fakeDb({ pos_receipt: legacy });
    up(db);
    const first = db.store.get("pos_receipt");
    up(db);
    expect(db.store.get("pos_receipt")).toBe(first);
    expect(normalizeLayout(JSON.parse(first)).changed).toBe(false);
  });

  it("missing table → no crash, no queries", () => {
    const db = fakeDb({}, { hasTable: false });
    expect(() => up(db)).not.toThrow();
  });

  it("_global is an accepted layout scope but not a doc type", () => {
    expect(LAYOUT_SCOPES).toContain("_global");
    expect(LAYOUT_SCOPES).toEqual(expect.arrayContaining(DOC_TYPES));
    expect(DOC_TYPES).not.toContain("_global");
  });
});
