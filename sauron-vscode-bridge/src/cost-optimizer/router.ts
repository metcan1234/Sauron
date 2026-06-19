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
	medium: "gemini",
	high: "openai",
}

const COMPLEXITY_KEYWORDS = ["refactor", "architecture", "debug", "security", "migrate", "rewrite"]

const DEFAULT_AGENT_MATRIX: AgentMatrix = {
	version: 1,
	agents: [
		{
			id: "gemini",
			core: { provider: "gemini", model: "gemini-2.0-flash" },
			cline: { providerId: "gemini", modelId: "gemini-2.5-flash" },
			configured: true,
		},
		{
			id: "deepseek",
			core: { provider: "deepseek", model: "deepseek-chat" },
			cline: { providerId: "deepseek", modelId: "deepseek-chat" },
			configured: true,
		},
		{
			id: "openai",
			core: { provider: "openai", model: "gpt-4o-mini" },
			cline: { providerId: "openai", modelId: "gpt-4o-mini" },
			configured: true,
		},
		{
			id: "ollama",
			core: { provider: "ollama", model: "qwen2.5-coder:7b" },
			cline: { providerId: "ollama", modelId: "qwen2.5-coder:7b" },
			configured: false,
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

export function computeComplexityHint(text: string, keywords: string[] = COMPLEXITY_KEYWORDS): ComplexityHint {
	const normalized = String(text || "").toLowerCase()
	if (!normalized.trim()) {
		return "low"
	}
	const wordCount = normalized.split(/\s+/).filter(Boolean).length
	const keywordHits = keywords.filter((keyword) => normalized.includes(String(keyword).toLowerCase())).length
	if (keywordHits >= 2 || wordCount > 800) {
		return "high"
	}
	if (keywordHits >= 1 || wordCount > 300) {
		return "medium"
	}
	return "low"
}

function pickConfiguredAgent(matrix: AgentMatrix, preferredOrder: string[]) {
	for (const agentId of preferredOrder) {
		const agent = matrix.agents.find((entry) => entry.id === agentId)
		if (agent && agent.configured !== false) {
			return agent
		}
	}
	return matrix.agents.find((entry) => entry.configured !== false) || matrix.agents[0]
}

export function resolveClineAgent(
	complexityHint: ComplexityHint | undefined,
	agentMatrix: AgentMatrix | undefined,
	options: { downgradeOneTier?: boolean; fallbackText?: string } = {},
): ClineAgentSelection | null {
	const matrix = agentMatrix || DEFAULT_AGENT_MATRIX
	let hint = normalizeComplexityHint(complexityHint)
	if (!complexityHint && options.fallbackText) {
		hint = computeComplexityHint(options.fallbackText)
	}

	if (options.downgradeOneTier && hint === "high") {
		hint = "medium"
	} else if (options.downgradeOneTier && hint === "medium") {
		hint = "low"
	}

	const preferredId = CLINE_COMPLEXITY_MAP[hint] || "deepseek"
	const agent = pickConfiguredAgent(matrix, [preferredId, "deepseek", "gemini", "openai", "ollama"])
	if (!agent) {
		return null
	}

	return {
		providerId: agent.cline.providerId,
		modelId: agent.cline.modelId,
		agentId: agent.id,
		reason: `complexity-${hint}`,
	}
}
