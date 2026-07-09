const { getPageParams, paginateSql, extractTotalRows, stripTotalRows } = require("../../src/reports/pagination");

describe("getPageParams", () => {
  test("returns default page and pageSize when opts is empty", () => {
    expect(getPageParams({})).toEqual({ page: 1, pageSize: 200, offset: 0 });
  });

  test("handles custom page and pageSize", () => {
    expect(getPageParams({ page: 3, pageSize: 50 })).toEqual({ page: 3, pageSize: 50, offset: 100 });
  });

  test("clamps page to minimum of 1", () => {
    expect(getPageParams({ page: -5 }).page).toBe(1);
  });

  test("falls back to default page on 0 (falsy)", () => {
    expect(getPageParams({ page: 0 }).page).toBe(1);
  });

  test("falls back to default pageSize on 0 (falsy) and clamps upper bound", () => {
    expect(getPageParams({ pageSize: 0 }).pageSize).toBe(200);
    expect(getPageParams({ pageSize: 100000 }).pageSize).toBe(50000);
  });

  test("returns defaults when opts is undefined", () => {
    expect(getPageParams()).toEqual({ page: 1, pageSize: 200, offset: 0 });
  });

  test("parses string numeric values", () => {
    expect(getPageParams({ page: "2", pageSize: "10" })).toEqual({ page: 2, pageSize: 10, offset: 10 });
  });

  test("handles NaN gracefully by falling back to defaults", () => {
    const result = getPageParams({ page: NaN, pageSize: NaN });
    expect(result).toEqual({ page: 1, pageSize: 200, offset: 0 });
  });
});

describe("paginateSql", () => {
  test("injects COUNT(*) OVER() and appends LIMIT/OFFSET", () => {
    const result = paginateSql("SELECT * FROM items", { page: 1, pageSize: 50 });
    expect(result.sql).toMatch(/COUNT\(\*\) OVER\(\) AS _total_rows/);
    expect(result.sql).toMatch(/LIMIT \? OFFSET \?/);
    expect(result.params).toEqual([50, 0]);
  });

  test("page 2 offsets correctly", () => {
    const result = paginateSql("SELECT * FROM items", { page: 2, pageSize: 50 });
    expect(result.params).toEqual([50, 50]);
  });

  test("preserves ORDER BY clause", () => {
    const result = paginateSql("SELECT id, name FROM items ORDER BY name DESC", { page: 1, pageSize: 10 });
    expect(result.sql).toMatch(/ORDER BY name DESC/);
  });

  test("returns raw SQL when not a SELECT statement", () => {
    const sql = "UPDATE items SET name = 'test'";
    expect(paginateSql(sql, { page: 1, pageSize: 10 })).toBe(sql);
  });

  test("handles missing opts with defaults", () => {
    const result = paginateSql("SELECT * FROM items");
    expect(result.params).toEqual([200, 0]);
  });

  test("handles SELECT with column aliases", () => {
    const result = paginateSql("SELECT i.id AS item_id, i.name FROM items i WHERE i.active = 1 ORDER BY i.name", { page: 1, pageSize: 25 });
    expect(result.sql).toMatch(/_total_rows/);
    expect(result.params).toEqual([25, 0]);
  });
});

describe("extractTotalRows", () => {
  test("reads _total_rows from first row", () => {
    expect(extractTotalRows([{ _total_rows: 100, id: 1 }, { _total_rows: 100, id: 2 }])).toBe(100);
  });

  test("falls back to array length when _total_rows missing", () => {
    expect(extractTotalRows([{ id: 1 }, { id: 2 }])).toBe(2);
  });

  test("returns 0 for empty array", () => {
    expect(extractTotalRows([])).toBe(0);
  });

  test("returns 0 for null or undefined", () => {
    expect(extractTotalRows(null)).toBe(0);
    expect(extractTotalRows(undefined)).toBe(0);
  });
});

describe("stripTotalRows", () => {
  test("removes _total_rows from every row", () => {
    const rows = [{ _total_rows: 100, id: 1, name: "test" }];
    expect(stripTotalRows(rows)).toEqual([{ id: 1, name: "test" }]);
  });

  test("does not mutate the original array", () => {
    const rows = [{ _total_rows: 100, id: 1 }];
    const copy = [...rows];
    stripTotalRows(rows);
    expect(rows).toEqual(copy);
  });

  test("returns empty array for empty input", () => {
    expect(stripTotalRows([])).toEqual([]);
  });

  test("returns null for null input", () => {
    expect(stripTotalRows(null)).toBeNull();
  });
});
