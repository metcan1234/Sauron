const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildGamedevHandoffSummary } = require("../../src/sauron/gamedev-task-optimizer");
const { BRIEF_POINTER, buildBriefHandoffHint } = require("../../src/sauron/gamedev-prompt-compiler");

test("handoff summary includes brief pointer not full master prompt", () => {
  const masterPrompt = "x".repeat(5000);
  const briefHint = buildBriefHandoffHint(masterPrompt);
  const meta = buildGamedevHandoffSummary({
    taskText: "phase goal text",
    engine: "unity",
    workspacePath: "/tmp/game",
    settings: {},
    mcpEntryPath: "/tmp/mcp.js",
    notices: [briefHint],
  });
  assert.ok(meta.summary.includes(BRIEF_POINTER));
  assert.ok(!meta.summary.includes(masterPrompt));
  assert.ok(meta.summary.length < 4000);
});

test("brief handoff hint truncates summary", () => {
  const hint = buildBriefHandoffHint("word ".repeat(40));
  assert.ok(hint.includes(BRIEF_POINTER));
  assert.ok(hint.length <= 180);
});
