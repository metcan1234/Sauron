const { createLogger } = require("../../logger");
const { syncClineUsageFromDisk } = require("./cline-usage-reader");

const logger = createLogger("cline-usage-poller");
const DEFAULT_INTERVAL_MS = 60_000;

let pollTimer = null;

function runClineUsageSync(getSettings) {
  try {
    const settings = typeof getSettings === "function" ? getSettings() : {};
    void syncClineUsageFromDisk(settings).catch((error) => {
      logger.warn("cline-usage-poller:tick-failed", {
        error: error?.message || String(error),
      });
    });
  } catch (error) {
    logger.warn("cline-usage-poller:tick-failed", {
      error: error?.message || String(error),
    });
  }
}

function startClineUsagePoller(getSettings, intervalMs = DEFAULT_INTERVAL_MS) {
  stopClineUsagePoller();
  runClineUsageSync(getSettings);
  pollTimer = setInterval(() => runClineUsageSync(getSettings), intervalMs);
  if (typeof pollTimer.unref === "function") {
    pollTimer.unref();
  }
}

function stopClineUsagePoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  startClineUsagePoller,
  stopClineUsagePoller,
  runClineUsageSync,
};
