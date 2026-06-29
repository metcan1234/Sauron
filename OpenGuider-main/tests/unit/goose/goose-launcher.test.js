const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const {
  buildGooseEnv,
  buildGooseCliArgs,
} = require("../../../src/sauron/goose-launcher");
const {
  buildGooseCliArgs: buildSpawnCliArgs,
  buildHeldOpenCommandArgs,
  findWindowsTerminalPathSync,
  splitGooseSystemArg,
  shouldUseWindowsPowerShellLauncher,
  writeGooseWindowsLauncher,
} = require("../../../src/sauron/goose-terminal-spawn");
const fs = require("fs");

test("buildGooseCliArgs uses -t for task and --system for instructions", () => {
  const args = buildGooseCliArgs({
    taskText: "list files in src",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
    systemInstructions: "# Sauron rules\nBe concise.",
  });

  assert.deepEqual(args.slice(0, 4), ["run", "--no-session", "-s", "--provider"]);
  assert.equal(args[4], "ollama");
  assert.equal(args[6], "qwen2.5-coder:7b");
  assert.equal(args[7], "-t");
  assert.equal(args[8], "list files in src");
  assert.equal(args[9], "--system");
  assert.match(args[10], /Sauron rules/);
  assert.ok(!args.includes("-i"));
});

test("buildGooseCliArgs omits --system when instructions empty", () => {
  const args = buildGooseCliArgs({
    taskText: "hello",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
    systemInstructions: "",
  });
  assert.equal(args[7], "-t");
  assert.equal(args[8], "hello");
  assert.ok(!args.includes("--system"));
  assert.ok(!args.includes("-i"));
});

test("buildHeldOpenCommandArgs wraps goose in cmd /k", () => {
  const binaryPath = "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\goose-package\\goose.exe";
  const gooseArgs = ["run", "--no-session", "-s"];
  const heldOpen = buildHeldOpenCommandArgs(binaryPath, gooseArgs);
  assert.deepEqual(heldOpen.slice(0, 3), ["cmd.exe", "/k", binaryPath]);
  assert.deepEqual(heldOpen.slice(3), gooseArgs);
});

test("buildGooseCliArgs preserves Turkish task text in -t argv slot", () => {
  const args = buildSpawnCliArgs({
    taskText: "EVERYTHİNG klasöründeki dosyaları listele",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
    systemInstructions: "",
  });
  assert.equal(args[7], "-t");
  assert.match(args[8], /EVERYTHİNG/);
  assert.doesNotMatch(args.join("|"), /EVERYTHÄ°NG/);
});

test("buildGooseEnv disables telemetry and marks goose terminal context", () => {
  const env = buildGooseEnv({}, { provider: "ollama", model: "qwen2.5-coder:7b" });
  assert.equal(env.GOOSE_TELEMETRY_OFF, "1");
  assert.equal(env.GOOSE_TERMINAL, "1");
  assert.equal(env.GOOSE_PROVIDER, "ollama");
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

test("findWindowsTerminalPathSync resolves wt via where.exe on windows", () => {
  const wtPath = findWindowsTerminalPathSync();
  if (process.platform === "win32") {
    assert.ok(wtPath);
    assert.match(wtPath, /wt\.exe$/i);
  } else {
    assert.equal(wtPath, null);
  }
});

test("splitGooseSystemArg extracts multiline --system payload", () => {
  const args = ["run", "-t", "hello", "--system", "## Balanced\n- kural"];
  const { cliArgs, systemInstructions } = splitGooseSystemArg(args);
  assert.deepEqual(cliArgs, ["run", "-t", "hello"]);
  assert.match(systemInstructions, /Balanced/);
});

test("shouldUseWindowsPowerShellLauncher enables for multiline system text on win32", () => {
  const args = buildSpawnCliArgs({
    taskText: "hello",
    providerConfig: { provider: "ollama", model: "x" },
    systemInstructions: "## Mod\n- satir",
  });
  if (process.platform === "win32") {
    assert.equal(shouldUseWindowsPowerShellLauncher(args), true);
  } else {
    assert.equal(shouldUseWindowsPowerShellLauncher(args), false);
  }
});

test("writeGooseWindowsLauncher writes system file and ps1 without inline --system", () => {
  const args = buildSpawnCliArgs({
    taskText: "list files",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
    systemInstructions: "## Balanced Modu\n- gereksiz tekrar yapma.\n## Workspace\n- Proje kökü: SauronWorkspace",
  });
  const launcher = writeGooseWindowsLauncher({
    binaryPath: "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\goose-package\\goose.exe",
    workspacePath: "C:\\SauronWorkspace",
    gooseArgs: args,
    sessionId: "test-session",
  });
  assert.ok(fs.existsSync(launcher.ps1Path));
  assert.ok(fs.existsSync(launcher.systemFile));
  assert.ok(fs.existsSync(launcher.launchConfigPath));
  const ps1 = fs.readFileSync(launcher.ps1Path, "utf8");
  const config = JSON.parse(fs.readFileSync(launcher.launchConfigPath, "utf8"));
  assert.match(ps1, /launch\.json/);
  assert.match(ps1, /ConvertFrom-Json/);
  assert.doesNotMatch(ps1, /EVERYTH/);
  assert.match(config.binaryPath, /goose\.exe$/i);
  assert.ok(Array.isArray(config.cliArgs));
  fs.rmSync(launcher.launchDir, { recursive: true, force: true });
});
