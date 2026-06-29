const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const PIPELINE_STATE_FILE = "build-pipeline.json";
const TASK_COMPLETE_FILE = "cline-task-complete.json";

function getSauronDir(workspacePath) {
  return path.join(workspacePath, ".sauron");
}

function readPipelineState(workspacePath) {
  const statePath = path.join(getSauronDir(workspacePath), PIPELINE_STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function writePipelineState(workspacePath, state) {
  const sauronDir = getSauronDir(workspacePath);
  fs.mkdirSync(sauronDir, { recursive: true });
  const statePath = path.join(sauronDir, PIPELINE_STATE_FILE);
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

async function runVerification(workspacePath, verification, { timeoutMs = 120000 } = {}) {
  if (!verification?.command) {
    return { ok: true, skipped: true };
  }

  const cwd = verification.cwd
    ? path.resolve(workspacePath, verification.cwd)
    : workspacePath;

  const runCommand = async (command) => {
    const shell = process.platform === "win32";
    const { stdout, stderr } = await execFileAsync(
      shell ? "cmd.exe" : "sh",
      shell ? ["/c", command] : ["-c", command],
      { cwd, timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
    );
    return {
      ok: true,
      stdout: String(stdout || "").slice(0, 2000),
      stderr: String(stderr || "").slice(0, 1000),
    };
  };

  try {
    return await runCommand(verification.command);
  } catch (error) {
    if (verification.fallbackCommand) {
      try {
        const fallback = await runCommand(verification.fallbackCommand);
        return { ...fallback, usedFallback: true };
      } catch (fallbackError) {
        return {
          ok: false,
          error: fallbackError?.message || "Verification failed",
          stdout: String(fallbackError?.stdout || "").slice(0, 2000),
          stderr: String(fallbackError?.stderr || "").slice(0, 1000),
          usedFallback: true,
        };
      }
    }
    return {
      ok: false,
      error: error?.message || "Verification failed",
      stdout: String(error?.stdout || "").slice(0, 2000),
      stderr: String(error?.stderr || "").slice(0, 1000),
    };
  }
}

module.exports = {
  PIPELINE_STATE_FILE,
  TASK_COMPLETE_FILE,
  readPipelineState,
  writePipelineState,
  readTaskCompleteArtifact,
  clearTaskCompleteArtifact,
  runVerification,
};
