const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { listFilesRecursive, resolveSafePath } = require("./workspace-sandbox");

const INDEX_FILE = "code-index.json";
const TEXT_EXTENSIONS = new Set([
  ".js", ".ts", ".tsx", ".jsx", ".json", ".md", ".css", ".html", ".mjs", ".cjs", ".py", ".yml", ".yaml",
]);

function getIndexPath(workspacePath) {
  return path.join(workspacePath, ".sauron", INDEX_FILE);
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function chunkFileContent(content, maxChunk = 800) {
  const lines = String(content).split("\n");
  const chunks = [];
  let buf = [];
  let len = 0;
  for (const line of lines) {
    buf.push(line);
    len += line.length + 1;
    if (len >= maxChunk) {
      chunks.push(buf.join("\n"));
      buf = [];
      len = 0;
    }
  }
  if (buf.length) {
    chunks.push(buf.join("\n"));
  }
  return chunks.slice(0, 20);
}

async function buildCodeIndex(workspacePath, options = {}) {
  const root = resolveSafePath(workspacePath);
  const files = listFilesRecursive(root, { maxDepth: 6, maxFiles: 400 })
    .filter((f) => TEXT_EXTENSIONS.has(path.extname(f).toLowerCase()));

  const entries = [];
  for (const rel of files) {
    const full = resolveSafePath(root, rel);
    try {
      const stat = fs.statSync(full);
      const content = fs.readFileSync(full, "utf8");
      const chunks = chunkFileContent(content);
      for (let i = 0; i < chunks.length; i++) {
        entries.push({
          path: rel,
          chunkIndex: i,
          mtimeMs: stat.mtimeMs,
          hash: hashContent(chunks[i]),
          text: chunks[i].slice(0, 600),
        });
      }
    } catch {
      // skip unreadable
    }
  }

  const index = {
    version: 1,
    builtAt: new Date().toISOString(),
    fileCount: files.length,
    entryCount: entries.length,
    entries,
  };

  const indexPath = getIndexPath(root);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index), "utf8");
  return { ok: true, indexPath, fileCount: files.length, entryCount: entries.length };
}

function readCodeIndex(workspacePath) {
  const indexPath = getIndexPath(workspacePath);
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch {
    return null;
  }
}

function getIndexStatus(workspacePath) {
  const index = readCodeIndex(workspacePath);
  if (!index) {
    return { ok: true, built: false, stale: true };
  }
  const ageMs = Date.now() - new Date(index.builtAt).getTime();
  return {
    ok: true,
    built: true,
    builtAt: index.builtAt,
    fileCount: index.fileCount,
    entryCount: index.entryCount,
    stale: ageMs > 24 * 60 * 60 * 1000,
  };
}

module.exports = {
  buildCodeIndex,
  readCodeIndex,
  getIndexStatus,
};
