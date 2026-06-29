#!/usr/bin/env node
// Correct multi-arch build for the auto-update channel (electron-builder.yml).
//
//   node electron/scripts/build-dist.js [--x64-only] [--skip-client]
//                                       [--publish] [--draft] [--dry-run]
//
// WHY THIS EXISTS — the bug it fixes:
//   `electron-builder --win` targeting x64 + ia32 in ONE run packs whatever
//   better_sqlite3.node happens to be in node_modules into BOTH installers.
//   `npm run electron:rebuild` only builds the x64 binary, so the ia32 installer
//   shipped a 64-bit DB driver. On a 32-bit PC that .node is "not a valid Win32
//   application" → the server crashes on startup → it looked like the app
//   "installed but never opened" / "database corrupted". (Reverting worked
//   because the old build had the right binary.)
//
//   This script builds each arch in its OWN electron-builder run with the
//   correct better_sqlite3.node swapped in and VERIFIED (PE machine type) first,
//   then publishes ONE merged latest.yml that lists both installers so
//   electron-updater hands each PC the installer matching its arch.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { ensureNativeBinary, restoreDevBinary, ROOT } = require("./native-cache");

let yaml;
try {
  yaml = require("js-yaml");
} catch (_) {
  yaml = null; // only needed for --publish
}

const PKG = require(path.join(ROOT, "package.json"));
const VERSION = PKG.version;
const TAG = `v${VERSION}`;
const REPO = "M7mod-hegazy/Retailer";
const CONFIG = "electron-builder.yml";

const argv = process.argv.slice(2);
const X64_ONLY = argv.includes("--x64-only");
const SKIP_CLIENT = argv.includes("--skip-client");
const PUBLISH = argv.includes("--publish");
const DRAFT = argv.includes("--draft");
const DRY_RUN = argv.includes("--dry-run");

const ARCHS = X64_ONLY ? ["x64"] : ["ia32", "x64"];

function log(msg) {
  console.log(`[build-dist] ${msg}`);
}

function run(command, args, label) {
  log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit code ${result.status})`);
  }
}

function outputDirFor(arch) {
  return path.join(ROOT, "release", "dist", arch);
}

// Build one arch into its own output dir with the correct, verified binary.
function buildArch(arch) {
  ensureNativeBinary(arch); // swaps + verifies the binary; afterPack re-verifies
  const out = path.relative(ROOT, outputDirFor(arch)).replace(/\\/g, "/");
  const archFlag = arch === "ia32" ? "--ia32" : "--x64";
  run(
    "npx",
    ["electron-builder", "--win", archFlag, "--config", CONFIG, "-c.win.target=nsis", `-c.directories.output=${out}`],
    `electron-builder (${arch})`
  );
}

function readLatestYml(arch) {
  const file = path.join(outputDirFor(arch), "latest.yml");
  if (!fs.existsSync(file)) {
    throw new Error(`missing ${path.relative(ROOT, file)} — the ${arch} build did not produce a latest.yml.`);
  }
  const data = yaml.load(fs.readFileSync(file, "utf8"));
  if (data.version !== VERSION) {
    throw new Error(`${arch} latest.yml is version ${data.version} but package.json is ${VERSION}.`);
  }
  if (!data.files || !data.files.length) {
    throw new Error(`${arch} latest.yml has no files[] entries.`);
  }
  return data;
}

// Merge the per-arch latest.yml files into one whose files[] lists every arch.
// electron-updater picks the file whose name carries the running arch token.
function buildMergedLatestYml(perArch) {
  const files = [];
  for (const arch of Object.keys(perArch)) {
    for (const f of perArch[arch].files) {
      if (!f.url.toLowerCase().includes(arch)) {
        throw new Error(
          `${arch} installer "${f.url}" has no "${arch}" token in its name; ` +
            "electron-updater could not pick the right arch. Fix artifactName."
        );
      }
      files.push({ url: f.url, sha512: f.sha512, size: f.size });
    }
  }
  const primary = (perArch.x64 || perArch[Object.keys(perArch)[0]]).files[0];
  return yaml.dump(
    {
      version: VERSION,
      files,
      path: primary.url,
      sha512: primary.sha512,
      releaseDate: new Date().toISOString(),
    },
    { lineWidth: -1 }
  );
}

function installerPathFor(arch) {
  const yml = readLatestYml(arch);
  const name = yml.files[0].url;
  const file = path.join(outputDirFor(arch), name);
  if (!fs.existsSync(file)) {
    throw new Error(`installer ${name} listed in ${arch} latest.yml not found.`);
  }
  return file;
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

function uploadAsset(token, uploadUrl, filePath, fileName, contentBuffer) {
  return new Promise((resolve, reject) => {
    const size = contentBuffer ? contentBuffer.length : fs.statSync(filePath).size;
    const urlString = uploadUrl.replace(/\{\?name,label\}/, "") + `?name=${encodeURIComponent(fileName)}`;
    const url = new URL(urlString);
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": fileName.endsWith(".yml") ? "text/yaml" : "application/octet-stream",
          "Content-Length": size,
          "User-Agent": "retailer-publisher",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            log(`uploaded ${fileName}`);
            resolve();
          } else {
            reject(new Error(`upload ${fileName} failed: ${res.statusCode} ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (contentBuffer) req.end(contentBuffer);
    else fs.createReadStream(filePath).pipe(req);
  });
}

