const test = require("node:test");
const assert = require("node:assert/strict");
const {
  raisePanelAboveOverlay,
  resetPanelAlwaysOnTop,
} = require("../../src/main/panel-window-focus");

function createPanelMock() {
  const calls = [];
  return {
    calls,
    isDestroyed: () => false,
    setAlwaysOnTop: (...args) => calls.push(["setAlwaysOnTop", ...args]),
    moveTop: () => calls.push(["moveTop"]),
  };
}

test("raisePanelAboveOverlay elevates panel above cursor overlay level", () => {
  const panel = createPanelMock();
  assert.equal(raisePanelAboveOverlay(panel), true);
  assert.deepEqual(panel.calls, [
    ["setAlwaysOnTop", true, "screen-saver", 2],
    ["moveTop"],
  ]);
});

test("resetPanelAlwaysOnTop restores default always-on-top level", () => {
  const panel = createPanelMock();
  assert.equal(resetPanelAlwaysOnTop(panel), true);
  assert.deepEqual(panel.calls, [["setAlwaysOnTop", true]]);
});

test("panel focus helpers ignore destroyed windows", () => {
  const panel = { isDestroyed: () => true };
  assert.equal(raisePanelAboveOverlay(panel), false);
  assert.equal(resetPanelAlwaysOnTop(panel), false);
});
