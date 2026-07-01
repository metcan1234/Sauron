const fs = require("fs");
const path = require("path");
const { normalizeGamedevEngine } = require("./gamedev-config");
const { ensureGamedevProjectReady } = require("./gamedev-project-bootstrap");
const { tryStartEngineMcp } = require("./gamedev-mcp-autostart");

const SETUP_STEPS = [
  { id: "detect-engine", label: "Proje motoru algila" },
  { id: "engine-compat", label: "Uyumluluk manifesti" },
  { id: "plugin-install", label: "Plugin / paket kurulumu" },
  { id: "mcp-autostart-config", label: "MCP otostart ayarlari" },
  { id: "bridge-probe", label: "Bridge kontrolu" },
  { id: "editor-launch", label: "Editor ac" },
  { id: "mcp-nudge", label: "MCP server baslat" },
  { id: "mcp-config", label: "MCP config yaz" },
];

function buildProgressFromBootstrap(result = {}) {
  const engine = result.engine || "unity";
  const steps = Array.isArray(result.steps) ? result.steps : [];
  const progress = SETUP_STEPS.map((entry) => {
    const match = steps.find((step) => step.id.includes(entry.id.replace(/-/g, "")) || step.id === entry.id);
    return {
      ...entry,
      engine,
      status: match ? (match.ok ? "done" : "warn") : "pending",
      message: match?.message || "",
    };
  });
  const doneCount = progress.filter((entry) => entry.status === "done").length;
  return {
    engine,
    progress,
    percent: Math.round((doneCount / progress.length) * 100),
    ready: result.ok === true,
    bridgeOnline: result.bridge?.ok === true,
  };
}

async function runGamedevSetupOrchestrator(workspacePath, settings = {}, engineOverride = null) {
  const resolved = String(workspacePath || "").trim();
  const engine = normalizeGamedevEngine(engineOverride || settings.gamedevActiveEngine || "unity");
  const timeline = [{ id: "start", at: Date.now(), message: `setup-start (${engine})` }];

  const bootstrap = await ensureGamedevProjectReady(resolved, settings, engine);
  timeline.push({ id: "bootstrap-complete", at: Date.now(), ok: bootstrap.ok });

  if (!bootstrap.bridge?.ok && settings.gamedevAutoMcpStart !== false) {
    const mcpStart = await tryStartEngineMcp(engine, resolved, settings);
    bootstrap.steps = bootstrap.steps || [];
    bootstrap.steps.push({
      id: "mcp-nudge",
      ok: mcpStart.ok,
      message: mcpStart.ok ? "MCP server yanit verdi" : mcpStart.nudge?.error || mcpStart.reason || "mcp-nudge",
    });
    if (mcpStart.probe?.ok) {
      bootstrap.bridge = mcpStart.probe;
    }
    timeline.push({ id: "mcp-nudge", at: Date.now(), ok: mcpStart.ok });
  }

  ensureMcpAutostartConfig(engine, resolved);

  const ui = buildProgressFromBootstrap(bootstrap);
  return {
    ...bootstrap,
    orchestrator: true,
    timeline,
    ui,
  };
}

function ensureMcpAutostartConfig(engine, workspacePath) {
  const { ensureUnityAutostartConfig, ensureFunplayAutostartConfig } = require("./gamedev-mcp-autostart");
  if (engine === "unity") {
    return ensureUnityAutostartConfig(workspacePath);
  }
  if (engine === "unreal") {
    return ensureFunplayAutostartConfig(workspacePath);
  }
  return null;
}

module.exports = {
  SETUP_STEPS,
  buildProgressFromBootstrap,
  runGamedevSetupOrchestrator,
};
