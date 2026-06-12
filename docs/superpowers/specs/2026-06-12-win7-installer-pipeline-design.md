# WIN7-TEST installer pipeline — design

**Date:** 2026-06-12
**Problem:** Building the Win7 installers (`dist:win7:ia32`) leaves a 32-bit
`better_sqlite3.node` in `node_modules`, which crashes everything that runs
afterwards under x64 Electron ("not a valid Win32 application"). Each build
also recompiles the native module from source (minutes), compiles it a second
time via electron-builder's `npmRebuild`, and the resulting `.exe` files must
be copied into `release/WIN7-TEST/` by hand.

## Solution

One orchestrator script, `electron/scripts/build-win7-test.js`, run as
`npm run dist:win7:test`. The existing `dist:win7` / `dist:win7:ia32` scripts
are repointed at it (`--arch x64` / `--arch ia32`) so the old bug-prone path
no longer exists.

### What the script does, in order

1. Kill running retailer processes (reuses `kill-retailer-processes.js`;
   ignores failure) so locked exes don't abort packaging.
2. Pre-clean the `win-*-unpacked` output dirs and fail fast (seconds, with a
   clear message) if a file in them is held open by another program. This was
   a real hidden failure cause: editor tabs (Cursor) holding `app.asar` open
   made electron-builder die minutes into packaging with an opaque error. The
   output dirs were also moved to fresh paths (`release/win7/<arch>/`) to
   escape existing locks on the old `win7-build-*` folders.
3. Build the client once (`npm run build --prefix client`), skippable with
   `--skip-client`.
3. For each requested arch (`both` by default):
   a. **Cache:** fetch `better_sqlite3.node` from
      `.native-cache/electron-<ver>_better-sqlite3-<ver>_<arch>/` (a file
      copy, ~1 s). On cache miss, run
      `electron-rebuild -f -w better-sqlite3 -a <arch>` once and store the
      result in the cache. The cache key contains the Electron and
      better-sqlite3 versions, so upgrading either invalidates it.
   b. **Verify:** read the PE header of the binary in `node_modules` and
      assert the machine type matches the target arch (0x014C = ia32,
      0x8664 = x64). Abort with a clear message on mismatch — a wrong-arch
      installer can no longer be produced.
   c. **Package:** run electron-builder with the existing per-arch win7 yml.
      `--fast` adds `-c.compression=store` (much faster NSIS step, bigger
      exe — for test iterations only).
   d. **Assemble:** delete the old matching installer in `release/WIN7-TEST/`
      (`2_INSTALL_SECOND_*.exe` or `2b_FOR_32BIT_WIN7_*.exe`) and copy the
      new artifact in. VxKex and STEPS.txt are never touched.
4. **`finally`: restore the x64 binary** (from cache) — even when a build
   fails, `node_modules` is left in the state the dev server needs. This is
   the structural fix for the recurring crash.

### Config changes

- `electron-builder-x64-win7.yml` / `electron-builder-ia32-win7.yml`:
  `npmRebuild: true → false`. Every path through these configs already
  rebuilds (or cache-restores) the native module explicitly first, so
  electron-builder's own rebuild was a redundant second compile per build.
- `package.json`: add `dist:win7:test`, repoint `dist:win7` and
  `dist:win7:ia32` to the script.
- `.gitignore`: add `.native-cache/`.

### Out of scope

`dist` / `dist:win11` (non-win7 flow), the auto-update (`electron-updater`)
flow, and the VxKex installer itself are unchanged.

## Error handling

- Cache miss → transparent rebuild (slow once), then cached.
- PE arch mismatch after restore/rebuild → hard abort before packaging.
- electron-builder failure → x64 restore still runs (`finally`), non-zero exit.
- Restore failure itself → loud error telling the user to run
  `npm run electron:rebuild`.

## Verification

Run `npm run dist:win7:test -- --fast`; confirm both exes land in
`release/WIN7-TEST/`, then confirm `better_sqlite3.node` is x64 and loads
under Electron (`ELECTRON_RUN_AS_NODE=1 npx electron -e "require('better-sqlite3')"`).
Run it a second time to confirm the cache makes arch switching ~instant.
