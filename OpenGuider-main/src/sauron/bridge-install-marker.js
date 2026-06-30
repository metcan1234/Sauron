const fs = require("fs");
const os = require("os");
const path = require("path");

const BRIDGE_MARKER_FILENAME = "bridge-installed.json";

function getBridgeMarkerPath() {
  const base = process.env.APPDATA
    || (process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support")
      : path.join(os.homedir(), ".config"));
  return path.join(base, "sauron", BRIDGE_MARKER_FILENAME);
}

function readBridgeMarker() {
  try {
    const markerPath = getBridgeMarkerPath();
    if (!fs.existsSync(markerPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

function writeBridgeMarker(payload) {
  const markerPath = getBridgeMarkerPath();
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function isBridgeMarkerValid(extensionId) {
  const marker = readBridgeMarker();
  if (!marker?.extensionId || !extensionId) {
    return false;
  }
  return String(marker.extensionId).toLowerCase() === String(extensionId).toLowerCase();
}

function clearBridgeMarkerForTests() {
  try {
    const markerPath = getBridgeMarkerPath();
    if (fs.existsSync(markerPath)) {
      fs.unlinkSync(markerPath);
    }
  } catch {
    // ignore
  }
}

module.exports = {
  getBridgeMarkerPath,
  readBridgeMarker,
  writeBridgeMarker,
  isBridgeMarkerValid,
  clearBridgeMarkerForTests,
};
