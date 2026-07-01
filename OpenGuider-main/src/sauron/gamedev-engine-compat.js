const fs = require("fs");
const path = require("path");
const {
  GAMEDEV_BRIDGE_PROBE_PROFILES,
  GAMEDEV_NATIVE_MCP,
  UNITY_MCP_PACKAGE_URL,
  GAMEDEV_INSTRUCTIONS_VERSION,
} = require("./gamedev-config");

const COMPAT_FILENAME = "engine-compat.json";
const COMPAT_VERSION = 2;

function getCompatPath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", COMPAT_FILENAME);
}

function getDefaultCompatManifest(sauronVersion = "") {
  return {
    version: COMPAT_VERSION,
    updatedAt: new Date().toISOString(),
    sauronMinVersion: String(sauronVersion || "2.6.0"),
    gamedevInstructionsVersion: GAMEDEV_INSTRUCTIONS_VERSION,
    pinned: {
      funplayReleaseTag: null,
      unityMcpPackageUrl: UNITY_MCP_PACKAGE_URL,
    },
    engines: {
      unity: {
        mcpPackages: ["com.coplaydev.unity-mcp"],
        packageUrl: UNITY_MCP_PACKAGE_URL,
        bridgeProfiles: GAMEDEV_BRIDGE_PROBE_PROFILES.unity,
        nativeMcp: GAMEDEV_NATIVE_MCP.unity,
      },
      unreal: {
        plugins: ["FunplayMCP"],
        bridgeProfiles: GAMEDEV_BRIDGE_PROBE_PROFILES.unreal,
        nativeMcp: GAMEDEV_NATIVE_MCP.unreal,
        setupDoc: "docs/gamedev-unreal-setup.md",
      },
    },
    notes: [
      "Bu dosya Sauron tarafından otomatik güncellenir.",
      "Unity/Unreal güncellemelerinden sonra Game Dev Doctor uyumluluk kontrolü yapar.",
    ],
  };
}

function readEngineCompat(workspacePath) {
  const compatPath = getCompatPath(workspacePath);
  try {
    if (!fs.existsSync(compatPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(compatPath, "utf8"));
  } catch {
    return null;
  }
}

function writeEngineCompat(workspacePath, manifest = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "workspace-required" };
  }
  const compatPath = getCompatPath(resolved);
  fs.mkdirSync(path.dirname(compatPath), { recursive: true });
  const payload = {
    ...getDefaultCompatManifest(manifest.sauronVersion),
    ...manifest,
    version: COMPAT_VERSION,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(compatPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { ok: true, path: compatPath, manifest: payload };
}

function ensureEngineCompat(workspacePath, options = {}) {
  const existing = readEngineCompat(workspacePath);
  if (existing && existing.version === COMPAT_VERSION && options.force !== true) {
    return { ok: true, path: getCompatPath(workspacePath), manifest: existing, created: false };
  }
  const written = writeEngineCompat(workspacePath, options);
  return { ...written, created: true };
}

module.exports = {
  COMPAT_FILENAME,
  COMPAT_VERSION,
  getCompatPath,
  getDefaultCompatManifest,
  readEngineCompat,
  writeEngineCompat,
  ensureEngineCompat,
};
