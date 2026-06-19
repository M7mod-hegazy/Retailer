#!/usr/bin/env node
// DEPRECATED — kept only so old muscle-memory / references don't break.
//
// This script used to contain a HARDCODED GitHub token and uploaded only the
// ia32 assets, producing a single-arch latest.yml that electron-updater on x64
// could not consume. Both problems are fixed in publish-release.js, which reads
// GH_TOKEN from the environment and uploads a merged multi-arch latest.yml.
//
// Usage:  GH_TOKEN=xxxx node electron/scripts/publish-release.js
require('./publish-release.js');
