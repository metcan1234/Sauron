const test = require("node:test");
const assert = require("node:assert/strict");
const {
  attachGamedevSessionStore,
  setGamedevModeActive,
  setGamedevLaunchInProgress,
  isGamedevModeActive,
  isGamedevLaunchInProgress,
  clearGamedevSession,
} = require("../../src/sauron/gamedev-session-state");

test("gamedev session state persists mode in store", () => {
  const memory = { gamedevModeActive: false };
  const store = {
    get: (key) => memory[key],
    set: (key, value) => {
      memory[key] = value;
    },
  };

  attachGamedevSessionStore(store);
  assert.equal(isGamedevModeActive(), false);

  setGamedevModeActive(true, { engine: "unity" });
  assert.equal(isGamedevModeActive(), true);
  assert.equal(memory.gamedevModeActive, true);

  clearGamedevSession();
  assert.equal(isGamedevModeActive(), false);
  assert.equal(memory.gamedevModeActive, false);
});

test("reactivating gamedev mode stays active (no toggle-off)", () => {
  const memory = { gamedevModeActive: false };
  const store = {
    get: (key) => memory[key],
    set: (key, value) => {
      memory[key] = value;
    },
  };

  attachGamedevSessionStore(store);
  setGamedevModeActive(true, { engine: "unity" });
  setGamedevModeActive(true, { engine: "unity" });
  assert.equal(isGamedevModeActive(), true);
});

test("gamedev launch in progress reports mode active", () => {
  const memory = { gamedevModeActive: false };
  const store = {
    get: (key) => memory[key],
    set: (key, value) => {
      memory[key] = value;
    },
  };

  attachGamedevSessionStore(store);
  assert.equal(isGamedevModeActive(), false);
  setGamedevLaunchInProgress(true);
  assert.equal(isGamedevLaunchInProgress(), true);
  assert.equal(isGamedevModeActive(), true);
  setGamedevLaunchInProgress(false);
  assert.equal(isGamedevModeActive(), false);
});
