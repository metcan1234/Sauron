const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const LAUNCH_DEBOUNCE_MS = 3000;
const recentLaunches = new Map();

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
      const first = result.trim().split(/\r?\n/).find(Boolean);
      if (first && fs.existsSync(first)) {
        return first;
      }
    } catch {
      // where failed
    }
    return null;
  }
  return "code";
}

function resolveVSCodeExecutable() {
  if (process.platform === "win32") {
    const exeCandidates = [
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "Code.exe"),
      path.join(process.env.ProgramFiles || "", "Microsoft VS Code", "Code.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft VS Code", "Code.exe"),
    ];
    for (const candidate of exeCandidates) {
      if (candidate && fs.existsSync(candidate)) {
        return { kind: "exe", path: candidate };
      }
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

function buildLaunchArgs(workspacePath, { newWindow = true } = {}) {
  const normalized = path.resolve(workspacePath);
  if (newWindow) {
    return ["-n", normalized];
  }
  return [normalized];
}

function spawnDetachedHidden(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      ...options,
    });
    child.on("error", reject);
    child.unref();
    resolve(child);
  });
}

function spawnViaHiddenPowerShell(filePath, args) {
  const argList = args.map((arg) => `'${String(arg).replace(/'/g, "''")}'`).join(", ");
  const psCommand = `Start-Process -FilePath '${String(filePath).replace(/'/g, "''")}' -ArgumentList ${argList} -WindowStyle Hidden`;
  return spawnDetachedHidden("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-Command",
    psCommand,
  ]);
}

async function spawnVSCodeProcess(executable, args) {
  if (!executable) {
    throw new Error("VS Code executable not found.");
  }

  if (executable.kind === "exe") {
    return spawnDetachedHidden(executable.path, args);
  }

  if (process.platform === "win32") {
    // Avoid `cmd /c start` — it spawns visible console windows.
    return spawnDetachedHidden(executable.path, args, { shell: false });
  }

  return spawnDetachedHidden(executable.path, args);
}

function getDebounceKey(workspacePath, newWindow) {
  return `${path.resolve(workspacePath)}::${newWindow ? "new" : "reuse"}`;
}

function shouldSkipDuplicateLaunch(key) {
  const last = recentLaunches.get(key);
  if (!last) {
    return false;
  }
  return Date.now() - last.at < LAUNCH_DEBOUNCE_MS;
}

function openWorkspaceInVSCode(workspacePath, options = {}) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    throw new Error("Workspace path is invalid or does not exist.");
  }

  const newWindow = options.newWindow !== false;
  const debounceKey = getDebounceKey(workspacePath, newWindow);

  if (shouldSkipDuplicateLaunch(debounceKey)) {
    return Promise.resolve({
      skipped: true,
      reason: "debounced",
      newWindow,
      workspacePath,
    });
  }

  const executable = resolveVSCodeExecutable();
  if (!executable) {
    throw new Error(
      "VS Code CLI (code) not found. Install VS Code and enable \"Shell Command: Install 'code' command in PATH\".",
    );
  }

  const launchArgs = buildLaunchArgs(workspacePath, { newWindow });

  return spawnVSCodeProcess(executable, launchArgs).then(() => {
    recentLaunches.set(debounceKey, { at: Date.now() });
    return {
      skipped: false,
      executable: executable.path,
      executableKind: executable.kind,
      newWindow,
      workspacePath,
      focused: process.platform === "win32",
    };
  });
}

function focusWorkspaceInVSCode(workspacePath) {
  return openWorkspaceInVSCode(workspacePath, { newWindow: false });
}

function launchVSCode(workspacePath, options = {}) {
  return openWorkspaceInVSCode(workspacePath, options);
}

function resetLaunchDebounceForTests() {
  recentLaunches.clear();
}

module.exports = {
  LAUNCH_DEBOUNCE_MS,
  resolveVSCodeCommand,
  resolveVSCodeExecutable,
  buildLaunchArgs,
  openWorkspaceInVSCode,
  focusWorkspaceInVSCode,
  launchVSCode,
  spawnVSCodeProcess,
  resetLaunchDebounceForTests,
};
