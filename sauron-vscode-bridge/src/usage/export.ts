import fs from "fs/promises"
import path from "path"
import type { ActiveTaskMetrics } from "../cline"
import { getSauronDir } from "../handoff/discovery"
import type { ClineExportState, FinOpsConfig, UsageLedgerRecord } from "./types"

const LOG_FILENAME = "logs.jsonl"
const EXPORT_STATE_FILENAME = "cline-export-state.json"

let writeChain = Promise.resolve()

function getUsageDir(workspaceRoot: string): string {
	return path.join(getSauronDir(workspaceRoot), "usage")
}

export function getUsageLogPath(workspaceRoot: string): string {
	return path.join(getUsageDir(workspaceRoot), LOG_FILENAME)
}

function getExportStatePath(workspaceRoot: string): string {
	return path.join(getUsageDir(workspaceRoot), EXPORT_STATE_FILENAME)
}

async function ensureUsageDir(workspaceRoot: string): Promise<void> {
	await fs.mkdir(getUsageDir(workspaceRoot), { recursive: true })
}

export function buildClineLedgerRecord(
	metrics: ActiveTaskMetrics,
	config: FinOpsConfig,
): UsageLedgerRecord {
	const costUsd = Math.max(0, Number(metrics.costUsd) || 0)
	const costTl = costUsd * config.finopsUsdToTl

	return {
		provider: metrics.providerId || "cline",
		model: metrics.modelId || "unknown",
		promptTokens: Math.max(0, Number(metrics.tokensIn) || 0),
		completionTokens: Math.max(0, Number(metrics.tokensOut) || 0),
		costTl,
		operation: "cline-task",
		latencyMs: 0,
		timestamp: new Date().toISOString(),
		recordId: `cline-task:${metrics.taskId}`,
		source: "cline",
		channel: "workspace",
		costUsd,
		taskId: metrics.taskId,
	}
}

async function readExportState(workspaceRoot: string): Promise<ClineExportState> {
	try {
		const raw = await fs.readFile(getExportStatePath(workspaceRoot), "utf8")
		const parsed = JSON.parse(raw) as Partial<ClineExportState>
		return {
			exportedTaskIds: Array.isArray(parsed.exportedTaskIds)
				? parsed.exportedTaskIds.map(String)
				: [],
		}
	} catch {
		return { exportedTaskIds: [] }
	}
}

async function writeExportState(workspaceRoot: string, state: ClineExportState): Promise<void> {
	await ensureUsageDir(workspaceRoot)
	await fs.writeFile(getExportStatePath(workspaceRoot), `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

export async function appendUsageRecord(
	workspaceRoot: string,
	record: UsageLedgerRecord,
): Promise<void> {
	await ensureUsageDir(workspaceRoot)
	const logPath = getUsageLogPath(workspaceRoot)
	const line = `${JSON.stringify(record)}\n`
	writeChain = writeChain.then(() => fs.appendFile(logPath, line, "utf8"))
	await writeChain
}

export async function exportTaskMetricsIfNew(
	workspaceRoot: string,
	metrics: ActiveTaskMetrics,
	config: FinOpsConfig,
): Promise<boolean> {
	if (!config.enabled) {
		return false
	}

	const state = await readExportState(workspaceRoot)
	if (state.exportedTaskIds.includes(metrics.taskId)) {
		return false
	}

	const record = buildClineLedgerRecord(metrics, config)
	await appendUsageRecord(workspaceRoot, record)

	state.exportedTaskIds.push(metrics.taskId)
	if (state.exportedTaskIds.length > 500) {
		state.exportedTaskIds = state.exportedTaskIds.slice(-500)
	}
	await writeExportState(workspaceRoot, state)
	return true
}

export function resetWriteChainForTests(): void {
	writeChain = Promise.resolve()
}
