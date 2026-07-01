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
    const { checkGamedevEngineBridgeSync } = require("./gamedev-health");
    push(checkGamedevEngineBridgeSync(settings, workspacePath));
  } else if (engine === "unreal") {
    const { checkGamedevEngineBridgeSync } = require("./gamedev-health");
    push(checkGamedevEngineBridgeSync(settings, workspacePath));
  }

  const workspacePath = String(settings.workspacePath || store?.get?.("workspacePath") || "").trim();
  if (workspacePath) {
    const layout = detectWorkspaceLayout(workspacePath);
    if (layout.layout === "electron-core" || layout.isOpenGuider) {
      const projectHint = engine === "unreal"
        ? "Unreal proje klasörü gerekli (.uproject içeren klasör)"
        : "Unity proje klasörü gerekli (Assets/ içeren klasör)";
      push({
        id: "gamedev-workspace-layout",
        status: "warn",
        message: `Çalışma Kısmı Sauron kaynak kodu — Game Dev için ${projectHint}`,
        fixHint: `Ayarlar → Çalışma Kısmı yolunu ${engine === "unreal" ? "Unreal" : "Unity"} proje klasörüne değiştirin.`,
      });
    }

    if (engine === "unreal") {
      const hasUproject = fs.existsSync(workspacePath)
        && fs.readdirSync(workspacePath).some((name) => name.endsWith(".uproject"));
      push({
        id: "gamedev-unreal-project",
        status: hasUproject ? "pass" : "warn",
        message: hasUproject ? "Unreal .uproject bulundu" : "Unreal .uproject bulunamadı",
        fixHint: hasUproject ? "" : "Çalışma Kısmı yolunu .uproject dosyasının bulunduğu klasöre ayarlayın.",
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

    try {
      const { readGameDesignBrief } = require("./gamedev-prompt-compiler");
      const { listWireRecipeFiles } = require("./unity-wire-recipes");
      const brief = readGameDesignBrief(workspacePath);
      push({
        id: "gamedev-brief",
        status: brief ? "pass" : "warn",
        message: brief
          ? `Oyun planı brief: ${String(brief.masterPrompt || "").slice(0, 60)}…`
          : "Oyun planı brief henüz yok",
        fixHint: brief ? "" : "Game Studio'da Oyun planım yazıp 🎮 ile oturum başlatın.",
      });

      const recipeCount = listWireRecipeFiles().length;
      push({
        id: "gamedev-wire-recipes",
        status: recipeCount >= 21 ? "pass" : "warn",
        message: `Wire recipe kapsamı: ${recipeCount} dosya`,
        fixHint: recipeCount >= 21 ? "" : "Sauron sürümünü güncelleyin — wire recipe paketi eksik.",
      });

      const templateMarker = path.join(workspacePath, ".sauron", "gamedev-template.json");
      if (fs.existsSync(templateMarker)) {
        const assetsRoot = path.join(workspacePath, "Assets", "SauronGameDev");
        const hasPrefabs = fs.existsSync(assetsRoot) && fs.readdirSync(assetsRoot, { withFileTypes: true })
          .some((entry) => entry.isDirectory() && fs.existsSync(path.join(assetsRoot, entry.name, "Prefabs")));
        push({
          id: "gamedev-prefab-scaffold",
          status: hasPrefabs ? "pass" : "warn",
          message: hasPrefabs ? "Genre prefab klasörü mevcut" : "Prefab scaffold henüz kopyalanmadı",
          fixHint: hasPrefabs ? "" : "Faz 1 scaffold veya şablon seçimi ile prefab'lar kopyalanır.",
        });
      }
    } catch {
      // optional brief/recipe checks
    }
  }
}

async function appendGamedevLiveChecks(checks, settings = {}) {
  if (settings.gamedevEnabled === false) {
    return;
  }

  const workspacePath = String(settings.workspacePath || "").trim();
  if (workspacePath) {
    try {
      const { readGamePipelineState } = require("./game-pipeline/game-pipeline-state");
      const pipeline = readGamePipelineState(workspacePath);
      if (pipeline?.status === "active") {
        checks.push({
          id: "gamedev-pipeline-active",
          status: "pass",
          message: `Game pipeline aktif: faz ${pipeline.currentPhase}/${pipeline.totalPhases}`,
          fixHint: "",
          tier: "optional",
        });
      }
      if (settings.gamedevPipelineAutoChain === false) {
        checks.push({
          id: "gamedev-pipeline-autochain",
          status: "warn",
          message: "Game pipeline auto-chain kapalı",
          fixHint: "Ayarlar → Game Dev → Pipeline auto-chain'i etkinleştirin.",
          tier: "optional",
        });
      } else {
        checks.push({
          id: "gamedev-pipeline-autochain",
          status: "pass",
          message: "Game pipeline auto-chain etkin",
          fixHint: "",
          tier: "optional",
        });
      }
    } catch {
      // optional
    }
  }

  if (settings.gamedevActiveEngine === "unreal") {
    try {
      const { probeUnrealBridge } = require("./gamedev-mcp-proxy");
      const workspacePath = String(settings.workspacePath || "").trim();
      const probe = await probeUnrealBridge({ workspacePath });
      checks.push({
        id: "gamedev-unreal-bridge-port",
        status: probe.connected ? "pass" : "warn",
        message: probe.connected
          ? `Unreal bridge bagli (${probe.transport || "tcp"}:${probe.port || "8765"})`
          : "Unreal bridge bekleniyor (HTTP 8765 / TCP 55557)",
        fixHint: probe.connected ? "" : "Unreal Editor acin, Funplay MCP plugin etkinlestirin.",
        tier: "optional",
      });
    } catch {
      // optional
    }
  } else if (settings.gamedevActiveEngine === "unity" || !settings.gamedevActiveEngine) {
    try {
      const { probeUnityBridge } = require("./gamedev-mcp-proxy");
      const workspacePath = String(settings.workspacePath || "").trim();
      const probe = await probeUnityBridge({ workspacePath });
      checks.push({
        id: "gamedev-unity-bridge-port",
        status: probe.connected ? "pass" : "warn",
        message: probe.connected
          ? `Unity bridge bagli (${probe.transport || "tcp"}:${probe.port || "8080"})`
          : "Unity bridge bekleniyor (HTTP 8080 / TCP 6400)",
        fixHint: probe.connected ? "" : `Unity → Package Manager → Git URL: ${UNITY_BRIDGE_PACKAGE_URL}`,
        tier: "optional",
      });
    } catch {
      // optional
    }
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
