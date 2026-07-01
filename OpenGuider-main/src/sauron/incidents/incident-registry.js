const fs = require("fs");
const os = require("os");
const path = require("path");
const { DEFAULT_INCIDENTS } = require("./default-incidents");
const { matchesIncident } = require("./incident-fingerprint");
const { MAX_REGISTRY_INCIDENTS, MAX_APPLIED_LOG_LINES } = require("./constants");

const REGISTRY_FILENAME = "registry.json";
const APPLIED_LOG_FILENAME = "applied-log.jsonl";

function getIncidentsDir(workspacePath = "") {
  const resolved = String(workspacePath || "").trim();
  if (resolved) {
    return path.join(resolved, ".sauron", "incidents");
  }
  return path.join(os.homedir(), ".sauron", "incidents");
}

function getRegistryPath(workspacePath = "") {
  return path.join(getIncidentsDir(workspacePath), REGISTRY_FILENAME);
}

function getAppliedLogPath(workspacePath = "") {
  return path.join(getIncidentsDir(workspacePath), APPLIED_LOG_FILENAME);
}

function normalizeIncident(entry = {}) {
  return {
    id: String(entry.id || "").trim(),
    fingerprint: String(entry.fingerprint || "").trim(),
    aliases: Array.isArray(entry.aliases) ? entry.aliases.map((v) => String(v).trim()).filter(Boolean) : [],
    component: String(entry.component || "panel").trim(),
    risk: ["low", "medium", "high"].includes(entry.risk) ? entry.risk : "medium",
    autoApply: entry.autoApply === true,
    verified: entry.verified === true,
    successCount: Math.max(0, Number(entry.successCount) || 0),
    lastAppliedAt: entry.lastAppliedAt || null,
    lastFailedAt: entry.lastFailedAt || null,
    hint: String(entry.hint || "").trim(),
    fix: entry.fix && typeof entry.fix === "object" ? entry.fix : { tier: "diagnose", allowedActions: [] },
    learned: entry.learned === true,
    createdAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || null,
  };
}

function mergeWithDefaults(incidents = []) {
  const byId = new Map();
  for (const seed of DEFAULT_INCIDENTS.map(normalizeIncident)) {
    byId.set(seed.id, seed);
  }
  for (const raw of incidents) {
    const normalized = normalizeIncident(raw);
    if (!normalized.id) {
      continue;
    }
    const existing = byId.get(normalized.id) || {};
    byId.set(normalized.id, {
      ...existing,
      ...normalized,
      fix: {
        ...(existing.fix || {}),
        ...(normalized.fix || {}),
      },
    });
  }
  return [...byId.values()].slice(0, MAX_REGISTRY_INCIDENTS);
}

function readRegistryFile(workspacePath = "") {
  const registryPath = getRegistryPath(workspacePath);
  try {
    return JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch {
    return { version: 1, incidents: [], outcomes: {} };
  }
}

function readIncidentRegistry(workspacePath = "") {
  const registryPath = getRegistryPath(workspacePath);
  const raw = readRegistryFile(workspacePath);
  const learned = Array.isArray(raw?.incidents) ? raw.incidents : [];
  const outcomes = raw?.outcomes && typeof raw.outcomes === "object" ? raw.outcomes : {};
  const merged = mergeWithDefaults(learned).map((entry) => {
    const outcome = outcomes[entry.id];
    if (!outcome) {
      return entry;
    }
    return {
      ...entry,
      successCount: Math.max(Number(entry.successCount) || 0, Number(outcome.successCount) || 0),
      lastAppliedAt: outcome.lastAppliedAt || entry.lastAppliedAt,
      lastFailedAt: outcome.lastFailedAt || entry.lastFailedAt,
      verified: outcome.verified != null ? outcome.verified === true : entry.verified,
    };
  });
  return {
    incidents: merged,
    source: learned.length ? "workspace" : "defaults",
    path: registryPath,
    outcomes,
  };
}

function writeIncidentRegistry(workspacePath = "", incidents = [], outcomes = null) {
  const registryPath = getRegistryPath(workspacePath);
  const current = readRegistryFile(workspacePath);
  const learnedOnly = incidents
    .filter((entry) => entry?.learned === true)
    .map(normalizeIncident)
    .slice(0, MAX_REGISTRY_INCIDENTS);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    incidents: learnedOnly,
    outcomes: outcomes && typeof outcomes === "object" ? outcomes : (current.outcomes || {}),
  };
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return readIncidentRegistry(workspacePath);
}

