const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildLaunchScript,
  buildGooseEnv,
  buildEnvSetupLines,
  writeLaunchArtifacts,
} = require("../../../src/sauron/goose-launcher");
const {
  buildStartProcessCommand,
  buildVisibleTerminalSpawnCommand,
} = require("../../../src/sauron/goose-terminal-spawn");

test("buildLaunchScript uses instructions file and interactive mode", () => {
  const script = buildLaunchScript({
    binaryPath: "C:\\tools\\goose.exe",
    workspacePath: "C:\\Users\\me\\Sauron Core\\proj",
    taskFilePath: "C:\\Temp\\sauron-goose\\task-1.txt",
    instructionsPath: "C:\\Users\\me\\Sauron Core\\proj\\.goose\\instructions.md",
    providerConfig: { provider: "deepseek", model: "deepseek-chat" },
  });

  assert.match(script, /-LiteralPath/);
  assert.match(script, /'-i',/);
  assert.match(script, /'-s',/);
  assert.match(script, /--no-session/);
  assert.doesNotMatch(script, /--system/);
  assert.match(script, /& \$goose @args/);
  assert.match(script, /Read-Host/);
  assert.match(script, /WindowTitle/);
  assert.match(script, /GOOSE_TELEMETRY_OFF/);
});

test("buildGooseEnv disables telemetry and marks goose terminal context", () => {
  const env = buildGooseEnv({}, { provider: "ollama", model: "qwen2.5-coder:7b" });
  assert.equal(env.GOOSE_TELEMETRY_OFF, "1");
  assert.equal(env.GOOSE_TERMINAL, "1");
  assert.equal(env.GOOSE_PROVIDER, "ollama");
});

test("buildEnvSetupLines writes PowerShell env assignments", () => {
  const lines = buildEnvSetupLines({
    GOOSE_PROVIDER: "ollama",
    GOOSE_MODEL: "qwen2.5-coder:7b",
    OLLAMA_HOST: "http://127.0.0.1:11434",
    UNRELATED: "skip",
  });
  const joined = lines.join("\n");
  assert.match(joined, /\$env:GOOSE_PROVIDER/);
  assert.match(joined, /\$env:OLLAMA_HOST/);
  assert.doesNotMatch(joined, /UNRELATED/);
});

test("buildStartProcessCommand uses visible window style", () => {
  const cmd = buildStartProcessCommand(
    "C:\\Temp\\launch.ps1",
    "C:\\workspace",
    null,
  );
  assert.match(cmd, /WindowStyle Normal/);
  assert.match(cmd, /-NoLogo/);
});

test("buildVisibleTerminalSpawnCommand prefers Windows Terminal when available", () => {
  const { command, terminal } = buildVisibleTerminalSpawnCommand(
    "C:\\Temp\\launch.ps1",
    "C:\\workspace",
  );
  assert.ok(["windows-terminal", "powershell"].includes(terminal));
  assert.match(command, /Write-Output \$spawnPid/);
  if (terminal === "windows-terminal") {
    assert.match(command, /wt\.exe|WindowsApps/);
    assert.match(command, /--title/);
  }
});

test("buildGooseEnv applies provider env overrides", () => {
  const env = buildGooseEnv(
    { openaiApiKey: "sk-openai" },
    {
      provider: "openai",
      model: "deepseek/deepseek-chat",
      envOverrides: {
        OPENAI_API_KEY: "sk-or",
        GOOSE_PROVIDER__HOST: "https://openrouter.ai/api/v1",
      },
    },
  );
  assert.equal(env.GOOSE_PROVIDER, "openai");
  assert.equal(env.OPENAI_API_KEY, "sk-or");
  assert.equal(env.GOOSE_PROVIDER__HOST, "https://openrouter.ai/api/v1");
});

test("writeLaunchArtifacts writes task and script files", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "goose-launch-"));
  const sessionId = "test-session";
  const { scriptPath, taskFilePath } = writeLaunchArtifacts({
    sessionId,
    taskText: "list files with spaces & 'quotes'",
    binaryPath: "C:\\goose.exe",
    workspacePath: workspace,
    providerConfig: { provider: "deepseek", model: "deepseek-chat" },
  });

  assert.ok(fs.existsSync(taskFilePath));
  assert.ok(fs.existsSync(scriptPath));
  assert.match(fs.readFileSync(taskFilePath, "utf8"), /quotes/);
  assert.match(fs.readFileSync(scriptPath, "utf8"), /Get-Content -LiteralPath/);

  fs.rmSync(workspace, { recursive: true, force: true });
  fs.unlinkSync(scriptPath);
  fs.unlinkSync(taskFilePath);
});
