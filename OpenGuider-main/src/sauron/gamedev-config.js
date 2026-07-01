const path = require("path");
const { getProjectRoot, isPackaged } = require("../app-paths");

const GAMEDEV_INSTRUCTIONS_DIR = ".clinerules";
const GAMEDEV_INSTRUCTIONS_FILE = "sauron-gamedev.md";
const GAMEDEV_INSTRUCTIONS_VERSION = "3.3";

const GAMEDEV_ENGINES = ["unity", "unreal", "roblox", "blender"];

const GAMEDEV_ENGINE_LABELS = {
  unity: "Unity",
  unreal: "Unreal",
  roblox: "Roblox",
  blender: "Blender",
};

const GAMEDEV_ENGINE_PORTS = {
  unity: 7890,
  unreal: 55557,
  roblox: 3002,
  blender: 9876,
};

const GAMEDEV_BRIDGE_PROBE_PROFILES = {
  unity: [
    { kind: "http", port: 8080, label: "Coplay unityMCP HTTP" },
    { kind: "tcp", port: 6400, label: "Coplay Unity TCP bridge" },
    { kind: "tcp", port: 7890, label: "Legacy Unity MCP TCP" },
  ],
  unreal: [
    { kind: "http", port: 8765, label: "Funplay Unreal HTTP" },
    { kind: "tcp", port: 55557, label: "Legacy ue-mcp TCP" },
  ],
  roblox: [{ kind: "tcp", port: 3002, label: "Roblox MCP" }],
  blender: [{ kind: "tcp", port: 9876, label: "Blender MCP" }],
};

const GAMEDEV_NATIVE_MCP = {
  unity: {
    serverId: "unityMCP",
    httpUrl: "http://127.0.0.1:8080/mcp",
  },
  unreal: {
    serverId: "funplay-unreal",
    command: "npx",
    args: ["-y", "funplay-unreal-mcp"],
    defaultUrl: "http://127.0.0.1:8765/",
  },
};

const UNITY_MCP_PACKAGE_URL =
  "https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main";

const GAMEDEV_DASHBOARD_PORT = 3100;
const GAMEDEV_MCP_SERVER_ID = "gamedev-all-in-one";

const DEFAULT_GAMEDEV_TASK_MAX_CHARS = 600;

function getGamedevExtensionRoot() {
  if (isPackaged()) {
    try {
      return path.join(process.resourcesPath, "gamedev-all-in-one");
    } catch {
      // fall through
    }
  }
  return path.join(getProjectRoot(), "extensions", "gamedev-all-in-one");
}

function getDefaultGamedevMcpEntryPath() {
  return path.join(getGamedevExtensionRoot(), "dist", "index.js");
}

function normalizeGamedevEngine(engine) {
  const key = String(engine || "unity").trim().toLowerCase();
  return GAMEDEV_ENGINES.includes(key) ? key : "unity";
}

function getBridgeProbeProfile(engine) {
  const normalized = normalizeGamedevEngine(engine);
  return GAMEDEV_BRIDGE_PROBE_PROFILES[normalized] || GAMEDEV_BRIDGE_PROBE_PROFILES.unity;
}

function buildEngineEnv(engine, workspacePath, bridgePort = null) {
  const resolved = String(workspacePath || "").trim();
  const normalized = normalizeGamedevEngine(engine);
  const env = {};

  if (resolved) {
    env.SAURON_GAMEDEV_WORKSPACE = resolved;
    if (normalized === "unity") {
      env.UNITY_PROJECT_PATH = resolved;
      env.UNITY_BRIDGE_PORT = String(bridgePort || GAMEDEV_ENGINE_PORTS.unity);
    } else if (normalized === "unreal") {
      env.UE_PROJECT_PATH = resolved;
      env.UNREAL_BRIDGE_PORT = String(bridgePort || GAMEDEV_ENGINE_PORTS.unreal);
    } else if (normalized === "roblox") {
      env.ROBLOX_PROJECT_PATH = resolved;
      env.ROBLOX_BRIDGE_PORT = String(GAMEDEV_ENGINE_PORTS.roblox);
    } else if (normalized === "blender") {
      env.BLENDER_PROJECT_PATH = resolved;
      env.BLENDER_BRIDGE_PORT = String(GAMEDEV_ENGINE_PORTS.blender);
    }
  }

  return env;
}

module.exports = {
  GAMEDEV_INSTRUCTIONS_DIR,
  GAMEDEV_INSTRUCTIONS_FILE,
  GAMEDEV_INSTRUCTIONS_VERSION,
  GAMEDEV_ENGINES,
  GAMEDEV_ENGINE_LABELS,
  GAMEDEV_ENGINE_PORTS,
  GAMEDEV_BRIDGE_PROBE_PROFILES,
  GAMEDEV_NATIVE_MCP,
  UNITY_MCP_PACKAGE_URL,
  GAMEDEV_DASHBOARD_PORT,
  GAMEDEV_MCP_SERVER_ID,
  DEFAULT_GAMEDEV_TASK_MAX_CHARS,
  getDefaultGamedevMcpEntryPath,
  getGamedevExtensionRoot,
  normalizeGamedevEngine,
  getBridgeProbeProfile,
  buildEngineEnv,
};
