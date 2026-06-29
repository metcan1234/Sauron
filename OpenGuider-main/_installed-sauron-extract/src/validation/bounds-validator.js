const { screen } = require("electron");

function getAllDisplays() {
  return screen.getAllDisplays();
}

function getPrimaryDisplay() {
  return screen.getPrimaryDisplay();
}

function getDisplayBounds(displayId) {
  if (!displayId) {
    const primary = getPrimaryDisplay();
    return primary.bounds;
  }
  const displays = getAllDisplays();
  for (const display of displays) {
    if (display.id === displayId) {
      return display.bounds;
    }
  }
  return getPrimaryDisplay().bounds;
}

function findDisplayForPoint(x, y) {
  const displays = getAllDisplays();
  for (const display of displays) {
    const bounds = display.bounds;
    if (x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height) {
      return display;
    }
  }
  return getPrimaryDisplay();
}

function normalizeTo0to1000(coordinate, displayBounds) {
  if (!coordinate) return null;
  const bounds = displayBounds || getPrimaryDisplay().bounds;
  const scaleX = 1000 / bounds.width;
  const scaleY = 1000 / bounds.height;
  return {
    x: Math.round((coordinate.x - bounds.x) * scaleX),
    y: Math.round((coordinate.y - bounds.y) * scaleY),
  };
}

function denormalizeFrom0to1000(coordinate, targetDisplay) {
  if (!coordinate) return null;
  const display = targetDisplay || findDisplayForPoint(0, 0) || getPrimaryDisplay();
  const bounds = display.bounds;
  const scaleX = bounds.width / 1000;
  const scaleY = bounds.height / 1000;
  return {
    x: Math.round(bounds.x + coordinate.x * scaleX),
    y: Math.round(bounds.y + coordinate.y * scaleY),
  };
}

function clampToBounds(coordinate, bounds) {
  if (!coordinate || !bounds) return coordinate;
  return {
    x: Math.max(bounds.x, Math.min(bounds.x1 || bounds.x + bounds.width, coordinate.x)),
    y: Math.max(bounds.y, Math.min(bounds.y1 || bounds.y + bounds.height, coordinate.y)),
  };
}

function validateCoordinate(coordinate, options = {}) {
  const {
    allowOutOfBounds = false,
    monitorHint = null,
  } = options;
  if (!coordinate) {
    return { valid: false, reason: "no coordinate", clamped: null };
  }
  const display = monitorHint ? findDisplayForPoint(monitorHint.x, monitorHint.y) : findDisplayForPoint(coordinate.x, coordinate.y);
  const bounds = display ? display.bounds : getPrimaryDisplay().bounds;
  if (
    coordinate.x >= bounds.x &&
    coordinate.x < bounds.x + bounds.width &&
    coordinate.y >= bounds.y &&
    coordinate.y < bounds.y + bounds.height
  ) {
    return { valid: true, display: display.id, clamped: coordinate };
  }
  if (allowOutOfBounds) {
    return { valid: false, reason: "out of bounds", clamped: coordinate, display: display.id };
  }
  const clamped = clampToBounds(coordinate, bounds);
  return { valid: true, reason: "clamped", clamped, display: display.id };
}

function getDisplayAtPosition(x, y) {
  return findDisplayForPoint(x, y);
}

module.exports = {
  getAllDisplays,
  getPrimaryDisplay,
  getDisplayBounds,
  findDisplayForPoint,
  normalizeTo0to1000,
  denormalizeFrom0to1000,
  clampToBounds,
  validateCoordinate,
  getDisplayAtPosition,
};