const test = require("node:test");
const assert = require("node:assert/strict");
const { suggestCodeExecutionPath } = require("../../src/routing/message-route");

test("suggestCodeExecutionPath returns none without coding intent", () => {
  const result = suggestCodeExecutionPath({
    workspacePath: "/tmp/x",
    codeIntent: { shouldSuggest: false },
  });
  assert.equal(result.path, "none");
});

test("suggestCodeExecutionPath prefers native agent when enabled", () => {
  const result = suggestCodeExecutionPath({
    codeAgentNativeEnabled: true,
    workspacePath: "/tmp/x",
    codeIntent: { shouldSuggest: true },
    prerequisites: { codeAgentReady: true },
  });
  assert.equal(result.path, "native_agent");
});

test("suggestCodeExecutionPath falls back to cline handoff", () => {
  const result = suggestCodeExecutionPath({
    codeAgentNativeEnabled: false,
    workspacePath: "/tmp/x",
    codeIntent: { shouldSuggest: true },
    prerequisites: { handoffReady: true },
  });
  assert.equal(result.path, "cline_handoff");
});
