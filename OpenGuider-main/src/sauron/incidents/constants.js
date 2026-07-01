const MAX_REGISTRY_INCIDENTS = 100;
const MAX_APPLIED_LOG_LINES = 500;
const MAX_STORE_SNAPSHOTS = 10;

const ALLOWED_STORE_KEYS = new Set([
  "workspacePath",
  "ollamaUrl",
  "ollamaModelCustom",
]);

const FORBIDDEN_ACTION_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\brimraf\b/i,
  /\bdel\s+\/s\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b/i,
  /\bnpm\s+uninstall\b/i,
  /\bunlink\s*\(/i,
  /\bfs\.rmSync\b/i,
  /\bfs\.unlinkSync\b/i,
];

const RISK_LEVELS = new Set(["low", "medium", "high"]);
const FIX_TIERS = new Set(["diagnose", "scripted", "agent-plan"]);

const ALLOWED_SCRIPTED_ACTIONS = new Set([
  "run-doctor-check",
  "run-full-doctor",
  "suggest-install-bridge",
  "install-bridge",
  "open-settings-tab",
  "retry-handoff",
  "show-incident-hint",
]);

module.exports = {
  MAX_REGISTRY_INCIDENTS,
  MAX_APPLIED_LOG_LINES,
  MAX_STORE_SNAPSHOTS,
  ALLOWED_STORE_KEYS,
  FORBIDDEN_ACTION_PATTERNS,
  RISK_LEVELS,
  FIX_TIERS,
  ALLOWED_SCRIPTED_ACTIONS,
};
