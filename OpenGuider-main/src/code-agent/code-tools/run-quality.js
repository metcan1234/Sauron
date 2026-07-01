const { runScript } = require("../repair-loop");

async function runLintTool(workspacePath) {
  return runScript(workspacePath, "lint");
}

async function runTypecheckTool(workspacePath) {
  const typecheck = await runScript(workspacePath, "typecheck");
  if (!typecheck.skipped) {
    return typecheck;
  }
  return runScript(workspacePath, "check");
}

module.exports = { runLintTool, runTypecheckTool };
