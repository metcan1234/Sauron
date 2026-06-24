const { loadWireRecipe } = require("./unity-wire-recipes");
const { probeUnityBridge, dispatchUnityCommand } = require("./gamedev-mcp-proxy");

const STEP_METHOD_MAP = {
  unity_load_scene: "load_scene",
  unity_create_gameobject: "create_gameobject",
  unity_add_component: "add_component",
  unity_set_transform: "set_transform",
  unity_add_rigidbody: "add_rigidbody",
  unity_save_scene: "save_scene",
  unity_play_mode: "play_mode",
  unity_get_hierarchy: "get_hierarchy",
};

async function executeWireRecipeStep(stepName, params = {}) {
  const method = STEP_METHOD_MAP[stepName] || stepName.replace(/^unity_/, "");
  return dispatchUnityCommand(method, params);
}

async function tryExecuteWireRecipe(recipeId, { skipIfNoBridge = true } = {}) {
  const recipe = loadWireRecipe(recipeId);
  if (!recipe) {
    return { ok: false, skipped: true, error: `Wire recipe not found: ${recipeId}` };
  }

  const probe = await probeUnityBridge();
  if (!probe.connected) {
    if (skipIfNoBridge) {
      return { ok: true, skipped: true, warn: "Unity bridge not connected — wire recipe deferred to agent." };
    }
    return { ok: false, skipped: false, error: "Unity bridge not connected." };
  }

  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const results = [];
  for (const step of steps) {
    const stepName = typeof step === "string" ? step : step.name;
    const params = typeof step === "object" ? (step.params || {}) : {};
    const result = await executeWireRecipeStep(stepName, params);
    results.push({ step: stepName, ...result });
    if (!result.ok && !result.skipped) {
      return {
        ok: false,
        skipped: false,
        recipeId,
        failedStep: stepName,
        results,
        error: result.error || `Wire step failed: ${stepName}`,
      };
    }
  }

  return { ok: true, skipped: false, recipeId, results, stepsRun: results.length };
}

module.exports = {
  STEP_METHOD_MAP,
  executeWireRecipeStep,
  tryExecuteWireRecipe,
};
