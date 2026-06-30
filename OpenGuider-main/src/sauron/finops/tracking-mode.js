const {
  shouldAutoRouteCore,
  shouldAutoRouteCline,
  shouldAutoRouteGoose,
} = require("./routing-mode");

function isFinOpsTrackingOnly(settings = {}) {
  return !shouldAutoRouteCore(settings) && !shouldAutoRouteCline(settings);
}

function shouldRestrictModels(settings = {}) {
  if (isFinOpsTrackingOnly(settings)) {
    return false;
  }
  return settings.finopsRestrictModels === true;
}

function shouldApplyCostOptimizerRouting(settings = {}) {
  return shouldAutoRouteCore(settings) || shouldAutoRouteCline(settings);
}

function shouldApplyBudgetGovernor(settings = {}, optimizer = {}) {
  if (!shouldAutoRouteCore(settings) && !shouldAutoRouteCline(settings)) {
    return false;
  }
  return optimizer?.budgetGovernor?.enabled !== false;
}

function shouldApplyCoreModelOverlay(settings = {}) {
  return shouldAutoRouteCore(settings);
}

function shouldApplyGooseAutoRouting(settings = {}) {
  return shouldAutoRouteGoose(settings);
}

module.exports = {
  isFinOpsTrackingOnly,
  shouldRestrictModels,
  shouldApplyCostOptimizerRouting,
  shouldApplyBudgetGovernor,
  shouldApplyCoreModelOverlay,
  shouldApplyGooseAutoRouting,
};
