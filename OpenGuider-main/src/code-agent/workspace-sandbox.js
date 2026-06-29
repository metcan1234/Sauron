const fs = require("fs");
const path = require("path");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "release",
  "win-unpacked",
  ".sauron",
]);

const IGNORE_EXTENSIONS = new Set([".exe", ".dll", ".ico", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip"]);

function resolveSafePath(workspacePath, relativePath = "") {
  const raw = String(workspacePath || "").trim();
  if (!raw) {
    throw new Error("Workspace path is required.");
  }
  const root = path.resolve(raw);
  const target = path.resolve(root, String(relativePath || "").replace(/^[/\\]+/, ""));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(rootWithSep)) {
    throw new Error("Path outside workspace.");
  }
  return target;
}

function shouldIgnoreEntry(name, isDirectory) {
  if (IGNORE_DIRS.has(name)) {
    return true;
  }
  if (!isDirectory && IGNORE_EXTENSIONS.has(path.extname(name).toLowerCase())) {
    return true;
  }
  return false;
}

function listFilesRecursive(workspacePath, options = {}) {
  const root = resolveSafePath(workspacePath);
  const maxDepth = Number(options.maxDepth) > 0 ? Number(options.maxDepth) : 6;
  const maxFiles = Number(options.maxFiles) > 0 ? Number(options.maxFiles) : 500;
  const results = [];

  function walk(dir, depth) {
    if (depth > maxDepth || results.length >= maxFiles) {
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) {
        break;
      }
      if (shouldIgnoreEntry(entry.name, entry.isDirectory())) {
        continue;
      }
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else {
        results.push(rel);
      }
    }
  }

  walk(root, 0);
  return results;
}

module.exports = {
  IGNORE_DIRS,
  resolveSafePath,
  shouldIgnoreEntry,
  listFilesRecursive,
};
