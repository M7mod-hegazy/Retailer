const crypto = require("crypto");

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 100;

function cacheKey(slug, startDate, endDate, opts = {}) {
  const hash = crypto.createHash("md5").update(JSON.stringify({ slug, startDate, endDate, opts })).digest("hex");
  return `report:${hash}`;
}

function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function set(key, data) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.entries().next().value;
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { data, ts: Date.now() });
}

function invalidate(slug) {
  for (const [key] of cache) {
    if (key.includes(`"slug":"${slug}"`)) cache.delete(key);
  }
}

function invalidateAll() {
  cache.clear();
}

module.exports = { cacheKey, get, set, invalidate, invalidateAll };
