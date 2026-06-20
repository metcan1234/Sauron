import type { AgentMatrix } from "../usage/types"

export type ComplexityHint = "low" | "medium" | "high"

export interface ClineAgentSelection {
	providerId: string
	modelId: string
	agentId: string
	reason: string
}

const CLINE_COMPLEXITY_MAP: Record<ComplexityHint, string> = {
	low: "deepseek",
	medium: "deepseek",
	high: "openai",
}

const CLOUD_AGENT_IDS = ["gemini", "deepseek", "openai"]
const CLINE_CLOUD_FALLBACK_ORDER = ["deepseek", "gemini", "openai"]

const HIGH_COMPLEXITY_KEYWORDS = ["architecture", "security", "auth", "migrate", "schema", "database"]
const MEDIUM_COMPLEXITY_KEYWORDS = ["refactor", "rewrite"]

const DEFAULT_AGENT_MATRIX: AgentMatrix = {
	version: 1,
	agents: [
		{
			id: "gemini",
			core: { provider: "gemini", model: "gemini-2.5-flash-lite" },
			cline: { providerId: "gemini", modelId: "gemini-2.5-flash" },
			configured: true,
			walletAvailable: true,
		},
		{
			id: "deepseek",
			core: { provider: "deepseek", model: "deepseek-chat" },
			cline: { providerId: "deepseek", modelId: "deepseek-chat" },
			configured: true,
			walletAvailable: true,
		},
		{
			id: "openai",
			core: { provider: "openai", model: "gpt-4o-mini" },
			cline: { providerId: "openai", modelId: "gpt-4o-mini" },
			configured: true,
			walletAvailable: true,
		},
		{
			id: "ollama",
			core: { provider: "ollama", model: "qwen2.5-coder:7b" },
			cline: { providerId: "ollama", modelId: "qwen2.5-coder:7b" },
			configured: false,
			walletAvailable: true,
		},
	],
	routing: {
		core: { low: "gemini", medium: "gemini", high: "deepseek" },
		cline: { ...CLINE_COMPLEXITY_MAP },
	},
}

function normalizeComplexityHint(hint?: string): ComplexityHint {
	if (hint === "medium" || hint === "high" || hint === "low") {
		return hint
	}
	return "low"
}

function countKeywordHits(normalized: string, keywords: string[]): number {
	return keywords.filter((keyword) => normalized.includes(String(keyword).toLowerCase())).length
}

export function computeComplexityHint(text: string): ComplexityHint {
	const normalized = String(text || "").toLowerCase()
	if (!normalized.trim()) {
		return "low"
	}
	const wordCount = normalized.split(/\s+/).filter(Boolean).length
	const highHits = countKeywordHits(normalized, HIGH_COMPLEXITY_KEYWORDS)
	const mediumHits = countKeywordHits(normalized, MEDIUM_COMPLEXITY_KEYWORDS)
	if (highHits >= 2 || (highHits >= 1 && wordCount >= 400) || wordCount >= 1200) {
		return "high"
	}
	if (mediumHits >= 1 || wordCount >= 500) {
		return "medium"
	}
	return "low"
}

function buildCloudFallbackOrder(preferredId: string, cloudOrder: string[]): string[] {
	const order: string[] = []
	const seen = new Set<string>()
	for (const agentId of [preferredId, ...cloudOrder]) {
		if (!agentId || seen.has(agentId) || !CLOUD_AGENT_IDS.includes(agentId)) {
			continue
		}
		seen.add(agentId)
		order.push(agentId)
	}
	return order
}

function pickConfiguredAgent(matrix: AgentMatrix, preferredOrder: string[], requireWallet = true) {
	for (const agentId of preferredOrder) {
		const agent = matrix.agents.find((entry) => entry.id === agentId)
		if (!agent || agent.configured === false) {
			continue
		}
		if (requireWallet && agent.walletAvailable === false) {
			continue
		}
		return agent
	}
	return null
}

function resolvePreferredAgentId(
	hint: ComplexityHint,
	matrix: AgentMatrix,
	options: { budgetGovernorActive?: boolean },
): { agentId: string; reason: string } {
	let preferredId = CLINE_COMPLEXITY_MAP[hint] || "deepseek"
	let reason = `complexity-${hint}`

	if (options.budgetGovernorActive && hint === "high") {
		preferredId = "deepseek"
		reason = "budget-governor-high-to-deepseek"
	}

	const openaiAgent = matrix.agents.find((entry) => entry.id === "openai")
	if (hint === "high" && preferredId === "openai" && openaiAgent?.configured === false) {
		preferredId = "deepseek"
		reason = "complexity-high-fallback-deepseek"
	}

	return { agentId: preferredId, reason }
}

export function resolveClineAgent(
	complexityHint: ComplexityHint | undefined,
	agentMatrix: AgentMatrix | undefined,
	options: {
		budgetGovernorActive?: boolean
		downgradeOneTier?: boolean
		fallbackText?: string
	} = {},
): ClineAgentSelection | null {
	const matrix = agentMatrix || DEFAULT_AGENT_MATRIX
	let hint = normalizeComplexityHint(complexityHint)
	if (!complexityHint && options.fallbackText) {
		hint = computeComplexityHint(options.fallbackText)
	}

	const budgetGovernorActive = options.budgetGovernorActive === true || options.downgradeOneTier === true

	const { agentId: preferredId, reason: baseReason } = resolvePreferredAgentId(hint, matrix, {
		budgetGovernorActive,
	})
	const preferredOrder = buildCloudFallbackOrder(preferredId, CLINE_CLOUD_FALLBACK_ORDER)
	let agent = pickConfiguredAgent(matrix, preferredOrder, true)
	let reason = baseReason

	if (agent && preferredOrder[0] !== agent.id) {
		const exhaustedPreferred = matrix.agents.find((entry) => entry.id === preferredOrder[0])
		if (exhaustedPreferred?.walletAvailable === false) {
			reason = `wallet-exhausted-fallback-${preferredOrder[0]}`
		}
	}

	if (!agent) {
		agent = pickConfiguredAgent(matrix, preferredOrder, false)
		reason = agent ? "wallet-exhausted-all-cloud" : baseReason
	}

	if (!agent) {
		return null
	}

	if (hint === "high" && preferredId === "openai" && agent.id === "deepseek" && reason === `complexity-${hint}`) {
		reason = "complexity-high-fallback-deepseek"
	}

	return {
		providerId: agent.cline.providerId,
		modelId: agent.cline.modelId,
		agentId: agent.id,
		reason,
	}
}
