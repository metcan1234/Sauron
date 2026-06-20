const fs = require("fs");
const path = require("path");
const { spawn, execFileSync, execFile } = require("child_process");
const vscodeWindowFocus = require("./vscode-window-focus");

const LAUNCH_DEBOUNCE_MS = 3000;
const POST_VERIFY_GRACE_MS = vscodeWindowFocus.POST_VERIFY_GRACE_MS || 30000;

const LAUNCH_PROFILES = [
  { profile: "default", extraArgs: [] },
  { profile: "disable-gpu", extraArgs: ["--disable-gpu"] },
  { profile: "safe-mode", extraArgs: ["--disable-gpu", "--disable-extensions"] },
];
const recentLaunches = new Map();
let launchInProgress = null;
let lastVerifiedLaunchAt = 0;
let lastVerifiedHwnd = 0;
let lastHandoffVerifiedAt = 0;

function isWithinPostVerifyGrace() {
  return lastVerifiedLaunchAt > 0 && (Date.now() - lastVerifiedLaunchAt) < POST_VERIFY_GRACE_MS;
}

function recordVerifiedLaunch(verifyResult) {
  if (verifyResult?.verified) {
    lastVerifiedLaunchAt = Date.now();
    lastVerifiedHwnd = verifyResult.hwnd || 0;
  }
}

function markHandoffLaunchVerified() {
  lastHandoffVerifiedAt = Date.now();
}

function isRecentHandoffVerified() {
  return lastHandoffVerifiedAt > 0 && (Date.now() - lastHandoffVerifiedAt) < POST_VERIFY_GRACE_MS;
}

function isVSCodeCliWrapper(candidatePath) {
  if (!candidatePath) {
    return false;
  }
  const lower = String(candidatePath).toLowerCase();
  if (lower.endsWith("code.exe")) {
    return false;
  }
  if (lower.endsWith("code.cmd") || lower.endsWith(`${path.sep}code`)) {
    return true;
  }
  return lower.includes(`${path.sep}bin${path.sep}`);
}

