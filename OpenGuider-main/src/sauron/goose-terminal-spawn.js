const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  escapePowerShellSingleQuoted,
  toPowerShellLiteralPath,
  buildEncodedPowerShellArgs,
} = require("./goose-powershell");

const GOOSE_TERMINAL_TITLE = "Sauron Goose";

function findWindowsTerminalPathSync() {
  if (process.platform !== "win32") {
    return null;
  }

  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WindowsApps", "wt.exe"),
    path.join(process.env.ProgramFiles || "", "WindowsApps", "Microsoft.WindowsTerminal_*"),
  ];

  for (const candidate of candidates) {
    if (candidate.includes("*")) {
      continue;
    }
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function buildStartProcessCommand(scriptPath, workspacePath, wtPath) {
  const scriptLit = toPowerShellLiteralPath(scriptPath);
  const cwdLit = toPowerShellLiteralPath(workspacePath);
  const title = escapePowerShellSingleQuoted(GOOSE_TERMINAL_TITLE);

  if (wtPath) {
    const wtLit = toPowerShellLiteralPath(wtPath);
    return [
      `$p = Start-Process -FilePath ${wtLit}`,
      `-ArgumentList @('-w','0','new-tab','--title','${title}','-d',${cwdLit},'powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-NoLogo','-File',${scriptLit})`,
      "-WindowStyle Normal -PassThru",
    ].join(" ");
  }

  return [
    "$p = Start-Process -FilePath 'powershell.exe'",
    `-ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-NoLogo','-File',${scriptLit})`,
    `-WorkingDirectory ${cwdLit} -WindowStyle Normal -PassThru`,
  ].join(" ");
}

function buildFocusTerminalSnippet() {
  const title = escapePowerShellSingleQuoted(GOOSE_TERMINAL_TITLE);
  return [
    "Start-Sleep -Milliseconds 700",
    "Add-Type @\"",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class SauronGooseFocus {",
    "  [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);",
    "  [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);",
    "  [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd);",
    "}",
    "\"@",
    `$needle = '${title}'`,
    "$proc = Get-Process | Where-Object {",
    "  $_.MainWindowHandle -ne 0 -and (",
    "    $_.MainWindowTitle -like \"*$needle*\" -or",
    "    $_.MainWindowTitle -like '*goose*' -or",
    "    $_.ProcessName -eq 'WindowsTerminal'",
    "  )",
    "} | Sort-Object StartTime -Descending | Select-Object -First 1",
    "if ($proc) {",
    "  $h = $proc.MainWindowHandle",
    "  if ($h -ne 0) {",
    "    if ([SauronGooseFocus]::IsIconic($h)) { [SauronGooseFocus]::ShowWindow($h, 9) | Out-Null }",
    "    else { [SauronGooseFocus]::ShowWindow($h, 5) | Out-Null }",
    "    [SauronGooseFocus]::SetForegroundWindow($h) | Out-Null",
    "  }",
    "}",
  ].join("\n");
}

function buildVisibleTerminalSpawnCommand(scriptPath, workspacePath) {
  const wtPath = findWindowsTerminalPathSync();
  const startCmd = buildStartProcessCommand(scriptPath, workspacePath, wtPath);
  const focusSnippet = buildFocusTerminalSnippet();
  return {
    command: `${startCmd}; $spawnPid = $p.Id; ${focusSnippet}; Write-Output $spawnPid`,
    terminal: wtPath ? "windows-terminal" : "powershell",
    wtPath,
  };
}

function spawnVisibleGooseTerminal({ scriptPath, workspacePath }) {
  const resolvedScript = String(scriptPath || "").trim();
  const resolvedWorkspace = String(workspacePath || "").trim();
  if (!resolvedScript || !resolvedWorkspace) {
    return Promise.reject(new Error("Goose terminal script or workspace path is missing."));
  }

  if (process.platform !== "win32") {
    return new Promise((resolve, reject) => {
      const child = require("child_process").spawn(
        "powershell.exe",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-File", resolvedScript],
        {
          detached: true,
          stdio: "ignore",
          cwd: resolvedWorkspace,
          windowsHide: false,
        },
      );
      child.on("error", reject);
      child.unref();
      resolve({ pid: child.pid, terminal: "powershell" });
    });
  }

  const { command, terminal } = buildVisibleTerminalSpawnCommand(resolvedScript, resolvedWorkspace);
  const encodedArgs = buildEncodedPowerShellArgs(command);

  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      encodedArgs,
      { windowsHide: true, timeout: 25000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message || "Goose terminal could not be opened."));
          return;
        }
        const lines = String(stdout || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const pid = parseInt(lines[lines.length - 1], 10);
        resolve({
          pid: Number.isFinite(pid) ? pid : null,
          terminal,
        });
      },
    );
  });
}

module.exports = {
  GOOSE_TERMINAL_TITLE,
  escapePowerShellSingleQuoted,
  findWindowsTerminalPathSync,
  buildStartProcessCommand,
  buildVisibleTerminalSpawnCommand,
  spawnVisibleGooseTerminal,
};
