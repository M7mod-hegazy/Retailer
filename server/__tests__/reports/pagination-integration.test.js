const Database = require("better-sqlite3");

function paginateSql(sql, page, pageSize) {
  const offset = (page - 1) * pageSize;
  const countSql = sql.replace(/^SELECT\s(.+?)\sFROM\s/is, "SELECT COUNT(*) OVER() AS _total_rows, $1 FROM ");
  return { sql: `${countSql} LIMIT ? OFFSET ?`, params: [pageSize, offset] };
}

function extractTotalRows(rows) {
  if (!rows || !rows.length) return 0;
  return rows[0]._total_rows || rows.length;
}

function stripTotalRows(rows) {
  if (!rows || !rows.length) return rows;
  return rows.map(({ _total_rows, ...rest }) => rest);
}

describe("pagination with real SQLite", () => {
  let db;

  beforeAll(() => {
    db = new Database(":memory:");
    db.exec("CREATE TABLE test_rows (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)");
    const insert = db.prepare("INSERT INTO test_rows (value) VALUES (?)");
    const tx = db.transaction(() => {
      for (let i = 1; i <= 100; i++) insert.run(`Row ${i}`);
    });
    tx();
  });

  afterAll(() => db.close());

  test("page 1 returns first 50 rows of 100 total", () => {
    const { sql, params } = paginateSql("SELECT id, value FROM test_rows ORDER BY id", 1, 50);
    const rows = db.prepare(sql).all(...params);
    expect(rows).toHaveLength(50);
    expect(rows[0].id).toBe(1);
    expect(rows[49].id).toBe(50);
    expect(extractTotalRows(rows)).toBe(100);
  });

  test("page 2 returns rows 51-100 of 100 total", () => {
    const { sql, params } = paginateSql("SELECT id, value FROM test_rows ORDER BY id", 2, 50);
    const rows = db.prepare(sql).all(...params);
    expect(rows).toHaveLength(50);
    expect(rows[0].id).toBe(51);
    expect(rows[49].id).toBe(100);
    expect(extractTotalRows(rows)).toBe(100);
  });

  test("page 3 returns zero rows (beyond dataset)", () => {
    const { sql, params } = paginateSql("SELECT id, value FROM test_rows ORDER BY id", 3, 50);
    expect(db.prepare(sql).all(...params)).toHaveLength(0);
  });

  test("stripTotalRows removes _total_rows without mutating originals", () => {
    const { sql, params } = paginateSql("SELECT id, value FROM test_rows ORDER BY id", 1, 10);
    const rows = db.prepare(sql).all(...params);
    const stripped = stripTotalRows(rows);
    expect(stripped).toHaveLength(10);
    expect(stripped[0]).not.toHaveProperty("_total_rows");
    expect(rows[0]).toHaveProperty("_total_rows");
  });

  test("smaller page size returns correct subset", () => {
    const { sql, params } = paginateSql("SELECT id, value FROM test_rows ORDER BY id", 3, 10);
    const rows = db.prepare(sql).all(...params);
    expect(rows).toHaveLength(10);
    expect(rows[0].id).toBe(21);
    expect(extractTotalRows(rows)).toBe(100);
  });

  test("COUNT(*) OVER() is consistent across different LIMITs", () => {
    const full = db.prepare("SELECT COUNT(*) AS c FROM test_rows").get();
    expect(full.c).toBe(100);

    const { sql: s1, params: p1 } = paginateSql("SELECT id, value FROM test_rows ORDER BY id", 1, 5);
    expect(extractTotalRows(db.prepare(s1).all(...p1))).toBe(100);

    const { sql: s2, params: p2 } = paginateSql("SELECT id, value FROM test_rows ORDER BY id", 4, 25);
    expect(extractTotalRows(db.prepare(s2).all(...p2))).toBe(100);
  });
});
