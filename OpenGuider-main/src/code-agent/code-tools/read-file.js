const fs = require("fs");
const { resolveSafePath } = require("../workspace-sandbox");

function readFileTool(workspacePath, args = {}) {
  const filePath = resolveSafePath(workspacePath, args.path);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found: ${args.path}` };
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return { ok: false, error: "Not a file." };
  }
  const content = fs.readFileSync(filePath, "utf8");
  const offset = Number(args.offset) || 0;
  const limit = Number(args.limit) || 0;
  let slice = content;
  if (limit > 0) {
    const lines = content.split("\n");
    slice = lines.slice(offset, offset + limit).join("\n");
  } else if (content.length > 12000) {
    slice = content.slice(0, 12000) + "\n…[truncated]";
  }
  return { ok: true, path: args.path, content: slice, totalChars: content.length };
}

module.exports = { readFileTool };
