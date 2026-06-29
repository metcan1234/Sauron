const test = require("node:test");
const assert = require("node:assert/strict");

// Mirror of renderer helper for node unit tests (ESM panel module is not loaded in test runner).
function formatFinOpsBadgeText(summary = {}, options = {}) {
  const budget = Number(summary.budgetTl) || 0;
  const totalSpent = Number(summary.totalSpentTl) || 0;
  const sessionSpent = Number(summary.sessionSpentTl) || 0;
  const hasSessionCost = sessionSpent > 0;
  const showUltra = options.showTokenUltra !== false
    && options.tokenUltraShowDashboard !== false;
  const tokenUltraSaved = Number(summary.tokenUltraStats?.estimatedCharsSaved) || 0;
  const ultraSuffix = showUltra && tokenUltraSaved > 500
    ? ` ↓${Math.round(tokenUltraSaved / 1000)}k`
    : "";

  if (budget <= 0) {
    if (!hasSessionCost && totalSpent <= 0) {
      return { text: "", hidden: true };
    }
    const text = hasSessionCost
      ? `${sessionSpent.toFixed(2)} / ${totalSpent.toFixed(2)} ₺${ultraSuffix}`
      : `${totalSpent.toFixed(2)} ₺${ultraSuffix}`;
    return { text, hidden: false };
  }

  const remainingPct = Number(summary.remainingPct);
  const pctLabel = Number.isFinite(remainingPct) ? Math.round(remainingPct) : 0;
  const text = hasSessionCost
    ? `${sessionSpent.toFixed(2)} · ${totalSpent.toFixed(2)} ₺ · %${pctLabel}${ultraSuffix}`
    : `${totalSpent.toFixed(2)} ₺ · %${pctLabel}${ultraSuffix}`;
  return { text, hidden: false };
}

test("formatFinOpsBadgeText uses TL only without USD suffix", () => {
  const result = formatFinOpsBadgeText({
    budgetTl: 0,
    totalSpentTl: 2.4,
    sessionSpentTl: 0.13,
    primaryAgentWallet: {
      agentId: "gemini",
      wallet: { unlimited: false, remainingUsd: 10, totalCreditUsd: 10 },
    },
  });
  assert.equal(result.hidden, false);
  assert.equal(result.text, "0.13 / 2.40 ₺");
  assert.doesNotMatch(result.text, /\$/);
});

test("formatFinOpsBadgeText includes budget percent when configured", () => {
  const result = formatFinOpsBadgeText({
    budgetTl: 100,
    totalSpentTl: 13,
    sessionSpentTl: 1.2,
    remainingPct: 87,
  });
  assert.match(result.text, /1\.20 · 13\.00 ₺ · %87/);
});
