const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  seedClinerulesPacks,
  getPacksForProjectType,
  normalizeProjectType,
} = require("../../src/sauron/clinerules-packs");

test("normalizeProjectType falls back to generic", () => {
  assert.equal(normalizeProjectType("electron-core"), "electron-core");
  assert.equal(normalizeProjectType("unknown"), "generic");
});

test("getPacksForProjectType returns electron packs", () => {
  const packs = getPacksForProjectType("electron-core");
  assert.equal(packs.includes("sauron-electron-dev.md"), true);
  assert.equal(packs.includes("sauron-self-improve.md"), true);
});

test("seedClinerulesPacks writes missing files only", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "clinerules-"));
  const first = seedClinerulesPacks(workspace, "bridge-extension");
  assert.ok(first.seeded.includes("sauron-bridge-dev.md"));
  const second = seedClinerulesPacks(workspace, "bridge-extension");
  assert.equal(second.seeded.length, 0);
  assert.equal(second.skipped.includes("sauron-bridge-dev.md"), true);
  fs.rmSync(workspace, { recursive: true, force: true });
});
