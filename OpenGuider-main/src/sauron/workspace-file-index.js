const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "release", "Library", "Temp", "Binaries",
  "Intermediate", "Saved", ".sauron", ".goose",
]);

const CODE_EXTENSIONS = new Set([".js", ".ts", ".tsx", ".jsx", ".cs", ".cpp", ".h", ".py", ".md", ".json"]);

function tokenize(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

function walkFiles(root, results = [], depth = 0, maxDepth = 5) {
  if (!root || depth > maxDepth || results.length >= 400) {
    return results;
  }
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (results.length >= 400) break;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        walkFiles(full, results, depth + 1, maxDepth);
      }
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!CODE_EXTENSIONS.has(ext)) continue;
    try {
      const stat = fs.statSync(full);
      if (stat.size > 300_000) continue;
      results.push(full);
    } catch {
      // skip
    }
  }
  return results;
}

function extractSymbols(content) {
  const symbols = [];
  const lines = String(content || "").split(/\r?\n/);
  for (let i = 0; i < lines.length && symbols.length < 12; i += 1) {
    const line = lines[i].trim();
    const match = line.match(/(?:function|class|interface|type|enum)\s+(\w+)/)
      || line.match(/(?:public|private|protected|internal)\s+(?:static\s+)?[\w<>\[\]?]+\s+(\w+)\s*\(/);
    if (match?.[1]) {
      symbols.push(match[1]);
    }
  }
  return symbols;
}

function buildWorkspaceFileIndex(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !fs.existsSync(resolved)) {
    return { files: [], queryTokens: [] };
  }

  const paths = walkFiles(resolved);
  const files = [];
  for (const fullPath of paths) {
    const rel = path.relative(resolved, fullPath).replace(/\\/g, "/");
    let content = "";
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    files.push({
      path: rel,
      symbols: extractSymbols(content),
      basename: path.basename(rel),
    });
  }

  return { files, builtAt: new Date().toISOString(), fileCount: files.length };
}

function scoreRelevantFiles(index, queryText, limit = 8) {
  const queryTokens = tokenize(queryText);
  if (!queryTokens.length || !index?.files?.length) {
    return [];
  }

  const scored = index.files.map((entry) => {
    const haystack = `${entry.path} ${entry.basename} ${(entry.symbols || []).join(" ")}`.toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      if (entry.basename.toLowerCase().includes(token)) score += 4;
      if (entry.path.toLowerCase().includes(token)) score += 2;
      if (haystack.includes(token)) score += 1;
    }
    return { ...entry, score };
  }).filter((entry) => entry.score > 0);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.path);
}

module.exports = {
  buildWorkspaceFileIndex,
  scoreRelevantFiles,
};
