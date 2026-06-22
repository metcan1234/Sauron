const fs = require("fs");
const { resolveSafePath } = require("../workspace-sandbox");
const { applySearchReplace, buildUnifiedDiff } = require("../patch-engine");

function searchReplaceTool(workspacePath, args = {}) {
  const filePath = resolveSafePath(workspacePath, args.path);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found: ${args.path}` };
  }
  const before = fs.readFileSync(filePath, "utf8");
  let after;
  try {
    after = applySearchReplace(before, args.search, args.replace);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  const diff = buildUnifiedDiff(args.path, before, after);
  return {
    ok: true,
    path: args.path,
    before,
    after,
    diff,
    needsApproval: true,
  };
}

function applySearchReplaceChange(workspacePath, change) {
  const filePath = resolveSafePath(workspacePath, change.path);
  fs.writeFileSync(filePath, change.after, "utf8");
  return { ok: true, path: change.path };
}

module.exports = { searchReplaceTool, applySearchReplaceChange };
