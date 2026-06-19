import type { ClineAPI } from "../cline"
import type { FinOpsConfig } from "../usage/types"
import type { SauronHandoff } from "../handoff/types"
import { probeClineCapabilities } from "../cline-capabilities"
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
	planSelection?: {
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
	const caps = probeClineCapabilities(cline)
	if (!optimizer?.enabled || !caps.canRouteModel) {
		return { applied: false }
	}

	const downgradeOneTier = await resolveBudgetDowngrade(
		workspaceRoot,
		optimizer,
		handoff.id,
	)

	const planSelection = resolveClineAgent("low", optimizer.agentMatrix, {
		downgradeOneTier,
		fallbackText: handoff.taskSummary || handoff.goal || "",
	})

	const actSelection = resolveClineAgent(handoff.complexityHint, optimizer.agentMatrix, {
		downgradeOneTier,
		fallbackText: handoff.taskSummary || handoff.goal || "",
	})

	if (!actSelection) {
		return { applied: false }
	}

	try {
		if (planSelection && caps.canRouteModel && cline.setPlanModeModel) {
			await cline.setPlanModeModel({
				providerId: planSelection.providerId,
				modelId: planSelection.modelId,
			})
		}
		await cline.setActiveModel!({
			providerId: actSelection.providerId,
			modelId: actSelection.modelId,
		})
	} catch {
		return { applied: false, selection: actSelection, planSelection: planSelection || undefined }
	}

	await appendUsageRecord(workspaceRoot, {
		provider: "sauron",
		model: `plan:${planSelection?.agentId || "none"} act:${actSelection.agentId}:${actSelection.modelId}`,
		promptTokens: 0,
		completionTokens: 0,
		costTl: 0,
		operation: "cline-agent-routing",
		latencyMs: 0,
		timestamp: new Date().toISOString(),
		recordId: `cline-agent-routing:${handoff.id || Date.now()}`,
		source: "bridge",
	}).catch(() => {})

	return {
		applied: true,
		selection: actSelection,
		planSelection: planSelection || undefined,
	}
}
