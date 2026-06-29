const { createLogger } = require("../../logger");
const { getTotalSpentTl, getRemainingBudgetTl } = require("./usage-tracker");

const logger = createLogger("finops-budget");

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function evaluateBudgetState(settings = {}, totalSpentTl = null) {
  const budget = Number(settings.finopsTotalBudgetTl) || 0;
  if (budget <= 0) {
    return { enabled: false, budget, totalSpentTl: totalSpentTl ?? 0, remainingTl: null, remainingPct: null };
  }

  const spent = Number.isFinite(totalSpentTl) ? totalSpentTl : 0;
  const remainingTl = budget - spent;
  const remainingPct = (remainingTl / budget) * 100;

  return {
    enabled: true,
    budget,
    totalSpentTl: spent,
    remainingTl,
    remainingPct,
  };
}

function buildPreCallAlert(state, settings = {}) {
  if (!state.enabled || state.remainingTl == null || state.remainingTl > 0) {
    return null;
  }

  const hardEnabled = settings.finopsHardBudgetEnabled === true;
  return {
    level: "exhausted",
    blocked: hardEnabled,
    message: hardEnabled
      ? "AI bütçen tükendi. Sert bütçe etkin — yeni LLM çağrıları engellendi."
      : "Dikkat: AI bütçen tükendi. LLM çağrıları devam edecek, ancak harcama limitin aşıldı.",
    remainingTl: state.remainingTl,
    remainingPct: state.remainingPct,
  };
}

function buildLowBudgetAlert(state, settings = {}) {
  if (!state.enabled || state.remainingPct == null || state.remainingPct > 20) {
    return null;
  }

  const today = todayKey();
  if (settings.finopsLastAlertDate === today) {
    return null;
  }

  const pctText = Math.max(0, Math.round(state.remainingPct));
  return {
    level: "warning",
    message: `Dikkat: AI bütçen azalıyor, %${pctText} kaldı.`,
    remainingTl: state.remainingTl,
    remainingPct: state.remainingPct,
    markAlertDate: today,
  };
}

function emitBudgetAlert(getWindows, payload) {
  if (!payload) return;

  const targets = typeof getWindows === "function" ? getWindows() : [];
  for (const window of targets) {
    if (window && !window.isDestroyed()) {
      window.webContents.send("finops-budget-alert", payload);
    }
  }
}

async function checkPreCallBudgetAlert(settings, getWindows) {
  const totalSpentTl = await getTotalSpentTl(settings);
  const state = evaluateBudgetState(settings, totalSpentTl);
  const alert = buildPreCallAlert(state, settings);
  emitBudgetAlert(getWindows, alert);
  return alert;
}

async function maybePostCallBudgetAlert(settings, getWindows, persistSettings) {
  const totalSpentTl = await getTotalSpentTl(settings);
  const state = evaluateBudgetState(settings, totalSpentTl);
  const alert = buildLowBudgetAlert(state, settings);
  if (!alert) return null;

  emitBudgetAlert(getWindows, alert);

  if (alert.markAlertDate && typeof persistSettings === "function") {
    try {
      await persistSettings({ finopsLastAlertDate: alert.markAlertDate });
    } catch (error) {
      logger.warn("finops-budget:persist-alert-date-failed", {
        error: error?.message || String(error),
      });
    }
  }

  return alert;
}

module.exports = {
  todayKey,
  evaluateBudgetState,
  buildPreCallAlert,
  buildLowBudgetAlert,
  emitBudgetAlert,
  checkPreCallBudgetAlert,
  maybePostCallBudgetAlert,
  getRemainingBudgetTl,
};
