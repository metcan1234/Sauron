const test = require("node:test");
const assert = require("node:assert/strict");

const {
  todayKey,
  evaluateBudgetState,
  buildPreCallAlert,
  buildLowBudgetAlert,
} = require("../../src/sauron/finops/budget-alert");

test("buildPreCallAlert warns when budget exhausted", () => {
  const state = evaluateBudgetState({ finopsTotalBudgetTl: 100 }, 120);
  const alert = buildPreCallAlert(state);
  assert.ok(alert);
  assert.equal(alert.level, "exhausted");
});

test("buildLowBudgetAlert deduplicates by day", () => {
  const state = evaluateBudgetState({ finopsTotalBudgetTl: 100 }, 85);
  const alert = buildLowBudgetAlert(state, { finopsLastAlertDate: todayKey() });
  assert.equal(alert, null);

  const fresh = buildLowBudgetAlert(state, { finopsLastAlertDate: "2020-01-01" });
  assert.ok(fresh);
  assert.equal(fresh.level, "warning");
  assert.match(fresh.message, /%15 kaldı/);
});

test("buildLowBudgetAlert triggers at 20 percent threshold", () => {
  const state = evaluateBudgetState({ finopsTotalBudgetTl: 100 }, 80);
  const alert = buildLowBudgetAlert(state, {});
  assert.ok(alert);
  assert.equal(alert.remainingPct, 20);
});
