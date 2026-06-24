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

module.exports = {
  GAME_PIPELINE_STATE_FILE,
  readGamePipelineState,
  writeGamePipelineState,
  readTaskCompleteArtifact,
  clearTaskCompleteArtifact,
};
