const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const GOOSE_TERMINAL_TITLE = "Sauron Goose";

function findWindowsTerminalPathSync() {
  if (process.platform !== "win32") {
    return null;
  }

  const candidate = path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WindowsApps", "wt.exe");
  try {
    return fs.existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function buildGooseCliArgs({ taskText, providerConfig = {}, instructionsPath }) {
  return [
    "run",
    "--no-session",
    "-s",
    "--provider",
    String(providerConfig.provider || "openai"),
    "--model",
    String(providerConfig.model || "gpt-4o-mini"),
    "-i",
    String(instructionsPath || ""),
    "-t",
    String(taskText || ""),
  ];
}

function spawnDetached(child) {
  child.unref();
  return {
    pid: child.pid || null,
  };
}

function spawnWindowsTerminalGoose({ wtPath, binaryPath, workspacePath, args, env }) {
  const wtArgs = [
    "-w",
    "0",
    "nt",
    "--title",
    GOOSE_TERMINAL_TITLE,
    "-d",
    workspacePath,
    "--",
    binaryPath,
    ...args,
  ];

  const child = spawn(wtPath, wtArgs, {
    detached: true,
    stdio: "ignore",
    env,
    windowsHide: false,
  });

  return {
    ...spawnDetached(child),
    terminal: "windows-terminal",
  };
}

function spawnCmdStartGoose({ binaryPath, workspacePath, args, env }) {
  const child = spawn(
    "cmd.exe",
    [
      "/c",
      "start",
      GOOSE_TERMINAL_TITLE,
      "/D",
      workspacePath,
      binaryPath,
      ...args,
    ],
    {
      detached: true,
      stdio: "ignore",
      env,
      windowsHide: true,
    },
  );

  return {
    ...spawnDetached(child),
    terminal: "cmd",
  };
}

function spawnDirectGoose({ binaryPath, workspacePath, args, env }) {
  const child = spawn(binaryPath, args, {
    cwd: workspacePath,
    env,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });

  return {
    ...spawnDetached(child),
    terminal: "direct",
  };
}

function spawnGooseProcess({ binaryPath, workspacePath, args, env }) {
  const resolvedBinary = String(binaryPath || "").trim();
  const resolvedWorkspace = String(workspacePath || "").trim();
  const gooseArgs = Array.isArray(args) ? args : [];

  if (!resolvedBinary) {
    throw new Error("Goose binary path is missing.");
  }
  if (!resolvedWorkspace) {
    throw new Error("Workspace path is missing.");
  }

  const wtPath = findWindowsTerminalPathSync();
  if (process.platform === "win32" && wtPath) {
    return spawnWindowsTerminalGoose({
      wtPath,
      binaryPath: resolvedBinary,
      workspacePath: resolvedWorkspace,
      args: gooseArgs,
      env,
    });
  }

  if (process.platform === "win32") {
    return spawnCmdStartGoose({
      binaryPath: resolvedBinary,
      workspacePath: resolvedWorkspace,
      args: gooseArgs,
      env,
    });
  }

  return spawnDirectGoose({
    binaryPath: resolvedBinary,
    workspacePath: resolvedWorkspace,
    args: gooseArgs,
    env,
  });
}

module.exports = {
  GOOSE_TERMINAL_TITLE,
  findWindowsTerminalPathSync,
  buildGooseCliArgs,
  spawnGooseProcess,
  spawnWindowsTerminalGoose,
  spawnCmdStartGoose,
  spawnDirectGoose,
};
