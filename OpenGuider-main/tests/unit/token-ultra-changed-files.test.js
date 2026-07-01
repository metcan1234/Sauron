const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const { resolveWorkspaceHint } = require("../../src/sauron/handoff-context-cache");

function initGitRepo(dir) {
  execSync("git init", { cwd: dir, stdio: "ignore" });
  execSync("git config user.email test@example.com", { cwd: dir, stdio: "ignore" });
  execSync("git config user.name Test", { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "readme.txt"), "hello\n");
  execSync("git add .", { cwd: dir, stdio: "ignore" });
  execSync('git commit -m "init"', { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "readme.txt"), "hello world\n");
}

test("changed-files handoff prefers file list over full tree", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "changed-files-"));
  try {
    initGitRepo(workspace);
    const result = resolveWorkspaceHint(workspace, {
      tokenUltraEnabled: true,
      tokenUltraUseChangedFilesOnly: true,
      finopsCostOptimizerMode: "balanced",
    }, "new task");
    assert.equal(result.changedFilesOnly, true);
    assert.ok(String(result.hint).includes("Changed files:"));
    assert.ok(String(result.hint).includes("repo-map.json"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
