const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { detectProjectEngine, probeHttpEndpoint } = require("../../src/sauron/gamedev-engine-discovery");
const { mergeMcpConfig, buildNativeEngineMcpServers } = require("../../src/sauron/gamedev-mcp-config");
const { ensureEngineCompat, readEngineCompat } = require("../../src/sauron/gamedev-engine-compat");
const { GAMEDEV_MCP_SERVER_ID } = require("../../src/sauron/gamedev-config");

test("detectProjectEngine finds unity and unreal markers", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-gd-"));
  fs.mkdirSync(path.join(tmp, "Assets"));
  fs.mkdirSync(path.join(tmp, "ProjectSettings"));
  fs.writeFileSync(path.join(tmp, "ProjectSettings", "ProjectVersion.txt"), "6000.0.0");

  assert.equal(detectProjectEngine(tmp).engine, "unity");

  const ue = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ue-"));
  fs.writeFileSync(path.join(ue, "Game.uproject"), "{}");
  assert.equal(detectProjectEngine(ue).engine, "unreal");
});

test("mergeMcpConfig preserves existing servers", () => {
  const existing = {
    mcpServers: { other: { command: "node", args: ["x.js"] } },
    servers: { unityMCP: { url: "http://127.0.0.1:8080/mcp", type: "http" } },
  };
  const merged = mergeMcpConfig(existing, {
    [GAMEDEV_MCP_SERVER_ID]: { command: "node", args: ["gamedev.js"] },
    unityMCP: { url: "http://127.0.0.1:8080/mcp", type: "http" },
  });
  assert.ok(merged.mcpServers.other);
  assert.ok(merged.mcpServers[GAMEDEV_MCP_SERVER_ID]);
  assert.ok(merged.servers.unityMCP);
});

test("buildNativeEngineMcpServers includes funplay-unreal", () => {
  const servers = buildNativeEngineMcpServers("unreal", "/tmp/project");
  assert.ok(servers["funplay-unreal"]);
  assert.equal(servers["funplay-unreal"].command, "npx");
});

test("ensureEngineCompat writes manifest", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-compat-"));
  const result = ensureEngineCompat(tmp);
  assert.equal(result.ok, true);
  const manifest = readEngineCompat(tmp);
  assert.ok(manifest.engines.unity);
  assert.ok(manifest.engines.unreal);
});

test("probeHttpEndpoint rejects invalid url", async () => {
  const result = await probeHttpEndpoint("");
  assert.equal(result.ok, false);
});
