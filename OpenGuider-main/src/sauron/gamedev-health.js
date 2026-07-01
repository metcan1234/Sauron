const { probeGamedevBridgeForEngine, probeTcpPortSync } = require("./gamedev-bridge-probe");
const { detectProjectEngine } = require("./gamedev-engine-discovery");
const { readEngineCompat } = require("./gamedev-engine-compat");
const { getBridgeProbeProfile, normalizeGamedevEngine } = require("./gamedev-config");

async function checkGamedevEngineBridge(settings = {}, workspacePath = "") {
  const engine = normalizeGamedevEngine(settings.gamedevActiveEngine || "unity");
  const resolved = String(workspacePath || settings.workspacePath || "").trim();
  const probe = await probeGamedevBridgeForEngine(engine, { workspacePath: resolved });

  if (probe.ok) {
    return {
      id: engine === "unreal" ? "gamedev-unreal-bridge" : "gamedev-unity-bridge",
      status: "pass",
      message: `${engine} bridge acik (${probe.transport || "tcp"}:${probe.port || probe.endpoint || "?"})`,
      fixHint: "",
      tier: "optional",
    };
  }

  const hint = engine === "unreal"
    ? "docs/gamedev-unreal-setup.md — Funplay MCP plugin kurun ve editor acik olsun (HTTP 8765)."
    : "docs/gamedev-unity-setup.md — Coplay unity-mcp kurun (HTTP 8080 / TCP 6400).";

  return {
    id: engine === "unreal" ? "gamedev-unreal-bridge" : "gamedev-unity-bridge",
    status: "warn",
    message: `${engine} bridge kapali`,
    fixHint: hint,
    tier: "optional",
  };
}

function checkGamedevEngineBridgeSync(settings = {}, workspacePath = "") {
  const engine = normalizeGamedevEngine(settings.gamedevActiveEngine || "unity");
  const profile = getBridgeProbeProfile(engine);
  const open = [];

  for (const entry of profile) {
    if (entry.port && probeTcpPortSync("127.0.0.1", entry.port)) {
      open.push(`${entry.label} (${entry.port})`);
    }
  }

  if (open.length > 0) {
    return {
      id: engine === "unreal" ? "gamedev-unreal-bridge" : "gamedev-unity-bridge",
      status: "pass",
      message: `${engine} bridge acik: ${open.join(", ")}`,
      fixHint: "",
      tier: "optional",
    };
  }

  const hint = engine === "unreal"
    ? "docs/gamedev-unreal-setup.md — Funplay MCP (HTTP 8765) veya legacy TCP 55557."
    : "docs/gamedev-unity-setup.md — Coplay unity-mcp (HTTP 8080 / TCP 6400).";

  return {
    id: engine === "unreal" ? "gamedev-unreal-bridge" : "gamedev-unity-bridge",
    status: "warn",
    message: `${engine} bridge kapali (8080/6400 veya 8765/55557)`,
    fixHint: hint,
    tier: "optional",
  };
}

function checkGamedevProjectEngineMatch(settings = {}, workspacePath = "") {
  const resolved = String(workspacePath || settings.workspacePath || "").trim();
  if (!resolved) {
    return {
      id: "gamedev-project-engine",
      status: "warn",
      message: "Workspace secilmedi",
      fixHint: "Ayarlar → Calisma Kismi",
      tier: "optional",
    };
  }

  const configured = normalizeGamedevEngine(settings.gamedevActiveEngine || "unity");
  const detected = detectProjectEngine(resolved);
  if (!detected.engine) {
    return {
      id: "gamedev-project-engine",
      status: "warn",
      message: "Proje motoru algilanamadi",
      fixHint: "Unity (Assets/) veya Unreal (.uproject) klasoru secin",
      tier: "optional",
    };
  }

  if (detected.engine !== configured) {
    return {
      id: "gamedev-project-engine",
      status: "warn",
      message: `Ayar ${configured}, proje ${detected.engine}`,
      fixHint: `Game Dev engine ayarini ${detected.engine} yapin veya dogru projeyi secin`,
      tier: "optional",
    };
  }

  return {
    id: "gamedev-project-engine",
    status: "pass",
    message: `Proje motoru uyumlu (${detected.engine})`,
    fixHint: "",
    tier: "optional",
  };
}

function checkGamedevCompatManifest(settings = {}, workspacePath = "") {
  const resolved = String(workspacePath || settings.workspacePath || "").trim();
  if (!resolved) {
    return {
      id: "gamedev-compat-manifest",
      status: "warn",
      message: "engine-compat.json yok (workspace bos)",
      fixHint: "Game Dev → Tek tik fix",
      tier: "optional",
    };
  }

  const compat = readEngineCompat(resolved);
  if (!compat) {
    return {
      id: "gamedev-compat-manifest",
      status: "warn",
      message: ".sauron/engine-compat.json eksik",
      fixHint: "Game Dev → Tek tik fix calistirin",
      tier: "optional",
    };
  }

  return {
    id: "gamedev-compat-manifest",
    status: "pass",
    message: `Uyumluluk manifesti guncel (v${compat.version || "?"})`,
    fixHint: "",
    tier: "optional",
  };
}

function checkGamedevUnrealPluginInstalled(settings = {}, workspacePath = "") {
  const resolved = String(workspacePath || settings.workspacePath || "").trim();
  if (!resolved) {
    return {
      id: "gamedev-unreal-plugin",
      status: "warn",
      message: "Funplay plugin kontrolu icin workspace gerekli",
      fixHint: "Calisma Kismi secin",
      tier: "optional",
    };
  }

  const { isFunplayPluginInstalled } = require("./gamedev-unreal-installer");
  if (isFunplayPluginInstalled(resolved)) {
    return {
      id: "gamedev-unreal-plugin",
      status: "pass",
      message: "FunplayMCP plugin kurulu",
      fixHint: "",
      tier: "optional",
    };
  }

  return {
    id: "gamedev-unreal-plugin",
    status: "warn",
    message: "FunplayMCP plugin eksik",
    fixHint: "Game Dev acin — Sauron otomatik indirip kurar (internet gerekir)",
    tier: "optional",
  };
}

module.exports = {
  checkGamedevEngineBridge,
  checkGamedevEngineBridgeSync,
  checkGamedevProjectEngineMatch,
  checkGamedevCompatManifest,
  checkGamedevUnrealPluginInstalled,
};
