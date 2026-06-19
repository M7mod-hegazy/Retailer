const { toSql, today, dayStamp, nowSql } = require("../src/utils/datetime");

describe("datetime helpers (Africa/Cairo, DST-aware)", () => {
  test("toSql shifts a UTC instant to Cairo winter wall-clock (+2)", () => {
    // 2026-01-15 23:30:00Z -> Cairo winter is +02:00 -> next day 01:30
    expect(toSql("2026-01-15T23:30:00Z")).toBe("2026-01-16 01:30:00");
  });

  test("toSql is DST-aware in summer (+3)", () => {
    // Egypt observes DST in summer; 2026-06-18 23:30:00Z -> +03:00 -> 02:30 next day
    expect(toSql("2026-06-18T23:30:00Z")).toBe("2026-06-19 02:30:00");
  });

  test("today returns the Cairo calendar date for the instant", () => {
    expect(today("2026-06-18T23:30:00Z")).toBe("2026-06-19");
    expect(today("2026-01-15T21:00:00Z")).toBe("2026-01-15");
  });

  test("dayStamp returns Cairo YYYYMMDD", () => {
    expect(dayStamp("2026-06-18T23:30:00Z")).toBe("20260619");
  });

  test("toSql treats a bare (no-zone) string as UTC", () => {
    expect(toSql("2026-06-18 23:30:00")).toBe("2026-06-19 02:30:00");
  });

  test("nowSql produces a well-formed Cairo SQL timestamp", () => {
    expect(nowSql()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