function lookupIncident(fingerprint = "", workspacePath = "") {
  const { incidents } = readIncidentRegistry(workspacePath);
  return incidents.find((incident) => matchesIncident(incident, fingerprint)) || null;
}

function canAutoApplyIncident(incident = {}, settings = {}) {
  if (settings.incidentAutoApplyLowRisk !== true) {
    return false;
  }
  if (!incident || incident.risk !== "low" || incident.verified !== true) {
    return false;
  }
  if (Number(incident.successCount) < 2) {
    return false;
  }
  if (String(incident.fix?.tier || "") !== "scripted") {
    return false;
  }
  return incident.autoApply === true;
}

function recordIncidentOutcome(workspacePath = "", incidentId = "", { success = false } = {}) {
  const current = readRegistryFile(workspacePath);
  const outcomes = { ...(current.outcomes || {}) };
  const prev = outcomes[incidentId] || { successCount: 0 };
  const next = {
    ...prev,
    updatedAt: new Date().toISOString(),
  };
  if (success) {
    next.successCount = Math.max(0, Number(prev.successCount) || 0) + 1;
    next.lastAppliedAt = next.updatedAt;
    next.verified = true;
  } else {
    next.lastFailedAt = next.updatedAt;
    if ((Number(prev.successCount) || 0) <= 0) {
      next.verified = false;
    }
  }
  outcomes[incidentId] = next;
  writeIncidentRegistry(workspacePath, current.incidents || [], outcomes);
  return lookupIncidentById(incidentId, workspacePath);
}

function lookupIncidentById(incidentId = "", workspacePath = "") {
  const { incidents } = readIncidentRegistry(workspacePath);
  return incidents.find((entry) => entry.id === incidentId) || null;
}

function upsertLearnedIncident(workspacePath = "", incident = {}) {
  const normalized = normalizeIncident({
    ...incident,
    learned: true,
    createdAt: incident.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (!normalized.id || !normalized.fingerprint) {
    return null;
  }
  const { incidents } = readIncidentRegistry(workspacePath);
  const without = incidents.filter((entry) => entry.id !== normalized.id && entry.fingerprint !== normalized.fingerprint);
  writeIncidentRegistry(workspacePath, [...without, normalized]);
  return normalized;
}

function appendAppliedLog(workspacePath = "", entry = {}) {
  const logPath = getAppliedLogPath(workspacePath);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const line = JSON.stringify({
    at: new Date().toISOString(),
    ...entry,
  });
  let existing = "";
  try {
    existing = fs.readFileSync(logPath, "utf8");
  } catch {
    existing = "";
  }
  const lines = existing.split(/\r?\n/).filter(Boolean);
  lines.push(line);
  const trimmed = lines.slice(-MAX_APPLIED_LOG_LINES);
  fs.writeFileSync(logPath, `${trimmed.join("\n")}\n`, "utf8");
  return trimmed.length;
}

function readAppliedLog(workspacePath = "", limit = 20) {
  const logPath = getAppliedLogPath(workspacePath);
  try {
    const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    }).reverse();
  } catch {
    return [];
  }
}

function clearIncidentData(workspacePath = "") {
  const dir = getIncidentsDir(workspacePath);
  for (const name of [REGISTRY_FILENAME, APPLIED_LOG_FILENAME]) {
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch {
      // ignore
    }
  }
  return { ok: true };
}

module.exports = {
  REGISTRY_FILENAME,
  APPLIED_LOG_FILENAME,
  getIncidentsDir,
  getRegistryPath,
  readIncidentRegistry,
  writeIncidentRegistry,
  lookupIncident,
  lookupIncidentById,
  canAutoApplyIncident,
  recordIncidentOutcome,
  upsertLearnedIncident,
  appendAppliedLog,
  readAppliedLog,
  clearIncidentData,
  normalizeIncident,
};
