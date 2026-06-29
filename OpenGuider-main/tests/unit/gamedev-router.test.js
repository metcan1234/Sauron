const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildGameDevPlanBullets,
  resolveGamedevMode,
  resolveGamedevClineAgent,
} = require("../../src/sauron/gamedev-router");

test("buildGameDevPlanBullets splits multi-sentence tasks", () => {
  const bullets = buildGameDevPlanBullets("Create player. Add climb mechanic. Test play mode.");
  assert.match(bullets, /1\. Create player/);
  assert.match(bullets, /2\. Add climb mechanic/);
});

test("resolveGamedevMode defaults to economy", () => {
  const routing = resolveGamedevMode({});
  assert.equal(routing.mode, "economy");
});

test("resolveGamedevClineAgent prefers deepseek", () => {
  const agent = resolveGamedevClineAgent({});
  assert.equal(agent.providerId, "deepseek");
});
