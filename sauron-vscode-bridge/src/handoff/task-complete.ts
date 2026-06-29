import type { ActiveTaskMetrics, ClineAPI } from "../cline"
import type { SauronHandoff } from "./types"

export const TASK_COMPLETE_FILENAME = "cline-task-complete.json"

export interface TaskCompleteArtifact {
	version: number
	handoffId?: string
	sessionId?: string
	pipelineId?: string
	pipelinePhase?: number
	projectType?: string
	completedAt: string
	metrics: {
		totalTokens: number
		totalCostUsd: number
		modelId?: string
		providerId?: string
	}
	summary: string
}

let lastConsumedHandoff: SauronHandoff | null = null
let lastConsumedHandoffPath: string | null = null

export function setLastConsumedHandoff(handoff: SauronHandoff, fullPath: string): void {
	lastConsumedHandoff = handoff
	lastConsumedHandoffPath = fullPath
}

export function getLastConsumedHandoff(): SauronHandoff | null {
	return lastConsumedHandoff
}

export function clearLastConsumedHandoff(): void {
	lastConsumedHandoff = null
	lastConsumedHandoffPath = null
}

export function buildTaskCompleteArtifact(
	handoff: SauronHandoff | null,
	metrics: ActiveTaskMetrics | null,
	summary: string,
): TaskCompleteArtifact {
	const tokensIn = metrics?.tokensIn ?? 0
	const tokensOut = metrics?.tokensOut ?? 0
	return {
		version: 1,
		handoffId: handoff?.id,
		sessionId: handoff?.sessionId,
		pipelineId: handoff?.pipelineId,
		pipelinePhase: handoff?.pipelinePhase,
		projectType: handoff?.projectType,
		completedAt: new Date().toISOString(),
		metrics: {
			totalTokens: tokensIn + tokensOut,
			totalCostUsd: metrics?.costUsd ?? 0,
			modelId: metrics?.modelId,
			providerId: metrics?.providerId,
		},
		summary: summary || "Cline task completed",
	}
}

export async function writeTaskCompleteArtifact(
	workspaceRoot: string,
	artifact: TaskCompleteArtifact,
): Promise<string> {
	const fs = await import("fs/promises")
	const path = await import("path")
	const sauronDir = path.join(workspaceRoot, ".sauron")
	await fs.mkdir(sauronDir, { recursive: true })
	const targetPath = path.join(sauronDir, TASK_COMPLETE_FILENAME)
	await fs.writeFile(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8")
	return targetPath
}

export function resolveTaskSummary(cline: ClineAPI, metrics: ActiveTaskMetrics | null): string {
	if (typeof cline.getLastTaskSummary === "function") {
		const summary = cline.getLastTaskSummary()
		if (summary) {
			return summary
		}
	}
	if (metrics?.taskId) {
		return `Task ${metrics.taskId} completed`
	}
	return "Cline task completed"
}
