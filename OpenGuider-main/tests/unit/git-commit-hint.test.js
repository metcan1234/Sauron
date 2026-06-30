const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildSuggestionFromChanges, isGitRepo } = require("../../src/sauron/git-commit-hint");

test("buildSuggestionFromChanges builds scoped commit headline", () => {
  const suggestion = buildSuggestionFromChanges(
    ["M src/sauron/mission-control-status.js", "M tests/unit/mission-control-status.test.js"],
    "2 files changed, 40 insertions(+)",
  );
  assert.match(suggestion.headline, /test/);
  assert.equal(suggestion.changedCount, 2);
});

test("isGitRepo detects git directory", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "git-hint-"));
  try {
    assert.equal(isGitRepo(workspace), false);
    fs.mkdirSync(path.join(workspace, ".git"));
    assert.equal(isGitRepo(workspace), true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
