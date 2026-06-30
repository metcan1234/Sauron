const { launchVSCode, focusVSCodeWorkspace } = require("./handoff");

const RELIABLE_VSCODE_LAUNCH_OPTIONS = {
  newWindow: false,
  respectRequestedNewWindow: true,
  skipInterProfileRecovery: true,
  skipRecovery: true,
  launchProfiles: [{ profile: "default", extraArgs: [] }],
  requireWindowVerification: false,
  skipVerification: true,
};

const GAMEDEV_VSCODE_LAUNCH_OPTIONS = {
  ...RELIABLE_VSCODE_LAUNCH_OPTIONS,
  requireWindowVerification: false,
  skipVerification: true,
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
    : await launchVSCode(resolved, GAMEDEV_VSCODE_LAUNCH_OPTIONS);

  return {
    ok: true,
    launchResult,
    action: focused?.verified ? "focus_existing" : (launchResult?.skipped ? "launch_skipped" : "launch"),
  };
}

module.exports = {
  focusOrLaunchWorkspaceVSCode,
  GAMEDEV_VSCODE_LAUNCH_OPTIONS,
  RELIABLE_VSCODE_LAUNCH_OPTIONS,
};
