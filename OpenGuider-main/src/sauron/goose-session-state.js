/** @type {null | { sessionId: string, workspacePath: string, mode: string, startedAt: string, handoffId: string, pid?: number }} */
let activeSession = null;

function getActiveGooseSession() {
  if (!activeSession) {
    return null;
  }
  return { ...activeSession };
}

function setActiveGooseSession(session) {
  activeSession = session ? { ...session } : null;
  return getActiveGooseSession();
}

function clearActiveGooseSession() {
  activeSession = null;
}

function isGooseSessionActive() {
  return Boolean(activeSession?.sessionId);
}

module.exports = {
  getActiveGooseSession,
  setActiveGooseSession,
  clearActiveGooseSession,
  isGooseSessionActive,
};
