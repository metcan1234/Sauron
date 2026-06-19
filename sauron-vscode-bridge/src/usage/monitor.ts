import * as vscode from "vscode"
import type { ActiveTaskMetrics, ClineAPI } from "../cline"
import {
	buildTaskCompleteArtifact,
	getLastConsumedHandoff,
	resolveTaskSummary,
	writeTaskCompleteArtifact,
} from "../handoff/task-complete"
import { readFinOpsConfig } from "./config"
import { exportTaskMetricsIfNew } from "./export"

interface WorkspaceTaskState {
	hadActiveTask: boolean
	lastMetrics: ActiveTaskMetrics | null
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

	const state = workspaceStates.get(workspaceRoot) ?? { hadActiveTask: false, lastMetrics: null }
	const hasActiveTask = cline.hasActiveTask()
	const metrics = hasActiveTask ? cline.getActiveTaskMetrics() : null

	if (hasActiveTask && metrics) {
		state.lastMetrics = metrics
	}

	if (state.hadActiveTask && !hasActiveTask && state.lastMetrics) {
		await exportTaskMetricsIfNew(workspaceRoot, state.lastMetrics, config)
		if (cline) {
			const summary = resolveTaskSummary(cline, state.lastMetrics)
			const artifact = buildTaskCompleteArtifact(
				getLastConsumedHandoff(),
				state.lastMetrics,
				summary,
			)
			await writeTaskCompleteArtifact(workspaceRoot, artifact).catch(() => {})
		}
		state.lastMetrics = null
	}

	workspaceStates.set(workspaceRoot, {
		hadActiveTask: hasActiveTask,
		lastMetrics: state.lastMetrics,
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
