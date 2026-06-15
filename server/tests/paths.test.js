const fs = require("fs");
const os = require("os");
const path = require("path");
const { firstWritableDir, ensureWritableDir } = require("../src/config/paths");

// Regression: a packaged install lives under a read-only directory
// (C:\Program Files\...). Writing runtime data there fails with EPERM and used
// to crash the embedded server on load ("can't connect to local server").
// firstWritableDir must NEVER throw and must always return a usable directory.
describe("firstWritableDir", () => {
  it("uses the preferred dir when it is writable", () => {
    const good = path.join(os.tmpdir(), `elh-good-${Date.now()}`);
    expect(firstWritableDir([good], "x")).toBe(good);
    expect(fs.existsSync(good)).toBe(true);
  });

  it("falls back to a temp dir when the preferred dir cannot be created (EPERM-like)", () => {
    // Create a *file*, then ask for a directory nested under it — mkdir must fail,
    // mirroring an EPERM under Program Files. The resolver must recover, not throw.
    const aFile = path.join(os.tmpdir(), `elh-file-${Date.now()}`);
    fs.writeFileSync(aFile, "x");
    const unwritable = path.join(aFile, "cannot", "mkdir");

    let resolved;
    expect(() => { resolved = firstWritableDir([unwritable], "fallback"); }).not.toThrow();
    expect(resolved.startsWith(os.tmpdir())).toBe(true);
    expect(fs.existsSync(resolved)).toBe(true);
  });

  it("skips empty/undefined candidates and still returns a writable dir", () => {
    const good = path.join(os.tmpdir(), `elh-skip-${Date.now()}`);
    expect(firstWritableDir([undefined, "", good], "x")).toBe(good);
  });

  it("ensureWritableDir is a single-candidate convenience wrapper", () => {
    const good = path.join(os.tmpdir(), `elh-wrap-${Date.now()}`);
    expect(ensureWritableDir(good, "x")).toBe(good);
  });
});
