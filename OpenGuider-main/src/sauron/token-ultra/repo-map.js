const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "release",
  "out",
  "Library",
  "Temp",
  "Binaries",
  "Intermediate",
  "Saved",
  ".sauron",
  ".goose",
]);

const CODE_EXTENSIONS = new Set([".js", ".ts", ".tsx", ".jsx", ".cs", ".cpp", ".h", ".py", ".json", ".md"]);

const SIGNATURE_PATTERNS = [
  /^(export\s+)?(async\s+)?function\s+(\w+)/,
  /^(export\s+)?class\s+(\w+)/,
  /^(export\s+)?interface\s+(\w+)/,
  /^(export\s+)?type\s+(\w+)/,
  /^(export\s+)?enum\s+(\w+)/,
  /^(\s*)(public|private|protected|internal)\s+(static\s+)?[\w<>\[\]?]+\s+(\w+)\s*\(/,
  /^(\s*)(void|bool|int|float|double|FString|AActor|UObject|UFUNCTION|UPROPERTY)\s+(\w+)/,
  /^(\s*)(namespace)\s+(\w+)/,
];

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name) || name.startsWith(".");
}

function extractSignatures(content, filePath) {
  const lines = String(content || "").split(/\r?\n/);
  const symbols = [];
  for (let i = 0; i < lines.length && symbols.length < 8; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith("//") || line.startsWith("*")) {
      continue;
    }
    for (const pattern of SIGNATURE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const name = match[3] || match[4] || match[5];
        if (name) {
          symbols.push(`${path.basename(filePath)}:${i + 1} ${name}`);
        }
        break;
      }
    }
  }
  return symbols;
}

function walkRepo(root, options = {}, results = [], depth = 0) {
  const maxDepth = Number(options.maxDepth) || 4;
  const maxFiles = Number(options.maxFiles) || 120;
  if (!root || depth > maxDepth || results.length >= maxFiles) {
    return results;
  }

  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= maxFiles) {
      break;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        walkRepo(fullPath, options, results, depth + 1);
      }
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!CODE_EXTENSIONS.has(ext)) {
      continue;
    }
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > 250_000) {
        continue;
      }
      const content = fs.readFileSync(fullPath, "utf8");
      const relative = path.relative(root, fullPath).replace(/\\/g, "/");
      const symbols = extractSignatures(content, relative);
      results.push({ file: relative, symbols });
    } catch {
      // skip unreadable files
    }
  }
  return results;
}

function buildRepoMap(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !fs.existsSync(resolved)) {
    return { lines: [], text: "", fileCount: 0 };
  }

  const files = walkRepo(resolved, options);
  const lines = [];
  for (const entry of files) {
    if (!entry.symbols.length) {
      lines.push(entry.file);
      continue;
    }
    lines.push(`${entry.file}: ${entry.symbols.slice(0, 4).join(", ")}`);
  }

  const maxChars = Number(options.maxChars) || 2500;
  let text = ["Repo map (signatures only):", ...lines].join("\n");
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars - 1)}…`;
  }
  return { lines, text, fileCount: files.length };
}

function writeRepoMapCache(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return null;
  }
  const map = buildRepoMap(resolved, options);
  const cacheDir = path.join(resolved, ".sauron", "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, "repo-map.json");
  fs.writeFileSync(cachePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    fileCount: map.fileCount,
    text: map.text,
  }, null, 2), "utf8");
  return {
    pointer: ".sauron/cache/repo-map.json",
    text: map.text,
    fileCount: map.fileCount,
  };
}

module.exports = {
  buildRepoMap,
  writeRepoMapCache,
};
