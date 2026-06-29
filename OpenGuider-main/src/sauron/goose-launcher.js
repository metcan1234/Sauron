const channelRuntime = require("./channel-runtime");
const fs = require("fs");
const path = require("path");
const { probeGooseBinary, resolveBinaryPathOnDisk, resolveDirectoryOnDisk } = require("./goose-binary-resolver");
const {
  buildGooseCliArgs,
  spawnGooseProcess,
} = require("./goose-terminal-spawn");
const { seedGooseInstructions } = require("./goose-instructions");
const { writeGooseHandoff, updateGooseHandoffStatus } = require("./goose-handoff");
const { resolveGooseMode, resolveModeProviderConfig } = require("./goose-router");
const { recordGooseSessionStart } = require("./goose-finops");
const { applyRecipeToTask } = require("./goose-recipes");
const { optimizeGooseTaskText, buildModeSystemInstructions, DEFAULT_TASK_MAX_CHARS } = require("./goose-task-optimizer");
const {
  setActiveGooseSession,
  clearActiveGooseSession,
  getActiveGooseSession,
} = require("./goose-session-state");
const { GOOSE_INSTRUCTIONS_DIR, GOOSE_INSTRUCTIONS_FILE } = require("./goose-config");

function buildGooseEnv(settings = {}, providerConfig = {}) {
  const env = { ...process.env };
  env.GOOSE_PROVIDER = String(providerConfig.provider || "openai");
  env.GOOSE_MODEL = String(providerConfig.model || "gpt-4o-mini");
  env.GOOSE_TELEMETRY_OFF = "1";
  env.GOOSE_TERMINAL = "1";
  env.GOOSE_MCP_PROFILE = String(settings.gooseMcpProfile || "workspace");

  if (settings.openaiApiKey) env.OPENAI_API_KEY = settings.openaiApiKey;
  if (settings.deepseekApiKey) env.DEEPSEEK_API_KEY = settings.deepseekApiKey;
  if (settings.openrouterApiKey) env.OPENROUTER_API_KEY = settings.openrouterApiKey;
  if (settings.geminiApiKey) env.GEMINI_API_KEY = settings.geminiApiKey;
  if (settings.ollamaUrl) env.OLLAMA_HOST = settings.ollamaUrl;

  const overrides = providerConfig.envOverrides;
  if (overrides && typeof overrides === "object") {
    for (const [key, value] of Object.entries(overrides)) {
      if (value != null && String(value).trim() !== "") {
        env[key] = String(value);
      }
    }
  }

  return env;
}

