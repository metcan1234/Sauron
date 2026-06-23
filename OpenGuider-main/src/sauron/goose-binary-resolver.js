const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const {
  GOOSE_BINARY_SEARCH_GLOBS,
  getDefaultSearchRoots,
} = require("./goose-config");

const execFileAsync = promisify(execFile);

let cachedBinaryPath = null;

function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function walkForBinary(dir, depth = 0, maxDepth = 4) {
  if (!dir || depth > maxDepth) {
    return null;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const name of GOOSE_BINARY_SEARCH_GLOBS) {
    const candidate = path.join(dir, name);
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }

  if (depth >= maxDepth) {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skip = new Set(["node_modules", ".git", "dist", "release", "out"]);
    if (skip.has(entry.name)) {
      continue;
    }
    const found = walkForBinary(path.join(dir, entry.name), depth + 1, maxDepth);
    if (found) {
      return found;
    }
  }
  return null;
}

async function resolveGooseFromPath() {
  if (process.platform !== "win32") {
    try {
      const { stdout } = await execFileAsync("which", ["goose"], { timeout: 4000 });
      const resolved = String(stdout || "").trim().split("\n")[0];
      return isExecutableFile(resolved) ? resolved : null;
    } catch {
      return null;
    }
  }

  try {
    const { stdout } = await execFileAsync("where.exe", ["goose"], { timeout: 4000 });
    const lines = String(stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      if (isExecutableFile(line)) {
        return line;
      }
    }
  } catch {
    // continue
  }

  const localBin = path.join(process.env.USERPROFILE || "", ".local", "bin", "goose.exe");
  if (isExecutableFile(localBin)) {
    return localBin;
  }
  return null;
}

function discoverGooseBinary(settings = {}) {
  const override = String(settings.gooseBinaryPath || "").trim();
  if (override && isExecutableFile(override)) {
    return override;
  }

  if (cachedBinaryPath && isExecutableFile(cachedBinaryPath)) {
    return cachedBinaryPath;
  }

  for (const root of getDefaultSearchRoots()) {
    const found = walkForBinary(root, 0, 3);
    if (found) {
      cachedBinaryPath = found;
      return found;
    }
  }

  return null;
}

async function discoverGooseBinaryAsync(settings = {}) {
  const override = String(settings.gooseBinaryPath || "").trim();
  if (override && isExecutableFile(override)) {
    return override;
  }

  const local = discoverGooseBinary(settings);
  if (local) {
    return local;
  }

  return resolveGooseFromPath();
}

async function getGooseVersion(binaryPath) {
  const resolved = String(binaryPath || "").trim();
  if (!resolved || !isExecutableFile(resolved)) {
    return null;
  }
  try {
    const { stdout } = await execFileAsync(resolved, ["--version"], { timeout: 5000 });
    return String(stdout || "").trim() || null;
  } catch {
    return null;
  }
}

function clearGooseBinaryCache() {
  cachedBinaryPath = null;
}

module.exports = {
  discoverGooseBinary,
  discoverGooseBinaryAsync,
  getGooseVersion,
  clearGooseBinaryCache,
  isExecutableFile,
};
