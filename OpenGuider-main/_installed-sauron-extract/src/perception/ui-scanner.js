const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { debugLog, DEBUG } = require("../utils/debug-logger");

function log(data) {
  debugLog("UIA", data);
}

// ── UIA Script (written to temp file) ─────────────────────────────────────────
const SCRIPT_DIR = path.join(os.tmpdir(), "openguider-ps");

const UIA_SCRIPT = `
Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue
Add-Type -AssemblyName UIAutomationTypes -ErrorAction SilentlyContinue

\$root = [System.Windows.Automation.AutomationElement]::RootElement
\$isControl = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::IsControlElementProperty, \$true
)
\$notOffscreen = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::IsOffscreenProperty, \$false
)
\$isEnabled = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::IsEnabledProperty, \$true
)
\$condition = New-Object System.Windows.Automation.AndCondition(\$isControl, \$notOffscreen, \$isEnabled)

\$elements = \$root.FindAll([System.Windows.Automation.TreeScope]::Descendants, \$condition)

\$results = @()
\$count = 0
\$maxElements = 5000

foreach (\$el in \$elements) {
  if (\$count -ge \$maxElements) { break }
  try {
    \$name = \$el.Current.Name
    \$rect = \$el.Current.BoundingRectangle
    if ([string]::IsNullOrWhiteSpace(\$name)) { continue }
    if (\$rect.Width -le 0 -or \$rect.Height -le 0) { continue }
    if ([double]::IsInfinity(\$rect.X) -or [double]::IsInfinity(\$rect.Y)) { continue }

    # Sanitize name: strip control characters that break JSON
    \$safeName = \$name -replace '[\\x00-\\x1F\\x7F]', ''
    \$safeAutoId = (\$el.Current.AutomationId) -replace '[\\x00-\\x1F\\x7F]', ''
    \$safeClass = (\$el.Current.ClassName) -replace '[\\x00-\\x1F\\x7F]', ''
    \$safeType = (\$el.Current.LocalizedControlType) -replace '[\\x00-\\x1F\\x7F]', ''

    \$obj = @{
      name = \$safeName
      controlType = \$safeType
      automationId = \$safeAutoId
      className = \$safeClass
      isEnabled = \$el.Current.IsEnabled
      rect = @{
        x = [int]\$rect.X
        y = [int]\$rect.Y
        width = [int]\$rect.Width
        height = [int]\$rect.Height
        x1 = [int](\$rect.X + \$rect.Width)
        y1 = [int](\$rect.Y + \$rect.Height)
      }
    }
    \$results += \$obj
    \$count++
  } catch { }
}

\$results | ConvertTo-Json -Depth 3 -Compress
`;

let uiaScriptPath = null;

function getUiaScriptPath() {
  if (!uiaScriptPath) {
    if (!fs.existsSync(SCRIPT_DIR)) {
      fs.mkdirSync(SCRIPT_DIR, { recursive: true });
    }
    uiaScriptPath = path.join(SCRIPT_DIR, "uia-query.ps1");
    try {
      if (fs.existsSync(uiaScriptPath) && fs.readFileSync(uiaScriptPath, "utf8") === UIA_SCRIPT) {
        return uiaScriptPath;
      }
    } catch (_) {}
    fs.writeFileSync(uiaScriptPath, UIA_SCRIPT, "utf8");
  }
  return uiaScriptPath;
}

async function queryUIAutomation() {
  log(`Querying UI Automation (all desktop elements, max 5000)...`);
  return new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", getUiaScriptPath()],
      { maxBuffer: 1024 * 1024 * 10, timeout: 25000 },
      (err, stdout, stderr) => {
        if (err) {
          log(`Query failed: ${err.message}`);
          resolve([]);
          return;
        }
        try {
          let trimmed = (stdout || "").trim();
          if (!trimmed || trimmed === "null" || trimmed === "") {
            log("No elements found");
            resolve([]);
            return;
          }
          // Strip control characters that break JSON.parse
          // eslint-disable-next-line no-control-regex
          trimmed = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
          const parsed = JSON.parse(trimmed);
          const elements = Array.isArray(parsed) ? parsed : [parsed];
          const filtered = elements.filter((e) => e.name && e.rect);
          log(`Found ${filtered.length} UI elements`);
          resolve(filtered);
        } catch (e) {
          log(`Parse error: ${e.message}`);
          resolve([]);
        }
      }
    );
  });
}

function calculateElementCenter(rect) {
  if (!rect) return null;
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2),
  };
}

function isWithinBounds(coordinate, rect, tolerance = 50) {
  if (!coordinate || !rect) return false;
  const { x, y } = coordinate;
  const x1 = rect.x1 !== undefined ? rect.x1 : rect.x + rect.width;
  const y1 = rect.y1 !== undefined ? rect.y1 : rect.y + rect.height;
  return (
    x >= rect.x - tolerance &&
    x <= x1 + tolerance &&
    y >= rect.y - tolerance &&
    y <= y1 + tolerance
  );
}

function snapToNearestElement(coordinate, elements, tolerance = 50) {
  if (!coordinate || !elements || elements.length === 0) return null;
  let nearest = null;
  let nearestDist = Infinity;
  for (const element of elements) {
    const center = calculateElementCenter(element.rect);
    if (!center) continue;
    const dx = coordinate.x - center.x;
    const dy = coordinate.y - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist && dist <= tolerance) {
      nearestDist = dist;
      nearest = {
        element,
        snappedCoordinate: center,
        distance: nearestDist,
      };
    }
  }
  return nearest;
}

function findMatchingElements(targetLabel, elements, fuzzy = true) {
  if (!targetLabel || !elements || elements.length === 0) return [];
  const lowerTarget = targetLabel.toLowerCase();
  const matches = [];
  for (const element of elements) {
    const name = (element.name || "").toLowerCase();
    const controlType = (element.controlType || "").toLowerCase();
    const automationId = (element.automationId || "").toLowerCase();
    
    if (fuzzy) {
      // Much safer fuzzy matching to prevent snapping LLM coordinate to random garbage
      const matchesSubtring = name.includes(lowerTarget) || controlType.includes(lowerTarget) || automationId.includes(lowerTarget);
      // reversed substring matching is dangerous if name is very short (e.g. name="A", lowerTarget="Postman")
      const matchesReversed = name.length >= 4 && lowerTarget.includes(name);

      if (matchesSubtring || matchesReversed) {
        matches.push(element);
      }
    } else {
      if (name === lowerTarget || controlType === lowerTarget) {
        matches.push(element);
      }
    }
  }
  return matches;
}

module.exports = {
  queryUIAutomation,
  calculateElementCenter,
  isWithinBounds,
  snapToNearestElement,
  findMatchingElements,
};