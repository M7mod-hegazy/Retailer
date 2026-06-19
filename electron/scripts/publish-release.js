#!/usr/bin/env node
// Publishes a Win7 GitHub release that electron-updater can actually consume.
//
//   GH_TOKEN=xxxx node electron/scripts/publish-release.js [--draft] [--dry-run]
//
// Why this exists:
//   The x64 and ia32 installers are built by separate electron-builder runs
//   (see build-win7-test.js), so each emits its OWN latest.yml that references
//   only one arch. A GitHub release can host just ONE latest.yml, so uploading
//   both would clobber. electron-updater instead expects a SINGLE latest.yml
//   whose `files[]` lists every arch installer; it then picks the file whose
//   name matches the running arch (our names carry an "x64"/"ia32" token).
//
//   This script merges the two per-arch latest.yml files into one, then creates
//   the release and uploads: both installers + the VxKex setup + merged yml.
//   The token is read from GH_TOKEN (never hardcoded).
const fs = require('fs');
const path = require('path');
const https = require('https');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', '..');
const REPO = 'M7mod-hegazy/Retailer';
const PKG = require(path.join(ROOT, 'package.json'));
const VERSION = PKG.version;
const TAG = `v${VERSION}`;

const ARCHS = {
  x64: { dir: path.join(ROOT, 'release', 'win7', 'x64'), token: 'x64' },
  ia32: { dir: path.join(ROOT, 'release', 'win7', 'ia32'), token: 'ia32' },
};
const WIN7_TEST_DIR = path.join(ROOT, 'release', 'WIN7-TEST');

const argv = process.argv.slice(2);
const DRAFT = argv.includes('--draft');
const DRY_RUN = argv.includes('--dry-run');

function log(msg) { console.log(`[publish] ${msg}`); }

function readLatestYml(arch) {
  const file = path.join(ARCHS[arch].dir, 'latest.yml');
  if (!fs.existsSync(file)) {
    throw new Error(`missing ${path.relative(ROOT, file)} — build the ${arch} installer first (npm run dist:win7${arch === 'ia32' ? ':ia32' : ''}).`);
  }
  const data = yaml.load(fs.readFileSync(file, 'utf8'));
  if (data.version !== VERSION) {
    throw new Error(
      `${arch} latest.yml is version ${data.version} but package.json is ${VERSION}. ` +
      'Both arches must be built from the same version — rebuild before publishing.'
    );
  }
  if (!data.files || !data.files.length) {
    throw new Error(`${arch} latest.yml has no files[] entries.`);
  }
  return data;
}

// Build one latest.yml whose files[] lists every arch, so electron-updater can
// resolve the right installer by the arch token in each filename.
function buildMergedLatestYml(perArch) {
  const files = [];
  for (const arch of Object.keys(perArch)) {
    for (const f of perArch[arch].files) {
      if (!f.url.toLowerCase().includes(ARCHS[arch].token)) {
        throw new Error(
          `${arch} installer "${f.url}" does not contain the "${ARCHS[arch].token}" token; ` +
          'electron-updater could not pick the right arch. Fix the artifactName.'
        );
      }
      files.push({ url: f.url, sha512: f.sha512, size: f.size });
    }
  }
  // Top-level legacy fields point at the x64 build (the primary desktop target).
  const primary = perArch.x64.files[0];
  return yaml.dump({
    version: VERSION,
    files,
    path: primary.url,
    sha512: primary.sha512,
    releaseDate: new Date().toISOString(),
  }, { lineWidth: -1 });
}

function findInstaller(arch) {
  const dir = ARCHS[arch].dir;
  const yml = readLatestYml(arch);
  const name = yml.files[0].url;
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    throw new Error(`installer ${name} listed in ${arch} latest.yml not found in ${path.relative(ROOT, dir)}.`);
  }
  return file;
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function uploadAsset(token, uploadUrl, filePath, fileName, contentBuffer) {
  return new Promise((resolve, reject) => {
    const size = contentBuffer ? contentBuffer.length : fs.statSync(filePath).size;
    const urlString = uploadUrl.replace(/\{\?name,label\}/, '') + `?name=${encodeURIComponent(fileName)}`;
    const url = new URL(urlString);
    const req = https.request({
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': fileName.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream',
        'Content-Length': size,
        'User-Agent': 'retailer-publisher',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          log(`uploaded ${fileName}`);
          resolve();
        } else {
          reject(new Error(`upload ${fileName} failed: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (contentBuffer) { req.end(contentBuffer); }
    else { fs.createReadStream(filePath).pipe(req); }
  });
}

async function getOrCreateRelease(token) {
  // Reuse an existing release for this tag if present (idempotent re-runs).
  try {
    const existing = await request({
      hostname: 'api.github.com',
      path: `/repos/${REPO}/releases/tags/${TAG}`,
      method: 'GET',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'retailer-publisher' },
    });
    if (existing && existing.upload_url) {
      log(`reusing existing release ${TAG}`);
      return existing;
    }
  } catch (_) { /* not found — create below */ }

  return request({
    hostname: 'api.github.com',
    path: `/repos/${REPO}/releases`,
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'retailer-publisher',
    },
  }, { tag_name: TAG, target_commitish: 'main', name: TAG, body: `Release ${TAG}`, draft: DRAFT, prerelease: false });
}

async function main() {
  const perArch = { x64: readLatestYml('x64'), ia32: readLatestYml('ia32') };
  const mergedYml = buildMergedLatestYml(perArch);

  // Write the merged yml next to the test bundle for inspection.
  fs.mkdirSync(WIN7_TEST_DIR, { recursive: true });
  const mergedPath = path.join(WIN7_TEST_DIR, 'latest.yml');
  fs.writeFileSync(mergedPath, mergedYml, 'utf8');
  log(`merged latest.yml written to ${path.relative(ROOT, mergedPath)}`);

  const assets = [
    { path: findInstaller('x64'), name: path.basename(findInstaller('x64')) },
    { path: findInstaller('ia32'), name: path.basename(findInstaller('ia32')) },
  ];
  const vxkex = path.join(WIN7_TEST_DIR, '1_INSTALL_FIRST_VxKex_Setup.exe');
  if (fs.existsSync(vxkex)) assets.push({ path: vxkex, name: path.basename(vxkex) });

  log(`release ${TAG}: ${assets.length} installer asset(s) + latest.yml`);
  assets.forEach((a) => log(`  - ${a.name}`));

  if (DRY_RUN) {
    log('dry-run: nothing uploaded. Merged latest.yml:\n' + mergedYml);
    return;
  }

  const token = process.env.GH_TOKEN;
  if (!token) {
    throw new Error('GH_TOKEN env var is required (a GitHub PAT with repo scope). Never hardcode it.');
  }

  const release = await getOrCreateRelease(token);
  const uploadUrl = release.upload_url;

  for (const a of assets) {
    await uploadAsset(token, uploadUrl, a.path, a.name);
  }
  // Upload the MERGED yml (not the per-arch ones).
  await uploadAsset(token, uploadUrl, null, 'latest.yml', Buffer.from(mergedYml, 'utf8'));

  log(`done — release ${TAG} published with a multi-arch latest.yml.`);
}

main().catch((err) => {
  console.error(`[publish] ${err.message}`);
  process.exit(1);
});
