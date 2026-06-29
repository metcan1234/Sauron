import * as vscode from "vscode"
import type { ActiveTaskMetrics, ClineAPI } from "../cline"
import {
	buildTaskCompleteArtifact,
	getLastConsumedHandoff,
	resolveTaskSummary,
	writeTaskCompleteArtifact,
} from "../handoff/task-complete"
import { journalTaskActivity, journalTaskReport } from "../activity/cline-activity-journal"
import { readFinOpsConfig } from "./config"
import { exportTaskMetricsIfNew } from "./export"

interface WorkspaceTaskState {
	hadActiveTask: boolean
	lastMetrics: ActiveTaskMetrics | null
	lastActivitySignature: string | null
}

const workspaceStates = new Map<string, WorkspaceTaskState>()

async function pollWorkspace(
	workspaceRoot: string,
	getCline: () => ClineAPI | undefined,
): Promise<void> {
	const cline = getCline()
	if (!cline?.getActiveTaskMetrics) {
		return
	}

	const config = await readFinOpsConfig(workspaceRoot)
	if (!config.enabled) {
		return
	}

	const state = workspaceStates.get(workspaceRoot) ?? {
		hadActiveTask: false,
		lastMetrics: null,
		lastActivitySignature: null,
	}
	const hasActiveTask = cline.hasActiveTask()
	const metrics = hasActiveTask ? cline.getActiveTaskMetrics() : null

	if (hasActiveTask && metrics) {
		state.lastMetrics = metrics
		const signature = `${metrics.taskId}:${metrics.tokensIn}:${metrics.tokensOut}:${metrics.modelId}`
		if (signature !== state.lastActivitySignature) {
			state.lastActivitySignature = signature
			await journalTaskActivity(workspaceRoot, metrics, metrics.taskId || "active").catch(() => {})
		}
	}

	if (state.hadActiveTask && !hasActiveTask && state.lastMetrics) {
		await exportTaskMetricsIfNew(workspaceRoot, state.lastMetrics, config)
		if (cline) {
			const summary = resolveTaskSummary(cline, state.lastMetrics)
			const handoff = getLastConsumedHandoff()
			const artifact = buildTaskCompleteArtifact(
				handoff,
				state.lastMetrics,
				summary,
			)
			await writeTaskCompleteArtifact(workspaceRoot, artifact).catch(() => {})
			await journalTaskReport(workspaceRoot, summary, handoff?.id).catch(() => {})
		}
		state.lastMetrics = null
		state.lastActivitySignature = null
	}

	workspaceStates.set(workspaceRoot, {
		hadActiveTask: hasActiveTask,
		lastMetrics: state.lastMetrics,
		lastActivitySignature: state.lastActivitySignature,
	})
}

export function startCostMonitor(
	context: vscode.ExtensionContext,
	getCline: () => ClineAPI | undefined,
): void {
	const tickAll = async () => {
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			await pollWorkspace(folder.uri.fsPath, getCline)
		}
	}

	void tickAll()
	const interval = setInterval(() => {
		void tickAll()
	}, 5000)
	context.subscriptions.push({
		dispose: () => {
			clearInterval(interval)
			workspaceStates.clear()
		},
	})
}

export function resetMonitorStateForTests(): void {
	workspaceStates.clear()
}
