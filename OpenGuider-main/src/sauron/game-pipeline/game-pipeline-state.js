const fs = require("fs");
const path = require("path");

const GAME_PIPELINE_STATE_FILE = "game-pipeline.json";
const TASK_COMPLETE_FILE = "cline-task-complete.json";

function getSauronDir(workspacePath) {
  return path.join(workspacePath, ".sauron");
}

function readGamePipelineState(workspacePath) {
  const statePath = path.join(getSauronDir(workspacePath), GAME_PIPELINE_STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function writeGamePipelineState(workspacePath, state) {
  const sauronDir = getSauronDir(workspacePath);
  fs.mkdirSync(sauronDir, { recursive: true });
  const statePath = path.join(sauronDir, GAME_PIPELINE_STATE_FILE);
  const next = { ...state, updatedAt: new Date().toISOString() };
  fs.writeFileSync(statePath, JSON.stringify(next, null, 2), "utf8");
  return statePath;
}

function readTaskCompleteArtifact(workspacePath) {
  const artifactPath = path.join(getSauronDir(workspacePath), TASK_COMPLETE_FILE);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  } catch {
    return null;
  }
}

function clearTaskCompleteArtifact(workspacePath) {
  const artifactPath = path.join(getSauronDir(workspacePath), TASK_COMPLETE_FILE);
  try {
    if (fs.existsSync(artifactPath)) {
      fs.unlinkSync(artifactPath);
    }
  } catch {
    // ignore
  }
}

async function runGameVerification(workspacePath, verification, options = {}) {
  if (!verification) {
    return { ok: true, skipped: true };
  }

  const strict = options.strict === true;

  if (verification.artifact) {
    const artifact = readTaskCompleteArtifact(workspacePath);
    if (artifact) {
      return { ok: true, skipped: false, artifact: true };
    }
    return { ok: true, skipped: true, artifact: false };
  }

  if (verification.mcp === "unity_play_mode") {
    const { runUnityPlayModeVerification, probeUnityBridge } = require("../gamedev-mcp-proxy");
    const probe = await probeUnityBridge();
    if (!probe.connected) {
      if (strict) {
        return {
          ok: false,
          skipped: false,
          error: "Unity bridge bağlı değil — son faz playtest doğrulaması başarısız.",
        };
      }
      return {
        ok: true,
        skipped: true,
        warn: probe.error || "Unity bridge not connected",
      };
    }
    return runUnityPlayModeVerification("play");
  }

  if (verification.command) {
    const { runVerification } = require("../build-pipeline/pipeline-state");
    return runVerification(workspacePath, verification);
  }

  return { ok: true, skipped: true };
}

module.exports = {
  GAME_PIPELINE_STATE_FILE,
  readGamePipelineState,
  writeGamePipelineState,
  readTaskCompleteArtifact,
  clearTaskCompleteArtifact,
  runGameVerification,
};
