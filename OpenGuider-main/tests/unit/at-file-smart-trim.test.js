const test = require("node:test");
const assert = require("node:assert/strict");

const { smartTrimFileContent } = require("../../src/panel/at-file-context");

test("smartTrimFileContent preserves head and tail", () => {
  const lines = Array.from({ length: 300 }, (_, i) => `line-${i + 1}`);
  const content = lines.join("\n");
  const result = smartTrimFileContent(content, true);
  assert.equal(result.smartTrimmed, true);
  assert.ok(result.content.includes("line-1"));
  assert.ok(result.content.includes("line-300"));
  assert.ok(result.content.includes("satır özetlendi"));
});

test("smartTrimFileContent disabled keeps slice behavior", () => {
  const content = "short file";
  const result = smartTrimFileContent(content, false);
  assert.equal(result.content, content);
  assert.notEqual(result.smartTrimmed, true);
});
