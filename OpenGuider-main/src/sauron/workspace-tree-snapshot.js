const fs = require("fs");
const path = require("path");
const { detectWorkspaceLayout } = require("./workspace-detector");

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "release",
  "out",
  ".sauron",
]);

const DEFAULT_OPTIONS = {
  maxDepth: 2,
  maxEntries: 40,
  maxChars: 700,
};

function readPackageMeta(workspacePath) {
  try {
    const raw = fs.readFileSync(path.join(workspacePath, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    const scripts = pkg.scripts && typeof pkg.scripts === "object"
      ? Object.keys(pkg.scripts).slice(0, 12)
      : [];
    const depCount = pkg.dependencies && typeof pkg.dependencies === "object"
      ? Object.keys(pkg.dependencies).length
      : 0;
    const devDepCount = pkg.devDependencies && typeof pkg.devDependencies === "object"
      ? Object.keys(pkg.devDependencies).length
      : 0;
    return {
      name: String(pkg.name || "").trim(),
      scripts,
      depCount,
      devDepCount,
    };
  } catch {
    return null;
  }
}

function listDirectoryEntries(dirPath, depth, state, options) {
  if (depth > options.maxDepth || state.entryCount >= options.maxEntries) {
    return;
  }

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() === b.isDirectory()) {
      return a.name.localeCompare(b.name);
    }
    return a.isDirectory() ? -1 : 1;
  });

  for (const entry of entries) {
    if (state.entryCount >= options.maxEntries) {
      state.truncated = true;
      break;
    }

    const name = entry.name;
    if (SKIP_DIR_NAMES.has(name)) {
      if (name === ".sauron" && depth === 0) {
        state.lines.push(".sauron/");
        state.entryCount += 1;
      }
      continue;
    }

    const indent = "  ".repeat(depth);
    if (entry.isDirectory()) {
      state.lines.push(`${indent}${name}/`);
      state.entryCount += 1;
      listDirectoryEntries(path.join(dirPath, name), depth + 1, state, options);
    } else if (depth < options.maxDepth) {
      state.lines.push(`${indent}${name}`);
      state.entryCount += 1;
    }
  }
}

function buildWorkspaceTreeHint(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !fs.existsSync(resolved)) {
    return "";
  }

  const merged = { ...DEFAULT_OPTIONS, ...options };
  const layout = detectWorkspaceLayout(resolved);
  const pkg = readPackageMeta(resolved);
  const metaLines = [`layout: ${layout.layout || "unknown"}`];

  if (layout.packageName) {
    metaLines.push(`package: ${layout.packageName}`);
  } else if (pkg?.name) {
    metaLines.push(`package: ${pkg.name}`);
  }

  if (pkg?.scripts?.length) {
    metaLines.push(`scripts: ${pkg.scripts.join(", ")}`);
  }
  if (pkg && (pkg.depCount > 0 || pkg.devDepCount > 0)) {
    metaLines.push(`dependencies: ${pkg.depCount} prod, ${pkg.devDepCount} dev`);
  }

  const state = { lines: [], entryCount: 0, truncated: false };
  listDirectoryEntries(resolved, 0, state, merged);

  let body = [
    "Workspace snapshot:",
    ...metaLines,
    ...state.lines,
  ].join("\n");

  if (state.truncated || body.length > merged.maxChars) {
    body = `${body.slice(0, Math.max(0, merged.maxChars - 1))}…`;
  }

  return body;
}

module.exports = {
  SKIP_DIR_NAMES,
  buildWorkspaceTreeHint,
  readPackageMeta,
};