async function launchGoose({ workspacePath, taskText, settings = {}, modeOverride = null }) {
  const resolvedWorkspace = String(workspacePath || settings.workspacePath || "").trim();
  const rawTask = String(taskText || "").trim();
  if (!resolvedWorkspace) {
    return { ok: false, error: "Workspace path is not configured." };
  }
  if (!rawTask) {
    return { ok: false, error: "Goose görev metni boş." };
  }

  const recipeApplied = applyRecipeToTask(rawTask, settings.gooseRecipeId);
  const optimizedTask = optimizeGooseTaskText(recipeApplied.text, {
    maxChars: Number(settings.tokenUltraMaxHandoffChars) || DEFAULT_TASK_MAX_CHARS,
  });
  const task = optimizedTask.text;

  const probe = await probeGooseBinary(settings);
  if (!probe.cliCapable || !probe.binaryPath) {
    if (probe.kind === "desktop") {
      return {
        ok: false,
        error: probe.error || "Goose Desktop bulundu; terminal CLI gerekir.",
        installHint: probe.installHint,
        desktopPath: probe.desktopPath || probe.binaryPath,
        kind: "desktop",
      };
    }
    return {
      ok: false,
      error: probe.error || "Goose CLI bulunamadı. Ayarlar → AI Ajanları → Goose yolunu kontrol edin.",
      installHint: probe.installHint,
    };
  }

  const configuredPath = String(settings.gooseBinaryPath || "").trim();
  const binaryPath = resolveBinaryPathOnDisk(probe.binaryPath)
    || resolveBinaryPathOnDisk(configuredPath)
    || probe.binaryPath;
  const canonicalWorkspace = resolveDirectoryOnDisk(resolvedWorkspace) || resolvedWorkspace;

  const routing = modeOverride
    ? {
      mode: modeOverride,
      reason: "manual-override",
      providerConfig: resolveModeProviderConfig(modeOverride, settings),
      notices: [],
    }
    : await resolveGooseMode(task, settings);

  seedGooseInstructions(canonicalWorkspace);

  const sessionId = `goose-${Date.now()}`;
  const handoffResult = writeGooseHandoff(canonicalWorkspace, {
    taskText: task,
    mode: routing.mode,
    sessionId,
  });

  const instructionsPath = path.join(
    canonicalWorkspace,
    GOOSE_INSTRUCTIONS_DIR,
    GOOSE_INSTRUCTIONS_FILE,
  );
  let systemInstructions = "";
  try {
    if (fs.existsSync(instructionsPath)) {
      systemInstructions = fs.readFileSync(instructionsPath, "utf8");
    }
  } catch {
    // optional system instructions
  }
  systemInstructions = buildModeSystemInstructions(
    systemInstructions,
    routing.mode,
    canonicalWorkspace,
  );

  const launchNotices = [...(routing.notices || [])];
  if (optimizedTask.truncated) {
    launchNotices.push("Görev metni token tasarrufu için kısaltıldı.");
  }

  const gooseArgs = buildGooseCliArgs({
    taskText: task,
    providerConfig: routing.providerConfig,
    systemInstructions,
  });
  const env = buildGooseEnv(settings, routing.providerConfig);

  let spawnResult;
  try {
    spawnResult = await spawnGooseProcess({
      binaryPath,
      workspacePath: canonicalWorkspace,
      args: gooseArgs,
      env,
      sessionId,
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Goose başlatılamadı.",
    };
  }

  await recordGooseSessionStart({
    settings,
    mode: routing.mode,
    provider: routing.providerConfig.provider,
    model: routing.providerConfig.model,
    sessionId,
    wordCount: optimizedTask.wordCount,
    taskText: task,
  });

  updateGooseHandoffStatus(canonicalWorkspace, handoffResult.handoff.id, "running", {
    provider: routing.providerConfig.provider,
    model: routing.providerConfig.model,
    binaryPath,
    launchMethod: spawnResult.terminal,
  });

  setActiveGooseSession({
    sessionId,
    workspacePath: canonicalWorkspace,
    mode: routing.mode,
    startedAt: new Date().toISOString(),
    handoffId: handoffResult.handoff.id,
    pid: spawnResult.pid,
    binaryPath,
    terminal: spawnResult.terminal,
  });

  // Register with channel-runtime
  if (spawnResult?.pid && typeof spawnResult.pid === 'number' && spawnResult.pid > 0) {
    channelRuntime.registerProcess('goose', spawnResult.pid, {
      sessionId,
      workspacePath: canonicalWorkspace,
      label: `Goose CLI (${spawnResult.terminal})`,
      dependencyPath: binaryPath,
    });
  }

  return {
    ok: true,
    sessionId,
    mode: routing.mode,
    reason: routing.reason,
    notices: launchNotices,
    provider: routing.providerConfig.provider,
    model: routing.providerConfig.model,
    binaryPath,
    handoffId: handoffResult.handoff.id,
    terminal: spawnResult.terminal,
    launchMethod: "node-spawn",
  };
}

async function cancelGooseSession() {
  const session = getActiveGooseSession();
  if (!session) {
    return { ok: false, error: "Aktif Goose oturumu yok." };
  }

  // Use channel-runtime for tree-aware kill (primary)
  const killResult = await channelRuntime.killChannel('goose');
  if (killResult.ok) {
    // channel-runtime handled cleanup and unregistered the process
    updateGooseHandoffStatus(session.workspacePath, session.handoffId, "cancelled");
    clearActiveGooseSession();
    return { ok: true, sessionId: session.sessionId };
  }

  // Fallback to direct process.kill
  if (session.pid) {
    try {
      process.kill(session.pid);
    } catch {
      // process may already be gone
    }
  }

  channelRuntime.unregisterProcess('goose');
  updateGooseHandoffStatus(session.workspacePath, session.handoffId, "cancelled");
  clearActiveGooseSession();
  return { ok: true, sessionId: session.sessionId };
}

function getGooseStatus() {
  const session = getActiveGooseSession();
  if (!session) {
    return { ok: true, active: false };
  }
  const alive = channelRuntime.isAlive('goose');
  return { ok: true, active: alive, session, runtimeAlive: alive };
}

module.exports = {
  launchGoose,
  cancelGooseSession,
  getGooseStatus,
  buildGooseEnv,
  buildGooseCliArgs,
};
