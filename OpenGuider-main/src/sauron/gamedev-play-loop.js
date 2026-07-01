const { tryExecuteWireRecipe } = require("./gamedev-wire-executor");
const { probeUnityBridge, dispatchUnityCommand } = require("./gamedev-mcp-proxy");
const { verifyGamedevPhase } = require("./gamedev-verification");

async function runGamedevPlayLoop({
  workspacePath,
  settings = {},
  maxAttempts = 3,
  recipeId = null,
} = {}) {
  if (settings.gamedevPlayLoopEnabled !== true) {
    return { ok: false, skipped: true, reason: "play_loop_disabled" };
  }
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }

  const attempts = [];
  for (let index = 0; index < maxAttempts; index += 1) {
    if (recipeId) {
      const wire = await tryExecuteWireRecipe(recipeId, { skipIfNoBridge: false });
      attempts.push({ step: "wire", wire });
      if (!wire.ok && !wire.skipped) {
        break;
      }
    }

    const play = await dispatchUnityCommand("play_mode", { enter: true });
    attempts.push({ step: "play_mode", play });
    if (!play.ok) {
      continue;
    }

    const verify = await verifyGamedevPhase(resolved, { mcp: "unity_play_mode" });
    attempts.push({ step: "verify", verify });
    if (verify.ok) {
      return { ok: true, attempts, attemptCount: index + 1 };
    }

    await dispatchUnityCommand("play_mode", { enter: false }).catch(() => null);
  }

  return {
    ok: false,
    error: "Play loop did not pass verification.",
    attempts,
  };
}

module.exports = { runGamedevPlayLoop };
