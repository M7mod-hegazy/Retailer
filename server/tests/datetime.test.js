const {
  toSql,
  today,
  dayStamp,
  nowSql,
  offsetMinutesForZone,
  wallOffsetMinutes,
  _resolveWallOffset,
  __setWindowsTz,
} = require("../src/utils/datetime");

describe("datetime helpers (Africa/Cairo, DST-aware)", () => {
  // Default every case to "no OS override" so results are deterministic on any
  // host (the dev/CI box's real timezone must not leak into these assertions).
  beforeEach(() => __setWindowsTz(null));
  afterEach(() => __setWindowsTz(undefined));

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

describe("Win7 stale-DST Egypt override", () => {
  beforeEach(() => __setWindowsTz(null));
  afterEach(() => __setWindowsTz(undefined));

  test("_resolveWallOffset only fires for an Egypt zone that disagrees with ICU", () => {
    // Summer: ICU says +03:00 (180), a stale Win7 applies +02:00 (120) -> adopt 120.
    expect(
      _resolveWallOffset({ zone: "Egypt Standard Time", winOffset: 120, icuOffset: 180 }),
    ).toBe(120);
    // Winter / patched: they agree -> no override.
    expect(
      _resolveWallOffset({ zone: "Egypt Standard Time", winOffset: 120, icuOffset: 120 }),
    ).toBeNull();
    // A different (misconfigured) zone must keep the ICU pin -> no override.
    expect(
      _resolveWallOffset({ zone: "Romance Standard Time", winOffset: 60, icuOffset: 180 }),
    ).toBeNull();
    // Missing OS offset -> no override.
    expect(
      _resolveWallOffset({ zone: "Egypt Standard Time", winOffset: null, icuOffset: 180 }),
    ).toBeNull();
  });

  test("offsetMinutesForZone reports the known Cairo offsets", () => {
    expect(offsetMinutesForZone(new Date("2026-06-18T12:00:00Z"), "Africa/Cairo")).toBe(180);
    expect(offsetMinutesForZone(new Date("2026-01-15T12:00:00Z"), "Africa/Cairo")).toBe(120);
  });

  test("toSql follows the Windows +2 clock on a stale-DST Win7 box in summer", () => {
    __setWindowsTz({ zone: "Egypt Standard Time", offsetMinutes: 120 });
    // The ICU path renders this instant as 02:30 (+3); Win7 renders +2 -> 01:30.
    expect(toSql("2026-06-18T23:30:00Z")).toBe("2026-06-19 01:30:00");
  });

  test("today bucket follows the Windows offset across midnight on a stale box", () => {
    __setWindowsTz({ zone: "Egypt Standard Time", offsetMinutes: 120 });
    // 21:30Z summer: ICU +3 -> 00:30 next day (19th); Win7 +2 -> 23:30 same day (18th).
    expect(today("2026-06-18T21:30:00Z")).toBe("2026-06-18");
  });

  test("no override in winter when Windows and ICU both apply +2", () => {
    __setWindowsTz({ zone: "Egypt Standard Time", offsetMinutes: 120 });
    expect(toSql("2026-01-15T23:30:00Z")).toBe("2026-01-16 01:30:00");
  });

  test("wallOffsetMinutes exposes the effective offset for the renderer", () => {
    __setWindowsTz({ zone: "Egypt Standard Time", offsetMinutes: 120 });
    expect(wallOffsetMinutes("2026-06-18T12:00:00Z")).toBe(120); // stale Win7 summer
    __setWindowsTz(null);
    expect(wallOffsetMinutes("2026-06-18T12:00:00Z")).toBe(180); // ICU summer
  });

  test("a non-Egypt zone keeps the ICU pin (misconfigured-zone hardening intact)", () => {
    __setWindowsTz({ zone: "Romance Standard Time", offsetMinutes: 60 });
    expect(toSql("2026-06-18T23:30:00Z")).toBe("2026-06-19 02:30:00"); // still ICU +3
  });
});
