const {
  resolveAgentForCline,
  pickRoutableAgent,
  CLINE_CLOUD_FALLBACK_ORDER,
  AGENT_DEFINITIONS,
} = require("./finops/agent-matrix");

function isFailoverEligible(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return /429|503|504|timeout|rate.?limit|overloaded|unavailable|deepseek|credit|quota|billing|econnreset|socket hang up/.test(text);
}

function buildCoreSettingsForAgent(settings, agentId) {
  const agent = AGENT_DEFINITIONS[agentId];
  if (!agent) {
    return settings;
  }
  return {
    ...settings,
    aiProvider: agent.coreProvider,
    aiModel: agent.coreModel,
    _finopsCoreOverlay: {
      coreModelTier: agent.id,
      agentId: agent.id,
    },
  };
}

function buildAgentAttemptChain(settings = {}, agentWallets = null) {
  const primary = resolveAgentForCline("low", settings, { agentWallets });
  const preferredId = primary?.agentId || "deepseek";
  const order = [preferredId, ...CLINE_CLOUD_FALLBACK_ORDER.filter((id) => id !== preferredId)];
  const attempts = [];
  const seen = new Set();

  for (const agentId of order) {
    if (seen.has(agentId)) {
      continue;
    }
    seen.add(agentId);
    const agent = pickRoutableAgent(settings, [agentId], agentWallets);
    if (agent) {
      attempts.push(agent.id);
    }
  }

  if (attempts.length === 0) {
    attempts.push(preferredId);
  }
  return { attempts, primaryId: preferredId };
}

async function executeWithAgentResilience({
  settings = {},
  agentWallets = null,
  notifyEnabled = false,
  runStream,
}) {
  if (typeof runStream !== "function") {
    throw new Error("runStream is required");
  }

  const { attempts, primaryId } = buildAgentAttemptChain(settings, agentWallets);
  let lastError = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const agentId = attempts[index];
    const liveSettings = buildCoreSettingsForAgent(settings, agentId);
    try {
      const result = await runStream(liveSettings);
      return {
        result,
        settings: liveSettings,
        failoverInfo: index === 0
          ? null
          : {
            fromAgent: primaryId,
            toAgent: agentId,
            message: lastError?.message || "primary-agent-failed",
            notifyEnabled: notifyEnabled === true,
          },
      };
    } catch (error) {
      lastError = error;
      const canRetry = index < attempts.length - 1 && isFailoverEligible(error);
      if (!canRetry) {
        throw error;
      }
    }
  }

  throw lastError || new Error("agent-resilience-exhausted");
}

module.exports = {
  executeWithAgentResilience,
  isFailoverEligible,
  buildAgentAttemptChain,
};
