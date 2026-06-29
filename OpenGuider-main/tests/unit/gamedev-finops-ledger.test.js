const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  appendGamedevLedgerEvent,
  summarizeGamedevLedger,
} = require("../../src/sauron/gamedev-finops-ledger");

test("finops ledger appends and summarizes sessions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ledger-"));
  appendGamedevLedgerEvent(tmp, { type: "session-start", engine: "unity" });
  appendGamedevLedgerEvent(tmp, { type: "mcp-tool", count: 3 });
  const summary = summarizeGamedevLedger(tmp);
  assert.equal(summary.sessions, 1);
  assert.equal(summary.mcpToolCalls, 3);
});
