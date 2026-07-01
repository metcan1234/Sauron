const fs = require("fs");
const path = require("path");

const METRICS_FILENAME = "token-ultra-metrics.json";

function getMetricsPath(workspacePath = "") {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return null;
  }
  return path.join(resolved, ".sauron", METRICS_FILENAME);
}

function readFallbackMetrics(workspacePath = "") {
  const metricsPath = getMetricsPath(workspacePath);
  if (!metricsPath) {
    return { fallbackCount: 0, events: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
    return {
      fallbackCount: Math.max(0, Number(raw.fallbackCount) || 0),
      events: Array.isArray(raw.events) ? raw.events.slice(-20) : [],
    };
  } catch {
    return { fallbackCount: 0, events: [] };
  }
}

function recordCompressionFallback(workspacePath = "", reason = "", channel = "workspace") {
  const metricsPath = getMetricsPath(workspacePath);
  if (!metricsPath) {
    return { fallbackCount: 0, events: [] };
  }
  const current = readFallbackMetrics(workspacePath);
  const event = {
    at: new Date().toISOString(),
    reason: String(reason || "").trim(),
    channel: String(channel || "workspace").trim(),
  };
  const next = {
    fallbackCount: current.fallbackCount + 1,
    events: [...current.events, event].slice(-20),
  };
  fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
  fs.writeFileSync(metricsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

module.exports = {
  METRICS_FILENAME,
  readFallbackMetrics,
  recordCompressionFallback,
};
