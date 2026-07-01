const fs = require("fs");
const path = require("path");

function extractSymbolsFromContent(content, filePath) {
  const symbols = [];
  const ext = path.extname(filePath).toLowerCase();
  const lines = String(content || "").split("\n");
  const patterns = ext === ".py"
    ? [/^\s*(?:async\s+)?def\s+(\w+)/, /^\s*class\s+(\w+)/]
    : [/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/, /^\s*(?:export\s+)?class\s+(\w+)/, /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/];

  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        symbols.push({ name: match[1], line: index + 1, file: filePath });
        break;
      }
    }
  });
  return symbols;
}

function buildSymbolIndex(workspacePath, files = [], maxFiles = 80) {
  const resolved = String(workspacePath || "").trim();
  const index = [];
  const slice = files.slice(0, maxFiles);
  for (const rel of slice) {
    try {
      const full = path.join(resolved, rel);
      if (!fs.existsSync(full) || fs.statSync(full).size > 120000) continue;
      const content = fs.readFileSync(full, "utf8");
      index.push(...extractSymbolsFromContent(content, rel));
    } catch {
      // skip unreadable
    }
  }
  return index;
}

function formatSymbolContext(symbols = [], goal = "") {
  if (!symbols.length) return "";
  const tokens = String(goal || "").toLowerCase().split(/\W+/).filter(Boolean);
  const ranked = symbols
    .map((symbol) => {
      const score = tokens.some((token) => symbol.name.toLowerCase().includes(token)) ? 2 : 0;
      return { ...symbol, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
  return ranked.map((entry) => `${entry.file}:${entry.line} ${entry.name}`).join("\n");
}

function mergeRepoMapContext(repoMapText, symbolText) {
  const parts = [];
  if (repoMapText) parts.push(`Repo map:\n${repoMapText}`);
  if (symbolText) parts.push(`Symbols:\n${symbolText}`);
  return parts.join("\n\n");
}

module.exports = {
  buildSymbolIndex,
  formatSymbolContext,
  mergeRepoMapContext,
  extractSymbolsFromContent,
};
