const fs = require("fs");
const path = require("path");
const { probeGamedevMcpEntry } = require("./gamedev-path-resolver");
const { getGamedevStatus } = require("./gamedev-status");
const { detectWorkspaceLayout } = require("./workspace-detector");
const {
  GAMEDEV_ENGINE_LABELS,
  normalizeGamedevEngine,
  GAMEDEV_ENGINE_PORTS,
} = require("./gamedev-config");

const UNITY_BRIDGE_PACKAGE_URL = "https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main";

function appendGamedevChecks(checks, store, settings = {}) {
  const push = (entry) => checks.push({ tier: "optional", ...entry });

  if (settings.gamedevEnabled === false) {
    push({
      id: "gamedev-enabled",
      status: "pass",
      message: "Game Dev devre dışı (atlandı)",
      fixHint: "",
    });
    return;
  }

  push({
    id: "gamedev-enabled",
    status: "pass",
    message: "Game Dev modu etkin",
    fixHint: "",
  });

  const probe = probeGamedevMcpEntry(settings);
  if (probe.ok) {
    push({
      id: "gamedev-mcp-entry",
      status: "pass",
      message: `gamedev-all-in-one MCP: ${path.basename(path.dirname(probe.entryPath))}/dist/index.js`,
      fixHint: "",
    });
  } else {
    push({
      id: "gamedev-mcp-entry",
      status: "fail",
      message: probe.error || "gamedev-all-in-one MCP bulunamadı",
      fixHint: "Uygulamayı güncel Sauron sürümüyle kurun veya extensions/gamedev-all-in-one/dist/index.js oluşturun.",
    });
  }

  const engine = normalizeGamedevEngine(settings.gamedevActiveEngine || store?.get?.("gamedevActiveEngine"));
  const engineLabel = GAMEDEV_ENGINE_LABELS[engine] || engine;
  push({
    id: "gamedev-engine",
    status: "pass",
    message: `Aktif engine: ${engineLabel} (port ${GAMEDEV_ENGINE_PORTS[engine] || "?"})`,
    fixHint: "",
  });

  if (engine === "unity") {
    push({
      id: "gamedev-unity-bridge",
      status: "warn",
      message: "Unity Editor bridge ayrı kurulmalı (CoplayDev/unity-mcp)",
      fixHint: `Unity → Package Manager → Git URL: ${UNITY_BRIDGE_PACKAGE_URL}`,
    });
  }

  const workspacePath = String(settings.workspacePath || store?.get?.("workspacePath") || "").trim();
  if (workspacePath) {
    const layout = detectWorkspaceLayout(workspacePath);
    if (layout.layout === "electron-core" || layout.isOpenGuider) {
      push({
        id: "gamedev-workspace-layout",
        status: "warn",
        message: "Çalışma Kısmı Sauron kaynak kodu — Game Dev için Unity proje klasörü gerekli",
        fixHint: "Ayarlar → Çalışma Kısmı yolunu Unity proje klasörüne değiştirin (Assets/ içeren klasör).",
      });
    }

    const cursorMcp = path.join(workspacePath, ".cursor", "mcp.json");
    const vscodeMcp = path.join(workspacePath, ".vscode", "mcp.json");
    const hasConfig = fs.existsSync(cursorMcp) || fs.existsSync(vscodeMcp);
    push({
      id: "gamedev-mcp-config",
      status: hasConfig ? "pass" : "warn",
      message: hasConfig ? "Workspace MCP config yazılmış" : "Workspace MCP config henüz yok",
      fixHint: hasConfig ? "" : "Panelde 🎮 veya Oyun yap butonuna basın — config otomatik yazılır.",
    });
  }
}

async function appendGamedevLiveChecks(checks, settings = {}) {
  if (settings.gamedevEnabled === false) {
    return;
  }
  try {
    const status = await getGamedevStatus(settings);
    const connected = status?.connector?.connected === true;
    checks.push({
      id: "gamedev-connector-live",
      status: connected ? "pass" : "warn",
      message: connected
        ? `${status.engineLabel} bridge bağlı`
        : `${status.engineLabel} bridge bekleniyor (dashboard: ${status.dashboardRunning ? "açık" : "kapalı"})`,
      fixHint: connected
        ? ""
        : "Unity/Unreal Editor'ı açın, bridge eklentisini etkinleştirin, ardından Cline'da MCP sunucusunu başlatın.",
      tier: "optional",
    });
  } catch {
    // optional live probe
  }
}

module.exports = {
  UNITY_BRIDGE_PACKAGE_URL,
  appendGamedevChecks,
  appendGamedevLiveChecks,
};
