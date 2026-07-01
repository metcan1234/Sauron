const fs = require("fs");
const path = require("path");
const { UNITY_MCP_PACKAGE_URL, normalizeGamedevEngine } = require("./gamedev-config");
const { detectProjectEngine } = require("./gamedev-engine-discovery");
const { ensureEngineCompat } = require("./gamedev-engine-compat");
const { writeGamedevMcpConfig } = require("./gamedev-mcp-config");
const { probeGamedevBridgeForEngine } = require("./gamedev-bridge-probe");
const { installFunplayMcpPlugin, isFunplayPluginInstalled } = require("./gamedev-unreal-installer");
const { ensureEditorBridgeReady } = require("./gamedev-editor-launcher");
const { ensureUnityAutostartConfig, ensureFunplayAutostartConfig } = require("./gamedev-mcp-autostart");
const { tryCaptureUnrealSceneSnapshot } = require("./gamedev-unreal-scene-cache");

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

async function ensureUnrealFunplayPlugin(workspacePath, settings = {}) {
  const resolved = String(workspacePath || "").trim();
  const hasUproject = fs.readdirSync(resolved, { withFileTypes: true })
    .some((entry) => entry.isFile() && entry.name.endsWith(".uproject"));
  if (!hasUproject) {
    return { ok: false, skipped: true, reason: "not-unreal-project" };
  }

  if (settings.gamedevAutoPluginInstall === false) {
    if (isFunplayPluginInstalled(resolved)) {
      return { ok: true, skipped: true, reason: "plugin-present-auto-install-disabled" };
    }
    return { ok: false, skipped: true, reason: "plugin-missing-auto-install-disabled" };
  }

  return installFunplayMcpPlugin(resolved, settings);
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
    ensureUnityAutostartConfig(resolved);
    const unityPkg = ensureUnityMcpPackage(resolved);
    steps.push({ id: "unity-mcp-package", ok: unityPkg.ok, message: unityPkg.reason });
    steps.push({ id: "mcp-autostart-config", ok: true, message: "unity-autostart-config" });
  }

  if (engine === "unreal") {
    ensureFunplayAutostartConfig(resolved);
    steps.push({ id: "mcp-autostart-config", ok: true, message: "funplay-autostart-config" });
    const unrealPlugin = await ensureUnrealFunplayPlugin(resolved, settings);
    steps.push({
      id: "unreal-funplay-install",
      ok: unrealPlugin.ok,
      message: unrealPlugin.reason || unrealPlugin.error || "unreal-plugin",
    });
    const sceneSnap = tryCaptureUnrealSceneSnapshot(resolved);
    steps.push({
      id: "unreal-scene-cache",
      ok: sceneSnap.ok,
      message: sceneSnap.ok ? `maps:${sceneSnap.snapshot?.mapCount || 0}` : sceneSnap.error,
    });
  }

  let bridge = await probeGamedevBridgeForEngine(engine, { workspacePath: resolved });
  steps.push({
    id: "bridge-probe",
    ok: bridge.ok,
    message: bridge.ok
      ? `${engine} bridge ${bridge.transport} (${bridge.port || bridge.endpoint})`
      : bridge.summary || "bridge-offline",
  });

  if (!bridge.ok && settings.gamedevAutoEditorLaunch !== false) {
    const editorReady = await ensureEditorBridgeReady(engine, resolved, settings, {
      timeoutMs: settings.gamedevBridgeWaitMs || 90000,
    });
    if (Array.isArray(editorReady.steps)) {
      steps.push(...editorReady.steps.map((step) => ({ ...step, id: `editor-${step.id}` })));
    }
    if (editorReady.probe) {
      bridge = editorReady.probe;
    }
    steps.push({
      id: "bridge-after-launch",
      ok: bridge.ok === true,
      message: bridge.ok
        ? `${engine} bridge ready after editor launch`
        : editorReady.error || "bridge-still-offline",
    });
  }

  const mcpWrite = writeGamedevMcpConfig(resolved, settings, engine, {
    bridgePort: bridge.port || null,
  });
  steps.push({
    id: "mcp-config",
    ok: mcpWrite.ok,
    message: mcpWrite.ok ? `mcp-config (${mcpWrite.writtenPaths?.length || 0})` : mcpWrite.error,
  });

  const bridgeOptional = bridge.ok !== true;
  const ok = mcpWrite.ok;

  return {
    ok,
    engine,
    workspacePath: resolved,
    bridge,
    bridgeOptional,
    steps,
    mcpWrite,
    warnings: steps.filter((step) => step.ok === false && step.id !== "bridge-probe" && step.id !== "bridge-after-launch"),
  };
}

module.exports = {
  ensureUnityMcpPackage,
  ensureUnrealFunplayPlugin,
  resolveEngineForWorkspace,
  ensureGamedevProjectReady,
};
