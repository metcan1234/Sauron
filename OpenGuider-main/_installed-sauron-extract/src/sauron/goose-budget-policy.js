const { resolveGovernorTier } = require("./finops/daily-budget-governor");

function buildBudgetWarnNotice(settings = {}, spentTl = 0) {
  const dailyLimit = Number(settings.gooseDailyBudgetTl) || 0;
  if (dailyLimit <= 0) {
    return null;
  }

  const warnAt = Number(settings.gooseBudgetWarnAt);
  const threshold = Number.isFinite(warnAt) && warnAt > 0 && warnAt < 1 ? warnAt : 0.8;
  const spendRatio = spentTl / dailyLimit;
  if (spendRatio < threshold) {
    return null;
  }

  const pct = Math.round(spendRatio * 100);
  return `Goose bütçenin %${pct}'i kullanıldı — economy modu önerilir.`;
}

async function buildGovernorNotice(settings = {}) {
  if (settings.gooseFinopsShareGlobalBudget === false) {
    return null;
  }

  try {
    const tier = await resolveGovernorTier(settings);
    if (tier.level === "hard") {
      return "FinOps günlük bütçe aşıldı — Goose economy modu önerilir.";
    }
    if (tier.level === "soft") {
      return "FinOps günlük bütçe uyarısı — Goose balanced/economy modu önerilir.";
    }
  } catch {
    return null;
  }
  return null;
}

module.exports = {
  buildBudgetWarnNotice,
  buildGovernorNotice,
};
