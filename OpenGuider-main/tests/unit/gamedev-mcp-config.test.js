const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { writeGamedevMcpConfig, mergeMcpConfig } = require("../../src/sauron/gamedev-mcp-config");

test("mergeMcpConfig adds gamedev-all-in-one without removing other servers", () => {
  const merged = mergeMcpConfig(
    { mcpServers: { other: { command: "echo" } } },
    { "gamedev-all-in-one": { command: "node", args: ["/tmp/index.js"] } },
  );
  assert.ok(merged.mcpServers.other);
  assert.ok(merged.mcpServers["gamedev-all-in-one"]);
});

test("writeGamedevMcpConfig writes cursor and vscode mcp json", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-gamedev-"));
  const fakeEntry = path.join(tmp, "index.js");
  fs.writeFileSync(fakeEntry, "// stub", "utf8");

  const result = writeGamedevMcpConfig(tmp, { gamedevMcpEntryPath: fakeEntry }, "unity");
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(tmp, ".cursor", "mcp.json")), true);
  assert.equal(fs.existsSync(path.join(tmp, ".vscode", "mcp.json")), true);
  assert.equal(fs.existsSync(path.join(tmp, ".cline", "mcp.json")), true);

  const cursor = JSON.parse(fs.readFileSync(path.join(tmp, ".cursor", "mcp.json"), "utf8"));
  assert.equal(cursor.mcpServers["gamedev-all-in-one"].command, "node");
  assert.equal(cursor.mcpServers["gamedev-all-in-one"].env.UNITY_PROJECT_PATH, tmp);
});
