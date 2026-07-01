const { readFileTool } = require("./read-file");
const { writeFileTool, applyWrite } = require("./write-file");
const { searchReplaceTool, applySearchReplaceChange } = require("./search-replace");
const { listDirectoryTool } = require("./list-directory");
const { grepWorkspaceTool } = require("./grep-workspace");
const { runTerminalTool } = require("./run-terminal");
const { gitStatusTool, gitDiffTool } = require("./git-tools");
const {
  gitBranchTool,
  gitCreateBranchTool,
  gitCommitTool,
} = require("./git-branch");
const { runLintTool, runTypecheckTool } = require("./run-quality");

async function executeCodeTool(workspacePath, tool, args = {}, options = {}) {
  switch (tool) {
    case "read_file":
      return readFileTool(workspacePath, args);
    case "write_file":
      return writeFileTool(workspacePath, args);
    case "search_replace":
      return searchReplaceTool(workspacePath, args);
    case "list_directory":
      return listDirectoryTool(workspacePath, args);
    case "grep_workspace":
      return grepWorkspaceTool(workspacePath, args);
    case "run_terminal":
      return runTerminalTool(workspacePath, args, options);
    case "git_status":
      return gitStatusTool(workspacePath);
    case "git_diff":
      return gitDiffTool(workspacePath, args);
    case "git_branch":
      return gitBranchTool(workspacePath);
    case "git_create_branch":
      return gitCreateBranchTool(workspacePath, args);
    case "git_commit":
      return gitCommitTool(workspacePath, args);
    case "run_lint":
      return runLintTool(workspacePath);
    case "run_typecheck":
      return runTypecheckTool(workspacePath);
    default:
      return { ok: false, error: `Unknown tool: ${tool}` };
  }
}

function applyPendingChange(workspacePath, change) {
  if (!change?.path) {
    return { ok: false, error: "Invalid change." };
  }
  if (change.tool === "write_file") {
    return applyWrite(workspacePath, change);
  }
  if (change.tool === "search_replace") {
    return applySearchReplaceChange(workspacePath, change);
  }
  return { ok: false, error: "Change is not applicable." };
}

module.exports = {
  executeCodeTool,
  applyPendingChange,
};
