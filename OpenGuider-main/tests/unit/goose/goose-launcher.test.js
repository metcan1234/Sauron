const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const {
  buildGooseEnv,
  buildGooseCliArgs,
} = require("../../../src/sauron/goose-launcher");
const {
  buildGooseCliArgs: buildSpawnCliArgs,
  findWindowsTerminalPathSync,
} = require("../../../src/sauron/goose-terminal-spawn");

test("buildGooseCliArgs builds goose run argv without powershell", () => {
  const instructionsPath = "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\proj\\.goose\\instructions.md";
  const args = buildGooseCliArgs({
    taskText: "list files in src",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
    instructionsPath,
  });

  assert.deepEqual(args.slice(0, 4), ["run", "--no-session", "-s", "--provider"]);
  assert.equal(args[4], "ollama");
  assert.equal(args[6], "qwen2.5-coder:7b");
  assert.equal(args[7], "-i");
  assert.equal(args[8], instructionsPath);
  assert.match(args[8], /EVERYTHİNG/);
  assert.equal(args[9], "-t");
  assert.equal(args[10], "list files in src");
});

test("buildGooseCliArgs preserves Turkish paths in argv slots", () => {
  const turkishBinaryFolder = "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\goose-package";
  const args = buildSpawnCliArgs({
    taskText: "hello",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
    instructionsPath: path.join(turkishBinaryFolder, ".goose", "instructions.md"),
  });
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

test("findWindowsTerminalPathSync returns string or null on windows", () => {
  const wtPath = findWindowsTerminalPathSync();
  if (process.platform === "win32" && wtPath) {
    assert.match(wtPath, /wt\.exe$/i);
  } else {
    assert.equal(wtPath, null);
  }
});
