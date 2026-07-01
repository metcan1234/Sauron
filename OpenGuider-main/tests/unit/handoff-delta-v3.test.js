const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  shouldUseDeltaHandoff,
  resolveWorkspaceHint,
  updateHandoffContextCache,
  tokenOverlapRatio,
} = require("../../src/sauron/handoff-context-cache");
const { resolveDeltaOverlapMin } = require("../../src/sauron/token-ultra/token-ultra-v3-config");

const baseSettings = {
  tokenUltraEnabled: true,
  tokenUltraUseDeltaHandoff: true,
  finopsCostOptimizerEnabled: true,
  finopsDeltaHandoffEnabled: true,
};

test("resolveDeltaOverlapMin defaults to 0.5", () => {
  assert.equal(resolveDeltaOverlapMin({}), 0.5);
  assert.equal(resolveDeltaOverlapMin({ tokenUltraDeltaOverlapMin: 0.65 }), 0.65);
});

test("shouldUseDeltaHandoff uses configurable overlap threshold", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "delta-v3-"));
  try {
    updateHandoffContextCache(workspace, {
      goal: "fix login button",
      treeHint: "Workspace snapshot:\nsrc/",
    });
    const goal = "fix login issue";
    assert.ok(tokenOverlapRatio(goal, "fix login button") >= 0.5);
    assert.equal(shouldUseDeltaHandoff(baseSettings, workspace, goal), true);
    assert.equal(
      shouldUseDeltaHandoff({ ...baseSettings, tokenUltraDeltaOverlapMin: 0.9 }, workspace, goal),
      false,
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("resolveWorkspaceHint quality gate falls back to full tree", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "delta-v3-fallback-"));
  try {
    updateHandoffContextCache(workspace, {
      goal: "fix login button",
      treeHint: "Workspace snapshot:\nsrc/main.js",
    });
    const result = resolveWorkspaceHint(workspace, {
      ...baseSettings,
      tokenUltraUseChangedFilesOnly: false,
    }, "fix login button bug");
    assert.equal(result.deltaMode, true);
    assert.ok(String(result.hint).includes("Workspace"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
