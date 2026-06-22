const fs = require("fs");
const { resolveSafePath, shouldIgnoreEntry } = require("../workspace-sandbox");

function listDirectoryTool(workspacePath, args = {}) {
  const dirPath = resolveSafePath(workspacePath, args.path || ".");
  if (!fs.existsSync(dirPath)) {
    return { ok: false, error: "Directory not found." };
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const items = entries
    .filter((e) => !shouldIgnoreEntry(e.name, e.isDirectory()))
    .map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "dir" : "file",
    }))
    .slice(0, 200);
  return { ok: true, path: args.path || ".", entries: items };
}

module.exports = { listDirectoryTool };
