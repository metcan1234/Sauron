import assert from "node:assert/strict"
import test from "node:test"
import { buildPromptFromHandoff } from "../handoff/handleIncomingHandoff.ts"
import type { SauronHandoff } from "../handoff/types.ts"

test("buildPromptFromHandoff includes project type and verification hints", () => {
	const handoff: SauronHandoff = {
		goal: "Implement feature",
		taskSummary: "Goal: test",
		projectType: "electron-core",
		pipelineId: "self-improve-feature-v1",
		pipelinePhase: 2,
		pipelineTotalPhases: 3,
		verification: { command: "npm test" },
	}
	const prompt = buildPromptFromHandoff(handoff)
	assert.match(prompt, /sauron-electron-dev\.md/)
	assert.match(prompt, /Pipeline phase 2/)
	assert.match(prompt, /npm test/)
})

test("resolveHandoffAction autoChain skips wait when active task", async () => {
	const { resolveHandoffAction } = await import("../handoff/handleIncomingHandoff.ts")
	assert.equal(resolveHandoffAction(true, true, undefined, true), "startNewTask")
	assert.equal(resolveHandoffAction(true, true, undefined, false), "waitForUser")
})