function resolveVSCodeCommand() {
  if (process.platform === "win32") {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "bin", "code.cmd"),
      path.join(process.env.ProgramFiles || "", "Microsoft VS Code", "bin", "code.cmd"),
      path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft VS Code", "bin", "code.cmd"),
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
    try {
      const result = execFileSync("where", ["code"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
      const matches = result.trim().split(/\r?\n/).filter(Boolean);
      const cliMatch = matches.find(isVSCodeCliWrapper);
      if (cliMatch && fs.existsSync(cliMatch)) {
        return cliMatch;
      }
    } catch {
      // where failed
    }
    return null;
  }
  return "code";
}

function resolveVSCodeAppExe() {
  const codeCmd = resolveVSCodeCommand();
  if (codeCmd) {
    const appExe = path.join(path.dirname(path.dirname(codeCmd)), "Code.exe");
    if (fs.existsSync(appExe)) {
      return appExe;
    }
  }

  const exeCandidates = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "Code.exe"),
    path.join(process.env.ProgramFiles || "", "Microsoft VS Code", "Code.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft VS Code", "Code.exe"),
  ];
  for (const candidate of exeCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveVSCodeLaunchExecutable() {
  if (process.platform === "win32") {
    const appExe = resolveVSCodeAppExe();
    if (appExe) {
      return { kind: "exe", path: appExe };
    }
    const codeCmd = resolveVSCodeCommand();
    if (codeCmd) {
      return { kind: "cmd", path: codeCmd };
    }
    return null;
  }

  const codeCmd = resolveVSCodeCommand();
  return codeCmd ? { kind: "cmd", path: codeCmd } : null;
}

function buildLaunchArgs(workspacePath, { newWindow = true, executableKind = "cmd", extraArgs = [] } = {}) {
  const normalized = path.resolve(workspacePath);
  const flags = [];
  if (executableKind === "exe") {
    flags.push(newWindow ? "--new-window" : "--reuse-window");
  } else if (newWindow) {
    flags.push("-n");
  } else {
    flags.push("-r");
  }
  return [...extraArgs, ...flags, normalized];
}

function resolveLaunchProfiles(options = {}) {
  if (options.launchProfile) {
    const match = LAUNCH_PROFILES.filter((entry) => entry.profile === options.launchProfile);
    return match.length > 0 ? match : LAUNCH_PROFILES;
  }
  if (options.launchProfiles) {
    return options.launchProfiles;
  }
  return LAUNCH_PROFILES;
}

function getLaunchMethod(executableKind) {
  if (executableKind === "exe") {
    return "code.exe-gui";
  }
  return "code.cmd";
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

function buildPowerShellStartProcessCommand(filePath, args) {
  const argList = args.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`).join(", ");
  return `Start-Process -FilePath '${escapePowerShellSingleQuoted(filePath)}' -ArgumentList ${argList} -WindowStyle Normal -PassThru`;
}

function spawnDetachedProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: options.windowsHide !== false,
      ...options,
    });
    child.on("error", reject);
    child.unref();
    resolve(child);
  });
}

function spawnViaPowerShellStartProcess(filePath, args) {
  const psCommand = buildPowerShellStartProcessCommand(filePath, args);
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-Command",
        psCommand,
      ],
      { windowsHide: true, timeout: 30000 },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}

function spawnVSCodeGuiProcess(command, args, options = {}) {
  return spawnDetachedProcess(command, args, {
    windowsHide: false,
    ...options,
  });
}

async function resolveEffectiveNewWindow(requestedNewWindow) {
  if (process.platform !== "win32") {
    return requestedNewWindow;
  }
  const state = await vscodeWindowFocus.getVSCodeProcessState();
  if (!state.running || !state.hasWindow) {
    return true;
  }
  return requestedNewWindow;
}

async function spawnVSCodeProcess(executable, args) {
  if (!executable) {
    throw new Error("VS Code executable not found.");
  }

  if (process.platform === "win32") {
    return spawnViaPowerShellStartProcess(executable.path, args);
  }

  if (executable.kind === "exe") {
    return spawnVSCodeGuiProcess(executable.path, args);
  }

  return spawnVSCodeGuiProcess(executable.path, args);
}

function getDebounceKey(workspacePath) {
  return path.resolve(workspacePath);
}

function shouldSkipDuplicateLaunch(key) {
  const last = recentLaunches.get(key);
  if (!last) {
    return false;
  }
  return Date.now() - last.at < LAUNCH_DEBOUNCE_MS;
}

function resolveVSCodeExecutable() {
  return resolveVSCodeLaunchExecutable();
}

function buildLaunchResult(base, verifyResult, launchMeta = {}) {
  return {
    skipped: false,
    ...launchMeta,
    verified: Boolean(verifyResult.verified),
    verificationReason: verifyResult.verificationReason || "unknown",
    pid: verifyResult.pid || null,
    hwnd: verifyResult.hwnd || 0,
    focused: Boolean(verifyResult.focused),
    focusReason: verifyResult.focusReason || null,
  };
}

async function focusExistingVSCodeWindow(workspacePath, options = {}) {
  const executable = resolveVSCodeExecutable();
  const launchMethod = executable ? getLaunchMethod(executable.kind) : null;
  const verifyTimeoutMs = options.verifyTimeoutMs || vscodeWindowFocus.DEFAULT_TIMEOUT_MS;

  let state = await vscodeWindowFocus.getVSCodeProcessState();

  if (!state.hasWindow && isWithinPostVerifyGrace() && lastVerifiedHwnd) {
    const focusResult = await vscodeWindowFocus.bringVSCodeToForeground(lastVerifiedHwnd);
    if (focusResult.ok) {
      state = await vscodeWindowFocus.getVSCodeProcessState();
      recordVerifiedLaunch({ verified: true, hwnd: focusResult.hwnd || lastVerifiedHwnd });
      return buildLaunchResult(state, {
        verified: true,
        verificationReason: "window_found",
        pid: state.pid,
        hwnd: focusResult.hwnd || lastVerifiedHwnd,
        title: state.title,
        focused: true,
        focusReason: focusResult.reason,
      }, {
        executable: executable?.path,
        executableKind: executable?.kind,
        launchMethod,
        newWindow: false,
        requestedNewWindow: false,
        workspacePath,
        action: "focus_existing",
      });
    }
  }

  if (state.hasWindow) {
    const focusResult = await vscodeWindowFocus.bringVSCodeToForeground(state.hwnd);
    recordVerifiedLaunch({ verified: true, hwnd: state.hwnd });
    return buildLaunchResult(state, {
      verified: true,
      verificationReason: "window_found",
      pid: state.pid,
      hwnd: state.hwnd,
      title: state.title,
      focused: focusResult.ok,
      focusReason: focusResult.reason,
    }, {
      executable: executable?.path,
      executableKind: executable?.kind,
      launchMethod,
      newWindow: false,
      requestedNewWindow: false,
      workspacePath,
      action: "focus_existing",
    });
  }

  if (state.running) {
    const focusProbe = await vscodeWindowFocus.bringVSCodeToForeground(0);
    if (focusProbe.ok && focusProbe.hwnd) {
      state = await vscodeWindowFocus.getVSCodeProcessState();
      recordVerifiedLaunch({ verified: true, hwnd: focusProbe.hwnd });
      return buildLaunchResult(state, {
        verified: true,
        verificationReason: "window_found",
        pid: state.pid,
        hwnd: focusProbe.hwnd,
        title: state.title,
        focused: true,
        focusReason: focusProbe.reason,
      }, {
        executable: executable?.path,
        executableKind: executable?.kind,
        launchMethod,
        newWindow: false,
        requestedNewWindow: false,
        workspacePath,
        action: "focus_existing",
      });
    }

    const waitResult = await vscodeWindowFocus.waitForVSCodeWindow({ timeoutMs: verifyTimeoutMs });
    if (waitResult.verified) {
      const focusResult = await vscodeWindowFocus.bringVSCodeToForeground(waitResult.hwnd);
      recordVerifiedLaunch({ verified: true, hwnd: waitResult.hwnd });
      return buildLaunchResult(waitResult, {
        ...waitResult,
        focused: focusResult.ok,
        focusReason: focusResult.reason,
      }, {
        executable: executable?.path,
        executableKind: executable?.kind,
        launchMethod,
        newWindow: false,
        requestedNewWindow: false,
        workspacePath,
        action: "wait_then_focus",
      });
    }
  }

  return null;
}

async function recoverFromZombieVSCodeIfNeeded(options = {}) {
  if (process.platform !== "win32") {
    return { recovered: false, reason: "non_windows", count: 0 };
  }

  if (!options.forceRecovery && isWithinPostVerifyGrace()) {
    return { recovered: false, reason: "post_verify_grace", count: 0 };
  }

  const state = await vscodeWindowFocus.getVSCodeProcessState();
  if (state.hasWindow) {
    return { recovered: false, reason: "window_visible", count: 0 };
  }
  if (!state.running) {
    return { recovered: false, reason: "not_running", count: 0 };
  }

  const cleanup = await vscodeWindowFocus.terminateVSCodeIfNoVisibleWindow();
  return {
    recovered: Boolean(cleanup.terminated),
    reason: cleanup.reason || "unknown",
    count: cleanup.count || 0,
  };
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmVerifiedWindowStable(verifyResult, settleMs = 1500, options = {}) {
  if (!verifyResult?.verified || process.platform !== "win32" || options.skipPostVerifySettle) {
    return verifyResult;
  }
  await sleepMs(settleMs);
  const state = await vscodeWindowFocus.getVSCodeProcessState();
  if (state.hasWindow) {
    return {
      ...verifyResult,
      pid: state.pid || verifyResult.pid,
      hwnd: state.hwnd || verifyResult.hwnd,
      verificationReason: verifyResult.verificationReason || "window_stable",
    };
  }
  return {
    verified: false,
    verificationReason: "window_lost_after_verify",
    pid: state.pid || verifyResult.pid,
    hwnd: 0,
    focused: false,
    focusReason: "window_lost_after_verify",
  };
}

async function launchAndVerifyVSCode(workspacePath, executable, options = {}) {
  const requestedNewWindow = options.newWindow !== false;
  const effectiveNewWindow = options.effectiveNewWindow ?? await resolveEffectiveNewWindow(requestedNewWindow);
  const launchArgs = buildLaunchArgs(workspacePath, {
    newWindow: effectiveNewWindow,
    executableKind: executable.kind,
    extraArgs: options.extraArgs || [],
  });
  const launchMethod = getLaunchMethod(executable.kind);
  const launchProfile = options.launchProfile || "default";

  await spawnVSCodeProcess(executable, launchArgs);

  const verifyTimeoutMs = options.verifyTimeoutMs
    || (process.platform === "win32" && !(await vscodeWindowFocus.getVSCodeProcessState()).hasWindow
      ? 25000
      : vscodeWindowFocus.DEFAULT_TIMEOUT_MS);

  let verifyResult = options.skipVerification
    ? {
      verified: true,
      verificationReason: "skipped",
      pid: null,
      hwnd: 0,
      focused: true,
      focusReason: "skipped",
    }
    : process.platform === "win32"
      ? await vscodeWindowFocus.verifyAndFocusVSCode({ timeoutMs: verifyTimeoutMs })
      : {
        verified: true,
        verificationReason: "non_windows",
        pid: null,
        hwnd: 0,
        focused: true,
        focusReason: "non_windows",
      };

  verifyResult = await confirmVerifiedWindowStable(verifyResult, 1500, options);

  return {
    verifyResult,
    launchMethod,
    effectiveNewWindow,
    requestedNewWindow,
    verifyTimeoutMs,
    launchProfile,
    launchArgs,
  };
}

async function openWorkspaceInVSCode(workspacePath, options = {}) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    throw new Error("Workspace path is invalid or does not exist.");
  }

  if (launchInProgress) {
    await launchInProgress;
    const focused = await focusExistingVSCodeWindow(workspacePath, options);
    if (focused) {
      return {
        ...focused,
        skipped: true,
        reason: "awaited_inflight_launch",
      };
    }
  }

  const launchPromise = performOpenWorkspaceInVSCode(workspacePath, options);
  launchInProgress = launchPromise;
  try {
    return await launchPromise;
  } finally {
    if (launchInProgress === launchPromise) {
      launchInProgress = null;
    }
  }
}

async function performOpenWorkspaceInVSCode(workspacePath, options = {}) {
  const requestedNewWindow = options.newWindow !== false;
  const effectiveNewWindow = await resolveEffectiveNewWindow(requestedNewWindow);
  const debounceKey = getDebounceKey(workspacePath);

  if (!options.force && shouldSkipDuplicateLaunch(debounceKey)) {
    const focused = await focusExistingVSCodeWindow(workspacePath, options);
    if (focused) {
      return {
        ...focused,
        skipped: true,
        reason: "debounced",
        newWindow: effectiveNewWindow,
      };
    }
    return {
      skipped: true,
      reason: "debounced",
      newWindow: effectiveNewWindow,
      workspacePath,
    };
  }

  const executable = resolveVSCodeExecutable();
  if (!executable) {
    throw new Error(
      "VS Code CLI (code) not found. Install VS Code and enable \"Shell Command: Install 'code' command in PATH\".",
    );
  }

  const profiles = resolveLaunchProfiles(options);
  let launchOutcome = null;
  let verifyResult = null;
  let action = options.recovery ? "launch_after_recovery" : "launch";
  let usedProfile = profiles[0]?.profile || "default";
  let recoveryAttempted = Boolean(options.recoveryAlreadyAttempted);

  for (let profileIndex = 0; profileIndex < profiles.length; profileIndex += 1) {
    const { profile, extraArgs } = profiles[profileIndex];
    const useNewWindow = profileIndex === 0 ? effectiveNewWindow : true;

    launchOutcome = await launchAndVerifyVSCode(workspacePath, executable, {
      ...options,
      effectiveNewWindow: useNewWindow,
      newWindow: useNewWindow,
      extraArgs,
      launchProfile: profile,
    });
    verifyResult = launchOutcome.verifyResult;
    usedProfile = profile;

    if (verifyResult.verified) {
      if (profileIndex > 0) {
        action = `launch_${profile.replace(/-/g, "_")}`;
      }
      break;
    }

    if (
      !options.skipRecovery
      && !recoveryAttempted
      && verifyResult.verificationReason === "process_only"
      && process.platform === "win32"
    ) {
      const cleanup = await recoverFromZombieVSCodeIfNeeded({
        forceRecovery: options.forceRecovery,
      });
      recoveryAttempted = true;
      if (cleanup.recovered) {
        launchOutcome = await launchAndVerifyVSCode(workspacePath, executable, {
          ...options,
          effectiveNewWindow: true,
          newWindow: true,
          extraArgs,
          launchProfile: profile,
        });
        verifyResult = launchOutcome.verifyResult;
        if (verifyResult.verified) {
          action = "launch_after_recovery";
          break;
        }
      }
    }

    if (profileIndex < profiles.length - 1 && process.platform === "win32") {
      await recoverFromZombieVSCodeIfNeeded({ forceRecovery: true });
    }
  }

  if (verifyResult?.verified) {
    recordVerifiedLaunch(verifyResult);
  }

  recentLaunches.set(debounceKey, { at: Date.now() });

  return buildLaunchResult({}, verifyResult, {
    executable: executable.path,
    executableKind: executable.kind,
    launchMethod: launchOutcome.launchMethod,
    newWindow: launchOutcome.effectiveNewWindow,
    requestedNewWindow: launchOutcome.requestedNewWindow,
    workspacePath,
    action,
    launchProfile: usedProfile,
  });
}

async function escalateToLaunchWithRecovery(workspacePath, options = {}, escalationReason = "focus_escalation") {
  const state = await vscodeWindowFocus.getVSCodeProcessState();
  let recoveryTag = escalationReason;

  if (state.running && !state.hasWindow) {
    const cleanup = await recoverFromZombieVSCodeIfNeeded({ forceRecovery: true });
    if (cleanup.recovered) {
      recoveryTag = "zombie_cleanup";
    }
  }

  const launchOptions = {
    newWindow: true,
    force: true,
    forceRecovery: true,
    recovery: recoveryTag,
    skipRecovery: false,
    recoveryAlreadyAttempted: recoveryTag === "zombie_cleanup",
    ...options,
  };

  if (!options.launchProfile && !options.launchProfiles) {
    const fallbackProfiles = LAUNCH_PROFILES.filter((entry) => entry.profile !== "default");
    launchOptions.launchProfiles = fallbackProfiles.length > 0 ? fallbackProfiles : LAUNCH_PROFILES;
  }

  return openWorkspaceInVSCode(workspacePath, launchOptions);
}

async function focusWorkspaceInVSCode(workspacePath, options = {}) {
  if (options.allowLaunch === false) {
    const focusedOnly = await focusExistingVSCodeWindow(workspacePath, options);
    if (focusedOnly) {
      return focusedOnly;
    }
    const state = await vscodeWindowFocus.getVSCodeProcessState();
    return buildLaunchResult(state, {
      verified: Boolean(state.hasWindow),
      verificationReason: state.hasWindow ? "window_found" : "focus_only_no_window",
      pid: state.pid,
      hwnd: state.hwnd,
      focused: false,
      focusReason: "allow_launch_false",
    }, {
      workspacePath,
      action: "focus_only",
      skipped: false,
    });
  }

  const focused = await focusExistingVSCodeWindow(workspacePath, options);
  if (focused) {
    return focused;
  }

  if (isWithinPostVerifyGrace()) {
    const state = await vscodeWindowFocus.getVSCodeProcessState();
    if (state.hasWindow) {
      const focusResult = await vscodeWindowFocus.bringVSCodeToForeground(state.hwnd);
      recordVerifiedLaunch({ verified: true, hwnd: state.hwnd });
      return buildLaunchResult(state, {
        verified: true,
        verificationReason: "window_found",
        pid: state.pid,
        hwnd: state.hwnd,
        focused: focusResult.ok,
        focusReason: focusResult.reason,
      }, {
        workspacePath,
        action: "focus_existing",
        skipped: false,
      });
    }
    if (state.running && !state.hasWindow) {
      const waitResult = await vscodeWindowFocus.waitForVSCodeWindow({
        timeoutMs: options.verifyTimeoutMs || 2000,
      });
      if (waitResult.verified) {
        const focusResult = await vscodeWindowFocus.bringVSCodeToForeground(waitResult.hwnd);
        recordVerifiedLaunch({ verified: true, hwnd: waitResult.hwnd });
        return buildLaunchResult(waitResult, {
          ...waitResult,
          focused: focusResult.ok,
          focusReason: focusResult.reason,
        }, {
          workspacePath,
          action: "wait_then_focus",
          skipped: false,
        });
      }
    }
  }

  const escalationReason = options.preferFocusOnly || isRecentHandoffVerified()
    ? "focus_escalation_after_handoff"
    : "focus_escalation";

  return escalateToLaunchWithRecovery(workspacePath, options, escalationReason);
}

function launchVSCode(workspacePath, options = {}) {
  return openWorkspaceInVSCode(workspacePath, options);
}

function resetLaunchDebounceForTests() {
  recentLaunches.clear();
  launchInProgress = null;
  lastVerifiedLaunchAt = 0;
  lastVerifiedHwnd = 0;
  lastHandoffVerifiedAt = 0;
}

module.exports = {
  LAUNCH_DEBOUNCE_MS,
  LAUNCH_PROFILES,
  isVSCodeCliWrapper,
  resolveVSCodeCommand,
  resolveVSCodeAppExe,
  resolveVSCodeLaunchExecutable,
  resolveVSCodeExecutable,
  buildLaunchArgs,
  resolveLaunchProfiles,
  buildPowerShellStartProcessCommand,
  getLaunchMethod,
  resolveEffectiveNewWindow,
  recoverFromZombieVSCodeIfNeeded,
  escalateToLaunchWithRecovery,
  recordVerifiedLaunch,
  markHandoffLaunchVerified,
  isWithinPostVerifyGrace,
  isRecentHandoffVerified,
  focusExistingVSCodeWindow,
  openWorkspaceInVSCode,
  focusWorkspaceInVSCode,
  focusVSCodeWorkspace: focusWorkspaceInVSCode,
  launchVSCode,
  spawnVSCodeProcess,
  resetLaunchDebounceForTests,
};
