const crypto = require("crypto");

const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

const NO_CACHE_OPERATIONS = new Set([
  "chat",
  "handoff-summary",
  "memory-chat-summary",
  "memory-chat",
]);

/** @type {Map<string, { value: string, expiresAt: number }>} */
const cache = new Map();

function buildCacheKey(operation, promptText) {
  const op = String(operation || "unknown").trim() || "unknown";
  const snippet = String(promptText || "").slice(0, 500);
  const hash = crypto.createHash("sha256").update(snippet).digest("hex").slice(0, 16);
  return `${op}:${hash}`;
}

function pruneExpired(now = Date.now()) {
  for (const [key, entry] of cache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function evictOldestIfNeeded(maxEntries = DEFAULT_MAX_ENTRIES) {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

function getCachedLlmResponse(operation, promptText) {
  if (NO_CACHE_OPERATIONS.has(operation)) {
    return null;
  }
  const key = buildCacheKey(operation, promptText);
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedLlmResponse(operation, promptText, response, ttlMs = DEFAULT_TTL_MS) {
  if (NO_CACHE_OPERATIONS.has(operation)) {
    return;
  }
  const text = String(response || "").trim();
  if (!text) {
    return;
  }
  pruneExpired();
  const key = buildCacheKey(operation, promptText);
  cache.set(key, {
    value: text,
    expiresAt: Date.now() + Math.max(1000, ttlMs),
  });
  evictOldestIfNeeded();
}

function clearLlmResponseCache() {
  cache.clear();
}

module.exports = {
  DEFAULT_MAX_ENTRIES,
  DEFAULT_TTL_MS,
  NO_CACHE_OPERATIONS,
  buildCacheKey,
  getCachedLlmResponse,
  setCachedLlmResponse,
  clearLlmResponseCache,
};
