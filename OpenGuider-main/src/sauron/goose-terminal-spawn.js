const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  escapePowerShellSingleQuoted,
  toPowerShellLiteralPath,
  writeUtf8BomFile,
  buildEncodedPowerShellArgs,
} = require("./goose-powershell");

const GOOSE_TERMINAL_TITLE = "Sauron Goose";

function getGooseTerminalDir() {
  const dir = path.join(os.tmpdir(), "sauron-goose");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function findWindowsTerminalPathSync() {
  if (process.platform !== "win32") {
    return null;
  }

  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WindowsApps", "wt.exe"),
  ];

  for (const candidate of candidates) {
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

function buildPowerShellLaunchArgs(scriptPath) {
  return [
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-NoLogo",
    "-File",
    scriptPath,
  ];
}

function buildWindowsTerminalCommandLine(scriptPath, workspacePath) {
  const scriptLit = toPowerShellLiteralPath(scriptPath);
  const cwdLit = toPowerShellLiteralPath(workspacePath);
  return [
    "-w 0 nt",
    '--title "Sauron Goose"',
    `-d ${cwdLit}`,
    "--",
    "powershell.exe",
    "-NoExit -NoProfile -ExecutionPolicy Bypass -NoLogo",
    `-File ${scriptLit}`,
  ].join(" ");
}

function writeVisibleTerminalBootstrap({ sessionId, scriptPath, workspacePath }) {
  const bootstrapPath = path.join(getGooseTerminalDir(), `open-${sessionId}.ps1`);
  const cwdLit = toPowerShellLiteralPath(workspacePath);
  const psArgs = buildPowerShellLaunchArgs(scriptPath)
    .map((part) => `'${escapePowerShellSingleQuoted(part)}'`)
    .join(", ");

  const content = [
    "$ErrorActionPreference = 'Continue'",
    `try { $host.UI.RawUI.WindowTitle = '${escapePowerShellSingleQuoted(GOOSE_TERMINAL_TITLE)}' } catch {}`,
    `Set-Location -LiteralPath ${cwdLit}`,
    "Write-Host 'Sauron Goose terminal acildi.' -ForegroundColor Cyan",
    `$psArgs = @(${psArgs})`,
    "& powershell.exe @psArgs",
    "Write-Host ''",
    "Write-Host 'Goose scripti bitti. Kapatmak icin Enter.' -ForegroundColor DarkGray",
    "try {",
    "  if ([Environment]::UserInteractive) { [void][Console]::ReadLine() }",
    "  else { Start-Sleep -Seconds 3600 }",
    "} catch {",
    "  Start-Sleep -Seconds 3600",
    "}",
  ].join("\r\n");

  writeUtf8BomFile(bootstrapPath, content);
  return bootstrapPath;
}

function buildStartProcessCommand(entryScriptPath, workspacePath, wtPath) {
  const entryLit = toPowerShellLiteralPath(entryScriptPath);
  const cwdLit = toPowerShellLiteralPath(workspacePath);

  if (wtPath) {
    const wtLit = toPowerShellLiteralPath(wtPath);
    const wtCommandLine = buildWindowsTerminalCommandLine(entryScriptPath, workspacePath);
    return [
      `$p = Start-Process -FilePath ${wtLit}`,
      `-ArgumentList '${escapePowerShellSingleQuoted(wtCommandLine)}'`,
      "-WindowStyle Normal -PassThru",
    ].join(" ");
  }

  const argList = buildPowerShellLaunchArgs(entryScriptPath)
    .map((part) => `'${escapePowerShellSingleQuoted(part)}'`)
    .join(", ");

  return [
    "$p = Start-Process -FilePath 'powershell.exe'",
    `-ArgumentList @(${argList})`,
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

function buildVisibleTerminalSpawnCommand(entryScriptPath, workspacePath) {
  const wtPath = findWindowsTerminalPathSync();
  const startCmd = buildStartProcessCommand(entryScriptPath, workspacePath, wtPath);
  const focusSnippet = buildFocusTerminalSnippet();
  return {
    command: `${startCmd}; $spawnPid = $p.Id; ${focusSnippet}; Write-Output $spawnPid`,
    terminal: wtPath ? "windows-terminal" : "powershell",
    wtPath,
  };
}

function spawnVisibleGooseTerminal({ scriptPath, workspacePath, sessionId = null }) {
  const resolvedScript = String(scriptPath || "").trim();
  const resolvedWorkspace = String(workspacePath || "").trim();
  if (!resolvedScript || !resolvedWorkspace) {
    return Promise.reject(new Error("Goose terminal script or workspace path is missing."));
  }

  const bootstrapId = sessionId || `goose-open-${Date.now()}`;
  const entryScriptPath = writeVisibleTerminalBootstrap({
    sessionId: bootstrapId,
    scriptPath: resolvedScript,
    workspacePath: resolvedWorkspace,
  });

  if (process.platform !== "win32") {
    return new Promise((resolve, reject) => {
      const child = require("child_process").spawn(
        "powershell.exe",
        buildPowerShellLaunchArgs(entryScriptPath),
        {
          detached: true,
          stdio: "ignore",
          cwd: resolvedWorkspace,
          windowsHide: false,
        },
      );
      child.on("error", reject);
      child.unref();
      resolve({
        pid: child.pid,
        terminal: "powershell",
        entryScriptPath,
      });
    });
  }

  const { command, terminal } = buildVisibleTerminalSpawnCommand(entryScriptPath, resolvedWorkspace);
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
          entryScriptPath,
        });
      },
    );
  });
}

module.exports = {
  GOOSE_TERMINAL_TITLE,
  escapePowerShellSingleQuoted,
  findWindowsTerminalPathSync,
  buildPowerShellLaunchArgs,
  buildWindowsTerminalCommandLine,
  writeVisibleTerminalBootstrap,
  buildStartProcessCommand,
  buildVisibleTerminalSpawnCommand,
  spawnVisibleGooseTerminal,
};
