const fs = require("fs");
const path = require("path");
const { probeUnityBridge, probeUnrealBridge } = require("./gamedev-mcp-proxy");
const { runGameVerification } = require("./game-pipeline/game-pipeline-state");
const { normalizeGamedevEngine } = require("./gamedev-config");

async function verifyGamedevPhase(workspacePath, verification = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }

  const engine = normalizeGamedevEngine(verification.engine || "unity");

  if (verification.mcp === "unity_play_mode" || (engine === "unity" && verification.mcp)) {
    const bridge = await probeUnityBridge({ workspacePath: resolved });
    if (!bridge.connected) {
      return { ok: true, skipped: true, warn: "Unity bridge offline" };
    }
    if (bridge.transport === "http") {
      return { ok: true, skipped: false, via: "unityMCP-http" };
    }
  }

  if (verification.mcp === "unreal_play_mode" || (engine === "unreal" && verification.mcp)) {
    const bridge = await probeUnrealBridge({ workspacePath: resolved });
    if (!bridge.connected) {
      return { ok: true, skipped: true, warn: "Unreal bridge offline" };
    }
    if (bridge.transport === "http") {
      return { ok: true, skipped: false, via: "funplay-http" };
    }
  }

  const base = await runGameVerification(resolved, verification, { strict: false });
  if (!base.ok) {
    return base;
  }

  const logHints = [];
  if (engine === "unity") {
    const editorLog = path.join(resolved, "Logs");
    if (fs.existsSync(editorLog)) {
      logHints.push("Unity Logs folder present");
    }
  }
  if (engine === "unreal") {
    const saved = path.join(resolved, "Saved");
    if (fs.existsSync(saved)) {
      logHints.push("Unreal Saved folder present");
    }
  }

  return {
    ok: true,
    ...base,
    engine,
    logHints,
  };
}

module.exports = { verifyGamedevPhase };
