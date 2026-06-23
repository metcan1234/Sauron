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
  buildWindowsTerminalCommandLine,
  writeVisibleTerminalBootstrap,
  buildPowerShellLaunchArgs,
} = require("../../../src/sauron/goose-terminal-spawn");
const {
  UTF8_BOM,
  encodePowerShellCommand,
  toPowerShellLiteralPath,
} = require("../../../src/sauron/goose-powershell");

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
  assert.match(script, /& "C:\\tools\\goose\.exe"/);
  assert.match(script, /@gooseArgs/);
  assert.doesNotMatch(script, /\$goose =/);
  assert.doesNotMatch(script, /\$args = @/);
  assert.match(script, /ReadLine/);
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

test("buildLaunchScript preserves Turkish paths with double-quoted literals", () => {
  const turkishPath = "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\goose-package\\goose.exe";
  const script = buildLaunchScript({
    binaryPath: turkishPath,
    workspacePath: "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\proj",
    taskFilePath: "C:\\Temp\\sauron-goose\\task-1.txt",
    instructionsPath: "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\proj\\.goose\\instructions.md",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
  });

  assert.match(script, /EVERYTHİNG/);
  assert.doesNotMatch(script, /EVERYTH°NG/);
  assert.ok(script.includes(`& ${toPowerShellLiteralPath(turkishPath)} @gooseArgs`));
  assert.match(script, /-Encoding UTF8/);
});

test("writeLaunchArtifacts writes UTF-8 BOM ps1 and task files", () => {
  const turkishWorkspace = path.join(os.tmpdir(), "goose-launch-EVERYTHİNG-test");
  fs.mkdirSync(turkishWorkspace, { recursive: true });
  const sessionId = "utf8-bom-session";
  const binaryPath = "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\goose-package\\goose.exe";
  const { scriptPath, taskFilePath } = writeLaunchArtifacts({
    sessionId,
    taskText: "list files in src",
    binaryPath,
    workspacePath: turkishWorkspace,
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
  });

  const scriptRaw = fs.readFileSync(scriptPath);
  const taskRaw = fs.readFileSync(taskFilePath);
  assert.equal(scriptRaw[0], 0xef);
  assert.equal(scriptRaw[1], 0xbb);
  assert.equal(scriptRaw[2], 0xbf);
  assert.equal(taskRaw[0], 0xef);
  const script = scriptRaw.toString("utf8");
  assert.match(script, /EVERYTHİNG/);
  assert.match(script, /& "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\goose-package\\goose\.exe"/);

  fs.rmSync(turkishWorkspace, { recursive: true, force: true });
  fs.unlinkSync(scriptPath);
  fs.unlinkSync(taskFilePath);
});

test("encodePowerShellCommand preserves Turkish characters for -EncodedCommand", () => {
  const sample = `Set-Location -LiteralPath ${toPowerShellLiteralPath("C:\\EVERYTHİNG\\goose")}`;
  const encoded = encodePowerShellCommand(sample);
  const decoded = Buffer.from(encoded, "base64").toString("utf16le");
  assert.match(decoded, /EVERYTHİNG/);
  assert.doesNotMatch(decoded, /EVERYTH°NG/);
});

test("buildPowerShellLaunchArgs always includes -NoExit", () => {
  const args = buildPowerShellLaunchArgs("C:\\Temp\\launch.ps1");
  assert.ok(args.includes("-NoExit"));
  assert.ok(args.includes("-File"));
});

test("buildWindowsTerminalCommandLine passes single command line with -NoExit", () => {
  const line = buildWindowsTerminalCommandLine(
    "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\open.ps1",
    "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\workspace",
  );
  assert.match(line, /-NoExit/);
  assert.match(line, /EVERYTHİNG/);
  assert.match(line, /--title "Sauron Goose"/);
  assert.match(line, /-File "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\open\.ps1"/);
});

test("writeVisibleTerminalBootstrap writes keep-open wrapper script", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "goose-bootstrap-"));
  const launchScript = path.join(workspace, "launch.ps1");
  fs.writeFileSync(launchScript, "Write-Host test", "utf8");
  const bootstrapPath = writeVisibleTerminalBootstrap({
    sessionId: "bootstrap-test",
    scriptPath: launchScript,
    workspacePath: workspace,
  });
  const raw = fs.readFileSync(bootstrapPath);
  const content = raw.toString("utf8");
  assert.equal(raw[0], 0xef);
  assert.match(content, /-NoExit/);
  assert.match(content, /ReadLine/);
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.unlinkSync(bootstrapPath);
});

test("buildStartProcessCommand uses visible window style", () => {
  const entryScript = "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\open.ps1";
  const cmd = buildStartProcessCommand(
    entryScript,
    "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\workspace",
    null,
  );
  assert.match(cmd, /WindowStyle Normal/);
  assert.match(cmd, /-NoExit/);
  assert.match(cmd, /EVERYTHİNG/);
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
