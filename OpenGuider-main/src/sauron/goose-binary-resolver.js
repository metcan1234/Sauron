const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const {
  GOOSE_BINARY_SEARCH_GLOBS,
  getDefaultSearchRoots,
} = require("./goose-config");

const execFileAsync = promisify(execFile);

const GOOSE_CLI_PREFERRED_PATHS = [
  () => path.join(process.env.USERPROFILE || "", ".local", "bin", "goose.exe"),
  () => path.join(process.env.USERPROFILE || "", "goose", "goose.exe"),
  () => path.join(process.env.USERPROFILE || "", ".cargo", "bin", "goose.exe"),
  () => path.join(process.env.USERPROFILE || "", "OneDrive", "Desktop", "EVERYTHİNG", "goose-package", "goose.exe"),
  () => path.join(process.env.USERPROFILE || "", "OneDrive", "Desktop", "EVERYTHING", "goose-package", "goose.exe"),
  () => path.join(process.env.USERPROFILE || "", "Desktop", "EVERYTHİNG", "goose-package", "goose.exe"),
  () => path.join(process.env.USERPROFILE || "", "Desktop", "EVERYTHING", "goose-package", "goose.exe"),
];

const GOOSE_DESKTOP_PATH_MARKERS = [
  "\\local\\programs\\goose\\",
  "\\program files\\goose\\",
  "\\program files\\block\\goose\\",
  "\\goose desktop\\",
  "\\block goose\\",
];

const TURKISH_LOCALE = "tr";
const VERSION_PATTERN = /(\d+\.\d+(?:\.\d+)?)/;

let cachedCliBinaryPath = null;

function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function namesMatchTurkish(a, b) {
  return String(a || "").localeCompare(String(b || ""), TURKISH_LOCALE, { sensitivity: "accent" }) === 0;
}

function normalizeCandidatePath(filePath) {
  return path.resolve(String(filePath || "").trim()).toLowerCase();
}

function isLikelyGooseDesktopPath(filePath) {
  const lower = normalizeCandidatePath(filePath);
  if (!lower.endsWith(".exe")) {
    return false;
  }
  return GOOSE_DESKTOP_PATH_MARKERS.some((marker) => lower.includes(marker));
}

