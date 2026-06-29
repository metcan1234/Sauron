const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SCRIPT_DIR = path.join(os.tmpdir(), "openguider-ps");
const POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 20000;
const ZOMBIE_GRACE_MS = 5000;
const POST_VERIFY_GRACE_MS = 30000;
const STABLE_WINDOW_MS = 1000;

const VSCODE_PROCESS_SCRIPT = `
$withWindow = Get-Process -Name Code -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Sort-Object MainWindowHandle -Descending |
  Select-Object -First 1
if ($withWindow) {
  @{
    running = $true
    pid = [int]$withWindow.Id
    hwnd = [int64]$withWindow.MainWindowHandle
    hasWindow = $true
    title = $withWindow.MainWindowTitle
  } | ConvertTo-Json -Compress
  return
}
$procs = Get-Process -Name Code -ErrorAction SilentlyContinue
if ($procs) {
  $target = $procs | Sort-Object StartTime -Descending | Select-Object -First 1
  @{
    running = $true
    pid = [int]$target.Id
    hwnd = [int64]$target.MainWindowHandle
    hasWindow = ($target.MainWindowHandle -ne 0)
    title = $target.MainWindowTitle
  } | ConvertTo-Json -Compress
  return
}
@{ running = $false } | ConvertTo-Json -Compress
`;

const BRING_TO_FOREGROUND_SCRIPT = `
param([long]$Hwnd = 0)

Add-Type -ErrorAction SilentlyContinue @"
using System;
using System.Runtime.InteropServices;
public class OGVSCodeFocus {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@

$targetHwnd = [IntPtr]$Hwnd
if ($targetHwnd -eq [IntPtr]::Zero) {
  $proc = Get-Process -Name Code -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Sort-Object MainWindowHandle -Descending |
    Select-Object -First 1
  if (-not $proc) {
    @{ ok = $false; reason = "no_window" } | ConvertTo-Json -Compress
    return
  }
  $targetHwnd = $proc.MainWindowHandle
}

if ([OGVSCodeFocus]::IsIconic($targetHwnd)) {
  [OGVSCodeFocus]::ShowWindow($targetHwnd, 9) | Out-Null
} else {
  [OGVSCodeFocus]::ShowWindow($targetHwnd, 5) | Out-Null
}
$focused = [OGVSCodeFocus]::SetForegroundWindow($targetHwnd)
@{ ok = [bool]$focused; hwnd = [int64]$targetHwnd } | ConvertTo-Json -Compress
`;

function buildTerminateScript(graceSeconds) {
  return `
$withWindow = Get-Process -Name Code -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -First 1
if ($withWindow) {
  @{ terminated = $false; reason = "window_visible" } | ConvertTo-Json -Compress
  return
}
$all = @(Get-Process -Name Code -ErrorAction SilentlyContinue)
if ($all.Count -eq 0) {
  @{ terminated = $false; count = 0; reason = "no_processes" } | ConvertTo-Json -Compress
  return
}
$cutoff = (Get-Date).AddSeconds(-${graceSeconds})
$newest = $all | Sort-Object StartTime -Descending | Select-Object -First 1
$newestInGrace = $false
try {
  $newestInGrace = ($newest.StartTime -gt $cutoff)
} catch {
  $newestInGrace = $false
}
if ($newestInGrace) {
  @{ terminated = $false; count = 0; reason = "startup_grace_or_no_stale" } | ConvertTo-Json -Compress
  return
}
$count = $all.Count
$all | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 700
@{ terminated = $true; count = $count; reason = "terminated_full_instance" } | ConvertTo-Json -Compress
`;
}

const VSCODE_COUNT_SCRIPT = `
$procs = @(Get-Process -Name Code -ErrorAction SilentlyContinue)
$withWindow = @($procs | Where-Object { $_.MainWindowHandle -ne 0 })
@{
  total = $procs.Count
  withWindow = $withWindow.Count
  zombies = [Math]::Max(0, $procs.Count - $withWindow.Count)
} | ConvertTo-Json -Compress
`;

