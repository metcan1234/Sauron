const fs = require("fs");
const path = require("path");
const { spawn, execFileSync, execFile } = require("child_process");
const vscodeWindowFocus = require("./vscode-window-focus");

const LAUNCH_DEBOUNCE_MS = 3000;
const GLOBAL_SPAWN_COOLDOWN_MS = 12000;
const POST_VERIFY_GRACE_MS = vscodeWindowFocus.POST_VERIFY_GRACE_MS || 30000;
const HWND_SETTLE_MS = 3000;

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
let configuredVscodePath = "";
let lastResolvedVscodePath = null;
let lastResolvedVscodeSource = null;
let lastVsCodeSpawnAt = 0;
let lastGlobalSpawnWorkspace = "";
let vsCodeLaunchLogger = null;
let spawnDiagnosticsEnabled = process.env.SAURON_VSCODE_SPAWN_DEBUG === "1";
let lastSpawnDiagnostic = null;

function setSpawnDiagnosticsEnabled(enabled) {
  spawnDiagnosticsEnabled = Boolean(enabled);
}

function getLastSpawnDiagnostic() {
  return lastSpawnDiagnostic;
}

function setVsCodeLaunchLogger(logger) {
  vsCodeLaunchLogger = typeof logger === "function" ? logger : null;
}

function readCodeWorkspaceContext(workspacePath) {
  const resolvedPath = path.resolve(workspacePath);
  const context = {
    workspacePath: resolvedPath,
    workspaceExists: fs.existsSync(resolvedPath),
    isCodeWorkspaceFile: resolvedPath.toLowerCase().endsWith(".code-workspace"),
    codeWorkspaceFile: null,
    codeWorkspaceContent: null,
    codeWorkspaceValidJson: null,
  };

  if (context.isCodeWorkspaceFile && context.workspaceExists) {
    context.codeWorkspaceFile = resolvedPath;
    try {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      context.codeWorkspaceContent = raw;
      const parsed = JSON.parse(raw);
      context.codeWorkspaceValidJson = true;
      const folders = Array.isArray(parsed?.folders) ? parsed.folders : [];
      context.codeWorkspaceFolders = folders.map((entry) => {
        const folderPath = String(entry?.path || "").trim();
        const absolutePath = path.isAbsolute(folderPath)
          ? folderPath
          : path.resolve(path.dirname(resolvedPath), folderPath);
        return {
          path: folderPath,
          absolutePath,
          exists: folderPath ? fs.existsSync(absolutePath) : false,
        };
      });
    } catch (error) {
      context.codeWorkspaceValidJson = false;
      context.codeWorkspaceParseError = error?.message || String(error);
    }
  }

  return context;
}

function collectVsCodeLaunchDiagnostics(workspacePath, executable, launchArgs, options = {}) {
  const workspaceContext = readCodeWorkspaceContext(workspacePath);
  const spawnMethod = process.platform === "win32"
    ? (
      executable?.kind === "cmd" && !resolveCodeExeFromCmdPath(executable?.path)
        ? "powershell-start-process"
        : "code.exe-detached"
    )
    : (executable?.kind === "exe" ? "code.exe-detached" : "code-cli-detached");

  return {
    event: "vscode-launch-command",
    executable: executable?.path || null,
    executableKind: executable?.kind || null,
    launchMethod: getLaunchMethod(executable?.kind || "cmd"),
    spawnMethod,
    args: Array.isArray(launchArgs) ? [...launchArgs] : [],
    cwd: options.cwd || null,
    envOverrides: options.env || null,
    launchProfile: options.launchProfile || "default",
    extraArgs: Array.isArray(options.extraArgs) ? [...options.extraArgs] : [],
    powershellCommand: (
      process.platform === "win32"
      && executable?.path
      && Array.isArray(launchArgs)
    )
      ? (() => {
        if (executable.kind === "cmd") {
          const codeExe = resolveCodeExeFromCmdPath(executable.path);
          if (codeExe) {
            return buildPowerShellStartProcessCommand(codeExe, mapCliArgsToExeArgs(launchArgs));
          }
        }
        return buildPowerShellStartProcessCommand(executable.path, launchArgs);
      })()
      : null,
    ...workspaceContext,
  };
}

