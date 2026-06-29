import assert from "node:assert/strict"
import test from "node:test"
import { mapAgentToClineModel, normalizeBridgeProviderId, resolveClineModelField } from "../cost-optimizer/provider-mapper.ts"

test("mapAgentToClineModel normalizes provider and model", () => {
	const target = mapAgentToClineModel("gemini", "gemini-2.5-flash")
	assert.equal(target.providerId, "gemini")
	assert.equal(target.modelId, "gemini-2.5-flash")
})

test("resolveClineModelField maps openai and ollama model fields", () => {
	assert.equal(resolveClineModelField("deepseek"), "api")
	assert.equal(resolveClineModelField("openai"), "openai")
	assert.equal(resolveClineModelField("ollama"), "ollama")
})

test("normalizeBridgeProviderId aliases google to gemini", () => {
	assert.equal(normalizeBridgeProviderId("google"), "gemini")
})
