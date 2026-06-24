// Per-arch better_sqlite3.node management, shared by every packaging script.
//
// Compiling better-sqlite3 for an arch takes minutes; we cache the compiled
// .node per (electron, abi, sqlite, arch) so switching arch is a file copy.
// ensureNativeBinary() guarantees node_modules holds the RIGHT arch binary and
// verifies it with the PE machine-type check before any installer is built —
// this is what makes it impossible to ship a 32-bit installer with a 64-bit
// DB driver (the crash that looked like "database corrupted" on old PCs).
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { peMachineType, PE_MACHINE, machineName } = require("./native-arch");

const ROOT = path.join(__dirname, "..", "..");
const NATIVE_BINARY = path.join(
  ROOT, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node"
);

function log(msg) {
  console.log(`[native-cache] ${msg}`);
}

function cachePathFor(arch) {
  const electronVersion = require(path.join(ROOT, "node_modules", "electron", "package.json")).version;
  const sqliteVersion = require(path.join(ROOT, "node_modules", "better-sqlite3", "package.json")).version;
  const abi = process.versions.modules;
  return path.join(
    ROOT, ".native-cache",
    `electron-${electronVersion}_abi-${abi}_better-sqlite3-${sqliteVersion}_${arch}`,
    "better_sqlite3.node"
  );
}

// Verify the binary currently in node_modules matches `arch`.
function assertBinaryArch(arch) {
  const machine = peMachineType(NATIVE_BINARY);
  if (machine !== PE_MACHINE[arch]) {
    throw new Error(
      `better_sqlite3.node is ${machineName(machine)} but the ${arch} build needs ` +
        `${machineName(PE_MACHINE[arch])}. Aborting before a broken installer is produced.`
    );
  }
}

// Put a better_sqlite3.node of the requested arch into node_modules — from the
// cache when possible, compiling (and caching) otherwise — then verify it.
function ensureNativeBinary(arch) {
  if (!PE_MACHINE[arch]) throw new Error(`unknown arch "${arch}" (use x64 or ia32)`);
  const cached = cachePathFor(arch);
  if (fs.existsSync(cached)) {
    // Guard against a poisoned cache entry: verify the cached file's arch too.
    const machine = peMachineType(cached);
    if (machine === PE_MACHINE[arch]) {
      fs.copyFileSync(cached, NATIVE_BINARY);
      log(`${arch}: restored better_sqlite3.node from cache`);
    } else {
      log(`${arch}: cached binary is ${machineName(machine)} (wrong) — recompiling`);
      compileAndCache(arch, cached);
    }
  } else {
    log(`${arch}: no cached binary, compiling (one-time, takes a few minutes)...`);
    compileAndCache(arch, cached);
  }
  assertBinaryArch(arch);
}

function compileAndCache(arch, cached) {
  const result = spawnSync(
    "npx",
    ["electron-rebuild", "-f", "-w", "better-sqlite3", "-a", arch],
    { cwd: ROOT, stdio: "inherit", shell: true }
  );
  if (result.status !== 0) {
    throw new Error(`electron-rebuild (${arch}) failed (exit code ${result.status})`);
  }
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  fs.copyFileSync(NATIVE_BINARY, cached);
  log(`${arch}: compiled and cached`);
}

// Always leave node_modules with the x64 binary so the dev server (x64 Electron)
// is never left with a 32-bit binary after a multi-arch build.
function restoreDevBinary() {
  try {
    ensureNativeBinary("x64");
    log("x64 dev binary restored — dev server is safe to run.");
  } catch (err) {
    console.error(
      `[native-cache] FAILED to restore the x64 binary (${err.message}).\n` +
        '[native-cache] Run "npm run electron:rebuild" before starting the dev server.'
    );
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  NATIVE_BINARY,
  cachePathFor,
  assertBinaryArch,
  ensureNativeBinary,
  restoreDevBinary,
};
