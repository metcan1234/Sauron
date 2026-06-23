const { spawn } = require("child_process");
const path = require("path");
const { discoverGooseBinaryAsync } = require("./goose-binary-resolver");
const { seedGooseInstructions } = require("./goose-instructions");
const { writeGooseHandoff, updateGooseHandoffStatus } = require("./goose-handoff");
const { resolveGooseMode, resolveModeProviderConfig } = require("./goose-router");
const { recordGooseSessionStart } = require("./goose-finops");
const {
  setActiveGooseSession,
  clearActiveGooseSession,
  getActiveGooseSession,
} = require("./goose-session-state");
const { GOOSE_INSTRUCTIONS_DIR, GOOSE_INSTRUCTIONS_FILE } = require("./goose-config");

function escapePowerShellSingleQuoted(value) {
  return String(value || "").replace(/'/g, "''");
}

function buildGooseEnv(settings = {}, providerConfig = {}) {
  const env = { ...process.env };
  env.GOOSE_PROVIDER = String(providerConfig.provider || "openai");
  env.GOOSE_MODEL = String(providerConfig.model || "gpt-4o-mini");

  if (settings.openaiApiKey) env.OPENAI_API_KEY = settings.openaiApiKey;
  if (settings.deepseekApiKey) env.DEEPSEEK_API_KEY = settings.deepseekApiKey;
  if (settings.openrouterApiKey) env.OPENROUTER_API_KEY = settings.openrouterApiKey;
  if (settings.geminiApiKey) env.GEMINI_API_KEY = settings.geminiApiKey;
  if (settings.ollamaUrl) env.OLLAMA_HOST = settings.ollamaUrl;

  return env;
}

function buildLaunchScript(binaryPath, workspacePath, taskText, providerConfig) {
  const binary = escapePowerShellSingleQuoted(binaryPath);
  const cwd = escapePowerShellSingleQuoted(workspacePath);
  const task = escapePowerShellSingleQuoted(taskText);
  const provider = escapePowerShellSingleQuoted(providerConfig.provider);
  const model = escapePowerShellSingleQuoted(providerConfig.model);
  const systemPath = path.join(workspacePath, GOOSE_INSTRUCTIONS_DIR, GOOSE_INSTRUCTIONS_FILE);
  const system = escapePowerShellSingleQuoted(`@${systemPath}`);

  return [
    `$ErrorActionPreference = 'Stop'`,
    `Set-Location '${cwd}'`,
    `& '${binary}' run --no-session --provider '${provider}' --model '${model}' --system '${system}' -t '${task}'`,
  ].join("; ");
}

async function launchGoose({ workspacePath, taskText, settings = {}, modeOverride = null }) {
  const resolvedWorkspace = String(workspacePath || settings.workspacePath || "").trim();
  const task = String(taskText || "").trim();
  if (!resolvedWorkspace) {
    return { ok: false, error: "Workspace path is not configured." };
  }
  if (!task) {
    return { ok: false, error: "Goose görev metni boş." };
  }

  const binaryPath = await discoverGooseBinaryAsync(settings);
  if (!binaryPath) {
    return {
      ok: false,
      error: "Goose binary bulunamadı. Ayarlar → AI Ajanları → Goose yolunu kontrol edin.",
    };
  }

  const routing = modeOverride
    ? {
      mode: modeOverride,
      reason: "manual-override",
      providerConfig: resolveModeProviderConfig(modeOverride, settings),
      notices: [],
    }
    : await resolveGooseMode(task, settings);

  seedGooseInstructions(resolvedWorkspace);

  const sessionId = `goose-${Date.now()}`;
  const handoffResult = writeGooseHandoff(resolvedWorkspace, {
    taskText: task,
    mode: routing.mode,
    sessionId,
  });

  const env = buildGooseEnv(settings, routing.providerConfig);
  const innerScript = buildLaunchScript(binaryPath, resolvedWorkspace, task, routing.providerConfig);
  const psCommand = `Start-Process powershell -ArgumentList '-NoExit','-Command','${innerScript.replace(/'/g, "''")}' -WindowStyle Normal`;

  const child = spawn("powershell.exe", ["-NoProfile", "-Command", psCommand], {
    detached: true,
    stdio: "ignore",
    env,
    windowsHide: true,
  });
  child.unref();

  await recordGooseSessionStart({
    settings,
    mode: routing.mode,
    provider: routing.providerConfig.provider,
    model: routing.providerConfig.model,
    sessionId,
  });

  updateGooseHandoffStatus(resolvedWorkspace, handoffResult.handoff.id, "running", {
    provider: routing.providerConfig.provider,
    model: routing.providerConfig.model,
    binaryPath,
  });

  setActiveGooseSession({
    sessionId,
    workspacePath: resolvedWorkspace,
    mode: routing.mode,
    startedAt: new Date().toISOString(),
    handoffId: handoffResult.handoff.id,
    pid: child.pid,
  });

  return {
    ok: true,
    sessionId,
    mode: routing.mode,
    reason: routing.reason,
    notices: routing.notices,
    provider: routing.providerConfig.provider,
    model: routing.providerConfig.model,
    binaryPath,
    handoffId: handoffResult.handoff.id,
  };
}

function cancelGooseSession() {
  const session = getActiveGooseSession();
  if (!session) {
    return { ok: false, error: "Aktif Goose oturumu yok." };
  }

  if (session.pid) {
    try {
      process.kill(session.pid);
    } catch {
      // process may already be gone
    }
  }

  updateGooseHandoffStatus(session.workspacePath, session.handoffId, "cancelled");
  clearActiveGooseSession();
  return { ok: true, sessionId: session.sessionId };
}

function getGooseStatus() {
  const session = getActiveGooseSession();
  if (!session) {
    return { ok: true, active: false };
  }
  return { ok: true, active: true, session };
}

module.exports = {
  launchGoose,
  cancelGooseSession,
  getGooseStatus,
  buildGooseEnv,
  buildLaunchScript,
  escapePowerShellSingleQuoted,
};
