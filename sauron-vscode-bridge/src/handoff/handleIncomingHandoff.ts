import path from "path"
import { compactHandoffPrompt } from "../cost-optimizer/compact-handoff"
import { appendUsageRecord } from "../usage/export"
import { readFinOpsConfig } from "../usage/config"
import type { FinOpsConfig } from "../usage/types"
import type { HandoffAction, HandoffUserChoice, SauronHandoff } from "./types"

export const HANDOFF_REPLACE_LABEL = "Mevcut görevi bitir, yenisini başlat"
export const HANDOFF_REJECT_LABEL = "Yeni görevi reddet, mevcut göreve devam et"

export function buildPromptFromHandoff(handoff: SauronHandoff): string {
	const summary = String(handoff.taskSummary || handoff.goal || "").trim()
	if (!summary) {
		return ""
	}
	return [
		"[Sauron Core handoff]",
		summary,
		"",
		"Continue this task in the shared workspace. Follow .clinerules/sauron-workspace.md.",
	].join("\n")
}

export async function buildPromptFromHandoffForWorkspace(
	handoff: SauronHandoff,
	workspaceRoot: string,
): Promise<string> {
	const basePrompt = buildPromptFromHandoff(handoff)
	if (!basePrompt) {
		return ""
	}

	const config = await readFinOpsConfig(workspaceRoot)
	const optimizer = config.costOptimizer
	if (!optimizer?.enabled) {
		return basePrompt
	}

	return compactHandoffPrompt(basePrompt, optimizer)
}

export async function logCostOptimizerHint(
	workspaceRoot: string,
	handoff: SauronHandoff,
	config: FinOpsConfig,
): Promise<void> {
	if (!config.enabled || !handoff.complexityHint) {
		return
	}

	await appendUsageRecord(workspaceRoot, {
		provider: "sauron",
		model: handoff.complexityHint,
		promptTokens: 0,
		completionTokens: 0,
		costTl: 0,
		operation: "cost-optimizer-hint",
		latencyMs: 0,
		timestamp: new Date().toISOString(),
		recordId: `cost-optimizer-hint:${handoff.id || Date.now()}`,
		source: "bridge",
	})
}

export function resolveWorkspaceRootFromHandoff(handoff: SauronHandoff, handoffFilePath: string): string {
	if (handoff.workspacePath) {
		return handoff.workspacePath
	}
	return path.dirname(path.dirname(handoffFilePath))
}

export function resolveHandoffAction(
	hasActiveTask: boolean,
	autoStart: boolean | undefined,
	userChoice?: HandoffUserChoice,
): HandoffAction {
	if (hasActiveTask) {
		if (userChoice === "startReplace") {
			return "startNewTask"
		}
		if (userChoice === "reject") {
			return "reject"
		}
		return "waitForUser"
	}

	if (autoStart === false) {
		return "addToInput"
	}
	return "startNewTask"
}

export function mapUserSelection(selection: string | undefined): HandoffUserChoice | undefined {
	if (selection === HANDOFF_REPLACE_LABEL) {
		return "startReplace"
	}
	if (selection === HANDOFF_REJECT_LABEL) {
		return "reject"
	}
	return undefined
}
