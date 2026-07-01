const fs = require("fs");
const path = require("path");
const { UNITY_MCP_PACKAGE_URL, normalizeGamedevEngine } = require("./gamedev-config");
const { detectProjectEngine } = require("./gamedev-engine-discovery");
const { ensureEngineCompat } = require("./gamedev-engine-compat");
const { writeGamedevMcpConfig } = require("./gamedev-mcp-config");
const { probeGamedevBridgeForEngine } = require("./gamedev-bridge-probe");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function ensureUnityMcpPackage(workspacePath) {
  const manifestPath = path.join(workspacePath, "Packages", "manifest.json");
  if (!fs.existsSync(path.join(workspacePath, "Assets"))) {
    return { ok: false, skipped: true, reason: "not-unity-project" };
  }

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const manifest = readJson(manifestPath) || { dependencies: {} };
  manifest.dependencies = manifest.dependencies || {};

  if (manifest.dependencies["com.coplaydev.unity-mcp"]) {
    return { ok: true, skipped: true, reason: "already-installed" };
  }

  manifest.dependencies["com.coplaydev.unity-mcp"] = UNITY_MCP_PACKAGE_URL;
  writeJson(manifestPath, manifest);
  return { ok: true, skipped: false, reason: "package-added", manifestPath };
}

function ensureUnrealFunplayBootstrap(workspacePath) {
  const pluginRoot = path.join(workspacePath, "Plugins", "FunplayMCP");
  const marker = path.join(pluginRoot, "FunplayMCP.uplugin");
  const hasUproject = fs.readdirSync(workspacePath, { withFileTypes: true })
    .some((entry) => entry.isFile() && entry.name.endsWith(".uproject"));
  if (!hasUproject) {
    return { ok: false, skipped: true, reason: "not-unreal-project" };
  }

  if (fs.existsSync(marker)) {
    return { ok: true, skipped: true, reason: "plugin-present", pluginRoot };
  }

  fs.mkdirSync(pluginRoot, { recursive: true });
  const readme = path.join(pluginRoot, "SAURON_INSTALL_FUNPLAY.md");
  fs.writeFileSync(readme, [
    "# Funplay MCP for Unreal — Sauron bootstrap",
    "",
    "Bu klasör Sauron tarafından oluşturuldu. Tam kurulum için:",
    "",
    "1. https://github.com/FunplayAI/funplay-unreal-mcp/releases adresinden zip indir",
    "2. Zip içindeki `FunplayMCP/` klasörünü bu `Plugins/FunplayMCP/` üzerine kopyala",
    "3. Unreal Editor → Edit → Plugins → Funplay MCP for Unreal → Enable",
    "4. Tools → Funplay MCP → Start",
    "",
    "Ardından Sauron Game Dev → Tek tık fix çalıştır.",
    "",
  ].join("\n"), "utf8");

  return { ok: true, skipped: false, reason: "bootstrap-readme", pluginRoot, readme };
}

function resolveEngineForWorkspace(workspacePath, settings = {}, engineOverride = null) {
  if (engineOverride) {
    return normalizeGamedevEngine(engineOverride);
  }
  const configured = normalizeGamedevEngine(settings.gamedevActiveEngine || "unity");
  const detected = detectProjectEngine(workspacePath);
  if (detected.engine) {
    return detected.engine;
  }
  return configured;
}

async function ensureGamedevProjectReady(workspacePath, settings = {}, engineOverride = null) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "workspace-required" };
  }
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  const engine = resolveEngineForWorkspace(resolved, settings, engineOverride);
  const steps = [];

  const compat = ensureEngineCompat(resolved, { sauronVersion: settings.sauronVersion });
  steps.push({ id: "engine-compat", ok: compat.ok, message: compat.ok ? compat.path : compat.error });

  if (engine === "unity") {
    const unityPkg = ensureUnityMcpPackage(resolved);
    steps.push({ id: "unity-mcp-package", ok: unityPkg.ok, message: unityPkg.reason });
  }
  if (engine === "unreal") {
    const unrealPlugin = ensureUnrealFunplayBootstrap(resolved);
    steps.push({ id: "unreal-funplay-bootstrap", ok: unrealPlugin.ok, message: unrealPlugin.reason });
  }

  const bridge = await probeGamedevBridgeForEngine(engine, { workspacePath: resolved });
  steps.push({
    id: "bridge-probe",
    ok: bridge.ok,
    message: bridge.ok
      ? `${engine} bridge ${bridge.transport} (${bridge.port || bridge.endpoint})`
      : bridge.summary || "bridge-offline",
  });

  const mcpWrite = writeGamedevMcpConfig(resolved, settings, engine, {
    bridgePort: bridge.port || null,
  });
  steps.push({
    id: "mcp-config",
    ok: mcpWrite.ok,
    message: mcpWrite.ok ? `mcp-config (${mcpWrite.writtenPaths?.length || 0})` : mcpWrite.error,
  });

  return {
    ok: mcpWrite.ok,
    engine,
    workspacePath: resolved,
    bridge,
    steps,
    mcpWrite,
  };
}

module.exports = {
  ensureUnityMcpPackage,
  ensureUnrealFunplayBootstrap,
  resolveEngineForWorkspace,
  ensureGamedevProjectReady,
};
