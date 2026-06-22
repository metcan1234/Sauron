const LOW_COMPLEXITY_KEYWORDS = [
  "fix",
  "typo",
  "rename",
  "import",
  "lint",
  "format",
];

const HIGH_COMPLEXITY_KEYWORDS = [
  "architecture",
  "security",
  "auth",
  "migrate",
  "schema",
  "database",
];

const MEDIUM_COMPLEXITY_KEYWORDS = [
  "refactor",
  "rewrite",
];

const DEFAULT_COMPLEXITY_KEYWORDS = [
  ...HIGH_COMPLEXITY_KEYWORDS,
  ...MEDIUM_COMPLEXITY_KEYWORDS,
];

const DEFAULT_TIER_MODELS = {
  economy: { providerId: "gemini", modelId: "gemini-2.5-flash-lite" },
  standard: { providerId: "deepseek", modelId: "deepseek-chat" },
  premium: { providerId: "openai", modelId: "gpt-4o-mini" },
  local: { providerId: "ollama", modelId: "qwen2.5-coder:7b" },
};

const PROVIDER_TO_CORE = {
  openrouter: "openrouter",
  openai: "openai",
  gemini: "gemini",
  google: "gemini",
  ollama: "ollama",
  groq: "groq",
  deepseek: "deepseek",
};

function normalizeTierModel(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const providerId = String(entry.providerId || "").trim();
  const modelId = String(entry.modelId || "").trim();
  if (!providerId || !modelId) {
    return null;
  }
  return { providerId, modelId };
}

function mergeTierModels(overrides = {}) {
  const merged = { ...DEFAULT_TIER_MODELS };
  for (const tier of Object.keys(DEFAULT_TIER_MODELS)) {
    const normalized = normalizeTierModel(overrides[tier]);
    if (normalized) {
      merged[tier] = normalized;
    }
  }
  return merged;
}

const DEFAULT_PROJECT_BUDGETS = {
  "corporate-web": { dailyBudgetTl: 15, defaultTier: "economy" },
  "electron-core": { dailyBudgetTl: 25, defaultTier: "balanced" },
  "bridge-extension": { dailyBudgetTl: 10, defaultTier: "economy" },
  "monorepo-stack": { dailyBudgetTl: 30, defaultTier: "balanced" },
  generic: { dailyBudgetTl: 0, defaultTier: "economy" },
};

function buildDefaultCostOptimizerConfig() {
  return {
    enabled: true,
    mode: "balanced",
    coreModelTier: "economy",
    models: { ...DEFAULT_TIER_MODELS },
    projectBudgets: { ...DEFAULT_PROJECT_BUDGETS },
    routing: {
      defaultTier: "economy",
      handoffMaxChars: 4000,
      includeTranscript: false,
      complexityKeywords: [...DEFAULT_COMPLEXITY_KEYWORDS],
    },
    budgetGovernor: {
      enabled: true,
      dailyBudgetTl: 0,
      warnAtRemainingPct: 30,
    },
  };
}

function mergeCostOptimizerConfig(settings = {}) {
  const defaults = buildDefaultCostOptimizerConfig();
  const enabled = settings.finopsCostOptimizerEnabled !== false;
  const mode = ["economy", "balanced", "performance"].includes(settings.finopsCostOptimizerMode)
    ? settings.finopsCostOptimizerMode
    : defaults.mode;
  const coreModelTier = ["economy", "standard", "premium", "local"].includes(settings.finopsCoreModelTier)
    ? settings.finopsCoreModelTier
    : defaults.coreModelTier;

  const handoffMaxChars = Number.isFinite(Number(settings.finopsHandoffMaxChars))
    ? Math.max(100, Number(settings.finopsHandoffMaxChars))
    : defaults.routing.handoffMaxChars;

  const dailyBudgetTl = Number.isFinite(Number(settings.finopsDailyBudgetTl))
    ? Math.max(0, Number(settings.finopsDailyBudgetTl))
    : defaults.budgetGovernor.dailyBudgetTl;

  return {
    enabled,
    mode,
    coreModelTier,
    models: mergeTierModels(settings.finopsOptimizerModels),
    projectBudgets: { ...defaults.projectBudgets },
    routing: {
      ...defaults.routing,
      handoffMaxChars,
      includeTranscript: settings.finopsHandoffIncludeTranscript === true,
    },
    budgetGovernor: {
      ...defaults.budgetGovernor,
      dailyBudgetTl,
    },
  };
}

