const { executeWithAgentResilience } = require("./agent-resilience");
const { appendGamedevLedgerEvent } = require("./gamedev-finops-ledger");

function wrapGamedevStreamAIResponse(streamAIResponse, settings = {}, workspacePath = "") {
  if (typeof streamAIResponse !== "function") {
    return null;
  }

  return async (request = {}) => {
    const baseSettings = { ...(request.settings || settings) };
    const result = await executeWithAgentResilience({
      settings: baseSettings,
      agentWallets: request.agentWallets || null,
      notifyEnabled: request.notifyEnabled,
      runStream: (liveSettings) => streamAIResponse({
        ...request,
        settings: liveSettings,
        channel: "gamedev",
      }),
    });

    if (result?.failoverInfo && workspacePath) {
      appendGamedevLedgerEvent(workspacePath, {
        type: "agent-failover",
        fromAgent: result.failoverInfo.fromAgent,
        toAgent: result.failoverInfo.toAgent,
        message: result.failoverInfo.message,
      }, result.settings || baseSettings);
    }

    return result.result;
  };
}

module.exports = {
  wrapGamedevStreamAIResponse,
};