function logVsCodeLaunchDetails(detail) {
  const payload = collectVsCodeLaunchDiagnostics(
    detail.workspacePath,
    detail.executable,
    detail.launchArgs,
    detail.options || {},
  );
  Object.assign(payload, {
    requestedNewWindow: detail.requestedNewWindow,
    effectiveNewWindow: detail.effectiveNewWindow,
  });
  if (typeof vsCodeLaunchLogger === "function") {
    vsCodeLaunchLogger(payload);
  } else {
    console.log("[vscode-launch]", JSON.stringify(payload, null, 2));
  }
  return payload;
}

function mapCliArgsToExeArgs(args = []) {
  const mapped = [];
  for (const arg of args) {
    if (arg === "-n") {
      mapped.push("--new-window");
      continue;
    }
    if (arg === "-r") {
      mapped.push("--reuse-window");
      continue;
    }
    mapped.push(arg);
  }
  return mapped;
}

function resolveCodeExeFromCmdPath(codeCmdPath) {
  if (!codeCmdPath) {
    return null;
  }
  const normalized = path.resolve(codeCmdPath);
  const candidates = [
    path.join(path.dirname(path.dirname(normalized)), "Code.exe"),
    path.join(path.dirname(normalized), "Code.exe"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function shouldUseCliShimOnWindows(args = []) {
  return args.some((arg) => arg === "-r" || arg === "--reuse-window");
}

function spawnVSCodeCmdOnWindows(codeCmdPath, args, options = {}) {
  if (options.useCliShim || shouldUseCliShimOnWindows(args)) {
    return spawnViaPowerShellStartProcess(codeCmdPath, args);
  }
  const codeExe = resolveCodeExeFromCmdPath(codeCmdPath);
  if (codeExe) {
    return spawnVSCodeGuiProcess(codeExe, mapCliArgsToExeArgs(args));
  }
  return spawnViaPowerShellStartProcess(codeCmdPath, args);
}

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

function isCursorCliPath(candidatePath) {
  if (!candidatePath) {
    return false;
  }
  return String(candidatePath).toLowerCase().includes("cursor");
}

function isVSCodeCliWrapper(candidatePath) {
  if (!candidatePath || isCursorCliPath(candidatePath)) {
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

function setConfiguredVscodePath(value) {
  configuredVscodePath = String(value || "").trim();
}

function getConfiguredVscodePath() {
  return configuredVscodePath;
}

function getCommonVSCodeCliCandidates() {
  if (process.platform === "win32") {
    return [
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "bin", "code.cmd"),
      path.join(process.env.ProgramFiles || "", "Microsoft VS Code", "bin", "code.cmd"),
      path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft VS Code", "bin", "code.cmd"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
      "/usr/local/bin/code",
    ];
  }
  return [
    "/usr/share/code/bin/code",
    "/usr/bin/code",
  ];
}

function listPathCommandMatches(command, args) {
  try {
    const result = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    return result.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function pickVSCodeCliFromPathMatches(matches) {
  const filtered = matches.filter((candidate) => candidate && !isCursorCliPath(candidate) && fs.existsSync(candidate));
  if (filtered.length === 0) {
    return null;
  }
  const cliMatch = filtered.find(isVSCodeCliWrapper);
  return cliMatch || filtered[0];
}

function resolveVscodeExecutablePath(options = {}) {
  const configuredPath = String(options.configuredPath ?? configuredVscodePath ?? "").trim();
  if (configuredPath && fs.existsSync(configuredPath)) {
    lastResolvedVscodePath = configuredPath;
    lastResolvedVscodeSource = "settings";
    return configuredPath;
  }

  for (const candidate of getCommonVSCodeCliCandidates()) {
    if (candidate && fs.existsSync(candidate)) {
      lastResolvedVscodePath = candidate;
      lastResolvedVscodeSource = "common-path";
      return candidate;
    }
  }

  const pathMatches = process.platform === "win32"
    ? listPathCommandMatches("where", ["code"])
    : listPathCommandMatches("which", ["-a", "code"]);
  const pathMatch = pickVSCodeCliFromPathMatches(pathMatches);
  if (pathMatch) {
    lastResolvedVscodePath = pathMatch;
    lastResolvedVscodeSource = "path-command";
    return pathMatch;
  }

  lastResolvedVscodePath = null;
  lastResolvedVscodeSource = null;
  return null;
}

function getLastResolvedVscodePathInfo() {
  return {
    path: lastResolvedVscodePath,
    source: lastResolvedVscodeSource,
  };
}

function resolveVSCodeCommand(options = {}) {
  const resolved = resolveVscodeExecutablePath(options);
  if (resolved) {
    return resolved;
  }
  if (process.platform !== "win32") {
    return "code";
  }
  return null;
}

function resolveVSCodeAppExe(options = {}) {
  const codeCmd = resolveVSCodeCommand(options);
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

function resolveVSCodeLaunchExecutable(options = {}) {
  if (process.platform === "win32") {
    const codeCmd = resolveVSCodeCommand(options);
    if (codeCmd) {
      return { kind: "cmd", path: codeCmd };
    }
    const appExe = resolveVSCodeAppExe(options);
    if (appExe) {
      return { kind: "exe", path: appExe };
    }
    return null;
  }

  const codeCmd = resolveVSCodeCommand(options);
  return codeCmd ? { kind: "cmd", path: codeCmd } : null;
}

function toShortPath(longPath) {
  if (process.platform !== "win32") {
    return longPath;
  }
  const resolved = path.resolve(longPath);
  if (!/[^\x00-\x7F]/.test(resolved)) {
    return resolved;
  }
  if (!fs.existsSync(resolved)) {
    return resolved;
  }

  const tryPath = (candidate) => {
    const value = String(candidate || "").trim();
    if (!value || value.includes('"') || value === resolved) {
      return null;
    }
    if (!fs.existsSync(value)) {
      return null;
    }
    return value;
  };

  try {
    const escaped = resolved.replace(/"/g, '""');
    const fromCmd = execFileSync(
      "cmd",
      ["/c", `for %I in ("${escaped}") do @echo %~sI`],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    const cmdShort = tryPath(fromCmd);
    if (cmdShort) {
      return cmdShort;
    }
  } catch {
    // fall through to PowerShell
  }

  try {
    const psEscaped = resolved.replace(/'/g, "''");
    const fromPs = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$fso = New-Object -ComObject Scripting.FileSystemObject; $fso.GetFolder('${psEscaped}').ShortPath`,
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    const psShort = tryPath(fromPs);
    if (psShort) {
      return psShort;
    }
  } catch {
    // ignore
  }

  return resolved;
}

function buildLaunchArgs(workspacePath, { newWindow = true, executableKind = "cmd", extraArgs = [], additionalPaths = [], gotoPath = null } = {}) {
  const normalized = path.resolve(workspacePath);
  const pathForWorkspace = process.platform === "win32" && /[^\x00-\x7F]/.test(normalized)
    ? toShortPath(normalized)
    : normalized;
  const prefixArgs = [...extraArgs];
  if (gotoPath) {
    const gotoResolved = path.resolve(String(gotoPath || "").trim());
    if (gotoResolved && fs.existsSync(gotoResolved)) {
      const pathForGoto = process.platform === "win32" && /[^\x00-\x7F]/.test(gotoResolved)
        ? toShortPath(gotoResolved)
        : gotoResolved;
      prefixArgs.push("-g", pathForGoto);
    }
  }
  const flags = [];
  if (executableKind === "exe") {
    flags.push(newWindow ? "--new-window" : "--reuse-window");
  } else if (newWindow) {
    flags.push("-n");
  } else {
    flags.push("-r");
  }
  void additionalPaths;
  return [...prefixArgs, ...flags, pathForWorkspace];
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

function getStartProcessWindowStyle(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".cmd") || lower.endsWith(".bat")) {
    return "Hidden";
  }
  return "Normal";
}

function buildPowerShellStartProcessCommand(filePath, args) {
  const windowStyle = getStartProcessWindowStyle(filePath);
  const argList = args.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`).join(", ");
  return `Start-Process -FilePath '${escapePowerShellSingleQuoted(filePath)}' -ArgumentList ${argList} -WindowStyle ${windowStyle}`;
}

function recordSpawnDiagnostic(entry) {
  lastSpawnDiagnostic = {
    at: new Date().toISOString(),
    ...entry,
  };
  if (spawnDiagnosticsEnabled) {
    const payload = { event: "vscode-spawn-diagnostic", ...lastSpawnDiagnostic };
    if (typeof vsCodeLaunchLogger === "function") {
      vsCodeLaunchLogger(payload);
    } else {
      console.log("[vscode-spawn-diagnostic]", JSON.stringify(payload, null, 2));
    }
  }
}

function spawnDetachedProcess(command, args, options = {}) {
  const captureDiagnostics = spawnDiagnosticsEnabled || options.captureDiagnostics === true;
  const stdio = captureDiagnostics ? ["ignore", "pipe", "pipe"] : "ignore";

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      windowsHide: options.windowsHide !== false,
      ...options,
      stdio,
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        if (captureDiagnostics) {
          stdoutChunks.push(String(chunk));
        }
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        if (captureDiagnostics) {
          stderrChunks.push(String(chunk));
        }
      });
    }

    child.on("error", (error) => {
      recordSpawnDiagnostic({
        command,
        args,
        phase: "error",
        message: error?.message || String(error),
        code: error?.code || null,
      });
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (captureDiagnostics) {
        recordSpawnDiagnostic({
          command,
          args,
          phase: "exit",
          pid: child.pid,
          code,
          signal,
          stdout: stdoutChunks.join(""),
          stderr: stderrChunks.join(""),
        });
      }
    });

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
      {
        windowsHide: true,
        timeout: 30000,
        cwd: process.env.USERPROFILE || process.env.HOME || undefined,
        ...(spawnDiagnosticsEnabled ? { encoding: "utf8" } : {}),
      },
      (error, stdout, stderr) => {
        if (spawnDiagnosticsEnabled) {
          recordSpawnDiagnostic({
            command: "powershell.exe",
            args: ["-Command", psCommand],
            phase: error ? "execFile_error" : "execFile_ok",
            message: error?.message || null,
            stdout: String(stdout || ""),
            stderr: String(stderr || ""),
          });
        }
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

async function resolveEffectiveNewWindow(requestedNewWindow, options = {}) {
  if (process.platform !== "win32") {
    return requestedNewWindow;
  }
  const state = await vscodeWindowFocus.getVSCodeProcessState();
  if (options.respectRequestedNewWindow && requestedNewWindow === false) {
    return state.running ? false : true;
  }
  if (!state.running || !state.hasWindow) {
    return true;
  }
  return requestedNewWindow;
}

async function spawnVSCodeProcess(executable, args, launchContext = null) {
  if (!executable) {
    throw new Error("VS Code executable not found.");
  }

  if (launchContext) {
    logVsCodeLaunchDetails(launchContext);
  }

  let result;
  if (process.platform === "win32") {
    if (executable.kind === "cmd") {
      result = await spawnVSCodeCmdOnWindows(executable.path, args, launchContext?.options || {});
    } else {
      result = await spawnVSCodeGuiProcess(executable.path, args);
    }
  } else if (executable.kind === "exe") {
    result = await spawnVSCodeGuiProcess(executable.path, args);
  } else {
    result = await spawnVSCodeGuiProcess(executable.path, args);
  }

  lastVsCodeSpawnAt = Date.now();
  return result;
}

function getLastVsCodeSpawnAt() {
  return lastVsCodeSpawnAt;
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

function resolveVSCodeExecutable(options = {}) {
  return resolveVSCodeLaunchExecutable(options);
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

function buildSpawnOkVerifyResult(extra = {}) {
  return {
    verified: true,
    verificationReason: "spawn_ok",
    pid: null,
    hwnd: 0,
    focused: false,
    focusReason: "spawn_ok",
    ...extra,
  };
}

function isWithinSpawnGrace() {
  return lastVsCodeSpawnAt > 0
    && (Date.now() - lastVsCodeSpawnAt) < vscodeWindowFocus.ZOMBIE_GRACE_MS;
}

async function recoverFromZombieVSCodeIfNeeded(options = {}) {
  if (process.platform !== "win32") {
    return { recovered: false, reason: "non_windows", count: 0 };
  }

  if (!options.ignoreSpawnGrace && isWithinSpawnGrace()) {
    return { recovered: false, reason: "recent_spawn_grace", count: 0 };
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
  if (
    !verifyResult?.verified
    || process.platform !== "win32"
    || options.skipPostVerifySettle
    || verifyResult.verificationReason === "spawn_ok"
  ) {
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
    ...verifyResult,
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
  const effectiveNewWindow = options.effectiveNewWindow
    ?? await resolveEffectiveNewWindow(requestedNewWindow, options);
  const launchArgs = buildLaunchArgs(workspacePath, {
    newWindow: effectiveNewWindow,
    executableKind: executable.kind,
    extraArgs: options.extraArgs || [],
    additionalPaths: options.additionalPaths || [],
    gotoPath: options.gotoPath || null,
  });
  const launchMethod = getLaunchMethod(executable.kind);
  const launchProfile = options.launchProfile || "default";
  const requireWindowVerification = options.requireWindowVerification === true;

  await spawnVSCodeProcess(executable, launchArgs, {
    workspacePath,
    executable,
    launchArgs,
    options,
    requestedNewWindow,
    effectiveNewWindow,
  });

  if (options.skipVerification) {
    const verifyResult = {
      verified: true,
      verificationReason: "skipped",
      pid: null,
      hwnd: 0,
      focused: true,
      focusReason: "skipped",
    };
    return {
      verifyResult,
      launchMethod,
      effectiveNewWindow,
      requestedNewWindow,
      verifyTimeoutMs: 0,
      launchProfile,
      launchArgs,
      spawnOk: true,
    };
  }

  const verifyTimeoutMs = options.verifyTimeoutMs
    || (process.platform === "win32" && !(await vscodeWindowFocus.getVSCodeProcessState()).hasWindow
      ? 25000
      : vscodeWindowFocus.DEFAULT_TIMEOUT_MS);

  let verifyResult = buildSpawnOkVerifyResult();

  if (requireWindowVerification && process.platform === "win32") {
    await sleepMs(HWND_SETTLE_MS);
    const windowCheck = await vscodeWindowFocus.verifyAndFocusVSCode({ timeoutMs: verifyTimeoutMs });
    verifyResult = await confirmVerifiedWindowStable(windowCheck, 1500, options);
    if (!verifyResult.verified) {
      return {
        verifyResult,
        launchMethod,
        effectiveNewWindow,
        requestedNewWindow,
        verifyTimeoutMs,
        launchProfile,
        launchArgs,
        spawnOk: true,
      };
    }
  } else if (process.platform === "win32") {
    const windowCheck = await vscodeWindowFocus.verifyAndFocusVSCode({
      timeoutMs: Math.min(verifyTimeoutMs, 3000),
      retryFocus: false,
    });
    verifyResult = buildSpawnOkVerifyResult({
      pid: windowCheck.pid,
      hwnd: windowCheck.hwnd,
      focused: windowCheck.focused,
      focusReason: windowCheck.focusReason || "spawn_ok",
      windowCheckReason: windowCheck.verificationReason,
    });
  }

  return {
    verifyResult,
    launchMethod,
    effectiveNewWindow,
    requestedNewWindow,
    verifyTimeoutMs,
    launchProfile,
    launchArgs,
    spawnOk: true,
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
  const effectiveNewWindow = options.effectiveNewWindow
    ?? await resolveEffectiveNewWindow(requestedNewWindow, options);
  const debounceKey = getDebounceKey(workspacePath);
  const reuseOnly = options.respectRequestedNewWindow === true || options.newWindow === false;

  if (
    !options.force
    && lastGlobalSpawnWorkspace === debounceKey
    && Date.now() - lastVsCodeSpawnAt < GLOBAL_SPAWN_COOLDOWN_MS
  ) {
    const focused = await focusExistingVSCodeWindow(workspacePath, options);
    if (focused) {
      return {
        ...focused,
        skipped: true,
        reason: "global_spawn_cooldown",
        newWindow: effectiveNewWindow,
      };
    }
  }

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
    const useNewWindow = reuseOnly
      ? effectiveNewWindow
      : (profileIndex === 0 ? effectiveNewWindow : true);

    try {
      launchOutcome = await launchAndVerifyVSCode(workspacePath, executable, {
        ...options,
        effectiveNewWindow: useNewWindow,
        newWindow: useNewWindow,
        extraArgs,
        launchProfile: profile,
      });
    } catch (launchError) {
      if (profileIndex >= profiles.length - 1) {
        throw launchError;
      }
      continue;
    }

    verifyResult = launchOutcome.verifyResult;
    usedProfile = profile;

    if (verifyResult.verified) {
      if (profileIndex > 0) {
        action = `launch_${profile.replace(/-/g, "_")}`;
      }
      break;
    }

    if (
      options.requireWindowVerification
      && !options.skipRecovery
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

    if (
      options.requireWindowVerification
      && profileIndex < profiles.length - 1
      && process.platform === "win32"
      && !options.skipInterProfileRecovery
      && !isWithinSpawnGrace()
    ) {
      await recoverFromZombieVSCodeIfNeeded({ forceRecovery: true });
    }
  }

  if (verifyResult?.verified) {
    recordVerifiedLaunch(verifyResult);
  }

  if (launchOutcome?.spawnOk) {
    lastVsCodeSpawnAt = Date.now();
    lastGlobalSpawnWorkspace = debounceKey;
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
  const reusePreferred = options.respectRequestedNewWindow === true || options.newWindow === false;

  if (state.running && !state.hasWindow && !options.skipRecovery) {
    const cleanup = await recoverFromZombieVSCodeIfNeeded({ forceRecovery: true });
    if (cleanup.recovered) {
      recoveryTag = "zombie_cleanup";
    }
  }

  const launchOptions = {
    newWindow: reusePreferred ? false : true,
    force: true,
    forceRecovery: !reusePreferred,
    requireWindowVerification: true,
    recovery: recoveryTag,
    skipRecovery: Boolean(options.skipRecovery),
    recoveryAlreadyAttempted: recoveryTag === "zombie_cleanup",
    skipInterProfileRecovery: reusePreferred ? true : options.skipInterProfileRecovery,
    respectRequestedNewWindow: options.respectRequestedNewWindow,
    ...options,
  };

  if (reusePreferred && !options.launchProfile && !options.launchProfiles) {
    launchOptions.launchProfiles = [{ profile: "default", extraArgs: [] }];
  } else if (!options.launchProfile && !options.launchProfiles) {
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
  lastVsCodeSpawnAt = 0;
  lastGlobalSpawnWorkspace = "";
}

module.exports = {
  LAUNCH_DEBOUNCE_MS,
  LAUNCH_PROFILES,
  isCursorCliPath,
  isVSCodeCliWrapper,
  setConfiguredVscodePath,
  getConfiguredVscodePath,
  resolveVscodeExecutablePath,
  getLastResolvedVscodePathInfo,
  getLastVsCodeSpawnAt,
  getLastSpawnDiagnostic,
  setSpawnDiagnosticsEnabled,
  setVsCodeLaunchLogger,
  readCodeWorkspaceContext,
  collectVsCodeLaunchDiagnostics,
  logVsCodeLaunchDetails,
  buildSpawnOkVerifyResult,
  resolveVSCodeCommand,
  resolveVSCodeAppExe,
  resolveVSCodeLaunchExecutable,
  resolveVSCodeExecutable,
  buildLaunchArgs,
  toShortPath,
  isWithinSpawnGrace,
  HWND_SETTLE_MS,
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
  resolveCodeExeFromCmdPath,
  mapCliArgsToExeArgs,
  shouldUseCliShimOnWindows,
  spawnVSCodeProcess,
  resetLaunchDebounceForTests,
};