async function getOrCreateRelease(token) {
  try {
    const existing = await request({
      hostname: "api.github.com",
      path: `/repos/${REPO}/releases/tags/${TAG}`,
      method: "GET",
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "retailer-publisher" },
    });
    if (existing && existing.upload_url) {
      log(`reusing existing release ${TAG}`);
      return existing;
    }
  } catch (_) { /* create below */ }
  return request(
    {
      hostname: "api.github.com",
      path: `/repos/${REPO}/releases`,
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "retailer-publisher",
      },
    },
    { tag_name: TAG, target_commitish: "main", name: TAG, body: `Release ${TAG}`, draft: DRAFT, prerelease: false }
  );
}

async function publish() {
  if (!yaml) throw new Error("js-yaml is required for --publish but could not be loaded.");
  const perArch = Object.fromEntries(ARCHS.map((a) => [a, readLatestYml(a)]));
  const mergedYml = buildMergedLatestYml(perArch);

  const assets = ARCHS.map((a) => ({ path: installerPathFor(a), name: path.basename(installerPathFor(a)) }));
  log(`release ${TAG}: ${assets.length} installer asset(s) + merged latest.yml`);
  assets.forEach((a) => log(`  - ${a.name}`));

  if (DRY_RUN) {
    log("dry-run: nothing uploaded. Merged latest.yml:\n" + mergedYml);
    return;
  }
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("GH_TOKEN env var is required to publish (a GitHub PAT with repo scope).");

  const release = await getOrCreateRelease(token);
  for (const a of assets) await uploadAsset(token, release.upload_url, a.path, a.name);
  await uploadAsset(token, release.upload_url, null, "latest.yml", Buffer.from(mergedYml, "utf8"));
  log(`done — release ${TAG} published with a multi-arch latest.yml.`);
}

async function main() {
  run("node", [path.join(__dirname, "kill-retailer-processes.js")], "kill-retailer-processes");
  if (SKIP_CLIENT) log("skipping client build (--skip-client)");
  else run("npm", ["run", "build", "--prefix", "client"], "client build");

  try {
    for (const arch of ARCHS) buildArch(arch);
    log(`built: ${ARCHS.join(" + ")} → release/dist`);
    if (PUBLISH) await publish();
  } finally {
    restoreDevBinary(); // never leave node_modules with a 32-bit binary for dev
  }
}

main().catch((err) => {
  console.error(`[build-dist] ${err.message}`);
  process.exit(1);
});
