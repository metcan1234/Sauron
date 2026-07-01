const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyProviderError,
  providerToAgentId,
  resolveFailoverChain,
  applyAgentOverlay,
  isFailoverEnabled,
  executeWithAgentResilience,
  buildFailoverMessage,
} = require("../../src/sauron/agent-resilience");

describe("agent-resilience", () => {
  it("classifies auth errors without retry path", () => {
    const result = classifyProviderError(new Error("Claude API error 401: invalid api key"));
    assert.equal(result.kind, "auth");
  });

  it("classifies transient errors for retry", () => {
    const result = classifyProviderError(new Error("DeepSeek API error 503: unavailable"));
    assert.equal(result.kind, "transient");
  });

  it("classifies abort as fatal", () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    const result = classifyProviderError(error);
    assert.equal(result.kind, "fatal");
  });

  it("resolves failover chain excluding failed agent", () => {
    const settings = {
      geminiApiKey: "g",
      deepseekApiKey: "d",
      openaiApiKey: "o",
    };
    const chain = resolveFailoverChain("deepseek", settings, null);
    assert.deepEqual(chain, ["gemini", "openai"]);
  });

  it("maps provider to agent id", () => {
    assert.equal(providerToAgentId("deepseek", {}), "deepseek");
    assert.equal(providerToAgentId("gemini", { _finopsCoreOverlay: { agentId: "gemini" } }), "gemini");
  });

  it("applies agent overlay to settings", () => {
    const next = applyAgentOverlay({ aiProvider: "deepseek", aiModel: "deepseek-chat" }, "gemini");
    assert.equal(next.aiProvider, "gemini");
    assert.equal(next._finopsCoreOverlay.agentId, "gemini");
  });

  it("disables failover in manual routing mode", () => {
    const settings = {
      finopsCostOptimizerEnabled: true,
      agentControlMode: "manual",
      coreRoutingMode: "manual",
    };
    assert.equal(isFailoverEnabled(settings), false);
  });

  it("retries transient once before failover", async () => {
    let attempts = 0;
    const alerts = [];
    const { configureAgentResilienceContext } = require("../../src/sauron/agent-resilience");
    configureAgentResilienceContext({
      getWindows: () => [],
      onFailoverRecord: (payload) => alerts.push(payload),
    });

    const settings = {
      agentFailoverEnabled: true,
      finopsCostOptimizerEnabled: true,
      agentControlMode: "auto",
      coreRoutingMode: "auto",
      aiProvider: "deepseek",
      geminiApiKey: "g",
      deepseekApiKey: "d",
      openaiApiKey: "o",
    };

    const { result, failoverInfo } = await executeWithAgentResilience({
      settings,
      agentWallets: null,
      runStream: async (attemptSettings) => {
        attempts += 1;
        if (attemptSettings.aiProvider === "deepseek" && attempts <= 2) {
          throw new Error("DeepSeek API error 503: unavailable");
        }
        return { text: "ok", providerUsage: null };
      },
    });

    assert.equal(result.text, "ok");
    assert.ok(attempts >= 3);
    assert.ok(failoverInfo);
    assert.equal(failoverInfo.toAgent, "gemini");
  });

  it("builds Turkish failover message", () => {
    assert.match(buildFailoverMessage("deepseek", "gemini"), /DeepSeek/);
    assert.match(buildFailoverMessage("deepseek", "gemini"), /Gemini/);
  });
});
