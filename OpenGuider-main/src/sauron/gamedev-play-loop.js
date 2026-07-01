const { tryExecuteWireRecipe } = require("./gamedev-wire-executor");
const { probeUnityBridge, probeUnrealBridge, dispatchUnityCommand, dispatchUnrealCommand } = require("./gamedev-mcp-proxy");
const { verifyGamedevPhase } = require("./gamedev-verification");
const { normalizeGamedevEngine } = require("./gamedev-config");

async function runGamedevPlayLoop({
  workspacePath,
  settings = {},
  maxAttempts = 3,
  recipeId = null,
  engine = null,
} = {}) {
  if (settings.gamedevPlayLoopEnabled !== true) {
    return { ok: false, skipped: true, reason: "play_loop_disabled" };
  }
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }

  const activeEngine = normalizeGamedevEngine(engine || settings.gamedevActiveEngine || "unity");
  const attempts = [];

  for (let index = 0; index < maxAttempts; index += 1) {
    if (recipeId) {
      const wire = await tryExecuteWireRecipe(recipeId, { skipIfNoBridge: false });
      attempts.push({ step: "wire", wire });
      if (!wire.ok && !wire.skipped) {
        break;
      }
    }

    const probe = activeEngine === "unreal"
      ? await probeUnrealBridge({ workspacePath: resolved })
      : await probeUnityBridge({ workspacePath: resolved });
    attempts.push({ step: "probe", probe });

    if (!probe.connected) {
      continue;
    }

    if (probe.transport === "http") {
      return {
        ok: true,
        skipped: true,
        reason: "http-mcp-active",
        engine: activeEngine,
        message: "Play loop editor HTTP MCP üzerinden — Cline funplay/unityMCP aracını kullanır.",
        attempts,
      };
    }

    const dispatch = activeEngine === "unreal" ? dispatchUnrealCommand : dispatchUnityCommand;
    const play = await dispatch("play_mode", { enter: true });
    attempts.push({ step: "play_mode", play });
    if (!play.ok) {
      continue;
    }

    const verifyMcp = activeEngine === "unreal" ? "unreal_play_mode" : "unity_play_mode";
    const verify = await verifyGamedevPhase(resolved, { mcp: verifyMcp, engine: activeEngine });
    attempts.push({ step: "verify", verify });
    if (verify.ok) {
      return { ok: true, attempts, attemptCount: index + 1, engine: activeEngine };
    }

    await dispatch("play_mode", { enter: false }).catch(() => null);
  }

  return {
    ok: false,
    error: "Play loop did not pass verification.",
    engine: activeEngine,
    attempts,
  };
}

module.exports = { runGamedevPlayLoop };
