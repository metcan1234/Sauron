const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  recordTask,
  readMemory,
  buildMemorySummaryBlock,
  getMemoryPath,
} = require("../../src/sauron/project-memory");

test("recordTask writes project-memory.json when enabled", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "proj-mem-"));
  try {
    const result = recordTask(workspace, {
      summary: "Kurumsal site scaffold",
      projectLabel: "Test A.Ş.",
      themeId: "kurumsal",
      handoffId: "abc123",
    }, { projectMemoryEnabled: true });
    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(getMemoryPath(workspace)), true);
    const memory = readMemory(workspace);
    assert.equal(memory.activeProjectLabel, "Test A.Ş.");
    assert.equal(memory.themeId, "kurumsal");
    assert.equal(memory.tasks.length, 1);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("recordTask skips when projectMemoryEnabled is false", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "proj-mem-off-"));
  try {
    const result = recordTask(workspace, { summary: "skip me" }, { projectMemoryEnabled: false });
    assert.equal(result.skipped, true);
    assert.equal(fs.existsSync(getMemoryPath(workspace)), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildMemorySummaryBlock returns Turkish disk summary", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "proj-mem-block-"));
  try {
    recordTask(workspace, { summary: "İlk görev", projectLabel: "Demo Ltd" }, { projectMemoryEnabled: true });
    const block = buildMemorySummaryBlock(workspace, { projectMemoryEnabled: true });
    assert.match(block, /Proje hafızası/);
    assert.match(block, /Demo Ltd/);
    assert.match(block, /İlk görev/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
