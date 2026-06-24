const path = require("path");
const { getProjectRoot, isPackaged } = require("../app-paths");

const GAMEDEV_INSTRUCTIONS_DIR = ".clinerules";
const GAMEDEV_INSTRUCTIONS_FILE = "sauron-gamedev.md";
const GAMEDEV_INSTRUCTIONS_VERSION = "2.0";

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

function buildEngineEnv(engine, workspacePath) {
  const resolved = String(workspacePath || "").trim();
  const normalized = normalizeGamedevEngine(engine);
  const env = {};

  if (resolved) {
    if (normalized === "unity") {
      env.UNITY_PROJECT_PATH = resolved;
      env.UNITY_BRIDGE_PORT = String(GAMEDEV_ENGINE_PORTS.unity);
    } else if (normalized === "unreal") {
      env.UE_PROJECT_PATH = resolved;
      env.UNREAL_BRIDGE_PORT = String(GAMEDEV_ENGINE_PORTS.unreal);
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
  GAMEDEV_DASHBOARD_PORT,
  GAMEDEV_MCP_SERVER_ID,
  DEFAULT_GAMEDEV_TASK_MAX_CHARS,
  getDefaultGamedevMcpEntryPath,
  getGamedevExtensionRoot,
  normalizeGamedevEngine,
  buildEngineEnv,
};
