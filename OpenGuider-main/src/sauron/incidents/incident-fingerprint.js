const crypto = require("crypto");

function normalizeErrorText(text = "") {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}t[\d:.z+-]+/gi, "")
    .replace(/[a-f0-9]{8}-[a-f0-9-]{27}/gi, "uuid")
    .replace(/\s+/g, " ")
    .slice(0, 400);
}

function inferIncidentCode(error = {}, context = {}) {
  const message = normalizeErrorText(error?.message || error);
  const explicit = String(error?.code || context?.errorCode || "").trim();
  if (explicit) {
    return explicit;
  }
  if (/bridge.*(bulunamad|not found|missing|kurulamad)/i.test(message)) {
    return "BRIDGE_MISSING";
  }
  if (/vscode cli|code command|shell command.*code/i.test(message)) {
    return "VSCODE_CLI_MISSING";
  }
  if (/cursor.*(değil|not vscode|shim)/i.test(message)) {
    return "VSCODE_NOT_CURSOR";
  }
  if (/handoff|pending.*görev/i.test(message)) {
    return "HANDOFF_BLOCKED";
  }
  if (/api key|authentication|unauthorized|401|403/i.test(message)) {
    return "AUTH_ERROR";
  }
  if (/rate limit|429|quota/i.test(message)) {
    return "RATE_LIMIT";
  }
  if (/workspace.*(not selected|bulunamad|does not exist)/i.test(message)) {
    return "WORKSPACE_PATH_INVALID";
  }
  if (/bloker|blocker/i.test(message)) {
    return "CHANNEL_BLOCKER";
  }
  return "UNKNOWN_ERROR";
}

function buildIncidentFingerprint(error = {}, context = {}) {
  const component = String(context?.component || "panel").trim().toLowerCase();
  const operation = String(context?.operation || "unknown").trim().toLowerCase();
  const code = inferIncidentCode(error, context);
  return `${component}:${operation}:${code}`;
}

function hashFingerprint(fingerprint = "") {
  return crypto.createHash("sha256").update(String(fingerprint || "")).digest("hex").slice(0, 16);
}

function matchesIncident(incident = {}, fingerprint = "") {
  const target = String(fingerprint || "").trim();
  if (!target) {
    return false;
  }
  if (String(incident.fingerprint || "").trim() === target) {
    return true;
  }
  const aliases = Array.isArray(incident.aliases) ? incident.aliases : [];
  return aliases.some((entry) => String(entry || "").trim() === target);
}

module.exports = {
  normalizeErrorText,
  inferIncidentCode,
  buildIncidentFingerprint,
  hashFingerprint,
  matchesIncident,
};
