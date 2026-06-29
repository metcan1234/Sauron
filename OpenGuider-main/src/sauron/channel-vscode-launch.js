const { launchVSCode, focusVSCodeWorkspace } = require("./handoff");
const { prepareChannelVSCode, revealWelcomeFile } = require("./channel-vscode-marker");

const SAURON_CHANNEL_VSCODE_OPTIONS = {
  newWindow: false,
  respectRequestedNewWindow: true,
  skipInterProfileRecovery: true,
  skipRecovery: true,
  launchProfiles: [{ profile: "default", extraArgs: [] }],
  requireWindowVerification: true,
  verifyTimeoutMs: 20000,
};

async function focusOrLaunchChannelVSCode(workspacePath, channel, meta = {}, extraOptions = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is required." };
  }

  const channelPrep = prepareChannelVSCode(resolved, channel, meta);
  const launchOptions = {
    ...SAURON_CHANNEL_VSCODE_OPTIONS,
    ...extraOptions,
    additionalPaths: channelPrep.additionalPaths,
  };

  const focused = await focusVSCodeWorkspace(resolved, {
    allowLaunch: false,
    verifyTimeoutMs: 5000,
    skipPostVerifySettle: true,
    respectRequestedNewWindow: true,
  });

  if (focused?.verified) {
    revealWelcomeFile(resolved, channel, meta);
    return {
      ok: true,
      launchResult: focused,
      action: focused.action || "focus_existing",
      channelMarker: channelPrep.marker,
    };
  }

  const launchResult = await launchVSCode(resolved, {
    ...launchOptions,
    force: extraOptions.force !== false,
  });

  return {
    ok: Boolean(launchResult?.verified || launchResult?.skipped),
    launchResult,
    action: launchResult?.action || "launch",
    channelMarker: channelPrep.marker,
    error: launchResult?.verified || launchResult?.skipped
      ? undefined
      : "VS Code başlatılamadı.",
  };
}

module.exports = {
  SAURON_CHANNEL_VSCODE_OPTIONS,
  focusOrLaunchChannelVSCode,
};
