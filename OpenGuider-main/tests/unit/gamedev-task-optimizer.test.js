const test = require("node:test");
const assert = require("node:assert/strict");

const {
  optimizeGamedevTaskText,
  buildGamedevHandoffSummary,
} = require("../../src/sauron/gamedev-task-optimizer");

test("optimizeGamedevTaskText truncates long tasks", () => {
  const long = "word ".repeat(200).trim();
  const result = optimizeGamedevTaskText(long, { maxChars: 50 });
  assert.ok(result.text.length <= 50);
  assert.equal(result.truncated, true);
});

test("buildGamedevHandoffSummary preserves full mcp tool policy", () => {
  const result = buildGamedevHandoffSummary({
    taskText: "Create a red cube with physics",
    engine: "unity",
    workspacePath: "C:/Projects/MyGame",
    settings: { finopsHandoffMaxChars: 4000 },
    mcpEntryPath: "C:/ext/dist/index.js",
  });

  assert.match(result.summary, /gamedev-all-in-one MCP/);
  assert.match(result.summary, /Engine: unity/);
  assert.equal(result.tokenPolicy.mcpTools, "full");
  assert.equal(result.tokenPolicy.includeTranscript, false);
});
