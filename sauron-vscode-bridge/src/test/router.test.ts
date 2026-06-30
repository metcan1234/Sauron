import assert from "node:assert/strict"
import test from "node:test"
import { computeComplexityHint, resolveClineAgent, resolveManualClineAgent } from "../cost-optimizer/router.ts"

test("resolveClineAgent routes low complexity to deepseek", () => {
	const selection = resolveClineAgent("low", undefined)
	assert.ok(selection)
	assert.equal(selection?.providerId, "deepseek")
	assert.equal(selection?.modelId, "deepseek-chat")
})

test("resolveClineAgent routes medium complexity to deepseek", () => {
	const selection = resolveClineAgent("medium", undefined)
	assert.ok(selection)
	assert.equal(selection?.providerId, "deepseek")
})

test("resolveClineAgent routes high complexity to openai", () => {
	const selection = resolveClineAgent("high", undefined)
	assert.ok(selection)
	assert.equal(selection?.providerId, "openai")
})

test("resolveClineAgent governor keeps high on deepseek", () => {
	const selection = resolveClineAgent("high", undefined, { budgetGovernorActive: true })
	assert.equal(selection?.providerId, "deepseek")
	assert.equal(selection?.reason, "budget-governor-high-to-deepseek")
})

test("computeComplexityHint keeps simple fixes low", () => {
	assert.equal(computeComplexityHint("fix typo"), "low")
	assert.equal(computeComplexityHint("refactor login button"), "medium")
	assert.equal(computeComplexityHint("migrate database schema auth"), "high")
})

test("resolveManualClineAgent returns ollama selection", () => {
	const selection = resolveManualClineAgent("ollama", undefined)
	assert.ok(selection)
	assert.equal(selection?.providerId, "ollama")
	assert.equal(selection?.reason, "manual-cline")
})

test("resolveClineAgent skips agent with walletAvailable false", () => {
	const matrix = {
		version: 1,
		agents: [
			{
				id: "deepseek",
				core: { provider: "deepseek", model: "deepseek-chat" },
				cline: { providerId: "deepseek", modelId: "deepseek-chat" },
				configured: true,
				walletAvailable: false,
			},
			{
				id: "gemini",
				core: { provider: "gemini", model: "gemini-2.5-flash-lite" },
				cline: { providerId: "gemini", modelId: "gemini-2.5-flash" },
				configured: true,
				walletAvailable: true,
			},
			{
				id: "openai",
				core: { provider: "openai", model: "gpt-4o-mini" },
				cline: { providerId: "openai", modelId: "gpt-4o-mini" },
				configured: true,
				walletAvailable: true,
			},
		],
		routing: {
			core: { low: "gemini", medium: "gemini", high: "deepseek" },
			cline: { low: "deepseek", medium: "deepseek", high: "openai" },
		},
	}
	const selection = resolveClineAgent("low", matrix)
	assert.equal(selection?.providerId, "gemini")
	assert.equal(selection?.reason, "wallet-exhausted-fallback-deepseek")
})
