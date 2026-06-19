import type { CostOptimizerConfig, TierModel } from "../usage/types"

const DEFAULT_COMPLEXITY_KEYWORDS = [
	"refactor",
	"architecture",
	"debug",
	"security",
	"migrate",
	"rewrite",
]

const DEFAULT_TIER_MODELS: Record<string, TierModel> = {
	economy: { providerId: "gemini", modelId: "gemini-2.0-flash" },
	standard: { providerId: "deepseek", modelId: "deepseek-chat" },
	premium: { providerId: "openai", modelId: "gpt-4o-mini" },
	local: { providerId: "ollama", modelId: "qwen2.5-coder:7b" },
}

export function buildDefaultCostOptimizerConfig(): CostOptimizerConfig {
	return {
		enabled: true,
		mode: "balanced",
		coreModelTier: "economy",
		models: {
			economy: { ...DEFAULT_TIER_MODELS.economy },
			standard: { ...DEFAULT_TIER_MODELS.standard },
			premium: { ...DEFAULT_TIER_MODELS.premium },
			local: { ...DEFAULT_TIER_MODELS.local },
		},
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
	}
}

function normalizeTierModel(entry: unknown): TierModel | null {
	if (!entry || typeof entry !== "object") {
		return null
	}
	const record = entry as Partial<TierModel>
	const providerId = String(record.providerId || "").trim()
	const modelId = String(record.modelId || "").trim()
	if (!providerId || !modelId) {
		return null
	}
	return { providerId, modelId }
}

export function mergeCostOptimizerConfig(raw: unknown): CostOptimizerConfig {
	const defaults = buildDefaultCostOptimizerConfig()
	if (!raw || typeof raw !== "object") {
		return defaults
	}

	const parsed = raw as Partial<CostOptimizerConfig>
	const mode = parsed.mode === "economy" || parsed.mode === "performance" ? parsed.mode : defaults.mode
	const coreModelTier =
		parsed.coreModelTier === "standard" ||
		parsed.coreModelTier === "premium" ||
		parsed.coreModelTier === "local"
			? parsed.coreModelTier
			: defaults.coreModelTier

	const models = { ...defaults.models }
	if (parsed.models && typeof parsed.models === "object") {
		for (const tier of Object.keys(defaults.models) as Array<keyof CostOptimizerConfig["models"]>) {
			const normalized = normalizeTierModel((parsed.models as Record<string, unknown>)[tier])
			if (normalized) {
				models[tier] = normalized
			}
		}
	}

	const routing =
		parsed.routing && typeof parsed.routing === "object"
			? (parsed.routing as Partial<CostOptimizerConfig["routing"]>)
			: {}
	const budgetGovernor =
		parsed.budgetGovernor && typeof parsed.budgetGovernor === "object"
			? (parsed.budgetGovernor as Partial<CostOptimizerConfig["budgetGovernor"]>)
			: {}

	return {
		enabled: parsed.enabled !== false,
		mode,
		coreModelTier,
		models,
		routing: {
			defaultTier: String(routing.defaultTier || defaults.routing.defaultTier),
			handoffMaxChars: Number.isFinite(Number(routing.handoffMaxChars))
				? Math.max(100, Number(routing.handoffMaxChars))
				: defaults.routing.handoffMaxChars,
			includeTranscript: routing.includeTranscript === true,
			complexityKeywords: Array.isArray(routing.complexityKeywords)
				? routing.complexityKeywords.map(String)
				: defaults.routing.complexityKeywords,
		},
		budgetGovernor: {
			enabled: budgetGovernor.enabled !== false,
			dailyBudgetTl: Number.isFinite(Number(budgetGovernor.dailyBudgetTl))
				? Math.max(0, Number(budgetGovernor.dailyBudgetTl))
				: defaults.budgetGovernor.dailyBudgetTl,
			warnAtRemainingPct: Number.isFinite(Number(budgetGovernor.warnAtRemainingPct))
				? Number(budgetGovernor.warnAtRemainingPct)
				: defaults.budgetGovernor.warnAtRemainingPct,
		},
		agentMatrix:
			parsed.agentMatrix && typeof parsed.agentMatrix === "object"
				? (parsed.agentMatrix as CostOptimizerConfig["agentMatrix"])
				: undefined,
	}
}
