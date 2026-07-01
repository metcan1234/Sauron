const { execFile } = require("child_process");
const { promisify } = require("util");
const { resolveSafePath } = require("../workspace-sandbox");
const { gitStatusTool, gitDiffTool } = require("./git-tools");

const execFileAsync = promisify(execFile);

async function gitBranchTool(workspacePath) {
  resolveSafePath(workspacePath);
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: workspacePath });
    return { ok: true, branch: String(stdout || "").trim() };
  } catch (error) {
    return { ok: false, error: error.message || "git branch failed" };
  }
}

async function gitCreateBranchTool(workspacePath, args = {}) {
  resolveSafePath(workspacePath);
  const branch = String(args.branch || "").trim();
  if (!branch) {
    return { ok: false, error: "branch name required" };
  }
  try {
    await execFileAsync("git", ["checkout", "-b", branch], { cwd: workspacePath });
    return { ok: true, branch };
  } catch (error) {
    return { ok: false, error: error.message || "git checkout -b failed" };
  }
}

async function gitCommitTool(workspacePath, args = {}) {
  resolveSafePath(workspacePath);
  const message = String(args.message || "").trim();
  if (!message) {
    return { ok: false, error: "commit message required" };
  }
  try {
    await execFileAsync("git", ["add", "-A"], { cwd: workspacePath });
    const { stdout } = await execFileAsync("git", ["commit", "-m", message], { cwd: workspacePath });
    return { ok: true, output: String(stdout || "").trim() };
  } catch (error) {
    return { ok: false, error: error.message || "git commit failed" };
  }
}

async function getWorkspaceGitSummary(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }
  try {
    resolveSafePath(resolved);
  } catch (error) {
    return { ok: false, error: error.message || "Invalid workspace." };
  }
  const [branchResult, statusResult] = await Promise.all([
    gitBranchTool(resolved),
    gitStatusTool(resolved),
  ]);
  if (!branchResult.ok && !statusResult.ok) {
    return { ok: false, error: branchResult.error || statusResult.error || "Not a git repo." };
  }
  const lines = String(statusResult.output || "").split("\n").filter(Boolean);
  return {
    ok: true,
    branch: branchResult.branch || "unknown",
    changedCount: lines.length,
    statusPreview: lines.slice(0, 8).join("\n"),
    isClean: lines.length === 0,
  };
}

module.exports = {
  gitBranchTool,
  gitCreateBranchTool,
  gitCommitTool,
  getWorkspaceGitSummary,
  gitStatusTool,
  gitDiffTool,
};
