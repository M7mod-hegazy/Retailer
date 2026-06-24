// electron-builder `afterPack` hook.
//
// Runs once per packed architecture, right after electron-builder lays out the
// app dir for that arch but BEFORE it is compressed into the installer. We use
// it as a hard gate: if the packed better_sqlite3.node does not match the arch
// being built, we throw and the whole build fails loudly — instead of silently
// shipping a 32-bit installer with a 64-bit DB driver (the crash that looked
// like "database corrupted" on customer PCs).
const { assertPackedArch, normalizeArch } = require("./native-arch");

module.exports = async function afterPack(context) {
  const arch = normalizeArch(context.arch);
  const { appOutDir, electronPlatformName } = context;

  // Only Windows ships the better-sqlite3 PE binary we care about here.
  if (electronPlatformName !== "win32") return;

  const result = assertPackedArch(appOutDir, arch);
  if (result.skipped) {
    console.log(`[afterpack-verify] ${arch}: skipped (unknown arch)`);
    return;
  }
  console.log(
    `[afterpack-verify] ${arch}: OK — ${result.checked} native binary(ies) match ${arch}.`
  );
};
