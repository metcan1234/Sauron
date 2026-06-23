const fs = require("fs");
const os = require("os");
const path = require("path");
const { probeGooseBinary } = require("./goose-binary-resolver");
const {
  GOOSE_TERMINAL_TITLE,
  spawnVisibleGooseTerminal,
} = require("./goose-terminal-spawn");
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
const {
  escapePowerShellSingleQuoted,
  toPowerShellLiteralPath,
  writeUtf8BomFile,
} = require("./goose-powershell");

function getGooseLaunchDir() {
  const dir = path.join(os.tmpdir(), "sauron-goose");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const GOOSE_ENV_PREFIXES = [
  "GOOSE_",
  "OPENAI_",
  "DEEPSEEK_",
  "OPENROUTER_",
  "GEMINI_",
  "OLLAMA_",
  "ANTHROPIC_",
];

function buildGooseEnv(settings = {}, providerConfig = {}) {
  const env = { ...process.env };
  env.GOOSE_PROVIDER = String(providerConfig.provider || "openai");
  env.GOOSE_MODEL = String(providerConfig.model || "gpt-4o-mini");
  env.GOOSE_TELEMETRY_OFF = "1";
  env.GOOSE_TERMINAL = "1";

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

function buildEnvSetupLines(env = {}) {
  const lines = [];
  for (const [key, value] of Object.entries(env)) {
    if (value == null || String(value).trim() === "") {
      continue;
    }
    if (!GOOSE_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      continue;
    }
    lines.push(`$env:${key} = '${escapePowerShellSingleQuoted(String(value))}'`);
  }
  if (!lines.some((line) => line.startsWith("$env:GOOSE_TELEMETRY_OFF"))) {
    lines.push("$env:GOOSE_TELEMETRY_OFF = '1'");
  }
  if (!lines.some((line) => line.startsWith("$env:GOOSE_TERMINAL"))) {
    lines.push("$env:GOOSE_TERMINAL = '1'");
  }
  return lines;
}

function buildKeepOpenFooter() {
  return [
    "Write-Host ''",
    "Write-Host 'Kapatmak icin Enter.' -ForegroundColor DarkGray",
    "try {",
    "  if ([Environment]::UserInteractive) { [void][Console]::ReadLine() }",
    "  else { Start-Sleep -Seconds 3600 }",
    "} catch {",
    "  Start-Sleep -Seconds 3600",
    "}",
  ];
}

function buildLaunchScript({
  binaryPath,
  workspacePath,
  taskFilePath,
  instructionsPath,
  providerConfig = {},
  env = {},
}) {
  const binaryLit = toPowerShellLiteralPath(binaryPath);
  const cwdLit = toPowerShellLiteralPath(workspacePath);
  const taskFileLit = toPowerShellLiteralPath(taskFilePath);
  const instructionsLit = toPowerShellLiteralPath(instructionsPath);
  const provider = escapePowerShellSingleQuoted(providerConfig.provider || "openai");
  const model = escapePowerShellSingleQuoted(providerConfig.model || "gpt-4o-mini");

  const envLines = buildEnvSetupLines(env);

  return [
    "$ErrorActionPreference = 'Continue'",
    "try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}",
    `try { $host.UI.RawUI.WindowTitle = '${escapePowerShellSingleQuoted(GOOSE_TERMINAL_TITLE)}' } catch {}`,
    ...envLines,
    `Set-Location -LiteralPath ${cwdLit}`,
    `$task = Get-Content -LiteralPath ${taskFileLit} -Raw -Encoding UTF8`,
    `$gooseArgs = @(`,
    "  'run',",
    "  '--no-session',",
    "  '-s',",
    `  '--provider', '${provider}',`,
    `  '--model', '${model}',`,
    `  '-i', ${instructionsLit},`,
    "  '-t', $task",
    ")",
    "Write-Host 'Sauron Goose — baslatiliyor...' -ForegroundColor Cyan",
    `Write-Host "Provider: ${provider} | Model: ${model}"`,
    "try {",
    `  & ${binaryLit} @gooseArgs`,
    "  $code = $LASTEXITCODE",
    "  if ($code -ne 0) {",
    "    Write-Host \"Goose hata kodu: $code\" -ForegroundColor Red",
    "    Write-Host 'Provider/API anahtari veya goose configure ayarlarini kontrol edin.' -ForegroundColor Yellow",
    "  }",
    "} catch {",
    "  Write-Host $_.Exception.Message -ForegroundColor Red",
    "}",
    ...buildKeepOpenFooter(),
  ].join("\r\n");
}

function writeLaunchArtifacts({
  sessionId,
  taskText,
  binaryPath,
  workspacePath,
  providerConfig,
  env = {},
}) {
  const launchDir = getGooseLaunchDir();
  const taskFilePath = path.join(launchDir, `task-${sessionId}.txt`);
  const scriptPath = path.join(launchDir, `launch-${sessionId}.ps1`);
  const instructionsPath = path.join(workspacePath, GOOSE_INSTRUCTIONS_DIR, GOOSE_INSTRUCTIONS_FILE);

  writeUtf8BomFile(taskFilePath, String(taskText));
  writeUtf8BomFile(
    scriptPath,
    buildLaunchScript({
      binaryPath,
      workspacePath,
      taskFilePath,
      instructionsPath,
      providerConfig,
      env,
    }),
  );

  return { scriptPath, taskFilePath, instructionsPath };
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

  const binaryPath = probe.binaryPath;

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

  const { scriptPath } = writeLaunchArtifacts({
    sessionId,
    taskText: task,
    binaryPath,
    workspacePath: resolvedWorkspace,
    providerConfig: routing.providerConfig,
    env,
  });

  let spawnResult;
  try {
    spawnResult = await spawnVisibleGooseTerminal({
      scriptPath,
      workspacePath: resolvedWorkspace,
      sessionId,
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Goose terminal penceresi açılamadı.",
    };
  }

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
    scriptPath,
  });

  setActiveGooseSession({
    sessionId,
    workspacePath: resolvedWorkspace,
    mode: routing.mode,
    startedAt: new Date().toISOString(),
    handoffId: handoffResult.handoff.id,
    pid: spawnResult.pid,
    scriptPath,
    terminal: spawnResult.terminal,
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
    scriptPath,
    terminal: spawnResult.terminal,
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
  buildEnvSetupLines,
  buildLaunchScript,
  buildKeepOpenFooter,
  writeLaunchArtifacts,
  escapePowerShellSingleQuoted,
  toPowerShellLiteralPath,
  getGooseLaunchDir,
  GOOSE_ENV_PREFIXES,
};
