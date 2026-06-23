const { detectGooseComplexity } = require("./goose-complexity");
const { getGooseTodaySpentTl } = require("./goose-finops");
const { GOOSE_TOKEN_MODES } = require("./goose-config");
const { checkOllamaRunning } = require("./goose-ollama-check");

function hasOllamaConfigured(settings = {}) {
  const url = String(settings.ollamaUrl || "").trim();
  const model = String(settings.ollamaModelCustom || "").trim();
  return Boolean(url && model);
}

function resolveModeProviderConfig(mode, settings = {}) {
  const key = ["economy", "balanced", "premium"].includes(mode) ? mode : "balanced";
  const base = { ...GOOSE_TOKEN_MODES[key] };

  if (key === "economy") {
    const model = String(settings.ollamaModelCustom || base.model || "qwen2.5-coder").trim();
    return { ...base, provider: "ollama", model };
  }

  if (key === "balanced") {
    const deepseekModel = String(settings.deepseekModelCustom || base.model || "deepseek-chat").trim();
    if (String(settings.deepseekApiKey || "").trim()) {
      return { ...base, provider: "deepseek", model: deepseekModel };
    }
    if (String(settings.openrouterApiKey || "").trim()) {
      return {
        ...base,
        provider: "openai",
        model: "deepseek/deepseek-chat",
        envOverrides: {
          OPENAI_API_KEY: String(settings.openrouterApiKey).trim(),
          GOOSE_PROVIDER__HOST: "https://openrouter.ai/api/v1",
        },
        routeNote: "openrouter-openai-compat",
      };
    }
    if (String(settings.openaiApiKey || "").trim()) {
      return {
        ...base,
        provider: "openai",
        model: String(settings.openaiModelCustom || base.fallbackModel || "gpt-4o-mini").trim(),
      };
    }
    return {
      ...base,
      provider: base.fallbackProvider || "openai",
      model: base.fallbackModel || "gpt-4o-mini",
      fallbackReason: "deepseek-unavailable",
    };
  }

  return { ...base, provider: "openai", model: "gpt-4o-mini" };
}

async function applyBudgetDowngrade(mode, settings = {}) {
  const dailyLimit = Number(settings.gooseDailyBudgetTl) || 0;
  if (dailyLimit <= 0) {
    return mode;
  }

  const spent = await getGooseTodaySpentTl(settings);
  const remaining = dailyLimit - spent;
  const remainingRatio = remaining / dailyLimit;

  if (remainingRatio < 0.2) {
    return "economy";
  }
  if (remainingRatio < 0.5 && mode === "premium") {
    return "balanced";
  }
  return mode;
}

async function resolveGooseMode(taskText, settings = {}) {
  if (settings.gooseEnabled === false) {
    return { mode: "balanced", reason: "goose-disabled", providerConfig: null };
  }

  let mode = settings.gooseAutoMode === false
    ? String(settings.gooseDefaultMode || "balanced")
    : detectGooseComplexity(taskText);

  mode = await applyBudgetDowngrade(mode, settings);

  let providerConfig = resolveModeProviderConfig(mode, settings);
  let reason = settings.gooseAutoMode === false ? "manual-default" : "complexity-route";
  const notices = [];

  if (mode === "economy" && !hasOllamaConfigured(settings)) {
    mode = "balanced";
    providerConfig = resolveModeProviderConfig(mode, settings);
    reason = "economy-ollama-missing-fallback-balanced";
    notices.push("Ollama yapılandırılmadı — Balanced moda geçildi.");
  } else if (mode === "economy") {
    const running = await checkOllamaRunning(settings.ollamaUrl);
    if (!running) {
      mode = "balanced";
      providerConfig = resolveModeProviderConfig(mode, settings);
      reason = "economy-ollama-down-fallback-balanced";
      notices.push("Ollama çalışmıyor — Balanced moda geçildi.");
    }
  }

  if (providerConfig.fallbackReason) {
    notices.push("DeepSeek/OpenAI anahtarı yok — OpenAI fallback kullanılıyor.");
  } else if (providerConfig.routeNote === "openrouter-openai-compat") {
    notices.push("OpenRouter, OpenAI uyumlu endpoint üzerinden kullanılıyor.");
  }

  return {
    mode,
    reason,
    providerConfig,
    notices,
  };
}

module.exports = {
  resolveGooseMode,
  resolveModeProviderConfig,
  hasOllamaConfigured,
  applyBudgetDowngrade,
};
