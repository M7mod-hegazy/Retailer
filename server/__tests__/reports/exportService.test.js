const { Writable } = require("stream");
const { exportRowsToExcelV2, exportRowsToCsv } = require("../../src/services/exportService");

function collectStream() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, enc, cb) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); cb(); },
    final(cb) { cb(); },
  });
  stream.setHeader = jest.fn();
  stream.getBuffer = () => Buffer.concat(chunks);
  stream.getOutput = () => chunks.map((c) => c.toString()).join("");
  return stream;
}

describe("exportRowsToExcelV2 streaming", () => {
  test("writes Excel to response and returns null", async () => {
    const res = collectStream();
    const rows = [
      { name: "Item A", price: 100, qty: 2 },
      { name: "Item B", price: 50, qty: 5 },
    ];
    const columns = [
      { key: "name", label: "Name" },
      { key: "price", label: "Price" },
      { key: "qty", label: "Qty" },
    ];

    const result = await exportRowsToExcelV2({ rows, columns, res });
    expect(result).toBeNull();
    expect(res.getBuffer().length).toBeGreaterThan(0);
  });

  test("returns file path when res is not provided", async () => {
    const rows = [{ name: "Test", value: 1 }];
    const columns = [
      { key: "name", label: "Name" },
      { key: "value", label: "Value" },
    ];
    const result = await exportRowsToExcelV2({ rows, columns });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.endsWith(".xlsx")).toBe(true);
  });

  test("handles empty rows gracefully with streaming", async () => {
    const res = collectStream();
    const result = await exportRowsToExcelV2({ rows: [], columns: [], res });
    expect(result).toBeNull();
    expect(res.getBuffer().length).toBeGreaterThan(0);
  });

  test("handles RTL option", async () => {
    const res = collectStream();
    const rows = [{ col1: "بي right-to-left" }];
    const columns = [{ key: "col1", label: "عمود" }];
    const result = await exportRowsToExcelV2({ rows, columns, rtl: true, res });
    expect(result).toBeNull();
    expect(res.getBuffer().length).toBeGreaterThan(0);
  });
});

describe("exportRowsToCsv streaming", () => {
  test("writes CSV with BOM, quoted headers, and data rows", async () => {
    const res = collectStream();
    const rows = [
      { name: "Item A", price: 100 },
      { name: "Item B", price: 50 },
    ];
    const columns = [
      { key: "name", label: "Name" },
      { key: "price", label: "Price" },
    ];

    const result = await exportRowsToCsv({ rows, columns, res });
    expect(result).toBeNull();
    const output = res.getOutput();
    expect(output.startsWith("\uFEFF")).toBe(true);
    expect(output).toContain('"Name","Price"');
    expect(output).toContain('"Item A"');
    expect(output).toMatch(/\r\n$/);
  });

  test("returns file path when res is not provided", async () => {
    const rows = [{ name: "Test", value: 1 }];
    const columns = [
      { key: "name", label: "Name" },
      { key: "value", label: "Value" },
    ];
    const result = await exportRowsToCsv({ rows, columns });
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.endsWith(".csv")).toBe(true);
  });

  test("escapes double quotes in CSV values", async () => {
    const res = collectStream();
    const rows = [{ note: 'He said "hello"' }];
    const columns = [{ key: "note", label: "Note" }];

    await exportRowsToCsv({ rows, columns, res });
    const output = res.getOutput();
    expect(output).toContain('"He said ""hello"""');
  });

  test("handles null and undefined values as empty in CSV", async () => {
    const res = collectStream();
    const rows = [{ name: null, price: undefined, tag: "ok" }];
    const columns = [
      { key: "name", label: "Name" },
      { key: "price", label: "Price" },
      { key: "tag", label: "Tag" },
    ];

    await exportRowsToCsv({ rows, columns, res });
    const output = res.getOutput();
    const lines = output.split("\r\n");
    expect(lines[1]).toBe(',,"ok"');
  });
});
