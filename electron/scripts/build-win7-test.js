#!/usr/bin/env node
// Builds the Win7 installers and assembles release/WIN7-TEST in one run.
//
//   node electron/scripts/build-win7-test.js [--arch=both|x64|ia32] [--fast] [--skip-client]
//
//   --arch         which installers to build (default: both)
//   --fast         NSIS "store" compression: much faster packaging, bigger exe.
//                  For test iterations only — leave off for customer releases.
//   --skip-client  reuse the existing client/dist build
//
// Compiled better_sqlite3.node binaries are cached per arch in .native-cache/
// so switching arch is a file copy instead of a source compile. Whatever
// happens, the x64 binary is restored at the end so the dev server (x64
// Electron) is never left with a 32-bit binary in node_modules.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const NATIVE_BINARY = path.join(
  ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'
);
const WIN7_TEST_DIR = path.join(ROOT, 'release', 'WIN7-TEST');

const ARCHS = {
  x64: {
    peMachine: 0x8664,
    config: 'electron-builder-x64-win7.yml',
    outputDir: path.join(ROOT, 'release', 'win7', 'x64'),
    artifactPrefix: '2_INSTALL_SECOND_',
  },
  ia32: {
    peMachine: 0x014c,
    config: 'electron-builder-ia32-win7.yml',
    outputDir: path.join(ROOT, 'release', 'win7', 'ia32'),
    artifactPrefix: '2b_FOR_32BIT_WIN7_',
  },
};

function log(msg) {
  console.log(`[win7-build] ${msg}`);
}

