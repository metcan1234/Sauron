export interface TierModel {
	providerId: string
	modelId: string
}

export interface AgentMatrixEntry {
	id: string
	core: { provider: string; model: string }
	cline: { providerId: string; modelId: string }
	configured?: boolean
}

export interface AgentMatrix {
	version: number
	agents: AgentMatrixEntry[]
	routing: {
		core: Record<string, string>
		cline: Record<string, string>
	}
}

export interface CostOptimizerRouting {
	defaultTier: string
	handoffMaxChars: number
	includeTranscript: boolean
	complexityKeywords: string[]
}

export interface CostOptimizerBudgetGovernor {
	enabled: boolean
	dailyBudgetTl: number
	warnAtRemainingPct: number
}

export interface CostOptimizerConfig {
	enabled: boolean
	mode: "economy" | "balanced" | "performance"
	coreModelTier: "economy" | "standard" | "premium" | "local"
	models: {
		economy: TierModel
		standard: TierModel
		premium: TierModel
		local: TierModel
	}
	routing: CostOptimizerRouting
	budgetGovernor: CostOptimizerBudgetGovernor
	agentMatrix?: AgentMatrix
}

export interface FinOpsConfig {
	enabled: boolean
	finopsUsdToTl: number
	pollIntervalMs: number
	emitMode?: "task-complete" | "per-request"
	costOptimizer?: CostOptimizerConfig
}

export interface UsageLedgerRecord {
	provider: string
	model: string
	promptTokens: number
	completionTokens: number
	costTl: number
	operation: string
	latencyMs: number
	timestamp: string
	recordId?: string
	source?: string
	costUsd?: number
}

export interface ClineExportState {
	exportedTaskIds: string[]
}
