const fs = require("fs");
const path = require("path");
const { probeUnityBridge } = require("./gamedev-mcp-proxy");
const { runGameVerification } = require("./game-pipeline/game-pipeline-state");

async function verifyGamedevPhase(workspacePath, verification = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }

  if (verification.mcp === "unity_play_mode") {
    const bridge = await probeUnityBridge();
    if (!bridge.connected) {
      return { ok: true, skipped: true, warn: "Unity bridge offline" };
    }
  }

  const base = await runGameVerification(resolved, verification, { strict: false });
  if (!base.ok) {
    return base;
  }

  const logHints = [];
  const editorLog = path.join(resolved, "Logs");
  if (fs.existsSync(editorLog)) {
    logHints.push("Unity Logs folder present");
  }

  return {
    ok: true,
    ...base,
    logHints,
  };
}

module.exports = { verifyGamedevPhase };
