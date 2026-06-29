const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const UIA_PS_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$el = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($null -eq $el) { exit 1 }
$rect = $el.Current.BoundingRectangle
if ($rect.Width -le 0 -or $rect.Height -le 0) { exit 2 }
Write-Output ("{0}|{1}|{2}|{3}" -f [int]$rect.X, [int]$rect.Y, [int]$rect.Width, [int]$rect.Height)
`.trim();

function isWindowsPlatform() {
  return process.platform === "win32";
}

async function getFocusedElementBounds(options = {}) {
  if (!isWindowsPlatform()) {
    return null;
  }
  if (options.enabled === false) {
    return null;
  }

  const timeoutMs = Number(options.timeoutMs) || 2500;
  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", UIA_PS_SCRIPT],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 64 },
    );
    const line = String(stdout || "").trim().split(/\r?\n/).pop();
    const parts = String(line || "").split("|").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
      return null;
    }
    const [x, y, width, height] = parts;
    return {
      x,
      y,
      width,
      height,
      centerX: x + Math.round(width / 2),
      centerY: y + Math.round(height / 2),
    };
  } catch {
    return null;
  }
}

function blendPointerWithUia(pointer, uiaBounds, sourceWidth = 1000, sourceHeight = 1000) {
  if (!pointer || !uiaBounds) {
    return pointer;
  }
  const llmX = Number(pointer.x);
  const llmY = Number(pointer.y);
  if (!Number.isFinite(llmX) || !Number.isFinite(llmY)) {
    return pointer;
  }

  let normX = llmX;
  let normY = llmY;
  if (llmX > 0 && llmX <= 1 && llmY > 0 && llmY <= 1) {
    normX = llmX * sourceWidth;
    normY = llmY * sourceHeight;
  }

  const uiaNormX = ((uiaBounds.centerX - uiaBounds.x) / Math.max(1, uiaBounds.width)) * sourceWidth;
  const uiaNormY = ((uiaBounds.centerY - uiaBounds.y) / Math.max(1, uiaBounds.height)) * sourceHeight;

  const blendedX = Math.round((normX * 0.45) + (uiaNormX * 0.55));
  const blendedY = Math.round((normY * 0.45) + (uiaNormY * 0.55));

  return {
    ...pointer,
    x: Math.max(0, Math.min(sourceWidth, blendedX)),
    y: Math.max(0, Math.min(sourceHeight, blendedY)),
    uiaAssisted: true,
  };
}

module.exports = {
  blendPointerWithUia,
  getFocusedElementBounds,
  isWindowsPlatform,
};
