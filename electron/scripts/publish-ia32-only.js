#!/usr/bin/env node
// Publishes ia32-ONLY to a GitHub Release for v{version}.
// Upload order: .exe → .blockmap → latest.yml  (critical!)
//
// Usage: GH_TOKEN=xxx node electron/scripts/publish-ia32-only.js
const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT    = path.join(__dirname, '..', '..');
const PKG     = require(path.join(ROOT, 'package.json'));
const VERSION = PKG.version;
const TAG     = `v${VERSION}`;
const REPO    = 'M7mod-hegazy/Retailer';
const IA32DIR = path.join(ROOT, 'release', 'win7', 'ia32');

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) { console.error('[ia32-publish] GH_TOKEN not set'); process.exit(1); }

function log(msg) { console.log(`[ia32-publish] ${msg}`); }

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      method, hostname: 'api.github.com', path: urlPath,
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'retailer-ia32-publisher',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else {
          reject(new Error(`${method} ${urlPath} → ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function uploadAsset(uploadUrl, fileName, content, contentType) {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(content);
    const size = isBuffer ? content.length : fs.statSync(content).size;
    const base = uploadUrl.replace(/\{\?name,label\}/, '');
    const url  = new URL(`${base}?name=${encodeURIComponent(fileName)}`);

    const req = https.request({
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + url.search,
      timeout: 10 * 60 * 1000, // 10-minute hard timeout
      headers: {
        Authorization: `token ${TOKEN}`,
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': size,
        'User-Agent': 'retailer-ia32-publisher',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        clearInterval(ticker);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          log(`  ✓ uploaded ${fileName}`);
          resolve();
        } else {
          reject(new Error(`upload ${fileName} failed: ${res.statusCode} ${data}`));
        }
      });
    });

    // Log progress every 10 s so the process doesn't look frozen
    let elapsed = 0;
    const ticker = setInterval(() => {
      elapsed += 10;
      log(`  … ${fileName} uploading (${elapsed}s elapsed, ${(size/1024/1024).toFixed(1)} MB total)`);
    }, 10000);

    req.on('timeout', () => {
      clearInterval(ticker);
      req.destroy(new Error(`upload ${fileName} timed out after 10 minutes`));
    });
    req.on('error', (err) => { clearInterval(ticker); reject(err); });

    if (isBuffer) {
      req.end(content);
    } else {
      const stream = fs.createReadStream(content);
      stream.on('error', (err) => { clearInterval(ticker); reject(err); });
      stream.pipe(req);
    }
  });
}

// ── Delete existing asset by name (idempotent re-run) ─────────────────────────
async function deleteAssetIfExists(releaseId, name) {
  const assets = await apiRequest('GET', `/repos/${REPO}/releases/${releaseId}/assets`);
  const existing = assets.find(a => a.name === name);
  if (existing) {
    await apiRequest('DELETE', `/repos/${REPO}/releases/assets/${existing.id}`);
    log(`  removed old asset: ${name}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Find installer files
  const exeName      = `2b_FOR_32BIT_WIN7_ElHegazi-Retailer-ia32-v${VERSION}.exe`;
  const blockmapName = `${exeName}.blockmap`;
  const exePath      = path.join(IA32DIR, exeName);
  const blockmapPath = path.join(IA32DIR, blockmapName);
  const ymlPath      = path.join(IA32DIR, 'latest.yml');

  for (const f of [exePath, blockmapPath, ymlPath]) {
    if (!fs.existsSync(f)) throw new Error(`Missing: ${path.relative(ROOT, f)}`);
  }

  const exeMB = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1);
  log(`Installer: ${exeName} (${exeMB} MB)`);
  if (parseFloat(exeMB) < 50) throw new Error(`Installer is only ${exeMB} MB — looks wrong, aborting.`);

  // 2. Get or create release
  let release;
  try {
    release = await apiRequest('GET', `/repos/${REPO}/releases/tags/${TAG}`);
    log(`Reusing existing release ${TAG} (id ${release.id})`);
  } catch {
    log(`Creating release ${TAG}...`);
    release = await apiRequest('POST', `/repos/${REPO}/releases`, {
      tag_name: TAG, target_commitish: 'main',
      name: TAG, body: `Release ${TAG}`,
      draft: false, prerelease: false,
    });
    log(`Created release id ${release.id}`);
  }

  const uploadUrl = release.upload_url;

  // 3. Upload in ORDER: .exe → .blockmap → latest.yml
  log(`Uploading to ${TAG} in order: .exe → .blockmap → latest.yml`);

  await deleteAssetIfExists(release.id, exeName);
  log(`Uploading .exe (${exeMB} MB)...`);
  await uploadAsset(uploadUrl, exeName, exePath);

  await deleteAssetIfExists(release.id, blockmapName);
  log('Uploading .blockmap...');
  await uploadAsset(uploadUrl, blockmapName, blockmapPath);

  await deleteAssetIfExists(release.id, 'latest.yml');
  log('Uploading latest.yml (last)...');
  await uploadAsset(uploadUrl, 'latest.yml', fs.readFileSync(ymlPath), 'text/yaml');

  log(`\nDone! Release ${TAG} published at:`);
  log(`https://github.com/${REPO}/releases/tag/${TAG}`);
}

main().catch(err => {
  console.error(`[ia32-publish] FAILED: ${err.message}`);
  process.exit(1);
});
