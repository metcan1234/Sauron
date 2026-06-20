const { mergeCostOptimizerConfig, resolveProjectBudget } = require("./cost-optimizer-config");
const { resolveUsageLogPath, readUsageEntries } = require("./usage-tracker");

const GOVERNOR_ALERT_MESSAGE = "Günlük bütçe aşıldı — zor işler için DeepSeek kullanılıyor.";

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

async function computeDailySpendTl(settings = {}) {
  const logPath = resolveUsageLogPath(settings);
  const cutoff = startOfTodayIso();
  let total = 0;

  try {
    const entries = await readUsageEntries(logPath);
    for (const entry of entries) {
      if (!entry.timestamp || entry.timestamp < cutoff) {
        continue;
      }
      const costTl = Number(entry.costTl);
      if (Number.isFinite(costTl)) {
        total += costTl;
      }
    }
  } catch {
    return 0;
  }

  return total;
}

function resolveDailyBudgetTl(settings = {}, projectType) {
  const optimizer = mergeCostOptimizerConfig(settings);
  if (!optimizer.enabled || !optimizer.budgetGovernor?.enabled) {
    return 0;
  }

  const projectBudget = resolveProjectBudget(projectType, optimizer).dailyBudgetTl;
  const projectBudgetNum = Number(projectBudget);
  if (Number.isFinite(projectBudgetNum) && projectBudgetNum > 0) {
    return projectBudgetNum;
  }

  return Number(optimizer.budgetGovernor.dailyBudgetTl) || 0;
}

async function shouldActivateBudgetGovernor(settings = {}, options = {}) {
  const dailyBudget = resolveDailyBudgetTl(settings, options.projectType);
  if (dailyBudget <= 0) {
    return false;
  }

  const spent = await computeDailySpendTl(settings);
  const now = new Date();
  const dayProgress = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
  const expectedSpend = dailyBudget * Math.max(0.25, dayProgress);

  return spent >= expectedSpend;
}

function buildGovernorAlertPayload() {
  return {
    level: "warning",
    message: GOVERNOR_ALERT_MESSAGE,
    governorActive: true,
  };
}

module.exports = {
  GOVERNOR_ALERT_MESSAGE,
  startOfTodayIso,
  computeDailySpendTl,
  resolveDailyBudgetTl,
  shouldActivateBudgetGovernor,
  buildGovernorAlertPayload,
};
