const fs = require("fs");
const path = require("path");
const {
  resolveVSCodeExecutable,
  focusExistingVSCodeWindow,
  isWithinSpawnCooldown,
  launchVSCode,
  toShortPath,
} = require("./vscode-launcher");
const vscodeWindowFocus = require("./vscode-window-focus");
const { applyChannelVSCodeTheme, getChannelThemeBanner } = require("./channel-vscode-theme");

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
  const banner = getChannelThemeBanner(channel);
  if (channel === "gamedev") {
    const engine = meta.engineLabel || meta.engine || "Unity";
    return `# 🟪 GAME DEV AKTİF

> ${banner}
> Yanlış moddaysan Sauron panelinde diğer kanala geç.

---

Bu VS Code penceresi **Sauron Game Dev** (${engine}) tarafindan acildi.

- Cline + gamedev-all-in-one MCP ile oyun gelistirme
- Oyun planini SAURON panelinden gonder
- Dashboard: http://127.0.0.1:3100
- **Sol alttaki çubuk mor olmali** — turuncu ise Çalışma Kısmı açıktır

Bu dosya hangi modun acik oldugunu gosterir; istedigin zaman kapatabilirsin.
`;
  }

  const handoffHint = meta.handoffFileName
    ? `\n- Son handoff: \`${meta.handoffFileName}\`\n`
    : "\n";

  return `# 🟧 ÇALIŞMA KISMI AKTİF

> ${banner}
> Yanlış moddaysan Sauron panelinde 🎮 Game Dev'e geç.

---

Bu VS Code penceresi **Sauron Calisma Kismi** (Cline + Bridge) tarafindan acildi.

- Handoff gorevleri Cline sidebar'da gorunur
- Bridge extension gorevi yukler
${handoffHint}
- **Sol alttaki çubuk turuncu olmali** — mor ise Game Dev açıktır

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

  applyChannelVSCodeTheme(resolved, channel, meta);

  return {
    welcomePath,
    additionalPaths: [welcomePath],
    marker,
  };
}

async function revealWelcomeFile(workspacePath, channel, meta = {}, existingPrep = null) {
  const prep = existingPrep || prepareChannelVSCode(workspacePath, channel, meta);
  const resolved = path.resolve(workspacePath);

  const focused = await focusExistingVSCodeWindow(resolved, {
    verifyTimeoutMs: 3000,
    skipPostVerifySettle: true,
  });
  if (focused?.verified) {
    return prep;
  }

  const state = await vscodeWindowFocus.getVSCodeProcessState();
  if (state.hasWindow || state.running || isWithinSpawnCooldown()) {
    return prep;
  }

  const executable = resolveVSCodeExecutable();
  if (!executable) {
    return prep;
  }

  try {
    await launchVSCode(resolved, {
      newWindow: false,
      skipRecovery: true,
      skipInterProfileRecovery: true,
      launchProfiles: [{ profile: "default", extraArgs: [] }],
      requireWindowVerification: false,
      skipVerification: true,
    });
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
