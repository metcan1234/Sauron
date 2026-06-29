const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findCatalogEntry,
  calculateCostTl,
  resolvePricePerMillionTokensTl,
} = require("../../src/sauron/finops/finops-pricing");

test("findCatalogEntry matches model prefixes", () => {
  const entry = findCatalogEntry("gemini", "gemini-2.5-flash-001");
  assert.ok(entry);
  assert.equal(entry.model, "gemini-2.5-flash");
});

test("resolvePricePerMillionTokensTl prefers catalog over overrides", () => {
  const resolved = resolvePricePerMillionTokensTl("gemini", "gemini-2.0-flash", {
    finopsModelPriceOverrides: { "gemini-2.0-flash": 999 },
  });
  assert.equal(resolved.source, "catalog");
  assert.equal(resolved.pricePerMillionTokensTl, 8);
});

test("resolvePricePerMillionTokensTl uses model override when catalog miss", () => {
  const resolved = resolvePricePerMillionTokensTl("openai", "gpt-4.1-mini", {
    finopsModelPriceOverrides: { "gpt-4.1-mini": 42 },
  });
  assert.equal(resolved.source, "model-override");
  assert.equal(resolved.pricePerMillionTokensTl, 42);
});

test("calculateCostTl applies per-million formula", () => {
  const result = calculateCostTl({
    provider: "openai",
    model: "gpt-4o-mini",
    promptTokens: 500_000,
    completionTokens: 500_000,
    settings: {},
  });
  assert.equal(result.totalTokens, 1_000_000);
  assert.equal(result.costTl, 15);
});
