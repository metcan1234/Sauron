#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const { discoverGooseBinary } = require("../src/sauron/goose-binary-resolver");
const { probeGamedevMcpEntry } = require("../src/sauron/gamedev-path-resolver");
const { inferChannel, summarizeByChannel } = require("../src/sauron/finops/tiktoken-estimator");
const { trackCall, readUsageEntries, flushWriteQueueForTests, resetWriteQueueForTests } = require("../src/sauron/finops/usage-tracker");
const { getGamePipeline } = require("../src/sauron/game-pipeline/game-pipeline-registry");
const { probeGamedevBridgePorts } = require("../src/sauron/gamedev-bridge-probe");

const projectRoot = path.resolve(__dirname, "..");
let failures = 0;

function pass(label) {
  console.log(`[PASS] ${label}`);
}

function fail(label, detail) {
  console.error(`[FAIL] ${label}`);
  if (detail) {
    console.error(`       ${detail}`);
  }
  failures += 1;
}

const bridgeVsix = path.resolve(projectRoot, "..", "sauron-vscode-bridge", "dist", "sauron-vscode-bridge.vsix");
if (fs.existsSync(bridgeVsix)) {
  pass(`Bridge VSIX (${bridgeVsix})`);
} else {
  fail("Bridge VSIX", bridgeVsix);
}

const gamedevEntry = path.resolve(projectRoot, "extensions", "gamedev-all-in-one", "dist", "index.js");
const gamedevProbe = probeGamedevMcpEntry({});
if (gamedevProbe.ok || fs.existsSync(gamedevEntry)) {
  pass(`GameDev MCP (${gamedevProbe.entryPath || gamedevEntry})`);
} else {
  fail("GameDev MCP", gamedevProbe.error || "dist/index.js missing");
}

const goosePath = discoverGooseBinary({});
if (goosePath && fs.existsSync(goosePath)) {
  pass(`Goose CLI (${goosePath})`);
} else {
  fail("Goose CLI", "goose.exe not found under SAURON/goose or OpenGuider-main/goose");
}

async function verifyLedgerChannels() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-verify-"));
  const settings = { workspacePath: tmp };
  resetWriteQueueForTests();
  trackCall({
    provider: "gemini",
    model: "gemini-2.5-flash",
    promptTokens: 10,
    completionTokens: 5,
    costTl: 0.01,
    operation: "chat",
    channel: "core",
  }, settings);
  trackCall({
    provider: "cline",
    model: "deepseek-chat",
    promptTokens: 20,
    completionTokens: 8,
    costTl: 0.02,
    operation: "cline-task",
    channel: "workspace",
  }, settings);
  await new Promise((resolve) => setImmediate(resolve));
  await flushWriteQueueForTests();
  const entries = await readUsageEntries(path.join(tmp, ".sauron", "usage", "logs.jsonl"));
  if (entries.length < 2) {
    fail("Unified ledger channel tags", "expected 2 entries");
    return;
  }
  const channels = summarizeByChannel(entries);
  if ((channels.core?.entryCount || 0) < 1 || (channels.workspace?.entryCount || 0) < 1) {
    fail("Unified ledger channel tags", JSON.stringify(channels));
    return;
  }
  pass("Unified ledger channel tags (core + workspace)");
}

function verifyPipelineArchetypes() {
  const ids = [
    "unity-physics-extraction-v1",
    "unity-arena-pvp-v1",
    "unreal-horror-coop-v1",
    "unreal-co-op-climb-v1",
  ];
  for (const id of ids) {
    const pipeline = getGamePipeline(id);
    if (!pipeline || !pipeline.phases?.length) {
      fail(`Pipeline archetype ${id}`, "missing");
      continue;
    }
    const last = pipeline.phases[pipeline.phases.length - 1];
    if (!String(last.goal || "").includes("Steam-ready")) {
      fail(`Pipeline steam phase ${id}`, last.goal || "no steam phase");
      continue;
    }
    pass(`Pipeline archetype ${id} (${pipeline.phases.length} phases)`);
  }
}

async function verifyTcpProbe() {
  const probe = await probeGamedevBridgePorts();
  pass(`GameDev TCP probe executed (${probe.summary})`);
}

(async () => {
  await verifyLedgerChannels();
  verifyPipelineArchetypes();
  await verifyTcpProbe();

  if (failures > 0) {
    console.error(`\nverify-channels: ${failures} failure(s)`);
    process.exit(1);
  }

  console.log("\nWorkspace + GameDev + Goose + unified ledger channels OK (v2.4)");
})().catch((error) => {
  fail("verify-channels runtime", error?.message || String(error));
  process.exit(1);
});
