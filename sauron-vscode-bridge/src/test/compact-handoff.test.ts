import assert from "node:assert/strict"
import test from "node:test"
import { compactHandoffPrompt } from "../cost-optimizer/compact-handoff.ts"
import { mergeCostOptimizerConfig } from "../cost-optimizer/config.ts"

test("compactHandoffPrompt strips transcript when includeTranscript is false", () => {
	const optimizer = mergeCostOptimizerConfig({
		enabled: true,
		routing: { includeTranscript: false, handoffMaxChars: 4000 },
	})
	const prompt = [
		"[Sauron Core handoff]",
		"Goal: Ship fix",
		"",
		"Recent conversation:",
		"User: very long history",
	].join("\n")

	const compact = compactHandoffPrompt(prompt, optimizer)
	assert.match(compact, /Goal: Ship fix/)
	assert.doesNotMatch(compact, /Recent conversation/)
})

test("compactHandoffPrompt preserves goal and plan steps under max chars", () => {
	const optimizer = mergeCostOptimizerConfig({
		enabled: true,
		routing: { includeTranscript: false, handoffMaxChars: 120 },
	})
	const prompt = [
		"[Sauron Core handoff]",
		"Goal: Important",
		"Plan steps:",
		"- [pending] Step one",
		"",
		"User intent: " + "x".repeat(500),
	].join("\n")

	const compact = compactHandoffPrompt(prompt, optimizer)
	assert.match(compact, /Goal: Important/)
	assert.match(compact, /Plan steps/)
	assert.ok(compact.length <= 120)
})

test("compactHandoffPrompt returns input when optimizer disabled", () => {
	const optimizer = mergeCostOptimizerConfig({ enabled: false })
	const prompt = "keep me"
	assert.equal(compactHandoffPrompt(prompt, optimizer), prompt)
})
