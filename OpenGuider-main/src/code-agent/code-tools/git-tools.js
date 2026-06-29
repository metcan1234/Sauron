const { execFile } = require("child_process");
const { promisify } = require("util");
const { resolveSafePath } = require("../workspace-sandbox");

const execFileAsync = promisify(execFile);

async function gitStatusTool(workspacePath) {
  resolveSafePath(workspacePath);
  try {
    const { stdout } = await execFileAsync("git", ["status", "--short"], { cwd: workspacePath });
    return { ok: true, output: String(stdout || "").trim() };
  } catch (error) {
    return { ok: false, error: error.message || "git status failed" };
  }
}

async function gitDiffTool(workspacePath, args = {}) {
  resolveSafePath(workspacePath);
  const fileArg = args.path ? ["--", args.path] : [];
  try {
    const { stdout } = await execFileAsync("git", ["diff", ...fileArg], { cwd: workspacePath, maxBuffer: 2 * 1024 * 1024 });
    return { ok: true, output: String(stdout || "").trim() };
  } catch (error) {
    return { ok: false, error: error.message || "git diff failed" };
  }
}

module.exports = { gitStatusTool, gitDiffTool };
