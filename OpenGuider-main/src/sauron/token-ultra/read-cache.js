const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_FILENAME = "read-cache.json";

function getCachePath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", CACHE_FILENAME);
}

function hashContent(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex").slice(0, 16);
}

function readReadCache(workspacePath) {
  const cachePath = getCachePath(workspacePath);
  try {
    if (!fs.existsSync(cachePath)) {
      return { files: {} };
    }
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return { files: parsed.files || {} };
  } catch {
    return { files: {} };
  }
}

function writeReadCache(workspacePath, cache) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const cachePath = getCachePath(resolved);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({
    files: cache.files || {},
    updatedAt: new Date().toISOString(),
  }, null, 2), "utf8");
  return true;
}

function recordFileRead(workspacePath, filePath, content = "") {
  const resolved = String(workspacePath || "").trim();
  const rel = String(filePath || "").replace(/\\/g, "/");
  if (!resolved || !rel) {
    return null;
  }
  const cache = readReadCache(resolved);
  const entry = {
    hash: hashContent(content),
    readAt: new Date().toISOString(),
    readCount: (cache.files[rel]?.readCount || 0) + 1,
  };
  cache.files[rel] = entry;
  writeReadCache(resolved, cache);
  return entry;
}

function buildReadPointer(workspacePath, filePath) {
  const resolved = String(workspacePath || "").trim();
  const rel = String(filePath || "").replace(/\\/g, "/");
  if (!resolved || !rel) {
    return { usePointer: false, line: null };
  }
  const cache = readReadCache(resolved);
  const entry = cache.files[rel];
  if (!entry || entry.readCount < 2) {
    return { usePointer: false, line: null };
  }
  return {
    usePointer: true,
    line: `[read-cache] ${rel} — önceki okuma (${entry.hash}); diff veya satır aralığı kullan`,
    hash: entry.hash,
    readCount: entry.readCount,
  };
}

module.exports = {
  CACHE_FILENAME,
  readReadCache,
  writeReadCache,
  recordFileRead,
  buildReadPointer,
};
