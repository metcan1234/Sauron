const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  bootstrapWorkspace,
  writeExtensionsRecommendations,
} = require("../../src/sauron/workspace-bootstrap");

test("bootstrapWorkspace writes finops config, rules, and extension recommendations", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-bootstrap-"));
  try {
    const result = await bootstrapWorkspace(workspace, {
      workspacePath: workspace,
      finopsUsdToTl: 35,
      finopsCostOptimizerEnabled: true,
    });

    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(path.join(workspace, ".sauron", "finops-config.json")), true);
    assert.equal(fs.existsSync(path.join(workspace, ".clinerules", "sauron-workspace.md")), true);
    assert.equal(fs.existsSync(path.join(workspace, ".clinerules", "sauron-web-dev.md")), true);
    assert.equal(result.webDevRulesSeeded, true);
    assert.equal(fs.existsSync(path.join(workspace, ".vscode", "extensions.json")), true);

    const extensions = JSON.parse(
      fs.readFileSync(path.join(workspace, ".vscode", "extensions.json"), "utf8"),
    );
    assert.ok(extensions.recommendations.includes("saoudrizwan.claude-dev"));
    assert.ok(extensions.recommendations.includes("sauron-local.sauron-vscode-bridge"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("writeExtensionsRecommendations merges existing recommendations", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ext-"));
  try {
    const vscodeDir = path.join(workspace, ".vscode");
    fs.mkdirSync(vscodeDir, { recursive: true });
    fs.writeFileSync(
      path.join(vscodeDir, "extensions.json"),
      JSON.stringify({ recommendations: ["dbaeumer.vscode-eslint"] }),
      "utf8",
    );

    writeExtensionsRecommendations(workspace);
    const merged = JSON.parse(fs.readFileSync(path.join(vscodeDir, "extensions.json"), "utf8"));
    assert.ok(merged.recommendations.includes("dbaeumer.vscode-eslint"));
    assert.ok(merged.recommendations.includes("sauron-local.sauron-vscode-bridge"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
