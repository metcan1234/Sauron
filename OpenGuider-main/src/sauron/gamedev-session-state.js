let storeRef = null;
let gamedevModeActive = false;
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
  lastSession = null;
}

module.exports = {
  attachGamedevSessionStore,
  setGamedevModeActive,
  isGamedevModeActive,
  setLastGamedevSession,
  getLastGamedevSession,
  clearGamedevSession,
};
