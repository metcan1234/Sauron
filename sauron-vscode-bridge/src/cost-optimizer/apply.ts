import type { ClineAPI } from "../cline"
import type { FinOpsConfig } from "../usage/types"
import type { SauronHandoff } from "../handoff/types"
import { appendUsageRecord } from "../usage/export"
import { resolveBudgetDowngrade } from "./governor"
import { resolveClineAgent } from "./router"

export interface ApplyClineModelResult {
	applied: boolean
	selection?: {
		providerId: string
		modelId: string
		agentId: string
		reason: string
	}
}

export async function applyClineModelBeforeHandoff(
	cline: ClineAPI,
	handoff: SauronHandoff,
	finopsConfig: FinOpsConfig,
	workspaceRoot: string,
): Promise<ApplyClineModelResult> {
	const optimizer = finopsConfig.costOptimizer
	if (!optimizer?.enabled || !cline.setActiveModel) {
		return { applied: false }
	}

	const downgradeOneTier = await resolveBudgetDowngrade(
		workspaceRoot,
		optimizer,
		handoff.id,
	)

	const selection = resolveClineAgent(handoff.complexityHint, optimizer.agentMatrix, {
		downgradeOneTier,
		fallbackText: handoff.taskSummary || handoff.goal || "",
	})

	if (!selection) {
		return { applied: false }
	}

	try {
		await cline.setActiveModel({
			providerId: selection.providerId,
			modelId: selection.modelId,
		})
	} catch {
		return { applied: false, selection }
	}

	await appendUsageRecord(workspaceRoot, {
		provider: "sauron",
		model: `${selection.agentId}:${selection.modelId}`,
		promptTokens: 0,
		completionTokens: 0,
		costTl: 0,
		operation: "cline-agent-routing",
		latencyMs: 0,
		timestamp: new Date().toISOString(),
		recordId: `cline-agent-routing:${handoff.id || Date.now()}`,
		source: "bridge",
	}).catch(() => {})

	return { applied: true, selection }
}
