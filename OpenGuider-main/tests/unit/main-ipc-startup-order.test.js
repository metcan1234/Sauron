const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

test("main.js registers IPC handlers before createPanelWindow in whenReady", () => {
  const mainPath = path.join(__dirname, "../../main.js");
  const source = fs.readFileSync(mainPath, "utf8");
  const bootIdx = source.indexOf("app.whenReady");
  assert.ok(bootIdx >= 0, "app.whenReady block missing");

  const bootBlock = source.slice(bootIdx, bootIdx + 12000);
  const ipcReadyIdx = bootBlock.indexOf("ensureIpcHandlersReady()");
  const panelIdx = bootBlock.indexOf("createPanelWindow()");
  assert.ok(ipcReadyIdx >= 0, "ensureIpcHandlersReady() missing in whenReady block");
  assert.ok(panelIdx >= 0, "createPanelWindow() missing in whenReady block");
  assert.ok(ipcReadyIdx < panelIdx, "IPC handlers must be ready before createPanelWindow");
});

test("main.js defines ipcHandlersReady startup barrier", () => {
  const mainPath = path.join(__dirname, "../../main.js");
  const source = fs.readFileSync(mainPath, "utf8");
  assert.match(source, /let ipcHandlersReady = false/);
  assert.match(source, /function ensureIpcHandlersReady\(/);
});
