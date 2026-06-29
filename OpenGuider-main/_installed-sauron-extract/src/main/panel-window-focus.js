function raisePanelAboveOverlay(panel) {
  if (!panel || panel.isDestroyed()) {
    return false;
  }

  panel.setAlwaysOnTop(true, "screen-saver", 2);
  panel.moveTop();
  return true;
}

function resetPanelAlwaysOnTop(panel) {
  if (!panel || panel.isDestroyed()) {
    return false;
  }

  panel.setAlwaysOnTop(true);
  return true;
}

module.exports = {
  raisePanelAboveOverlay,
  resetPanelAlwaysOnTop,
};
