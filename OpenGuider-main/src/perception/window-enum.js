const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { screen } = require("electron");
const { debugLog, DEBUG } = require("../utils/debug-logger");

// ── Script file caching ──────────────────────────────────────────────────────
// Write PowerShell scripts to temp files ONCE and reuse them.
const SCRIPT_DIR = path.join(os.tmpdir(), "openguider-ps");

function ensureScriptDir() {
  if (!fs.existsSync(SCRIPT_DIR)) {
    fs.mkdirSync(SCRIPT_DIR, { recursive: true });
  }
}

function writeScriptFile(name, content) {
  ensureScriptDir();
  const filePath = path.join(SCRIPT_DIR, name);
  // Only write if file doesn't exist or content changed
  try {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) {
      return filePath;
    }
  } catch (_) { }
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

// ── PowerShell scripts ───────────────────────────────────────────────────────

const ENUM_WINDOWS_SCRIPT = `
Add-Type -ErrorAction SilentlyContinue @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class OGWin32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

\$results = @()
[OGWin32]::EnumWindows({
  param(\$hWnd, \$lParam)
  if (-not [OGWin32]::IsWindowVisible(\$hWnd)) { return \$true }
  \$len = [OGWin32]::GetWindowTextLength(\$hWnd)
  if (\$len -eq 0) { return \$true }
  \$sb = New-Object System.Text.StringBuilder(\$len + 1)
  [OGWin32]::GetWindowText(\$hWnd, \$sb, \$sb.Capacity) | Out-Null
  \$title = \$sb.ToString()
  if ([string]::IsNullOrWhiteSpace(\$title)) { return \$true }
  \$csb = New-Object System.Text.StringBuilder(256)
  [OGWin32]::GetClassName(\$hWnd, \$csb, 256) | Out-Null
  \$cn = \$csb.ToString()
  if (\$cn -eq "IME" -or \$cn -eq "MSCTFIME UI") { return \$true }
  \$pid = 0
  [OGWin32]::GetWindowThreadProcessId(\$hWnd, [ref]\$pid) | Out-Null
  \$r = New-Object OGWin32+RECT
  [OGWin32]::GetWindowRect(\$hWnd, [ref]\$r) | Out-Null
  \$min = [OGWin32]::IsIconic(\$hWnd)
  # Sanitize title for JSON safety
  \$title = \$title -replace '[\\x00-\\x1F]', ''
  \$script:results += @{
    hwnd = \$hWnd.ToInt64()
    title = \$title
    pid = [int]\$pid
    className = \$cn
    minimized = \$min
    rect = @{ x = \$r.Left; y = \$r.Top; width = \$r.Right - \$r.Left; height = \$r.Bottom - \$r.Top }
  }
  return \$true
}, [IntPtr]::Zero) | Out-Null

\$results | ConvertTo-Json -Depth 3 -Compress
`;

const FOCUSED_WINDOW_SCRIPT = `
Add-Type -ErrorAction SilentlyContinue @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class OGFocus {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

\$hwnd = [OGFocus]::GetForegroundWindow()
if (\$hwnd -eq [IntPtr]::Zero) { return }
\$len = [OGFocus]::GetWindowTextLength(\$hwnd)
\$title = ""
if (\$len -gt 0) {
  \$sb = New-Object System.Text.StringBuilder(\$len + 1)
  [OGFocus]::GetWindowText(\$hwnd, \$sb, \$sb.Capacity) | Out-Null
  \$title = \$sb.ToString() -replace '[\\x00-\\x1F]', ''
}
\$pid = 0
[OGFocus]::GetWindowThreadProcessId(\$hwnd, [ref]\$pid) | Out-Null
\$r = New-Object OGFocus+RECT
[OGFocus]::GetWindowRect(\$hwnd, [ref]\$r) | Out-Null
@{
  hwnd = \$hwnd.ToInt64()
  title = \$title
  pid = [int]\$pid
  rect = @{ x = \$r.Left; y = \$r.Top; width = \$r.Right - \$r.Left; height = \$r.Bottom - \$r.Top }
} | ConvertTo-Json -Depth 3 -Compress
`;

// ── Script file paths (lazy initialized) ──────────────────────────────────────
let enumScriptPath = null;
let focusedScriptPath = null;

function getEnumScriptPath() {
  if (!enumScriptPath) {
    enumScriptPath = writeScriptFile("enum-windows.ps1", ENUM_WINDOWS_SCRIPT);
  }
  return enumScriptPath;
}

function getFocusedScriptPath() {
  if (!focusedScriptPath) {
    focusedScriptPath = writeScriptFile("focused-window.ps1", FOCUSED_WINDOW_SCRIPT);
  }
  return focusedScriptPath;
}

// ── PowerShell runner ─────────────────────────────────────────────────────────
function runPowerShellFile(scriptPath) {
  return new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { maxBuffer: 1024 * 1024 * 5, timeout: 8000 },
      (err, stdout, stderr) => {
        if (err) {
          if (DEBUG) debugLog("WindowEnum", `PS error: ${err.message}`);
          resolve(null);
          return;
        }
        const trimmed = (stdout || "").trim();
        if (!trimmed || trimmed === "null" || trimmed === "") {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(trimmed));
        } catch (e) {
          if (DEBUG) debugLog("WindowEnum", `JSON parse error: ${e.message}, raw[0..200]: ${trimmed.substring(0, 200)}`);
          resolve(null);
        }
      }
    );
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getActiveWindows() {
  if (DEBUG) debugLog("WindowEnum", "Enumerating via EnumWindows...");
  const result = await runPowerShellFile(getEnumScriptPath());
  if (!result) {
    if (DEBUG) debugLog("WindowEnum", "No windows found");
    return [];
  }
  const windows = Array.isArray(result) ? result : [result];
  if (DEBUG) debugLog("WindowEnum", `Found ${windows.length} windows`);
  return windows;
}

async function getFocusedWindow() {
  if (DEBUG) debugLog("WindowEnum", "Getting focused window...");
  const result = await runPowerShellFile(getFocusedScriptPath());
  if (result) {
    if (DEBUG) debugLog("WindowEnum", `Focused: "${result.title}" hwnd=${result.hwnd}`);
  } else {
    if (DEBUG) debugLog("WindowEnum", "No focused window");
  }
  return result;
}

function getCursorPosition() {
  try {
    const point = screen.getCursorScreenPoint();
    if (DEBUG) debugLog("WindowEnum", `Cursor: (${point.x}, ${point.y})`);
    return point;
  } catch (e) {
    if (DEBUG) debugLog("WindowEnum", `Cursor API error: ${e.message}`);
    return { x: 0, y: 0 };
  }
}

async function enumerateActiveApp() {
  const [focused, windows] = await Promise.all([
    getFocusedWindow(),
    getActiveWindows(),
  ]);
  const cursor = getCursorPosition();
  return {
    focusedWindow: focused,
    windows: windows.slice(0, 30),
    cursorPosition: cursor,
  };
}

module.exports = {
  getActiveWindows,
  getFocusedWindow,
  getCursorPosition,
  enumerateActiveApp,
};