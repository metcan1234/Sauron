const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

async function spawnWindowsTerminalGoose({ wtPath, binaryPath, workspacePath, args, env }) {
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
    wtPath,
    command: wtPath,
    argv: wtArgs,
  };
}

async function spawnCmdStartGoose({ binaryPath, workspacePath, args, env }) {
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
    command: "cmd.exe",
    argv: cmdArgs,
  };
}

async function spawnDirectGoose({ binaryPath, workspacePath, args, env }) {
  const heldOpenArgs = buildHeldOpenCommandArgs(binaryPath, args);
  const result = await spawnDetachedProcess(heldOpenArgs[0], heldOpenArgs.slice(1), {
    cwd: workspacePath,
    env,
  });
  return {
    ...result,
    terminal: "direct",
    command: heldOpenArgs[0],
    argv: heldOpenArgs.slice(1),
  };
}

async function spawnGooseProcess({ binaryPath, workspacePath, args, env }) {
  const resolvedBinary = String(binaryPath || "").trim();
  const resolvedWorkspace = String(workspacePath || "").trim();
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
    });
  } else if (process.platform === "win32") {
    result = await spawnCmdStartGoose({
      binaryPath: resolvedBinary,
      workspacePath: resolvedWorkspace,
      args: gooseArgs,
      env,
    });
  } else {
    result = await spawnDirectGoose({
      binaryPath: resolvedBinary,
      workspacePath: resolvedWorkspace,
      args: gooseArgs,
      env,
    });
  }

  writeLaunchDiagnostic({
    ok: true,
    binaryPath: resolvedBinary,
    workspacePath: resolvedWorkspace,
    gooseArgs,
    terminal: result.terminal,
    pid: result.pid,
    command: result.command,
    argv: result.argv,
    wtPath: wtPath || null,
  });

  return result;
}

module.exports = {
  GOOSE_TERMINAL_TITLE,
  findWindowsTerminalPathSync,
  buildGooseCliArgs,
  buildHeldOpenCommandArgs,
  writeLaunchDiagnostic,
  spawnGooseProcess,
  spawnWindowsTerminalGoose,
  spawnCmdStartGoose,
  spawnDirectGoose,
};
