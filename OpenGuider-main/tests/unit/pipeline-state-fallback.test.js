const test = require("node:test");
const assert = require("node:assert/strict");
const { runVerification } = require("../../src/sauron/build-pipeline/pipeline-state");

test("runVerification uses fallbackCommand when primary fails", async () => {
  const workspace = process.cwd();
  const result = await runVerification(workspace, {
    command: "sauron-nonexistent-verify-command-xyz",
    fallbackCommand: "node -e \"process.exit(0)\"",
  });
  assert.equal(result.ok, true);
  assert.equal(result.usedFallback, true);
});
