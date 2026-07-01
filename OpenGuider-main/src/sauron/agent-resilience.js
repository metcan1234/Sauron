const {
  AGENT_DEFINITIONS,
  CORE_CLOUD_FALLBACK_ORDER,
  isAgentRoutable,
} = require("./finops/agent-matrix");

const AGENT_LABELS = {
  gemini: "Gemini",
  deepseek: "DeepSeek",
  openai: "OpenAI",
  ollama: "Ollama",
};

const PROVIDER_AGENT_MAP = {
  gemini: "gemini",
  deepseek: "deepseek",
  openai: "openai",
  ollama: "ollama",
};

const MAX_HEALTH_EVENTS = 50;
const MAX_FAILOVER_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 400;

let resilienceContext = {
  getWindows: () => [],
  onFailoverRecord: null,
};

const healthEvents = [];

function configureAgentResilienceContext(context = {}) {
  resilienceContext = {
    ...resilienceContext,
    ...context,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyProviderError(error) {
  const message = String(error?.message || error || "");
  const name = String(error?.name || "");

  if (name === "AbortError" || /\babort(ed)?\b/i.test(message)) {
    return { kind: "fatal", message };
  }
  if (name === "BudgetExceededError") {
    return { kind: "fatal", message };
  }

  const statusMatch = message.match(/error\s+(\d{3})/i) || message.match(/\b(\d{3})\b/);
  const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : null;

  if (
    status === 401
    || status === 403
    || /invalid.*api.*key|authentication|unauthorized|forbidden/i.test(message)
  ) {
    return { kind: "auth", status, message };
  }

  if (
    status === 429
    || (Number.isFinite(status) && status >= 500 && status < 600)
    || /timeout|econnreset|econnrefused|fetch failed|network|socket hang up/i.test(message)
  ) {
    return { kind: "transient", status, message };
  }

  if (Number.isFinite(status) && status >= 400) {
    return { kind: "auth", status, message };
  }

  return { kind: "transient", status, message };
}

function providerToAgentId(provider = "", settings = {}) {
  const overlayId = String(settings?._finopsCoreOverlay?.agentId || "").trim().toLowerCase();
  if (overlayId && AGENT_DEFINITIONS[overlayId]) {
    return overlayId;
  }
  const normalized = String(provider || "").trim().toLowerCase();
  return PROVIDER_AGENT_MAP[normalized] || null;
}

function resolveFailoverChain(failedAgentId = "", settings = {}, agentWallets = null) {
  const failed = String(failedAgentId || "").trim().toLowerCase();
  const order = [];
  const seen = new Set();

  for (const agentId of CORE_CLOUD_FALLBACK_ORDER) {
    if (!agentId || agentId === failed || seen.has(agentId)) {
      continue;
    }
    seen.add(agentId);
    order.push(agentId);
  }

  if (failed !== "ollama" && !seen.has("ollama")) {
    order.push("ollama");
  }

  return order.filter((agentId) => isAgentRoutable(settings, agentId, agentWallets));
}

function resolveAgentModel(settings = {}, agentId = "gemini") {
  const agent = AGENT_DEFINITIONS[agentId];
  if (!agent) {
    return { aiProvider: "gemini", aiModel: AGENT_DEFINITIONS.gemini.coreModel, agentId: "gemini" };
  }

  const customKey = agentId === "ollama" ? "ollamaModelCustom" : `${agent.coreProvider}ModelCustom`;
  const customModel = String(settings[customKey] || "").trim();
  return {
    aiProvider: agent.coreProvider,
    aiModel: customModel || agent.coreModel,
    agentId: agent.id,
  };
}

function applyAgentOverlay(settings = {}, agentId = "gemini") {
  const resolved = resolveAgentModel(settings, agentId);
  return {
    ...settings,
    aiProvider: resolved.aiProvider,
    aiModel: resolved.aiModel,
    _finopsCoreOverlay: {
      ...(settings._finopsCoreOverlay || {}),
      coreModelTier: resolved.agentId,
      agentId: resolved.agentId,
      reason: "runtime-failover",
      originalProvider: settings._finopsCoreOverlay?.originalProvider || settings.aiProvider,
      originalModel: settings._finopsCoreOverlay?.originalModel || settings.aiModel,
    },
    _agentFailoverActive: true,
  };
}

function recordAgentHealth(agentId = "", ok = true, errorKind = "") {
  const entry = {
    agentId: String(agentId || "").trim() || "unknown",
    ok: Boolean(ok),
    errorKind: String(errorKind || "").trim(),
    at: new Date().toISOString(),
  };
  healthEvents.push(entry);
  while (healthEvents.length > MAX_HEALTH_EVENTS) {
    healthEvents.shift();
  }
  return entry;
}

function getAgentHealthSnapshot() {
  const byAgent = {};
  for (const entry of healthEvents) {
    if (!byAgent[entry.agentId]) {
      byAgent[entry.agentId] = { success: 0, failure: 0, lastAt: entry.at, lastErrorKind: "" };
    }
    if (entry.ok) {
      byAgent[entry.agentId].success += 1;
    } else {
      byAgent[entry.agentId].failure += 1;
      byAgent[entry.agentId].lastErrorKind = entry.errorKind;
    }
    byAgent[entry.agentId].lastAt = entry.at;
  }
  return {
    updatedAt: new Date().toISOString(),
    events: healthEvents.slice(-MAX_HEALTH_EVENTS),
    byAgent,
  };
}

function buildFailoverMessage(fromAgentId, toAgentId) {
  const fromLabel = AGENT_LABELS[fromAgentId] || fromAgentId || "Agent";
  const toLabel = AGENT_LABELS[toAgentId] || toAgentId || "yedek agent";
  return `${fromLabel} yanıt vermedi — ${toLabel}'ye geçtim.`;
}

function emitAgentFailoverAlert(payload) {
  if (!payload) {
    return;
  }

  if (payload.notifyEnabled !== false) {
    const targets = typeof resilienceContext.getWindows === "function"
      ? resilienceContext.getWindows()
      : [];

    for (const window of targets) {
      if (window && !window.isDestroyed()) {
        window.webContents.send("agent-failover-alert", payload);
      }
    }
  }

  if (typeof resilienceContext.onFailoverRecord === "function") {
    resilienceContext.onFailoverRecord(payload);
  }
}

function isFailoverEnabled(settings = {}) {
  if (settings.agentFailoverEnabled === false) {
    return false;
  }
  const { shouldAutoRouteCore } = require("./finops/routing-mode");
  return shouldAutoRouteCore(settings);
}

async function executeWithAgentResilience({
  settings = {},
  agentWallets = null,
  runStream,
  notifyEnabled = true,
}) {
  let liveSettings = { ...settings };
  let sameProviderRetried = false;
  let failoverAttempts = 0;
  const triedAgents = new Set();
  let lastFailoverInfo = null;

  const initialAgentId = providerToAgentId(liveSettings.aiProvider, liveSettings);
  if (initialAgentId) {
    triedAgents.add(initialAgentId);
  }

  while (true) {
    const currentAgentId = providerToAgentId(liveSettings.aiProvider, liveSettings)
      || String(liveSettings.aiProvider || "unknown");

    try {
      const result = await runStream(liveSettings);
      recordAgentHealth(currentAgentId, true, "");
      return { result, settings: liveSettings, failoverInfo: lastFailoverInfo };
    } catch (error) {
      const classified = classifyProviderError(error);
      recordAgentHealth(currentAgentId, false, classified.kind);

      if (classified.kind === "fatal" || !isFailoverEnabled(liveSettings)) {
        throw error;
      }

      if (classified.kind === "transient" && !sameProviderRetried) {
        sameProviderRetried = true;
        await delay(RETRY_BACKOFF_MS);
        continue;
      }

      if (failoverAttempts >= MAX_FAILOVER_ATTEMPTS) {
        throw error;
      }

      const chain = resolveFailoverChain(currentAgentId, liveSettings, agentWallets);
      const nextAgentId = chain.find((agentId) => !triedAgents.has(agentId));
      if (!nextAgentId) {
        throw error;
      }

      triedAgents.add(nextAgentId);
      const fromAgentId = typeof currentAgentId === "string" ? currentAgentId : String(currentAgentId);
      const fromProvider = liveSettings.aiProvider;
      liveSettings = applyAgentOverlay(liveSettings, nextAgentId);
      const failoverMessage = buildFailoverMessage(fromAgentId, nextAgentId);

      lastFailoverInfo = {
        fromAgent: fromAgentId,
        toAgent: nextAgentId,
        fromProvider,
        toProvider: liveSettings.aiProvider,
        message: failoverMessage,
      };

      emitAgentFailoverAlert({
        fromAgent: fromAgentId,
        toAgent: nextAgentId,
        fromProvider,
        toProvider: liveSettings.aiProvider,
        reason: classified.kind,
        message: failoverMessage,
        notifyEnabled: notifyEnabled !== false && liveSettings.agentFailoverNotifyEnabled !== false,
        at: new Date().toISOString(),
      });

      failoverAttempts += 1;
      sameProviderRetried = false;
    }
  }
}

module.exports = {
  AGENT_LABELS,
  RETRY_BACKOFF_MS,
  MAX_FAILOVER_ATTEMPTS,
  configureAgentResilienceContext,
  classifyProviderError,
  providerToAgentId,
  resolveFailoverChain,
  applyAgentOverlay,
  recordAgentHealth,
  getAgentHealthSnapshot,
  buildFailoverMessage,
  emitAgentFailoverAlert,
  isFailoverEnabled,
  executeWithAgentResilience,
};
