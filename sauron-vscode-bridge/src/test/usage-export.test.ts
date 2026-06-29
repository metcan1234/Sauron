import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
	buildClineLedgerRecord,
	exportTaskMetricsIfNew,
	getUsageLogPath,
	resetWriteChainForTests,
} from "../usage/export"
import { DEFAULT_FINOPS_CONFIG } from "../usage/config"
import type { ActiveTaskMetrics } from "../cline"

const sampleMetrics: ActiveTaskMetrics = {
	taskId: "task-abc",
	tokensIn: 1200,
	tokensOut: 800,
	costUsd: 0.14,
	modelId: "claude-sonnet-4-5",
	providerId: "anthropic",
}

test("buildClineLedgerRecord converts USD to TL", () => {
	const record = buildClineLedgerRecord(sampleMetrics, {
		...DEFAULT_FINOPS_CONFIG,
		finopsUsdToTl: 40,
	})
	assert.equal(record.operation, "cline-task")
	assert.equal(record.recordId, "cline-task:task-abc")
	assert.equal(record.costTl, 5.6000000000000005)
	assert.equal(record.promptTokens, 1200)
	assert.equal(record.completionTokens, 800)
})

test("exportTaskMetricsIfNew deduplicates by taskId", async () => {
	resetWriteChainForTests()
	const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-finops-"))
	try {
		const first = await exportTaskMetricsIfNew(workspaceRoot, sampleMetrics, DEFAULT_FINOPS_CONFIG)
		const second = await exportTaskMetricsIfNew(workspaceRoot, sampleMetrics, DEFAULT_FINOPS_CONFIG)
		assert.equal(first, true)
		assert.equal(second, false)

		const logPath = getUsageLogPath(workspaceRoot)
		const raw = await fs.readFile(logPath, "utf8")
		const lines = raw.trim().split("\n")
		assert.equal(lines.length, 1)
		const parsed = JSON.parse(lines[0])
		assert.equal(parsed.operation, "cline-task")
	} finally {
		await fs.rm(workspaceRoot, { recursive: true, force: true })
	}
})
