const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { resolveBinaryPathOnDisk, resolveDirectoryOnDisk } = require("./goose-binary-resolver");

const GOOSE_TERMINAL_TITLE = "Sauron Goose";

function getGooseLaunchLogDir() {
  const dir = path.join(os.tmpdir(), "sauron-goose");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeLaunchDiagnostic(entry) {
  try {
    const logPath = path.join(getGooseLaunchLogDir(), "last-launch.json");
    fs.writeFileSync(logPath, `${JSON.stringify({
      at: new Date().toISOString(),
      ...entry,
    }, null, 2)}\n`, "utf8");
  } catch {
    // ignore logging failures
  }
}

function findWindowsTerminalPathSync() {
  if (process.platform !== "win32") {
    return null;
  }

  try {
    const stdout = execFileSync("where.exe", ["wt"], {
      encoding: "utf8",
      timeout: 4000,
      windowsHide: true,
    });
    const first = String(stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first) {
      return first;
    }
  } catch {
    // where.exe may fail when wt is not installed
  }

  const candidate = path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WindowsApps", "wt.exe");
  try {
    fs.accessSync(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function buildGooseCliArgs({ taskText, providerConfig = {}, systemInstructions = "" }) {
  const args = [
    "run",
    "--no-session",
    "-s",
    "--provider",
    String(providerConfig.provider || "openai"),
    "--model",
    String(providerConfig.model || "gpt-4o-mini"),
    "-t",
    String(taskText || ""),
  ];

  const system = String(systemInstructions || "").trim();
  if (system) {
    args.push("--system", system);
  }

  return args;
}

function splitGooseSystemArg(gooseArgs = []) {
  const cliArgs = [...gooseArgs];
  let systemInstructions = "";
  const systemIndex = cliArgs.indexOf("--system");
  if (systemIndex >= 0 && systemIndex + 1 < cliArgs.length) {
    systemInstructions = String(cliArgs[systemIndex + 1] || "");
    cliArgs.splice(systemIndex, 2);
  }
  return { cliArgs, systemInstructions };
}

function shouldUseWindowsPowerShellLauncher(gooseArgs = []) {
  if (process.platform !== "win32") {
    return false;
  }
  const { systemInstructions } = splitGooseSystemArg(gooseArgs);
  if (!systemInstructions) {
    return false;
  }
  return /[\r\n]/.test(systemInstructions) || systemInstructions.length > 120;
}

function writeGooseWindowsLauncher({ binaryPath, workspacePath, gooseArgs, sessionId }) {
  const launchDir = path.join(getGooseLaunchLogDir(), String(sessionId || Date.now()));
  fs.mkdirSync(launchDir, { recursive: true });

  const resolvedBinary = resolveBinaryPathOnDisk(binaryPath) || String(binaryPath || "").trim();
  const resolvedWorkspace = resolveDirectoryOnDisk(workspacePath) || String(workspacePath || "").trim();

  const { cliArgs, systemInstructions } = splitGooseSystemArg(gooseArgs);
  const systemFile = path.join(launchDir, "system.md");
  if (systemInstructions) {
    fs.writeFileSync(systemFile, systemInstructions, "utf8");
  }

  const launchConfigPath = path.join(launchDir, "launch.json");
  fs.writeFileSync(launchConfigPath, `${JSON.stringify({
    binaryPath: resolvedBinary,
    workspacePath: resolvedWorkspace,
    cliArgs,
    systemFile: systemInstructions ? systemFile : null,
  }, null, 2)}\n`, "utf8");

  const ps1Path = path.join(launchDir, "launch.ps1");
  const ps1 = `\ufeff# Sauron Goose launcher — paths via launch.json (UTF-8, Turkish I/İ safe)
$ErrorActionPreference = 'Continue'
$launchConfigPath = Join-Path $PSScriptRoot 'launch.json'
$launch = Get-Content -LiteralPath $launchConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
Set-Location -LiteralPath $launch.workspacePath
$gooseArgs = [System.Collections.ArrayList]@($launch.cliArgs)
if ($launch.systemFile) {
  $systemContent = Get-Content -LiteralPath $launch.systemFile -Raw -Encoding UTF8
  [void]$gooseArgs.Add('--system')
  [void]$gooseArgs.Add($systemContent)
}
if (-not (Test-Path -LiteralPath $launch.binaryPath)) {
  Write-Error "Goose binary not found: $($launch.binaryPath)"
  exit 1
}
& $launch.binaryPath @gooseArgs
`;

  fs.writeFileSync(ps1Path, ps1, "utf8");

  return {
    ps1Path,
    launchDir,
    launchConfigPath,
    systemFile: systemInstructions ? systemFile : null,
    cliArgs,
    binaryPath: resolvedBinary,
    workspacePath: resolvedWorkspace,
    usedSystemFile: Boolean(systemInstructions),
  };
}

function buildHeldOpenCommandArgs(binaryPath, gooseArgs) {
  return ["cmd.exe", "/k", binaryPath, ...gooseArgs];
}

function spawnDetachedProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      ...options,
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("spawn", () => {
      child.unref();
      resolve({
        pid: child.pid || null,
      });
    });
  });
}

async function spawnWindowsTerminalGoose({ wtPath, binaryPath, workspacePath, args, env, sessionId }) {
  if (shouldUseWindowsPowerShellLauncher(args)) {
    const launcher = writeGooseWindowsLauncher({
      binaryPath,
      workspacePath,
      gooseArgs: args,
      sessionId,
    });
    const wtArgs = [
      "-w",
      "0",
      "nt",
      "--title",
      GOOSE_TERMINAL_TITLE,
      "-d",
      workspacePath,
      "--",
      "powershell.exe",
      "-NoExit",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      launcher.ps1Path,
    ];

    const result = await spawnDetachedProcess(wtPath, wtArgs, { env });
    return {
      ...result,
      terminal: "windows-terminal",
      launchMethod: "powershell-launcher",
      wtPath,
      command: wtPath,
      argv: wtArgs,
      launcher,
    };
  }

  const heldOpenArgs = buildHeldOpenCommandArgs(binaryPath, args);
  const wtArgs = [
    "-w",
    "0",
    "nt",
    "--title",
    GOOSE_TERMINAL_TITLE,
    "-d",
    workspacePath,
    "--",
    ...heldOpenArgs,
  ];

  const result = await spawnDetachedProcess(wtPath, wtArgs, { env });
  return {
    ...result,
    terminal: "windows-terminal",
    launchMethod: "cmd-k",
    wtPath,
    command: wtPath,
    argv: wtArgs,
  };
}

async function spawnCmdStartGoose({ binaryPath, workspacePath, args, env, sessionId }) {
  if (shouldUseWindowsPowerShellLauncher(args)) {
    const launcher = writeGooseWindowsLauncher({
      binaryPath,
      workspacePath,
      gooseArgs: args,
      sessionId,
    });
    const cmdArgs = [
      "/c",
      "start",
      "",
      "/D",
      workspacePath,
      "powershell.exe",
      "-NoExit",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      launcher.ps1Path,
    ];

    const result = await spawnDetachedProcess("cmd.exe", cmdArgs, {
      env,
      windowsHide: true,
    });
    return {
      ...result,
      terminal: "cmd",
      launchMethod: "powershell-launcher",
      command: "cmd.exe",
      argv: cmdArgs,
      launcher,
    };
  }

  const heldOpenArgs = buildHeldOpenCommandArgs(binaryPath, args);
  const cmdArgs = [
    "/c",
    "start",
    "",
    "/D",
    workspacePath,
    ...heldOpenArgs,
  ];

  const result = await spawnDetachedProcess("cmd.exe", cmdArgs, {
    env,
    windowsHide: true,
  });
  return {
    ...result,
    terminal: "cmd",
    launchMethod: "cmd-k",
    command: "cmd.exe",
    argv: cmdArgs,
  };
}

async function spawnDirectGoose({ binaryPath, workspacePath, args, env, sessionId }) {
  if (shouldUseWindowsPowerShellLauncher(args)) {
    const launcher = writeGooseWindowsLauncher({
      binaryPath,
      workspacePath,
      gooseArgs: args,
      sessionId,
    });
    const result = await spawnDetachedProcess("powershell.exe", [
      "-NoExit",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      launcher.ps1Path,
    ], {
      cwd: workspacePath,
      env,
    });
    return {
      ...result,
      terminal: "powershell",
      launchMethod: "powershell-launcher",
      command: "powershell.exe",
      argv: ["-NoExit", "-ExecutionPolicy", "Bypass", "-File", launcher.ps1Path],
      launcher,
    };
  }

  const heldOpenArgs = buildHeldOpenCommandArgs(binaryPath, args);
  const result = await spawnDetachedProcess(heldOpenArgs[0], heldOpenArgs.slice(1), {
    cwd: workspacePath,
    env,
  });
  return {
    ...result,
    terminal: "direct",
    launchMethod: "cmd-k",
    command: heldOpenArgs[0],
    argv: heldOpenArgs.slice(1),
  };
}

async function spawnGooseProcess({ binaryPath, workspacePath, args, env, sessionId = null }) {
  const resolvedBinary = resolveBinaryPathOnDisk(binaryPath) || String(binaryPath || "").trim();
  const resolvedWorkspace = resolveDirectoryOnDisk(workspacePath) || String(workspacePath || "").trim();
  const gooseArgs = Array.isArray(args) ? args : [];

  if (!resolvedBinary) {
    throw new Error("Goose binary path is missing.");
  }
  if (!resolvedWorkspace) {
    throw new Error("Workspace path is missing.");
  }
  if (!fs.existsSync(resolvedBinary)) {
    throw new Error(`Goose binary not found: ${resolvedBinary}`);
  }

  let result;
  const wtPath = findWindowsTerminalPathSync();
  if (process.platform === "win32" && wtPath) {
    result = await spawnWindowsTerminalGoose({
      wtPath,
      binaryPath: resolvedBinary,
      workspacePath: resolvedWorkspace,
      args: gooseArgs,
      env,
      sessionId,
    });
  } else if (process.platform === "win32") {
    result = await spawnCmdStartGoose({
      binaryPath: resolvedBinary,
      workspacePath: resolvedWorkspace,
      args: gooseArgs,
      env,
      sessionId,
    });
  } else {
    result = await spawnDirectGoose({
      binaryPath: resolvedBinary,
      workspacePath: resolvedWorkspace,
      args: gooseArgs,
      env,
      sessionId,
    });
  }

  writeLaunchDiagnostic({
    ok: true,
    binaryPath: resolvedBinary,
    workspacePath: resolvedWorkspace,
    gooseArgs,
    sessionId,
    launchMethod: result.launchMethod || result.terminal,
    terminal: result.terminal,
    pid: result.pid,
    command: result.command,
    argv: result.argv,
    launcher: result.launcher || null,
    wtPath: wtPath || null,
  });

  return result;
}

module.exports = {
  GOOSE_TERMINAL_TITLE,
  findWindowsTerminalPathSync,
  buildGooseCliArgs,
  splitGooseSystemArg,
  shouldUseWindowsPowerShellLauncher,
  writeGooseWindowsLauncher,
  buildHeldOpenCommandArgs,
  writeLaunchDiagnostic,
  spawnGooseProcess,
  spawnWindowsTerminalGoose,
  spawnCmdStartGoose,
  spawnDirectGoose,
};
