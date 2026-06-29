function createTrayMenu({ Tray, Menu, buildTrayIcon, callbacks }) {
  let tray = null;

  function createTray() {
    tray = new Tray(buildTrayIcon());
    tray.setToolTip("Sauron — AI Companion");
    tray.on("click", () => {
      if (callbacks.isPanelVisible()) {
        callbacks.hidePanel();
      } else {
        callbacks.showPanel();
      }
    });
    tray.on("double-click", callbacks.showPanel);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open Sauron", click: callbacks.showPanel },
      { label: "Settings", click: callbacks.createSettingsWindow },
      { type: "separator" },
      { label: "Quit", click: callbacks.quitApp },
    ]));
    return tray;
  }

  function getTray() {
    return tray;
  }

  return {
    createTray,
    getTray,
  };
}

module.exports = { createTrayMenu };
