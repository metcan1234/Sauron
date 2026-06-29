const { launchVSCode, focusVSCodeWorkspace } = require("./handoff");
const { prepareChannelVSCode, revealWelcomeFile } = require("./channel-vscode-marker");

const SAURON_CHANNEL_VSCODE_OPTIONS = {
  newWindow: false,
  respectRequestedNewWindow: true,
  skipInterProfileRecovery: true,
  skipRecovery: true,
  launchProfiles: [{ profile: "default", extraArgs: [] }],
  requireWindowVerification: false,
  verifyTimeoutMs: 6000,
};

let channelLaunchInFlight = null;

async function performFocusOrLaunchChannelVSCode(workspacePath, channel, meta = {}, extraOptions = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is required." };
  }

  const allowLaunch = extraOptions.allowLaunch !== false;
  const revealWelcome = extraOptions.revealWelcome === true;

  const channelPrep = prepareChannelVSCode(resolved, channel, meta);
  const launchOptions = {
    ...SAURON_CHANNEL_VSCODE_OPTIONS,
    ...extraOptions,
    additionalPaths: [],
    gotoPath: revealWelcome ? channelPrep.welcomePath : (extraOptions.gotoPath || null),
    useCliShim: true,
  };

  const focused = await focusVSCodeWorkspace(resolved, {
    allowLaunch: false,
    verifyTimeoutMs: 5000,
    skipPostVerifySettle: true,
    respectRequestedNewWindow: true,
  });

  if (focused?.verified) {
    if (revealWelcome) {
      await revealWelcomeFile(resolved, channel, meta, channelPrep);
    }
    return {
      ok: true,
      launchResult: focused,
      action: focused.action || "focus_existing",
      channelMarker: channelPrep.marker,
    };
  }

  if (!allowLaunch) {
    return {
      ok: false,
      skipped: true,
      action: "focus_only",
      channelMarker: channelPrep.marker,
      error: "VS Code açık değil. ⌘ Çalışma Kısmı butonuna basarak açabilirsiniz.",
      launchResult: focused,
    };
  }

  const launchResult = await launchVSCode(resolved, {
    ...launchOptions,
    force: extraOptions.force === true,
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

async function focusOrLaunchChannelVSCode(workspacePath, channel, meta = {}, extraOptions = {}) {
  if (channelLaunchInFlight) {
    return channelLaunchInFlight;
  }
  channelLaunchInFlight = performFocusOrLaunchChannelVSCode(workspacePath, channel, meta, extraOptions)
    .finally(() => {
      channelLaunchInFlight = null;
    });
  return channelLaunchInFlight;
}

module.exports = {
  SAURON_CHANNEL_VSCODE_OPTIONS,
  focusOrLaunchChannelVSCode,
};
