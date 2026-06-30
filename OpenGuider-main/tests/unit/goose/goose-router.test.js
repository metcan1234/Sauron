const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveGooseMode,
  resolveModeProviderConfig,
  hasOllamaConfigured,
  applyBudgetDowngrade,
} = require("../../../src/sauron/goose-router");

test("resolveModeProviderConfig uses deepseek via openai-compatible host when key present", () => {
  const cfg = resolveModeProviderConfig("balanced", {
    deepseekApiKey: "sk-test",
    deepseekModelCustom: "deepseek-chat",
    deepseekBaseUrl: "https://api.deepseek.com",
  });
  assert.equal(cfg.provider, "openai");
  assert.equal(cfg.model, "deepseek-chat");
  assert.equal(cfg.envOverrides.OPENAI_API_KEY, "sk-test");
  assert.equal(cfg.envOverrides.GOOSE_PROVIDER__HOST, "https://api.deepseek.com/v1");
  assert.equal(cfg.routeNote, "deepseek-openai-compat");
});

test("resolveModeProviderConfig uses openrouter via openai-compatible host", () => {
  const cfg = resolveModeProviderConfig("balanced", {
    openrouterApiKey: "sk-or-test",
  });
  assert.equal(cfg.provider, "openai");
  assert.equal(cfg.model, "deepseek/deepseek-chat");
  assert.equal(cfg.envOverrides.GOOSE_PROVIDER__HOST, "https://openrouter.ai/api/v1");
  assert.equal(cfg.envOverrides.OPENAI_API_KEY, "sk-or-test");
});

test("resolveModeProviderConfig economy uses ollama model from settings", () => {
  const cfg = resolveModeProviderConfig("economy", {
    ollamaUrl: "http://localhost:11434",
    ollamaModelCustom: "qwen2.5-coder:7b",
  });
  assert.equal(cfg.provider, "ollama");
  assert.equal(cfg.model, "qwen2.5-coder:7b");
  assert.equal(cfg.envOverrides.GOOSE_MAX_TURNS, "40");
  assert.equal(cfg.envOverrides.GOOSE_CONTEXT_STRATEGY, "summarize");
});

test("hasOllamaConfigured requires url and model", () => {
  assert.equal(hasOllamaConfigured({ ollamaUrl: "http://localhost:11434" }), false);
  assert.equal(
    hasOllamaConfigured({ ollamaUrl: "http://localhost:11434", ollamaModelCustom: "qwen" }),
    true,
  );
});

test("resolveGooseMode falls back to balanced when economy ollama missing", async () => {
  const routing = await resolveGooseMode("dosyayı aç", {
    gooseAutoMode: true,
    ollamaUrl: "",
    ollamaModelCustom: "",
    deepseekApiKey: "sk-test",
  });
  assert.equal(routing.mode, "balanced");
  assert.match(routing.reason, /fallback|complexity|ollama/i);
  assert.ok(routing.notices.some((n) => /Ollama/i.test(n)));
});

test("resolveGooseMode respects manual default when auto off", async () => {
  const routing = await resolveGooseMode("herhangi görev", {
    gooseAutoMode: false,
    gooseDefaultMode: "premium",
    openaiApiKey: "sk-test",
  });
  assert.equal(routing.mode, "premium");
  assert.equal(routing.reason, "manual-goose");
});

test("applyBudgetDowngrade is opt-in via gooseBudgetAutoDowngrade", async () => {
  const mode = await applyBudgetDowngrade("premium", {
    gooseDailyBudgetTl: 1,
    gooseBudgetAutoDowngrade: false,
  });
  assert.equal(mode, "premium");
});

test("detectGooseComplexity routes rewrite to balanced via medium keywords", () => {
  const { detectGooseComplexity } = require("../../../src/sauron/goose-complexity");
  assert.equal(detectGooseComplexity("rewrite the helper utilities"), "balanced");
});
