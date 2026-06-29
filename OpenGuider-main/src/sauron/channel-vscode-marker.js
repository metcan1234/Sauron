const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { resolveVSCodeCommand, toShortPath } = require("./vscode-launcher");

const CHANNEL_FILES = {
  workspace: "CHANNEL-WORKSPACE.md",
  gamedev: "CHANNEL-GAMEDEV.md",
};

const CHANNEL_LABELS = {
  workspace: "Çalışma Kısmı · Cline",
  gamedev: "Game Dev",
};

function pathForLaunch(targetPath) {
  const resolved = path.resolve(targetPath);
  if (process.platform === "win32" && /[^\x00-\x7F]/.test(resolved)) {
    return toShortPath(resolved);
  }
  return resolved;
}

function ensureSauronDir(workspacePath) {
  const dir = path.join(workspacePath, ".sauron");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildWelcomeContent(channel, meta = {}) {
  if (channel === "gamedev") {
    const engine = meta.engineLabel || meta.engine || "Unity";
    return `# Game Dev modu aktif

Bu VS Code penceresi **Sauron Game Dev** (${engine}) tarafindan acildi.

- Cline + gamedev-all-in-one MCP ile oyun gelistirme
- Oyun planini SAURON panelinden gonder
- Dashboard: http://127.0.0.1:3100

Bu dosya hangi modun acik oldugunu gosterir; istedigin zaman kapatabilirsin.
`;
  }

  const handoffHint = meta.handoffFileName
    ? `\n- Son handoff: \`${meta.handoffFileName}\`\n`
    : "\n";

  return `# Calisma Kismi aktif

Bu VS Code penceresi **Sauron Calisma Kismi** (Cline + Bridge) tarafindan acildi.

- Handoff gorevleri Cline sidebar'da gorunur
- Bridge extension gorevi yukler
${handoffHint}
Bu dosya hangi modun acik oldugunu gosterir; istedigin zaman kapatabilirsin.
`;
}

function prepareChannelVSCode(workspacePath, channel, meta = {}) {
  const resolved = path.resolve(workspacePath);
  const sauronDir = ensureSauronDir(resolved);
  const fileName = CHANNEL_FILES[channel] || CHANNEL_FILES.workspace;
  const welcomePath = path.join(sauronDir, fileName);

  fs.writeFileSync(welcomePath, buildWelcomeContent(channel, meta), "utf8");

  const marker = {
    channel,
    label: CHANNEL_LABELS[channel] || channel,
    ...meta,
    welcomeFile: fileName,
    openedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(sauronDir, "active-channel.json"),
    `${JSON.stringify(marker, null, 2)}\n`,
    "utf8",
  );

  return {
    welcomePath,
    additionalPaths: [welcomePath],
    marker,
  };
}

function revealWelcomeFile(workspacePath, channel, meta = {}) {
  const prep = prepareChannelVSCode(workspacePath, channel, meta);
  const code = resolveVSCodeCommand();
  if (!code) {
    return prep;
  }

  const file = pathForLaunch(prep.welcomePath);
  try {
    const child = spawn(code, ["-r", "-g", file], {
      detached: true,
      stdio: "ignore",
      shell: String(code).toLowerCase().endsWith(".cmd"),
      windowsHide: true,
    });
    child.unref();
  } catch {
    // non-fatal
  }
  return prep;
}

module.exports = {
  CHANNEL_FILES,
  CHANNEL_LABELS,
  prepareChannelVSCode,
  revealWelcomeFile,
  pathForLaunch,
};
