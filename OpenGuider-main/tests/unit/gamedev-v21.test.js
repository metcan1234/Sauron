const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  startGamePipeline,
  advanceGamePipelineAfterComplete,
  getCurrentPhaseGoal,
} = require("../../src/sauron/game-pipeline/game-pipeline-runner");
const { writeGamedevPhaseHandoff } = require("../../src/sauron/gamedev-phase-handoff");
const { resolveWireRecipePointer, loadWireRecipe } = require("../../src/sauron/unity-wire-recipes");
const { probeUnityBridge } = require("../../src/sauron/gamedev-mcp-proxy");
const { scaffoldUnityTemplate } = require("../../src/sauron/scaffold-unity-template");

test("advanceGamePipelineAfterComplete writes next phase handoff", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-game-adv-handoff-"));
  const started = await startGamePipeline({
    pipelineId: "unity-empty-v1",
    workspacePath: tmp,
  });
  assert.equal(started.ok, true);

  const artifactPath = path.join(tmp, ".sauron", "cline-task-complete.json");
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify({
    pipelineId: started.pipeline.id,
    handoffId: "h-test-1",
  }), "utf8");

  const advanced = await advanceGamePipelineAfterComplete(tmp, {
    gamedevPipelineAutoChain: true,
    gamedevEnabled: true,
  }, { launchVSCode: false });

  assert.equal(advanced.ok, true);
  assert.equal(advanced.action, "next-phase");
  assert.ok(advanced.handoffFileName);
  assert.ok(fs.existsSync(path.join(tmp, ".sauron", advanced.handoffFileName)));

  const phase = getCurrentPhaseGoal(tmp);
  assert.equal(phase.phase, 2);
});

test("writeGamedevPhaseHandoff keeps mcpTools full and bounded summary", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-phase-handoff-"));
  const started = await startGamePipeline({
    pipelineId: "unity-co-op-climb-v1",
    workspacePath: tmp,
  });
  const phase = getCurrentPhaseGoal(tmp);
  const written = await writeGamedevPhaseHandoff({
    workspacePath: tmp,
    settings: { gamedevEnabled: true },
    pipelineState: started.pipeline,
    phaseDef: { phase: phase.phase, goal: phase.goal, complexityHint: "low" },
    scaffoldOnPhaseOne: true,
  });
  assert.equal(written.ok, true);
  const handoff = JSON.parse(fs.readFileSync(written.handoffPath, "utf8"));
  assert.equal(handoff.gamedev.mcpTools, "full");
  assert.equal(handoff.briefPointer, ".sauron/game-design-brief.json");
  assert.equal(handoff.complexityHint, "low");
  assert.ok(handoff.taskSummary.length <= 4000);
});

test("resolveWireRecipePointer returns genre phase recipe id", () => {
  assert.equal(resolveWireRecipePointer("co-op-climb", 2), "co-op-climb-phase2");
  const recipe = loadWireRecipe("co-op-climb-phase2");
  assert.ok(Array.isArray(recipe.steps));
  assert.ok(recipe.steps.includes("unity_load_scene"));
});

test("scaffoldUnityTemplate copies scene and shared assets", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-scaffold-scene-"));
  const result = scaffoldUnityTemplate(tmp, "co-op-climb");
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(tmp, "Assets", "SauronGameDev", "co-op-climb", "Scenes", "Main.unity")));
  assert.ok(fs.existsSync(path.join(tmp, "Assets", "SauronGameDev", "_shared", "Editor", "SauronTemplateBootstrap.cs")));
});

test("listWireRecipeFiles covers genre pipelines", () => {
  const { listWireRecipeFiles } = require("../../src/sauron/unity-wire-recipes");
  const files = listWireRecipeFiles();
  assert.ok(files.length >= 21);
});

test("probeUnityBridge returns structured result when offline", async () => {
  const probe = await probeUnityBridge({ port: 47890, timeoutMs: 300 });
  assert.equal(typeof probe.connected, "boolean");
});
