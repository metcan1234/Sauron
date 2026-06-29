const http = require("http");
const {
  GAMEDEV_DASHBOARD_PORT,
  GAMEDEV_ENGINE_LABELS,
  normalizeGamedevEngine,
} = require("./gamedev-config");
const { probeGamedevMcpEntry } = require("./gamedev-path-resolver");
const { readGameDesignBrief } = require("./gamedev-prompt-compiler");
const { readGamePipelineState } = require("./game-pipeline/game-pipeline-state");
const { summarizeGamedevLedger } = require("./gamedev-finops-ledger");

function fetchDashboardStatus(port = GAMEDEV_DASHBOARD_PORT, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/status",
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ ok: res.statusCode === 200, data: JSON.parse(body) });
          } catch {
            resolve({ ok: false, data: null });
          }
        });
      },
    );

    req.on("error", () => resolve({ ok: false, data: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, data: null });
    });
  });
}

function pickConnectorStatus(data, engine) {
  const normalized = normalizeGamedevEngine(engine);
  if (!data || typeof data !== "object") {
    return { connected: false, available: false, reasons: ["Dashboard yanıt vermedi."] };
  }

  const connectors = data.connectors || data.engines || data;
  const entry = connectors?.[normalized] || connectors?.[normalized.charAt(0).toUpperCase() + normalized.slice(1)];
  if (!entry || typeof entry !== "object") {
    return { connected: false, available: false, reasons: ["Connector bilgisi yok."] };
  }

  return {
    connected: entry.bridgeConnected === true || entry.connected === true,
    available: entry.available === true || entry.bridgeConnected === true,
    reasons: Array.isArray(entry.reasons) ? entry.reasons : [],
    detected: entry.detected || null,
  };
}

async function getGamedevStatus(settings = {}, engine = "unity", workspacePath = null) {
  const normalized = normalizeGamedevEngine(engine || settings.gamedevActiveEngine);
  const mcpProbe = probeGamedevMcpEntry(settings);
  const dashboard = await fetchDashboardStatus(GAMEDEV_DASHBOARD_PORT);
  const connector = pickConnectorStatus(dashboard.data, normalized);
  const resolvedWorkspace = String(workspacePath || settings.workspacePath || "").trim();
  const finops = resolvedWorkspace ? summarizeGamedevLedger(resolvedWorkspace) : null;
  const brief = resolvedWorkspace ? readGameDesignBrief(resolvedWorkspace) : null;
  const pipelineState = resolvedWorkspace ? readGamePipelineState(resolvedWorkspace) : null;
  const phaseTokensEst = pipelineState?.totalEstimatedTokens || pipelineState?.phases?.reduce(
    (sum, p) => sum + (p.estimatedTokens || 0),
    0,
  ) || 0;

  return {
    engine: normalized,
    engineLabel: GAMEDEV_ENGINE_LABELS[normalized] || normalized,
    mcpEntryPath: mcpProbe.entryPath,
    mcpEntryOk: mcpProbe.ok,
    dashboardRunning: dashboard.ok,
    dashboardPort: GAMEDEV_DASHBOARD_PORT,
    dashboardUrl: `http://127.0.0.1:${GAMEDEV_DASHBOARD_PORT}`,
    connector,
    brief: brief ? {
      pointer: ".sauron/game-design-brief.json",
      summary: String(brief.masterPrompt || "").slice(0, 120),
      compiledBy: brief.compiledBy,
      briefHash: brief.briefHash,
    } : null,
    finops: finops ? {
      ...finops,
      phaseTokensEst,
      briefCompiledBy: brief?.compiledBy || null,
    } : { phaseTokensEst, briefCompiledBy: brief?.compiledBy || null },
    tokenPolicy: {
      mcpTools: "full",
      llmHandoff: "economy",
      note: "MCP tool calls are local and do not consume LLM tokens.",
    },
  };
}

module.exports = {
  fetchDashboardStatus,
  pickConnectorStatus,
  getGamedevStatus,
};
