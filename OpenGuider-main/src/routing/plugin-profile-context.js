const { probeGamedevBridgePorts } = require("../sauron/gamedev-bridge-probe");

const CACHE_TTL_MS = 5000;
let bridgeCache = {
  at: 0,
  status: null,
};

async function getCachedBridgeStatus(force = false) {
  const now = Date.now();
  if (!force && bridgeCache.status && now - bridgeCache.at < CACHE_TTL_MS) {
    return bridgeCache.status;
  }
  bridgeCache.status = await probeGamedevBridgePorts();
  bridgeCache.at = now;
  return bridgeCache.status;
}

function clearBridgeStatusCache() {
  bridgeCache = { at: 0, status: null };
}

module.exports = {
  CACHE_TTL_MS,
  getCachedBridgeStatus,
  clearBridgeStatusCache,
};
