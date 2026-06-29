const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildWorkspaceTreeHint } = require("../../src/sauron/workspace-tree-snapshot");

test("buildWorkspaceTreeHint lists shallow tree and skips heavy dirs", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-tree-"));
  try {
    fs.mkdirSync(path.join(workspace, "src", "agent"), { recursive: true });
    fs.mkdirSync(path.join(workspace, "node_modules", "ignored"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({
      name: "demo-app",
      scripts: { start: "node main.js", test: "node --test" },
      dependencies: { lodash: "1.0.0" },
    }), "utf8");

    const hint = buildWorkspaceTreeHint(workspace);
    assert.match(hint, /Workspace snapshot:/);
    assert.match(hint, /package: demo-app/);
    assert.match(hint, /src\//);
    assert.match(hint, /agent\//);
    assert.doesNotMatch(hint, /node_modules\/ignored/);
    assert.ok(hint.length <= 700);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildWorkspaceTreeHint returns empty string for missing workspace", () => {
  assert.equal(buildWorkspaceTreeHint(""), "");
  assert.equal(buildWorkspaceTreeHint("/missing/path"), "");
});