function ensureScriptDir() {
  if (!fs.existsSync(SCRIPT_DIR)) {
    fs.mkdirSync(SCRIPT_DIR, { recursive: true });
  }
}

function writeScriptFile(name, content) {
  ensureScriptDir();
  const filePath = path.join(SCRIPT_DIR, name);
  try {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) {
      return filePath;
    }
  } catch {
    // ignore read errors
  }
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

let processScriptPath = null;
let foregroundScriptPath = null;
let terminateScriptPath = null;
let countScriptPath = null;

function getProcessScriptPath() {
  if (!processScriptPath) {
    processScriptPath = writeScriptFile("vscode-process.ps1", VSCODE_PROCESS_SCRIPT);
  }
  return processScriptPath;
}

function getForegroundScriptPath() {
  if (!foregroundScriptPath) {
    foregroundScriptPath = writeScriptFile("vscode-foreground.ps1", BRING_TO_FOREGROUND_SCRIPT);
  }
  return foregroundScriptPath;
}

function getTerminateScriptPath() {
  if (!terminateScriptPath) {
    terminateScriptPath = writeScriptFile(
      "vscode-cleanup.ps1",
      buildTerminateScript(Math.ceil(ZOMBIE_GRACE_MS / 1000)),
    );
  }
  return terminateScriptPath;
}

function getCountScriptPath() {
  if (!countScriptPath) {
    countScriptPath = writeScriptFile("vscode-count.ps1", VSCODE_COUNT_SCRIPT);
  }
  return countScriptPath;
}

function runPowerShellFile(scriptPath, extraArgs = []) {
  if (process.platform !== "win32") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        ...extraArgs,
      ],
      { maxBuffer: 1024 * 1024, timeout: 10000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        const trimmed = (stdout || "").trim();
        if (!trimmed || trimmed === "null") {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(trimmed));
        } catch {
          resolve(null);
        }
      },
    );
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getVSCodeProcessState() {
  const result = await runPowerShellFile(getProcessScriptPath());
  if (!result || !result.running) {
    return { running: false, pid: null, hwnd: 0, hasWindow: false, title: "" };
  }
  return {
    running: true,
    pid: result.pid || null,
    hwnd: result.hwnd || 0,
    hasWindow: Boolean(result.hasWindow),
    title: String(result.title || ""),
  };
}

async function isVSCodeProcessRunning() {
  const state = await getVSCodeProcessState();
  return state.running;
}

async function hasVisibleVSCodeWindow() {
  const state = await getVSCodeProcessState();
  return state.hasWindow;
}

