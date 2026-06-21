const test = require("node:test");
const assert = require("node:assert/strict");
const { PlannerResultSchema } = require("../../src/agent/schemas");

test("PlannerResultSchema rejects more than six steps", () => {
  const steps = Array.from({ length: 7 }, (_item, index) => ({
    title: `Step ${index + 1}`,
    instruction: "Do something",
    successCriteria: "Visible change",
  }));
  const parsed = PlannerResultSchema.safeParse({
    goal: "Test goal",
    assistantResponse: "Plan ready",
    steps,
  });
  assert.equal(parsed.success, false);
});

test("PlannerResultSchema accepts up to six steps", () => {
  const steps = Array.from({ length: 6 }, (_item, index) => ({
    title: `Step ${index + 1}`,
    instruction: "Do something",
    successCriteria: "Visible change",
  }));
  const parsed = PlannerResultSchema.safeParse({
    goal: "Test goal",
    assistantResponse: "Plan ready",
    steps,
  });
  assert.equal(parsed.success, true);
});
