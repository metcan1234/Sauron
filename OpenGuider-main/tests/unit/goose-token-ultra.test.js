const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { applyTokenUltraToGooseTask } = require("../../src/sauron/token-ultra/goose-token-ultra");
const { readTokenUltraCache } = require("../../src/sauron/token-ultra/delta-store");

test("applyTokenUltraToGooseTask compresses long task text", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "goose-ultra-"));
  try {
    const longTask = `Fix authentication bug in login flow. ${"detail ".repeat(400)}`;
    const result = applyTokenUltraToGooseTask(longTask, {
      tokenUltraEnabled: true,
      tokenUltraGooseMaxChars: 500,
    }, {
      workspacePath: workspace,
      goal: "Fix authentication bug",
    });

    assert.ok(result.text.length <= 500);
    assert.ok(result.tokenUltra);
    assert.equal(result.tokenUltra.channel, "goose");
    assert.ok(typeof result.tokenUltra.savedChars === "number");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("applyTokenUltraToGooseTask records channel savings", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "goose-ultra-save-"));
  try {
    const task = `Implement feature with many words ${"token ".repeat(200)}`;
    applyTokenUltraToGooseTask(task, {
      tokenUltraEnabled: true,
      tokenUltraGooseMaxChars: 400,
    }, {
      workspacePath: workspace,
      goal: "Implement feature",
    });

    const cache = readTokenUltraCache(workspace);
    assert.ok(cache?.savings?.byChannel?.goose);
    assert.ok(Number(cache.savings.byChannel.goose.estimatedCharsSaved) >= 0);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("applyTokenUltraToGooseTask skips when disabled", () => {
  const text = "Short goose task";
  const result = applyTokenUltraToGooseTask(text, { tokenUltraEnabled: false }, {});
  assert.equal(result.text, text);
  assert.equal(result.tokenUltra, null);
});