function resolveDirectoryOnDisk(dirPath) {
  const target = String(dirPath || "").trim();
  if (!target) {
    return null;
  }

  if (fs.existsSync(target)) {
    try {
      return fs.realpathSync.native(target);
    } catch {
      return path.resolve(target);
    }
  }

  const parent = path.dirname(target);
  const leaf = path.basename(target);
  if (!leaf || parent === target) {
    return null;
  }

  const resolvedParent = resolveDirectoryOnDisk(parent);
  if (!resolvedParent) {
    return null;
  }

  try {
    for (const entry of fs.readdirSync(resolvedParent, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (namesMatchTurkish(entry.name, leaf)) {
        return path.join(resolvedParent, entry.name);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function resolveBinaryPathOnDisk(inputPath) {
  const trimmed = String(inputPath || "").trim();
  if (!trimmed) {
    return null;
  }

  const directCandidates = [trimmed, path.resolve(trimmed)];
  for (const candidate of directCandidates) {
    if (isExecutableFile(candidate)) {
      try {
        return fs.realpathSync.native(candidate);
      } catch {
        return path.resolve(candidate);
      }
    }
  }

  const resolvedDir = resolveDirectoryOnDisk(path.dirname(trimmed));
  const fileName = path.basename(trimmed);
  if (!resolvedDir || !fileName) {
    return null;
  }

  const joined = path.join(resolvedDir, fileName);
  if (isExecutableFile(joined)) {
    try {
      return fs.realpathSync.native(joined);
    } catch {
      return path.resolve(joined);
    }
  }

  try {
    for (const entry of fs.readdirSync(resolvedDir)) {
      if (!namesMatchTurkish(entry, fileName)) {
        continue;
      }
      const candidate = path.join(resolvedDir, entry);
      if (isExecutableFile(candidate)) {
        try {
          return fs.realpathSync.native(candidate);
        } catch {
          return path.resolve(candidate);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function parseGooseVersionOutput(stdout, stderr) {
  const text = `${stdout || ""}\n${stderr || ""}`.trim();
  if (!text) {
    return null;
  }
  if (/not recognized|operable program|cannot find|no such file/i.test(text)) {
    return null;
  }
  const match = text.match(VERSION_PATTERN);
  return match ? match[1] : null;
}

function quoteCmdPath(filePath) {
  return `"${String(filePath || "").replace(/"/g, '\\"')}"`;
}

async function runGooseVersion(binaryPath) {
  const resolved = String(binaryPath || "").trim();
  if (!resolved) {
    return null;
  }

  try {
    const { stdout, stderr } = await execFileAsync(resolved, ["--version"], {
      timeout: 12000,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    const version = parseGooseVersionOutput(stdout, stderr);
    if (version) {
      return version;
    }
  } catch (error) {
    const fromError = parseGooseVersionOutput(error?.stdout, error?.stderr);
    if (fromError) {
      return fromError;
    }
  }

  if (process.platform === "win32") {
    try {
      const command = `${quoteCmdPath(resolved)} --version`;
      const { stdout, stderr } = await execFileAsync("cmd.exe", ["/d", "/s", "/c", command], {
        timeout: 12000,
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      });
      return parseGooseVersionOutput(stdout, stderr);
    } catch (error) {
      return parseGooseVersionOutput(error?.stdout, error?.stderr);
    }
  }

  return null;
}

function scoreBinaryCandidate(filePath, settings = {}) {
  const lower = normalizeCandidatePath(filePath);
  const override = resolveBinaryPathOnDisk(settings.gooseBinaryPath);
  let score = 0;

  if (override && normalizeCandidatePath(filePath) === normalizeCandidatePath(override)) {
    score += 1000;
  }
  if (lower.includes("\\.local\\bin\\goose.exe")) score += 100;
  if (lower.includes("\\goose\\goose.exe") && !lower.includes("programs")) score += 80;
  if (lower.includes("goose-x86_64-pc-windows")) score += 60;
  if (isLikelyGooseDesktopPath(filePath)) score -= 200;
  if (lower.endsWith("\\goose.exe") && !lower.includes("programs")) score += 20;

  try {
    const sizeMb = fs.statSync(filePath).size / (1024 * 1024);
    if (sizeMb > 120) score -= 80;
    if (sizeMb < 80) score += 10;
  } catch {
    // ignore
  }

  return score;
}

function addCandidate(candidates, seen, filePath, settings = {}) {
  const resolved = resolveBinaryPathOnDisk(filePath) || String(filePath || "").trim();
  if (!resolved || !isExecutableFile(resolved)) {
    return;
  }
  const key = normalizeCandidatePath(resolved);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  candidates.push(resolved);
}

function walkForBinary(dir, depth = 0, maxDepth = 4, matches = []) {
  if (!dir || depth > maxDepth) {
    return matches;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return matches;
  }

  for (const name of GOOSE_BINARY_SEARCH_GLOBS) {
    const candidate = path.join(dir, name);
    if (isExecutableFile(candidate)) {
      matches.push(candidate);
    }
  }

  if (depth >= maxDepth) {
    return matches;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skip = new Set(["node_modules", ".git", "dist", "release", "out"]);
    if (skip.has(entry.name)) {
      continue;
    }
    walkForBinary(path.join(dir, entry.name), depth + 1, maxDepth, matches);
  }
  return matches;
}

function collectGooseBinaryCandidates(settings = {}) {
  const candidates = [];
  const seen = new Set();
  const skipAutoDiscovery = process.env.SAURON_SKIP_GOOSE_AUTODISCOVERY === "1";

  const override = String(settings.gooseBinaryPath || "").trim();
  if (override) {
    addCandidate(candidates, seen, override, settings);
  }

  if (!skipAutoDiscovery) {
    for (const resolver of GOOSE_CLI_PREFERRED_PATHS) {
      addCandidate(candidates, seen, resolver(), settings);
    }

    if (cachedCliBinaryPath) {
      addCandidate(candidates, seen, cachedCliBinaryPath, settings);
    }

    for (const root of getDefaultSearchRoots()) {
      for (const found of walkForBinary(root, 0, 3)) {
        addCandidate(candidates, seen, found, settings);
      }
    }
  }

  return candidates.sort((a, b) => scoreBinaryCandidate(b, settings) - scoreBinaryCandidate(a, settings));
}

async function resolveGooseFromPath() {
  if (process.platform !== "win32") {
    try {
      const { stdout } = await execFileAsync("which", ["goose"], { timeout: 4000, encoding: "utf8" });
      const resolved = String(stdout || "").trim().split("\n")[0];
      const onDisk = resolveBinaryPathOnDisk(resolved);
      return onDisk ? [onDisk] : [];
    } catch {
      return [];
    }
  }

  try {
    const { stdout } = await execFileAsync("where.exe", ["goose"], { timeout: 4000, encoding: "utf8" });
    return String(stdout || "")
      .split(/\r?\n/)
      .map((line) => resolveBinaryPathOnDisk(line.trim()) || line.trim())
      .filter((line) => isExecutableFile(line));
  } catch {
    return [];
  }
}

async function verifyGooseCliBinary(binaryPath) {
  const resolved = resolveBinaryPathOnDisk(binaryPath) || String(binaryPath || "").trim();
  if (!resolved || !isExecutableFile(resolved)) {
    return { cliCapable: false, kind: "missing", reason: "missing", binaryPath: resolved || binaryPath };
  }

  if (isLikelyGooseDesktopPath(resolved)) {
    return {
      cliCapable: false,
      kind: "desktop",
      reason: "desktop-path",
      binaryPath: resolved,
    };
  }

  const version = await runGooseVersion(resolved);
  if (version && VERSION_PATTERN.test(version)) {
    return {
      cliCapable: true,
      kind: "cli",
      reason: "version",
      binaryPath: resolved,
      version,
    };
  }

  const helpChecks = [
    ["run", "--help"],
    ["--help"],
  ];

  for (const args of helpChecks) {
    try {
      const { stdout, stderr } = await execFileAsync(resolved, args, {
        timeout: 12000,
        windowsHide: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      });
      const text = `${stdout || ""}\n${stderr || ""}`.toLowerCase();
      const hasRunSubcommand = /\brun\b/.test(text) && (
        text.includes("no-session")
        || text.includes("--provider")
        || text.includes("--text")
        || text.includes("-t")
      );
      if (hasRunSubcommand) {
        return { cliCapable: true, kind: "cli", reason: "run-help", binaryPath: resolved, version };
      }
      if (text.includes("configure") && text.includes("session")) {
        return { cliCapable: true, kind: "cli", reason: "cli-help", binaryPath: resolved, version };
      }
    } catch (error) {
      const output = `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`.toLowerCase();
      if (output.includes("unknown") && output.includes("run")) {
        return { cliCapable: false, kind: "desktop", reason: "no-run-subcommand", binaryPath: resolved };
      }
    }
  }

  return { cliCapable: false, kind: "unknown", reason: "not-cli", binaryPath: resolved, version };
}

async function probeGooseBinary(settings = {}) {
  const overrideRaw = String(settings.gooseBinaryPath || "").trim();
  if (overrideRaw) {
    const resolvedOverride = resolveBinaryPathOnDisk(overrideRaw);
    if (!resolvedOverride) {
      return {
        ok: false,
        cliCapable: false,
        kind: "missing-override",
        configuredPath: overrideRaw,
        binaryPath: null,
        error: `Goose dosyasi bulunamadi: ${overrideRaw}`,
        installHint: "Yolu kontrol edin (Turkce karakter: I/İ). Dosya gercekten var mi?",
      };
    }

    const verification = await verifyGooseCliBinary(resolvedOverride);
    if (verification.cliCapable) {
      cachedCliBinaryPath = resolvedOverride;
      const version = verification.version || await runGooseVersion(resolvedOverride);
      return {
        ok: true,
        cliCapable: true,
        kind: "cli",
        binaryPath: resolvedOverride,
        configuredPath: overrideRaw,
        resolvedPath: resolvedOverride,
        version,
        reason: verification.reason,
      };
    }

    return {
      ok: false,
      cliCapable: false,
      kind: verification.kind || "invalid-override",
      configuredPath: overrideRaw,
      binaryPath: resolvedOverride,
      version: verification.version || null,
      error: verification.kind === "desktop"
        ? "Bu yol Goose Desktop'a ait; terminal CLI gerekir."
        : `Goose bulundu ama CLI dogrulanamadi: ${resolvedOverride}`,
      installHint: verification.version
        ? `Surum okundu (${verification.version}) fakat run destegi dogrulanamadi.`
        : "Terminalde bu dosyayla `goose --version` calistirin.",
    };
  }

  const pathMatches = await resolveGooseFromPath();
  const candidates = collectGooseBinaryCandidates(settings);
  for (const match of pathMatches) {
    if (!candidates.some((entry) => normalizeCandidatePath(entry) === normalizeCandidatePath(match))) {
      candidates.push(match);
    }
  }
  candidates.sort((a, b) => scoreBinaryCandidate(b, settings) - scoreBinaryCandidate(a, settings));

  let desktopPath = null;
  for (const candidate of candidates) {
    const verification = await verifyGooseCliBinary(candidate);
    if (verification.cliCapable) {
      cachedCliBinaryPath = candidate;
      const version = verification.version || await runGooseVersion(candidate);
      return {
        ok: true,
        cliCapable: true,
        kind: "cli",
        binaryPath: candidate,
        version,
        reason: verification.reason,
      };
    }
    if (verification.kind === "desktop" && !desktopPath) {
      desktopPath = candidate;
    }
  }

  if (desktopPath) {
    return {
      ok: false,
      cliCapable: false,
      kind: "desktop",
      desktopPath,
      binaryPath: desktopPath,
      error: "Goose Desktop bulundu; Sauron icin Goose CLI (terminal) gerekir.",
      installHint: "PowerShell: iwr https://github.com/block/goose/releases/download/stable/download_cli.ps1 -OutFile download_cli.ps1; .\\download_cli.ps1",
    };
  }

  return {
    ok: false,
    cliCapable: false,
    kind: "missing",
    binaryPath: null,
    error: "Goose CLI bulunamadi.",
    installHint: "CLI kurun veya Ayarlar → Goose CLI yolunu girin.",
  };
}

function discoverGooseBinary(settings = {}) {
  const override = resolveBinaryPathOnDisk(settings.gooseBinaryPath);
  if (override && !isLikelyGooseDesktopPath(override)) {
    return override;
  }

  if (cachedCliBinaryPath && isExecutableFile(cachedCliBinaryPath)) {
    return cachedCliBinaryPath;
  }

  for (const candidate of collectGooseBinaryCandidates(settings)) {
    if (!isLikelyGooseDesktopPath(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function discoverGooseBinaryAsync(settings = {}) {
  const probe = await probeGooseBinary(settings);
  return probe.cliCapable ? probe.binaryPath : null;
}

async function getGooseVersion(binaryPath) {
  const resolved = resolveBinaryPathOnDisk(binaryPath) || String(binaryPath || "").trim();
  if (!resolved || !isExecutableFile(resolved)) {
    return null;
  }
  return runGooseVersion(resolved);
}

function clearGooseBinaryCache() {
  cachedCliBinaryPath = null;
}

module.exports = {
  discoverGooseBinary,
  discoverGooseBinaryAsync,
  probeGooseBinary,
  verifyGooseCliBinary,
  resolveBinaryPathOnDisk,
  resolveDirectoryOnDisk,
  isLikelyGooseDesktopPath,
  collectGooseBinaryCandidates,
  getGooseVersion,
  runGooseVersion,
  clearGooseBinaryCache,
  isExecutableFile,
  namesMatchTurkish,
};
