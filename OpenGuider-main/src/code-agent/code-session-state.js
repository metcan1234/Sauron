const fs = require("fs");
const path = require("path");

const SESSION_FILE = "code-agent-session.json";

function getSessionPath(workspacePath) {
  return path.join(workspacePath, ".sauron", SESSION_FILE);
}

function readSession(workspacePath) {
  const filePath = getSessionPath(workspacePath);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeSession(workspacePath, session) {
  const dir = path.join(workspacePath, ".sauron");
  fs.mkdirSync(dir, { recursive: true });
  const next = { ...session, updatedAt: new Date().toISOString() };
  fs.writeFileSync(getSessionPath(workspacePath), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function clearSession(workspacePath) {
  const filePath = getSessionPath(workspacePath);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

function createEmptySession(goal, sessionId) {
  return {
    sessionId,
    goal,
    active: true,
    status: "running",
    plan: null,
    iteration: 0,
    toolLog: [],
    touchedFiles: [],
    fileCache: {},
    pendingChange: null,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  SESSION_FILE,
  readSession,
  writeSession,
  clearSession,
  createEmptySession,
};
