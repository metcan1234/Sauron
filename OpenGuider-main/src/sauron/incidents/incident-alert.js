function emitIncidentAlert(getWindows, payload) {
  if (!payload) {
    return;
  }
  const targets = typeof getWindows === "function" ? getWindows() : [];
  for (const window of targets) {
    if (window && !window.isDestroyed()) {
      window.webContents.send("incident-alert", payload);
    }
  }
}

module.exports = {
  emitIncidentAlert,
};
