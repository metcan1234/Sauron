let gamedevModeActive = false;
let lastSession = null;

function setGamedevModeActive(active, extra = {}) {
  gamedevModeActive = active === true;
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
  return gamedevModeActive;
}

function setLastGamedevSession(session) {
  lastSession = session ? { ...session } : null;
  if (session?.modeActive === true) {
    gamedevModeActive = true;
  }
}

function getLastGamedevSession() {
  return lastSession ? { ...lastSession } : null;
}

function clearGamedevSession() {
  gamedevModeActive = false;
  lastSession = null;
}

module.exports = {
  setGamedevModeActive,
  isGamedevModeActive,
  setLastGamedevSession,
  getLastGamedevSession,
  clearGamedevSession,
};
