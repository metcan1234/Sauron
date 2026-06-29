const { launchVSCode, focusVSCodeWorkspace } = require("./handoff");

const RELIABLE_VSCODE_LAUNCH_OPTIONS = {
  newWindow: false,
  force: true,
  skipRecovery: true,
  skipVerification: true,
  bypassDebounce: true,
};

async function focusOrLaunchWorkspaceVSCode(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is required." };
  }

  const focused = await focusVSCodeWorkspace(resolved, {
    allowLaunch: false,
    verifyTimeoutMs: 4000,
    skipPostVerifySettle: true,
  });

  const launchResult = focused?.verified
    ? focused
    : await launchVSCode(resolved, RELIABLE_VSCODE_LAUNCH_OPTIONS);

  return {
    ok: true,
    launchResult,
    action: focused?.verified ? "focus_existing" : (launchResult?.skipped ? "launch_skipped" : "launch"),
  };
}

module.exports = {
  focusOrLaunchWorkspaceVSCode,
};
