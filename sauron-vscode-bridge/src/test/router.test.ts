import assert from "node:assert/strict"
import test from "node:test"
import { computeComplexityHint, resolveClineAgent } from "../cost-optimizer/router.ts"

test("resolveClineAgent routes low complexity to deepseek", () => {
	const selection = resolveClineAgent("low", undefined)
	assert.ok(selection)
	assert.equal(selection?.providerId, "deepseek")
	assert.equal(selection?.modelId, "deepseek-chat")
})

test("resolveClineAgent routes high complexity to openai", () => {
	const selection = resolveClineAgent("high", undefined)
	assert.ok(selection)
	assert.equal(selection?.providerId, "openai")
})

test("resolveClineAgent downgrades high to medium tier", () => {
	const selection = resolveClineAgent("high", undefined, { downgradeOneTier: true })
	assert.equal(selection?.providerId, "gemini")
})

test("computeComplexityHint escalates architecture keywords", () => {
	assert.equal(computeComplexityHint("please refactor the architecture"), "high")
	assert.equal(computeComplexityHint("fix typo"), "low")
})
