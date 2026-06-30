const fs = require("fs");
const path = require("path");

const VSCODE_DIR = ".vscode";
const SETTINGS_FILE = "settings.json";

const CHANNEL_VSCODE_THEMES = {
  workspace: {
    titlePrefix: "⌘ ÇALIŞMA",
    shortLabel: "Çalışma Kısmı",
    accentName: "TURUNCU",
    statusBarBackground: "#7c2d12",
    statusBarForeground: "#fff7ed",
    titleBarBackground: "#9a3412",
    titleBarForeground: "#ffffff",
    activityBarBackground: "#5c1f0f",
    bannerLine: "Alt çubuk **turuncu** = Çalışma Kısmı (Cline + Bridge)",
  },
  gamedev: {
    titlePrefix: "🎮 GAME DEV",
    shortLabel: "Game Dev",
    accentName: "MOR",
    statusBarBackground: "#581c87",
    statusBarForeground: "#f3e8ff",
    titleBarBackground: "#6b21a8",
    titleBarForeground: "#ffffff",
    activityBarBackground: "#3b0764",
    bannerLine: "Alt çubuk **mor** = Game Dev (Unity MCP + pipeline)",
  },
};

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildColorCustomizations(theme) {
  return {
    "statusBar.background": theme.statusBarBackground,
    "statusBar.foreground": theme.statusBarForeground,
    "statusBar.noFolderBackground": theme.statusBarBackground,
    "statusBar.debuggingBackground": theme.statusBarBackground,
    "statusBarItem.remoteBackground": theme.titleBarBackground,
    "titleBar.activeBackground": theme.titleBarBackground,
    "titleBar.activeForeground": theme.titleBarForeground,
    "titleBar.inactiveBackground": theme.activityBarBackground,
    "titleBar.inactiveForeground": theme.statusBarForeground,
    "activityBar.background": theme.activityBarBackground,
    "activityBar.foreground": theme.statusBarForeground,
    "activityBar.inactiveForeground": theme.statusBarForeground,
  };
}

function applyChannelVSCodeTheme(workspacePath, channel, meta = {}) {
  const theme = CHANNEL_VSCODE_THEMES[channel] || CHANNEL_VSCODE_THEMES.workspace;
  const resolved = path.resolve(String(workspacePath || "").trim());
  if (!resolved) {
    return { ok: false, error: "Workspace path is required." };
  }

  const vscodeDir = path.join(resolved, VSCODE_DIR);
  const settingsPath = path.join(vscodeDir, SETTINGS_FILE);
  fs.mkdirSync(vscodeDir, { recursive: true });

  const existing = readJsonFile(settingsPath) || {};
  const engineSuffix = channel === "gamedev" && meta.engineLabel
    ? ` · ${meta.engineLabel}`
    : "";

  const merged = {
    ...existing,
    "window.title": `\${dirty}\${activeEditorShort}\${separator}${theme.titlePrefix}${engineSuffix}\${separator}\${rootName}`,
    "workbench.colorCustomizations": buildColorCustomizations(theme),
    "sauron.activeChannel": channel,
    "sauron.channelLabel": theme.shortLabel,
    "sauron.channelAccent": theme.accentName,
  };

  fs.writeFileSync(settingsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return { ok: true, settingsPath, theme };
}

function getChannelThemeBanner(channel) {
  const theme = CHANNEL_VSCODE_THEMES[channel] || CHANNEL_VSCODE_THEMES.workspace;
  return theme.bannerLine;
}

module.exports = {
  CHANNEL_VSCODE_THEMES,
  applyChannelVSCodeTheme,
  getChannelThemeBanner,
};
