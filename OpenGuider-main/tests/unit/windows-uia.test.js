const test = require("node:test");
const assert = require("node:assert/strict");
const {
  blendPointerWithUia,
  isWindowsPlatform,
} = require("../../src/agent/micro-guide/windows-uia");

test("blendPointerWithUia blends LLM coords toward UIA center", () => {
  const pointer = { x: 100, y: 200, label: "btn" };
  const uiaBounds = {
    x: 0,
    y: 0,
    width: 1000,
    height: 1000,
    centerX: 800,
    centerY: 800,
  };
  const blended = blendPointerWithUia(pointer, uiaBounds);
  assert.ok(blended.x > pointer.x);
  assert.ok(blended.y > pointer.y);
  assert.equal(blended.uiaAssisted, true);
});

test("blendPointerWithUia returns original pointer without bounds", () => {
  const pointer = { x: 400, y: 500 };
  assert.deepEqual(blendPointerWithUia(pointer, null), pointer);
});

test("isWindowsPlatform reflects process platform", () => {
  assert.equal(isWindowsPlatform(), process.platform === "win32");
});