async function waitForStableVSCodeWindow({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  stableMs = STABLE_WINDOW_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  let lastState = { running: false, pid: null, hwnd: 0, hasWindow: false, title: "" };

  while (Date.now() < deadline) {
    lastState = await getVSCodeProcessState();
    if (lastState.hasWindow) {
      if (!stableSince) {
        stableSince = Date.now();
      }
      if (Date.now() - stableSince >= stableMs) {
        return {
          ok: true,
          verified: true,
          verificationReason: "window_stable",
          pid: lastState.pid,
          hwnd: lastState.hwnd,
          title: lastState.title,
        };
      }
    } else {
      stableSince = 0;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (lastState.hasWindow) {
    return {
      ok: true,
      verified: true,
      verificationReason: "window_found",
      pid: lastState.pid,
      hwnd: lastState.hwnd,
      title: lastState.title,
    };
  }

  if (lastState.running) {
    return {
      ok: false,
      verified: false,
      verificationReason: "process_only",
      pid: lastState.pid,
      hwnd: lastState.hwnd,
      title: lastState.title,
    };
  }

  return {
    ok: false,
    verified: false,
    verificationReason: "timeout",
    pid: null,
    hwnd: 0,
    title: "",
  };
}

async function waitForVSCodeWindow({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastState = { running: false, pid: null, hwnd: 0, hasWindow: false, title: "" };

  while (Date.now() < deadline) {
    lastState = await getVSCodeProcessState();
    if (lastState.hasWindow) {
      return {
        ok: true,
        verified: true,
        verificationReason: "window_found",
        pid: lastState.pid,
        hwnd: lastState.hwnd,
        title: lastState.title,
      };
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (lastState.running) {
    return {
      ok: false,
      verified: false,
      verificationReason: "process_only",
      pid: lastState.pid,
      hwnd: lastState.hwnd,
      title: lastState.title,
    };
  }

  return {
    ok: false,
    verified: false,
    verificationReason: "timeout",
    pid: null,
    hwnd: 0,
    title: "",
  };
}

async function getVSCodeProcessCounts() {
  if (process.platform !== "win32") {
    return { total: 0, withWindow: 0, zombies: 0 };
  }
  const result = await runPowerShellFile(getCountScriptPath());
  return {
    total: Number(result?.total) || 0,
    withWindow: Number(result?.withWindow) || 0,
    zombies: Number(result?.zombies) || 0,
  };
}

async function terminateVSCodeIfNoVisibleWindow() {
  if (process.platform !== "win32") {
    return { terminated: false, reason: "non_windows" };
  }

  const state = await getVSCodeProcessState();
  if (state.hasWindow) {
    return { terminated: false, reason: "window_visible" };
  }

  const result = await runPowerShellFile(getTerminateScriptPath());
  return {
    terminated: Boolean(result?.terminated),
    count: result?.count || 0,
    reason: result?.reason || "unknown",
  };
}

async function bringVSCodeToForeground(hwnd = 0) {
  const args = hwnd ? ["-Hwnd", String(hwnd)] : [];
  const result = await runPowerShellFile(getForegroundScriptPath(), args);
  if (!result) {
    return { ok: false, reason: "script_failed" };
  }
  return {
    ok: Boolean(result.ok),
    hwnd: result.hwnd || hwnd || 0,
    reason: result.ok ? "focused" : "focus_denied",
  };
}

async function verifyAndFocusVSCode({ timeoutMs = DEFAULT_TIMEOUT_MS, retryFocus = true } = {}) {
  let waitResult = await waitForStableVSCodeWindow({ timeoutMs });

  if (waitResult.verified) {
    const focusResult = await bringVSCodeToForeground(waitResult.hwnd);
    return {
      ...waitResult,
      focused: focusResult.ok,
      focusReason: focusResult.reason,
    };
  }

  if (retryFocus) {
    const focusResult = await bringVSCodeToForeground();
    if (focusResult.ok && focusResult.hwnd) {
      return {
        ok: true,
        verified: true,
        verificationReason: "focus_restored",
        pid: waitResult.pid,
        hwnd: focusResult.hwnd,
        title: waitResult.title,
        focused: true,
        focusReason: focusResult.reason,
      };
    }
  }

  return {
    ...waitResult,
    focused: false,
    focusReason: waitResult.verificationReason,
  };
}

function resetScriptCacheForTests() {
  processScriptPath = null;
  foregroundScriptPath = null;
  terminateScriptPath = null;
  countScriptPath = null;
}

module.exports = {
  POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  ZOMBIE_GRACE_MS,
  POST_VERIFY_GRACE_MS,
  getVSCodeProcessState,
  getVSCodeProcessCounts,
  isVSCodeProcessRunning,
  hasVisibleVSCodeWindow,
  STABLE_WINDOW_MS,
  sleep,
  waitForStableVSCodeWindow,
  waitForVSCodeWindow,
  bringVSCodeToForeground,
  verifyAndFocusVSCode,
  terminateVSCodeIfNoVisibleWindow,
  resetScriptCacheForTests,
};
