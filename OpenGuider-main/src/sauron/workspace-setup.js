const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  resolveVSCodeCommand,
  isVSCodeGuiExecutable,
  deriveCliPathFromGuiExecutable,
} = require("./vscode-launcher");
const { isBridgeMarkerValid } = require("./bridge-install-marker");

const CLINE_EXTENSION_IDS = [
  "saoudrizwan.claude-dev",
  "saoudrizwan.cline-nightly",
];

const BRIDGE_EXTENSION_ID = "sauron-local.sauron-vscode-bridge";
const EXTENSION_LIST_CACHE_MS = 60_000;

const SETUP_STEPS = [
  {
    id: "vscode-cli",
    title: "VS Code CLI (code)",
    docHint: "VS Code → Command Palette → \"Shell Command: Install 'code' command in PATH\"",
  },
  {
    id: "cline",
    title: "Cline extension (Marketplace)",
    docHint: "VS Code Extensions → Cline (saoudrizwan.claude-dev)",
  },
  {
    id: "bridge",
    title: "Sauron VS Code Bridge",
    docHint: "⌘ ile otomatik kurulur veya Settings → Workspace → Bridge'i kur / yenile",
  },
];

let extensionListCache = {
  codeCmd: null,
  extensions: null,
  at: 0,
};

function resolveHeadlessVSCodeCli(codeCmd) {
  const resolved = String(codeCmd || "").trim();
  if (!resolved) {
    return null;
  }
  if (!isVSCodeGuiExecutable(resolved)) {
    return resolved;
  }
  return deriveCliPathFromGuiExecutable(resolved);
}

function listInstalledExtensions(codeCmd, options = {}) {
  const cliPath = resolveHeadlessVSCodeCli(codeCmd);
  if (!cliPath) {
    return [];
  }

  const force = options.force === true;
  const now = Date.now();
  if (
    !force
    && extensionListCache.codeCmd === cliPath
    && Array.isArray(extensionListCache.extensions)
    && (now - extensionListCache.at) < EXTENSION_LIST_CACHE_MS
  ) {
    return extensionListCache.extensions;
  }

  try {
    const result = process.platform === "win32"
      ? execSync(`"${cliPath}" --list-extensions`, {
        encoding: "utf8",
        timeout: 15000,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      })
      : execFileSync(cliPath, ["--list-extensions"], {
        encoding: "utf8",
        timeout: 15000,
        stdio: ["ignore", "pipe", "ignore"],
      });
    const extensions = result
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean);
    extensionListCache = {
      codeCmd: cliPath,
      extensions,
      at: now,
    };
    return extensions;
  } catch {
    return [];
  }
}

function findExtensionMatch(installed, candidates) {
  const normalized = installed.map((id) => id.toLowerCase());
  for (const candidate of candidates) {
    if (normalized.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return null;
}

function checkWorkspacePrerequisites(options = {}) {
  const probeExtensions = options.probeExtensions !== false;
  const codeCmd = resolveVSCodeCommand();
  const headlessCli = resolveHeadlessVSCodeCli(codeCmd);
  const vscodeCli = Boolean(headlessCli && fs.existsSync(headlessCli));
  const installed = vscodeCli && probeExtensions ? listInstalledExtensions(codeCmd) : [];

  const clineMatch = probeExtensions ? findExtensionMatch(installed, CLINE_EXTENSION_IDS) : null;
  const bridgeFromMarker = probeExtensions && isBridgeMarkerValid(BRIDGE_EXTENSION_ID);
  const bridgeMatch = bridgeFromMarker
    ? BRIDGE_EXTENSION_ID
    : (probeExtensions && installed.includes(BRIDGE_EXTENSION_ID.toLowerCase())
      ? BRIDGE_EXTENSION_ID
      : null);

  const steps = SETUP_STEPS.map((step) => {
    if (step.id === "vscode-cli") {
      return {
        ...step,
        ok: vscodeCli,
        detail: vscodeCli ? headlessCli : "code komutu bulunamadı",
      };
    }
    if (step.id === "cline") {
      return {
        ...step,
        ok: probeExtensions ? Boolean(clineMatch) : true,
        detail: !probeExtensions
          ? "Başlangıçta taranmadı"
          : (clineMatch ? `Yüklü: ${clineMatch}` : "Cline extension bulunamadı"),
      };
    }
    if (step.id === "bridge") {
      return {
        ...step,
        ok: probeExtensions ? Boolean(bridgeMatch) : true,
        detail: !probeExtensions
          ? "Başlangıçta taranmadı"
          : (bridgeMatch ? `Yüklü: ${bridgeMatch}` : "Sauron Bridge bulunamadı"),
      };
    }
    return { ...step, ok: false, detail: "" };
  });

  const missingSteps = probeExtensions ? steps.filter((step) => !step.ok) : steps.filter((step) => step.id === "vscode-cli" && !step.ok);
  const warnings = missingSteps.map((step) => step.detail);

  return {
    ok: probeExtensions ? missingSteps.length === 0 : vscodeCli,
    vscodeCli,
    codeCmd: headlessCli || null,
    clineExtension: clineMatch,
    bridgeExtension: bridgeMatch,
    steps,
    warnings,
    canOpenWorkspace: vscodeCli,
    extensionProbeSkipped: !probeExtensions,
    setupGuidePath: path.join(__dirname, "..", "..", "docs", "agent-setup-cline.md"),
  };
}

function resetExtensionListCacheForTests() {
  extensionListCache = {
    codeCmd: null,
    extensions: null,
    at: 0,
  };
}

module.exports = {
  BRIDGE_EXTENSION_ID,
  CLINE_EXTENSION_IDS,
  checkWorkspacePrerequisites,
  listInstalledExtensions,
  resolveHeadlessVSCodeCli,
  resetExtensionListCacheForTests,
};