function run(command, args, label) {
  log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit code ${result.status})`);
  }
}

function peMachineType(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 64 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    throw new Error(`${file} is not a PE binary`);
  }
  const peOffset = bytes.readUInt32LE(60);
  return bytes.readUInt16LE(peOffset + 4);
}

function assertBinaryArch(arch) {
  const machine = peMachineType(NATIVE_BINARY);
  if (machine !== ARCHS[arch].peMachine) {
    throw new Error(
      `better_sqlite3.node is machine type 0x${machine.toString(16)} but the ` +
      `${arch} installer needs 0x${ARCHS[arch].peMachine.toString(16)}. Aborting ` +
      'before a broken installer is produced.'
    );
  }
}

function cachePathFor(arch) {
  const electronVersion = require(path.join(ROOT, 'node_modules', 'electron', 'package.json')).version;
  const sqliteVersion = require(path.join(ROOT, 'node_modules', 'better-sqlite3', 'package.json')).version;
  const abi = process.versions.modules;
  return path.join(
    ROOT, '.native-cache',
    `electron-${electronVersion}_abi-${abi}_better-sqlite3-${sqliteVersion}_${arch}`,
    'better_sqlite3.node'
  );
}

// Puts a better_sqlite3.node of the requested arch into node_modules,
// from cache when possible, compiling (and caching) otherwise.
function ensureNativeBinary(arch) {
  const cached = cachePathFor(arch);
  if (fs.existsSync(cached)) {
    fs.copyFileSync(cached, NATIVE_BINARY);
    log(`${arch}: restored better_sqlite3.node from cache`);
  } else {
    log(`${arch}: no cached binary, compiling (one-time, takes a few minutes)...`);
    run('npx', ['electron-rebuild', '-f', '-w', 'better-sqlite3', '-a', arch], `electron-rebuild (${arch})`);
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.copyFileSync(NATIVE_BINARY, cached);
    log(`${arch}: compiled and cached`);
  }
  assertBinaryArch(arch);
}

function unpackedDirName(arch) {
  return arch === 'x64' ? 'win-unpacked' : 'win-ia32-unpacked';
}

function isLockedOutputError(err) {
  const msg = err && err.message ? err.message : String(err);
  const code = err && err.code;
  return code === 'EBUSY' || code === 'EPERM' || /EBUSY|EPERM|being used|resource busy/i.test(msg);
}

// electron-builder must empty the unpacked dir; a stale file held open by
// another program (editor tab, Explorer preview, antivirus) makes it fail
// minutes into the build. Clear it up front when possible; if the folder is
// locked, fall back to a fresh timestamped output dir so the build can proceed.
function prepareOutputDir(arch) {
  const defaultOutput = ARCHS[arch].outputDir;
  const unpacked = path.join(defaultOutput, unpackedDirName(arch));
  if (!fs.existsSync(unpacked)) {
    return defaultOutput;
  }
  try {
    fs.rmSync(unpacked, { recursive: true, force: true });
    return defaultOutput;
  } catch (err) {
    if (!isLockedOutputError(err)) {
      throw new Error(
        `cannot clean ${path.relative(ROOT, unpacked)}: ${err.message}`
      );
    }
    const fallback = path.join(
      path.dirname(defaultOutput),
      `${path.basename(defaultOutput)}-${Date.now()}`
    );
    log(
      `cannot clean ${path.relative(ROOT, unpacked)} (file open in another program); ` +
      `using ${path.relative(ROOT, fallback)} for this build`
    );
    return fallback;
  }
}

function newestArtifact(arch, outputDir = ARCHS[arch].outputDir) {
  const { artifactPrefix } = ARCHS[arch];
  const candidates = fs.readdirSync(outputDir)
    .filter((f) => f.startsWith(artifactPrefix) && f.endsWith('.exe'))
    .map((f) => path.join(outputDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!candidates.length) {
    throw new Error(`no ${artifactPrefix}*.exe found in ${outputDir}`);
  }
  return candidates[0];
}

function copyIntoWin7Test(artifact, arch) {
  fs.mkdirSync(WIN7_TEST_DIR, { recursive: true });
  for (const old of fs.readdirSync(WIN7_TEST_DIR)) {
    if (old.startsWith(ARCHS[arch].artifactPrefix) && old.endsWith('.exe')) {
      fs.rmSync(path.join(WIN7_TEST_DIR, old));
    }
  }
  const dest = path.join(WIN7_TEST_DIR, path.basename(artifact));
  fs.copyFileSync(artifact, dest);
  log(`${arch}: installer copied to ${path.relative(ROOT, dest)}`);
}


function copyPublishArtifacts(arch, outputDir) {
  if (outputDir === ARCHS[arch].outputDir) return;
  fs.mkdirSync(ARCHS[arch].outputDir, { recursive: true });
  const installer = newestArtifact(arch, outputDir);
  const files = [installer, `${installer}.blockmap`, path.join(outputDir, 'latest.yml')];
  for (const src of files) {
    if (!fs.existsSync(src)) throw new Error(`expected build artifact missing: ${path.relative(ROOT, src)}`);
    const dest = path.join(ARCHS[arch].outputDir, path.basename(src));
    fs.copyFileSync(src, dest);
    log(`${arch}: publish artifact copied to ${path.relative(ROOT, dest)}`);
  }
}
function buildArch(arch, fast, outputDir) {
  ensureNativeBinary(arch);
  const args = ['electron-builder', '--win', '--config', ARCHS[arch].config];
  if (outputDir !== ARCHS[arch].outputDir) {
    args.push(`-c.directories.output=${path.relative(ROOT, outputDir).replace(/\\/g, '/')}`);
  }
  if (fast) args.push('-c.compression=store');
  run('npx', args, `electron-builder (${arch})`);
  copyPublishArtifacts(arch, outputDir);
  copyIntoWin7Test(newestArtifact(arch, outputDir), arch);
}

function restoreDevBinary() {
  try {
    ensureNativeBinary('x64');
    log('x64 dev binary restored — dev server is safe to run.');
  } catch (err) {
    console.error(
      `[win7-build] FAILED to restore the x64 binary (${err.message}).\n` +
      '[win7-build] Run "npm run electron:rebuild" before starting the dev server.'
    );
    process.exitCode = 1;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const fast = argv.includes('--fast');
  const skipClient = argv.includes('--skip-client');
  const archArg = (argv.find((a) => a.startsWith('--arch')) || '--arch=both')
    .replace(/^--arch=?/, '') || argv[argv.indexOf('--arch') + 1];
  const archs = archArg === 'both' ? ['ia32', 'x64'] : [archArg];
  if (!archs.every((a) => ARCHS[a])) {
    throw new Error(`unknown --arch "${archArg}" (use both, x64 or ia32)`);
  }

  run('node', [path.join(__dirname, 'kill-retailer-processes.js')], 'kill-retailer-processes');
  const outputDirs = Object.fromEntries(archs.map((arch) => [arch, prepareOutputDir(arch)]));
  if (skipClient) {
    log('skipping client build (--skip-client)');
  } else {
    run('npm', ['run', 'build', '--prefix', 'client'], 'client build');
  }

  try {
    for (const arch of archs) buildArch(arch, fast, outputDirs[arch]);
    log(`done: ${archs.join(' + ')} installer(s) ready in release/WIN7-TEST`);
    if (fast) log('built with --fast (no compression) — do not ship these to customers.');
  } finally {
    restoreDevBinary();
  }
}

try {
  main();
} catch (err) {
  console.error(`[win7-build] ${err.message}`);
  process.exitCode = 1;
}
