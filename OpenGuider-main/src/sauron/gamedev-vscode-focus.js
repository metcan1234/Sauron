const { focusOrLaunchChannelVSCode } = require("./channel-vscode-launch");

const GAMEDEV_VSCODE_LAUNCH_OPTIONS = {
  newWindow: false,
  respectRequestedNewWindow: true,
  skipInterProfileRecovery: true,
  skipRecovery: true,
  launchProfiles: [{ profile: "default", extraArgs: [] }],
  requireWindowVerification: true,
  verifyTimeoutMs: 20000,
};

async function focusOrLaunchWorkspaceVSCode(workspacePath, options = {}) {
  const channelMeta = {
    engine: options.engine || null,
    engineLabel: options.engineLabel || options.engine || "Unity",
  };

  return focusOrLaunchChannelVSCode(workspacePath, "gamedev", channelMeta, {
    ...GAMEDEV_VSCODE_LAUNCH_OPTIONS,
    ...options,
    allowLaunch: options.allowLaunch !== false,
    revealWelcome: options.revealWelcome === true,
  });
}

module.exports = {
  focusOrLaunchWorkspaceVSCode,
  GAMEDEV_VSCODE_LAUNCH_OPTIONS,
};
