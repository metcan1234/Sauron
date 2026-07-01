const { loadWireRecipe } = require("./gamedev-wire-recipes");
const { probeUnityBridge, probeUnrealBridge, dispatchUnityCommand } = require("./gamedev-mcp-proxy");
const { normalizeGamedevEngine } = require("./gamedev-config");

const UNITY_STEP_METHOD_MAP = {
  unity_load_scene: "load_scene",
  unity_create_gameobject: "create_gameobject",
  unity_add_component: "add_component",
  unity_set_transform: "set_transform",
  unity_add_rigidbody: "add_rigidbody",
  unity_save_scene: "save_scene",
  unity_play_mode: "play_mode",
  unity_get_hierarchy: "get_hierarchy",
};

async function executeUnityWireRecipeStep(stepName, params = {}) {
  const method = UNITY_STEP_METHOD_MAP[stepName] || stepName.replace(/^unity_/, "");
  return dispatchUnityCommand(method, params);
}

async function tryExecuteWireRecipe(recipeId, { skipIfNoBridge = true, engine = "unity", workspacePath = "" } = {}) {
  const normalizedEngine = normalizeGamedevEngine(engine);
  const recipe = loadWireRecipe(recipeId, normalizedEngine);
  if (!recipe) {
    return { ok: false, skipped: true, error: `Wire recipe not found: ${recipeId}` };
  }

  if (normalizedEngine === "unreal") {
    const probe = await probeUnrealBridge({ workspacePath });
    if (!probe.connected) {
      if (skipIfNoBridge) {
        return {
          ok: true,
          skipped: true,
          engine: normalizedEngine,
          warn: "Unreal bridge not connected — wire recipe deferred to funplay-unreal MCP tools.",
          recipeId,
        };
      }
      return { ok: false, skipped: false, error: "Unreal bridge not connected." };
    }
    if (probe.transport === "http") {
      return {
        ok: true,
        skipped: true,
        engine: normalizedEngine,
        recipeId,
        warn: "Unreal HTTP MCP active — execute recipe steps via Cline funplay-unreal tools.",
        steps: recipe.steps || [],
      };
    }
  }

  const probe = normalizedEngine === "unreal"
    ? await probeUnrealBridge({ workspacePath })
    : await probeUnityBridge({ workspacePath });
  if (!probe.connected) {
    if (skipIfNoBridge) {
      return {
        ok: true,
        skipped: true,
        engine: normalizedEngine,
        warn: `${normalizedEngine} bridge not connected — wire recipe deferred to agent.`,
      };
    }
    return { ok: false, skipped: false, error: `${normalizedEngine} bridge not connected.` };
  }

  if (normalizedEngine === "unreal") {
    return {
      ok: true,
      skipped: true,
      engine: normalizedEngine,
      recipeId,
      warn: "Unreal TCP wire execution not supported — use funplay MCP tools in Cline.",
      steps: recipe.steps || [],
    };
  }

  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const results = [];
  for (const step of steps) {
    const stepName = typeof step === "string" ? step : step.name;
    const params = typeof step === "object" ? (step.params || {}) : {};
    const result = await executeUnityWireRecipeStep(stepName, params);
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

  return { ok: true, skipped: false, recipeId, results, stepsRun: results.length, engine: normalizedEngine };
}

module.exports = {
  UNITY_STEP_METHOD_MAP,
  executeUnityWireRecipeStep,
  tryExecuteWireRecipe,
};
