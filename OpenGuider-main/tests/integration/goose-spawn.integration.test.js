const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { resolveBinaryPathOnDisk, probeGooseBinary } = require("../../src/sauron/goose-binary-resolver");
const { spawnGooseProcess, buildGooseCliArgs } = require("../../src/sauron/goose-terminal-spawn");

test("spawnGooseProcess opens held-open terminal with real goose binary", async (t) => {
  if (process.platform !== "win32" || process.env.SAURON_SKIP_GOOSE_SPAWN_TEST === "1") {
    t.skip("Windows integration spawn test only");
    return;
  }

  const settings = {
    gooseBinaryPath: "C:\\Users\\Can\\OneDrive\\Desktop\\EVERYTHİNG\\goose-package\\goose.exe",
    ollamaUrl: "http://127.0.0.1:11434",
    ollamaModelCustom: "qwen2.5-coder:7b",
  };

  const probe = await probeGooseBinary(settings);
  if (!probe.cliCapable || !probe.binaryPath) {
    t.skip(`Goose CLI unavailable: ${probe.error || "missing"}`);
    return;
  }

  const binaryPath = resolveBinaryPathOnDisk(probe.binaryPath);
  const workspacePath = path.resolve(__dirname, "../..");
  const instructionsPath = path.join(workspacePath, ".goose", "instructions.md");
  fs.mkdirSync(path.dirname(instructionsPath), { recursive: true });
  if (!fs.existsSync(instructionsPath)) {
    fs.writeFileSync(instructionsPath, "# test instructions\n", "utf8");
  }

  const args = buildGooseCliArgs({
    taskText: "echo spawn integration test",
    providerConfig: { provider: "ollama", model: "qwen2.5-coder:7b" },
    systemInstructions: "# integration test rules",
  });

  const result = await spawnGooseProcess({
    binaryPath,
    workspacePath,
    args,
    sessionId: "integration-test",
    env: {
      ...process.env,
      GOOSE_TELEMETRY_OFF: "1",
    },
  });

  assert.ok(result.pid);
  assert.ok(["windows-terminal", "cmd", "direct", "powershell"].includes(result.terminal));
  const argvJoined = result.argv.join(" ");
  if (result.launchMethod === "powershell-launcher") {
    assert.match(argvJoined, /powershell\.exe/i);
    assert.match(argvJoined, /launch\.ps1/i);
  } else {
    assert.match(argvJoined, /cmd\.exe/);
    assert.match(argvJoined, /\/k/);
  }
});
