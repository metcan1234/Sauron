function isFinOpsTrackingOnly(settings = {}) {
  return settings.finopsTrackingOnly !== false;
}

function shouldRestrictModels(settings = {}) {
  if (isFinOpsTrackingOnly(settings)) {
    return false;
  }
  return settings.finopsRestrictModels === true;
}

function shouldApplyCostOptimizerRouting(settings = {}) {
  if (isFinOpsTrackingOnly(settings)) {
    return false;
  }
  return settings.finopsCostOptimizerEnabled !== false;
}

function shouldApplyBudgetGovernor(settings = {}, optimizer = {}) {
  if (isFinOpsTrackingOnly(settings)) {
    return false;
  }
  return optimizer?.budgetGovernor?.enabled !== false;
}

function shouldApplyCoreModelOverlay(settings = {}) {
  if (isFinOpsTrackingOnly(settings)) {
    return false;
  }
  return settings.finopsCoreModelOverlay !== false;
}

module.exports = {
  isFinOpsTrackingOnly,
  shouldRestrictModels,
  shouldApplyCostOptimizerRouting,
  shouldApplyBudgetGovernor,
  shouldApplyCoreModelOverlay,
};
