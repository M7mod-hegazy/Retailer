// Shared native-module architecture helpers.
//
// The #1 cause of the "تلف في قاعدة البيانات" / "not a valid Win32 application"
// crash on customer PCs was a 32-bit (ia32) installer that shipped a 64-bit
// better_sqlite3.node (or vice-versa). A 32-bit Electron process cannot load a
// 64-bit .node, so the embedded server dies on startup. This module centralises
// the one check that makes that impossible to ship: read the PE machine type of
// a compiled .node and compare it to the architecture the installer targets.
const fs = require("fs");
const path = require("path");

// PE "Machine" field values (IMAGE_FILE_HEADER.Machine).
const PE_MACHINE = {
  ia32: 0x014c, // IMAGE_FILE_MACHINE_I386
  x64: 0x8664, // IMAGE_FILE_MACHINE_AMD64
  arm64: 0xaa64, // IMAGE_FILE_MACHINE_ARM64
};

// electron-builder passes an Arch enum (builder-util Arch) to hooks; map the
// numeric/string forms we may receive to our arch keys.
const BUILDER_ARCH = {
  0: "ia32",
  1: "x64",
  3: "arm64",
  ia32: "ia32",
  x64: "x64",
  arm64: "arm64",
};

function normalizeArch(arch) {
  if (arch == null) return null;
  return BUILDER_ARCH[arch] != null ? BUILDER_ARCH[arch] : String(arch);
}

// Read the PE machine type of a compiled binary (.node / .exe / .dll).
function peMachineType(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 64 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new Error(`${file} is not a PE binary (missing MZ header)`);
  }
  const peOffset = bytes.readUInt32LE(60);
  return bytes.readUInt16LE(peOffset + 4);
}

function machineName(machine) {
  const found = Object.keys(PE_MACHINE).find((k) => PE_MACHINE[k] === machine);
  return found || `0x${machine.toString(16)}`;
}

// Find every better_sqlite3.node under a packed app's resources dir. The .node
// lives in resources/app.asar.unpacked/.../better-sqlite3/build/Release/.
function findNativeBinaries(appOutDir, name = "better_sqlite3.node") {
  const root = path.join(appOutDir, "resources", "app.asar.unpacked");
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === name) out.push(full);
    }
  };
  walk(root);
  return out;
}

// Throw if any packed native binary does not match the target architecture.
// `appOutDir` is the unpacked app dir electron-builder produced for this arch.
function assertPackedArch(appOutDir, arch) {
  const target = normalizeArch(arch);
  const expected = PE_MACHINE[target];
  if (!expected) {
    // Unknown/unsupported arch — don't block, just skip the check.
    return { checked: 0, skipped: true, arch: target };
  }
  const binaries = findNativeBinaries(appOutDir);
  if (binaries.length === 0) {
    throw new Error(
      `native-arch guard: no better_sqlite3.node found under ${appOutDir}. ` +
        "The packaged app would crash on startup (DB driver missing)."
    );
  }
  for (const bin of binaries) {
    const machine = peMachineType(bin);
    if (machine !== expected) {
      throw new Error(
        `native-arch guard: ${path.basename(bin)} is ${machineName(machine)} ` +
          `but the ${target} installer needs ${machineName(expected)}. ` +
          "Refusing to build a broken installer (this is the bug that caused the " +
          '"database corrupted" crash on 32-bit PCs). Rebuild better-sqlite3 for ' +
          `${target} before packaging.\n  binary: ${bin}`
      );
    }
  }
  return { checked: binaries.length, skipped: false, arch: target };
}

module.exports = {
  PE_MACHINE,
  normalizeArch,
  peMachineType,
  machineName,
  findNativeBinaries,
  assertPackedArch,
};
