const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveVSCodeCommand } = require("./handoff");

const CLINE_EXTENSION_IDS = [
  "saoudrizwan.claude-dev",
  "saoudrizwan.cline-nightly",
];

const BRIDGE_EXTENSION_ID = "sauron-local.sauron-vscode-bridge";

const SETUP_STEPS = [
  {
    id: "vscode-cli",
    title: "VS Code CLI (code)",
    docHint: "VS Code → Command Palette → \"Shell Command: Install 'code' command in PATH\"",
  },
  {
    id: "cline",
    title: "Cline extension (fork önerilir)",
    docHint: "cline-main/apps/vscode derleyip yükleyin veya Marketplace Cline + PATCHES.md",
  },
  {
    id: "bridge",
    title: "Sauron VS Code Bridge",
    docHint: "sauron-vscode-bridge → npm run compile → VS Code'da Run Extension veya .vsix",
  },
];

function listInstalledExtensions(codeCmd) {
  if (!codeCmd) {
    return [];
  }
  try {
    const result = execFileSync(codeCmd, ["--list-extensions"], {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["ignore", "pipe", "ignore"],
      shell: process.platform === "win32",
    });
    return result
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean);
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

function checkWorkspacePrerequisites() {
  const codeCmd = resolveVSCodeCommand();
  const vscodeCli = Boolean(codeCmd && fs.existsSync(codeCmd));
  const installed = vscodeCli ? listInstalledExtensions(codeCmd) : [];

  const clineMatch = findExtensionMatch(installed, CLINE_EXTENSION_IDS);
  const bridgeMatch = installed.includes(BRIDGE_EXTENSION_ID.toLowerCase())
    ? BRIDGE_EXTENSION_ID
    : null;

  const steps = SETUP_STEPS.map((step) => {
    if (step.id === "vscode-cli") {
      return {
        ...step,
        ok: vscodeCli,
        detail: vscodeCli ? codeCmd : "code komutu bulunamadı",
      };
    }
    if (step.id === "cline") {
      return {
        ...step,
        ok: Boolean(clineMatch),
        detail: clineMatch ? `Yüklü: ${clineMatch}` : "Cline extension bulunamadı",
      };
    }
    if (step.id === "bridge") {
      return {
        ...step,
        ok: Boolean(bridgeMatch),
        detail: bridgeMatch ? `Yüklü: ${bridgeMatch}` : "Sauron Bridge bulunamadı",
      };
    }
    return { ...step, ok: false, detail: "" };
  });

  const missingSteps = steps.filter((step) => !step.ok);
  const warnings = missingSteps.map((step) => step.detail);

  return {
    ok: missingSteps.length === 0,
    vscodeCli,
    codeCmd: codeCmd || null,
    clineExtension: clineMatch,
    bridgeExtension: bridgeMatch,
    steps,
    warnings,
    canOpenWorkspace: vscodeCli,
    setupGuidePath: path.join(__dirname, "..", "..", "docs", "agent-setup-cline.md"),
  };
}

module.exports = {
  BRIDGE_EXTENSION_ID,
  CLINE_EXTENSION_IDS,
  checkWorkspacePrerequisites,
  listInstalledExtensions,
};
