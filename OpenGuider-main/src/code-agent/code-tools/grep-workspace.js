const fs = require("fs");
const path = require("path");
const { listFilesRecursive, resolveSafePath } = require("../workspace-sandbox");

function grepWorkspaceTool(workspacePath, args = {}) {
  const pattern = String(args.pattern || "").trim();
  if (!pattern) {
    return { ok: false, error: "pattern is required." };
  }
  let regex;
  try {
    regex = new RegExp(pattern, args.caseSensitive ? "" : "i");
  } catch (error) {
    return { ok: false, error: `Invalid regex: ${error.message}` };
  }

  const scope = args.path ? [resolveSafePath(workspacePath, args.path)] : null;
  const files = scope
    ? (fs.statSync(scope[0]).isFile() ? [path.relative(workspacePath, scope[0])] : listFilesRecursive(workspacePath, { maxDepth: 4 }))
    : listFilesRecursive(workspacePath, { maxDepth: 5, maxFiles: 300 });

  const matches = [];
  for (const rel of files) {
    if (matches.length >= 40) {
      break;
    }
    const full = resolveSafePath(workspacePath, rel);
    let content;
    try {
      content = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matches.push({ path: rel, line: i + 1, text: lines[i].trim().slice(0, 200) });
        if (matches.length >= 40) {
          break;
        }
      }
    }
  }
  return { ok: true, pattern, matchCount: matches.length, matches };
}

module.exports = { grepWorkspaceTool };
