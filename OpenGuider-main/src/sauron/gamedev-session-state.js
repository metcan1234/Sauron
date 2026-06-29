let storeRef = null;
let gamedevModeActive = false;
let gamedevLaunchInProgress = false;
let lastSession = null;

function attachGamedevSessionStore(store) {
  storeRef = store || null;
  if (storeRef?.get) {
    gamedevModeActive = storeRef.get("gamedevModeActive") === true;
  }
}

function persistGamedevModeActive() {
  if (storeRef?.set) {
    storeRef.set("gamedevModeActive", gamedevModeActive);
  }
}

function setGamedevLaunchInProgress(active) {
  gamedevLaunchInProgress = active === true;
}

function isGamedevLaunchInProgress() {
  return gamedevLaunchInProgress;
}

function setGamedevModeActive(active, extra = {}) {
  gamedevModeActive = active === true;
  persistGamedevModeActive();

  if (active) {
    lastSession = {
      ...(lastSession || {}),
      ...extra,
      modeActive: true,
      activatedAt: new Date().toISOString(),
    };
  } else if (lastSession) {
    lastSession = {
      ...lastSession,
      modeActive: false,
      deactivatedAt: new Date().toISOString(),
    };
  }
  return gamedevModeActive;
}

function isGamedevModeActive() {
  if (gamedevLaunchInProgress) {
    return true;
  }
  if (storeRef?.get) {
    return storeRef.get("gamedevModeActive") === true;
  }
  return gamedevModeActive;
}

function setLastGamedevSession(session) {
  lastSession = session ? { ...session } : null;
  if (session?.modeActive === true) {
    setGamedevModeActive(true, session);
  }
}

function getLastGamedevSession() {
  return lastSession ? { ...lastSession } : null;
}

function clearGamedevSession() {
  setGamedevModeActive(false);
  gamedevLaunchInProgress = false;
  lastSession = null;
}

module.exports = {
  attachGamedevSessionStore,
  setGamedevModeActive,
  setGamedevLaunchInProgress,
  isGamedevLaunchInProgress,
  isGamedevModeActive,
  setLastGamedevSession,
  getLastGamedevSession,
  clearGamedevSession,
};
