const DEBUG = process.env.DEBUG_PREPOST === "1" || process.env.DEBUG === "1";

function debugLog(prefix, data) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [${prefix}] ${data}`);
}

module.exports = {
  debugLog,
  DEBUG,
};