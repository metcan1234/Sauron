const fs = require("fs");
const path = require("path");
const { resolveSafePath } = require("../workspace-sandbox");
const { buildUnifiedDiff } = require("../patch-engine");

function writeFileTool(workspacePath, args = {}) {
  const filePath = resolveSafePath(workspacePath, args.path);
  const content = String(args.content ?? "");
  const existed = fs.existsSync(filePath);
  const before = existed ? fs.readFileSync(filePath, "utf8") : "";
  const diff = buildUnifiedDiff(args.path, before, content);
  return {
    ok: true,
    path: args.path,
    before,
    after: content,
    diff,
    isNew: !existed,
    needsApproval: true,
  };
}

function applyWrite(workspacePath, change) {
  const filePath = resolveSafePath(workspacePath, change.path);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, change.after, "utf8");
  return { ok: true, path: change.path };
}

module.exports = { writeFileTool, applyWrite };
