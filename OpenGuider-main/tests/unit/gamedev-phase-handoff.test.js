const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { writeGamedevPhaseHandoff } = require("../../src/sauron/gamedev-phase-handoff");

const baseSettings = {
  workspacePath: "",
  tokenUltraEnabled: true,
  tokenUltraGamedevMaxChars: 1200,
  tokenUltraUseRepoMap: false,
  tokenUltraUseSceneCache: false,
  tokenUltraSandboxToolOutput: false,
  gamedevActiveEngine: "unity",
  gamedevPipelineAutoChain: false,
  finopsTrackingOnly: true,
};

test("writeGamedevPhaseHandoff applies Token Ultra to payload", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gd-phase-ultra-"));
  const settings = { ...baseSettings, workspacePath: workspace };
  try {
    const pipelineState = {
      id: "pipeline-test-1",
      templateId: "unity-starter",
      label: "Test pipeline",
      totalPhases: 2,
      projectType: "game-unity",
      genre: "empty",
      masterPrompt: "Build a simple game",
    };
    const phaseDef = {
      phase: 1,
      goal: `Create player controller with movement ${"and polish ".repeat(80)}`,
      complexityHint: "low",
      verification: "Player moves",
    };

    const result = await writeGamedevPhaseHandoff({
      workspacePath: workspace,
      settings,
      pipelineState,
      phaseDef,
      scaffoldOnPhaseOne: false,
    });

    assert.equal(result.ok, true);
    const handoffPath = path.join(workspace, ".sauron", result.handoffFileName || `handoff-${result.handoffId}.json`);
    assert.ok(fs.existsSync(handoffPath));
    const handoff = JSON.parse(fs.readFileSync(handoffPath, "utf8"));
    assert.ok(handoff.tokenUltra);
    assert.equal(handoff.version, 3);
    assert.ok(handoff.taskSummary.length <= 1200);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
