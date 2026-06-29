import assert from "node:assert/strict"
import test from "node:test"
import {
	buildTaskCompleteArtifact,
	setLastConsumedHandoff,
} from "../handoff/task-complete.ts"

test("buildTaskCompleteArtifact includes pipeline fields", () => {
	setLastConsumedHandoff(
		{
			id: "h-1",
			sessionId: "s-1",
			pipelineId: "pipe-1",
			pipelinePhase: 1,
			projectType: "electron-core",
		},
		"/tmp/handoff.json",
	)
	const artifact = buildTaskCompleteArtifact(
		{
			id: "h-1",
			pipelineId: "pipe-1",
			pipelinePhase: 1,
			projectType: "electron-core",
		},
		{
			taskId: "t-1",
			tokensIn: 10,
			tokensOut: 20,
			costUsd: 0.01,
			modelId: "deepseek-chat",
		},
		"Done",
	)
	assert.equal(artifact.pipelineId, "pipe-1")
	assert.equal(artifact.metrics.totalTokens, 30)
})