function mapProviderIdToCore(providerId) {
  const key = String(providerId || "").trim().toLowerCase();
  return PROVIDER_TO_CORE[key] || key || "openrouter";
}

function resolveCoreModelOverlay(settings = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  if (!optimizer.enabled) {
    return null;
  }

  const tier = optimizer.coreModelTier;
  const tierModel = optimizer.models[tier];
  if (!tierModel) {
    return null;
  }

  const aiProvider = mapProviderIdToCore(tierModel.providerId);
  return {
    aiProvider,
    aiModel: tierModel.modelId,
    coreModelTier: tier,
    optimizerEnabled: true,
  };
}

function countKeywordHits(normalized, keywords) {
  return keywords.filter((keyword) => normalized.includes(String(keyword).toLowerCase())).length;
}

function computeComplexityHint(text) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized.trim()) {
    return "low";
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const lowHits = countKeywordHits(normalized, LOW_COMPLEXITY_KEYWORDS);
  const highHits = countKeywordHits(normalized, HIGH_COMPLEXITY_KEYWORDS);
  const mediumHits = countKeywordHits(normalized, MEDIUM_COMPLEXITY_KEYWORDS);

  if (highHits >= 2 || (highHits >= 1 && wordCount >= 400) || wordCount >= 1200) {
    return "high";
  }
  if (mediumHits >= 1 || wordCount >= 500) {
    return "medium";
  }
  if (wordCount < 80 && highHits === 0 && lowHits >= 1) {
    return "low";
  }
  if (wordCount < 80 && highHits === 0) {
    return "low";
  }
  return "low";
}

function resolveProjectBudget(projectType, optimizer) {
  const key = String(projectType || "generic").trim();
  const budgets = optimizer?.projectBudgets || DEFAULT_PROJECT_BUDGETS;
  return budgets[key] || budgets.generic || { dailyBudgetTl: 0, defaultTier: "economy" };
}

function resolvePanelContextMessages(settings = {}) {
  const numeric = Number(settings.finopsPanelContextMessages);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(50, Math.floor(numeric));
  }
  return 20;
}

function resolveMemoryCompressThreshold(settings = {}, fallback = 40) {
  if (settings.finopsMemoryCompressThreshold === undefined || settings.finopsMemoryCompressThreshold === null) {
    return fallback;
  }
  const numeric = Number(settings.finopsMemoryCompressThreshold);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

function resolveMemoryCompressBatch(settings = {}, fallback = 20) {
  if (settings.finopsMemoryCompressBatch === undefined || settings.finopsMemoryCompressBatch === null) {
    return fallback;
  }
  const numeric = Number(settings.finopsMemoryCompressBatch);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

module.exports = {
  DEFAULT_TIER_MODELS,
  LOW_COMPLEXITY_KEYWORDS,
  HIGH_COMPLEXITY_KEYWORDS,
  MEDIUM_COMPLEXITY_KEYWORDS,
  DEFAULT_COMPLEXITY_KEYWORDS,
  DEFAULT_PROJECT_BUDGETS,
  buildDefaultCostOptimizerConfig,
  mergeCostOptimizerConfig,
  mergeTierModels,
  mapProviderIdToCore,
  resolveCoreModelOverlay,
  resolveProjectBudget,
  computeComplexityHint,
  resolvePanelContextMessages,
  resolveMemoryCompressThreshold,
  resolveMemoryCompressBatch,
};
