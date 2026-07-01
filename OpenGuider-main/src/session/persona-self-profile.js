const { normalizePersonalitySliders } = require("../ai/personality-sliders");
const { BUILTIN_SCENARIOS } = require("../ai/conversation-scenarios");

const MAX_CHANGE_LOG = 24;
const MAX_ALT_GREETINGS = 8;
const MAX_EXAMPLE_DIALOGUES = 6;
const MAX_FEEDBACK_LOG = 16;
const MAX_FEEDBACK_NOTES = 8;
const SLIDER_DELTA_MAX = 8;

const VALID_SCENARIO_IDS = new Set(BUILTIN_SCENARIOS.map((entry) => entry.id));

const PERSONA_STORE_KEYS = {
  luna: {
    enabled: "lunaSelfTuningEnabled",
    profile: "lunaSelfProfile",
    locks: "lunaSelfProfileLocks",
  },
  hiri: {
    enabled: "hiriSelfTuningEnabled",
    profile: "hiriSelfProfile",
    locks: "hiriSelfProfileLocks",
  },
};

function emptySelfProfile(personaId = "luna") {
  const base = {
    updatedAt: "",
    tuneCount: 0,
    messageCount: 0,
    planNote: "",
    personalitySliders: null,
    activeScenarioId: "",
    altGreetings: [],
    exampleDialogues: [],
    changeLog: [],
    feedbackLog: [],
    feedbackNotes: [],
  };
  if (personaId === "luna") {
    base.personalitySliders = {
      responseLength: 50,
      warmth: 70,
      flirtiness: 50,
      emoji: 30,
    };
  } else {
    base.personalitySliders = {
      responseLength: 50,
      warmth: 65,
      emoji: 20,
    };
  }
  return base;
}

function normalizeStringList(list, max = 8) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const entry of list) {
    const line = String(entry || "").trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result.slice(-max);
}

function normalizeSlidersForPersona(raw = {}, personaId = "luna") {
  if (personaId === "hiri") {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      responseLength: clampSlider(source.responseLength, 50),
      warmth: clampSlider(source.warmth, 65),
      emoji: clampSlider(source.emoji, 20),
    };
  }
  return normalizePersonalitySliders(raw);
}

function clampSlider(value, fallback = 50) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeScenarioId(id = "") {
  const value = String(id || "").trim();
  if (!value || !VALID_SCENARIO_IDS.has(value)) {
    return "";
  }
  return value;
}

function normalizeSelfProfile(raw = {}, personaId = "luna") {
  const base = emptySelfProfile(personaId);
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    updatedAt: String(source.updatedAt || "").trim(),
    tuneCount: Math.max(0, Number(source.tuneCount) || 0),
    messageCount: Math.max(0, Number(source.messageCount) || 0),
    planNote: String(source.planNote || "").trim(),
    personalitySliders: normalizeSlidersForPersona(
      source.personalitySliders || base.personalitySliders,
      personaId,
    ),
    activeScenarioId: normalizeScenarioId(source.activeScenarioId),
    altGreetings: normalizeStringList(source.altGreetings, MAX_ALT_GREETINGS),
    exampleDialogues: normalizeStringList(source.exampleDialogues, MAX_EXAMPLE_DIALOGUES),
    changeLog: Array.isArray(source.changeLog)
      ? source.changeLog.slice(-MAX_CHANGE_LOG).map((entry) => ({
        at: String(entry?.at || "").trim(),
        field: String(entry?.field || "").trim(),
        from: entry?.from ?? null,
        to: entry?.to ?? null,
        reason: String(entry?.reason || "").trim(),
      })).filter((entry) => entry.field)
      : [],
    feedbackLog: Array.isArray(source.feedbackLog)
      ? source.feedbackLog.slice(-MAX_FEEDBACK_LOG).map((entry) => ({
        at: String(entry?.at || "").trim(),
        userQuote: String(entry?.userQuote || "").trim(),
        adjustment: String(entry?.adjustment || "").trim(),
        applied: String(entry?.applied || "").trim(),
      })).filter((entry) => entry.userQuote || entry.adjustment)
      : [],
    feedbackNotes: normalizeStringList(source.feedbackNotes, MAX_FEEDBACK_NOTES),
  };
}

function clampSliderDelta(current, target) {
  const cur = clampSlider(current, 50);
  const tgt = clampSlider(target, cur);
  if (tgt > cur + SLIDER_DELTA_MAX) {
    return cur + SLIDER_DELTA_MAX;
  }
  if (tgt < cur - SLIDER_DELTA_MAX) {
    return cur - SLIDER_DELTA_MAX;
  }
  return tgt;
}

function mergeSlidersGradually(current = {}, incoming = {}, personaId = "luna") {
  const normalizedCurrent = normalizeSlidersForPersona(current, personaId);
  const normalizedIncoming = normalizeSlidersForPersona(incoming, personaId);
  const merged = { ...normalizedCurrent };
  for (const key of Object.keys(normalizedIncoming)) {
    merged[key] = clampSliderDelta(normalizedCurrent[key], normalizedIncoming[key]);
  }
  return merged;
}

function appendChangeLog(profile, field, from, to, reason = "") {
  const now = new Date().toISOString();
  const entry = {
    at: now,
    field,
    from,
    to,
    reason: String(reason || "").trim(),
  };
  return [...(profile.changeLog || []), entry].slice(-MAX_CHANGE_LOG);
}

function recordSelfTuneMessage(profile = {}, personaId = "luna") {
  const normalized = normalizeSelfProfile(profile, personaId);
  const now = new Date().toISOString();
  normalized.messageCount += 1;
  normalized.updatedAt = now;
  return normalized;
}

function shouldRunSelfTuningExtract(profile = {}) {
  const count = Math.max(0, Number(profile.messageCount) || 0);
  return count > 0 && count % 3 === 0;
}

function applySelfTuningExtraction(profile = {}, extraction = {}, personaId = "luna", locks = {}) {
  const normalized = normalizeSelfProfile(profile, personaId);
  const now = new Date().toISOString();
  let changed = false;

  if (!locks.personalitySliders && extraction.personalitySliders) {
    const merged = mergeSlidersGradually(
      normalized.personalitySliders,
      extraction.personalitySliders,
      personaId,
    );
    if (JSON.stringify(merged) !== JSON.stringify(normalized.personalitySliders)) {
      normalized.changeLog = appendChangeLog(
        normalized,
        "personalitySliders",
        normalized.personalitySliders,
        merged,
        extraction.reason || extraction.planNote || "",
      );
      normalized.personalitySliders = merged;
      changed = true;
    }
  }

  if (!locks.activeScenarioId && extraction.activeScenarioId !== undefined) {
    const scenarioId = normalizeScenarioId(extraction.activeScenarioId);
    if (scenarioId !== normalized.activeScenarioId) {
      normalized.changeLog = appendChangeLog(
        normalized,
        "activeScenarioId",
        normalized.activeScenarioId,
        scenarioId,
        extraction.reason || "",
      );
      normalized.activeScenarioId = scenarioId;
      changed = true;
    }
  }

  if (!locks.altGreetings && Array.isArray(extraction.altGreetings) && extraction.altGreetings.length) {
    const merged = normalizeStringList(
      [...normalized.altGreetings, ...extraction.altGreetings],
      MAX_ALT_GREETINGS,
    );
    if (JSON.stringify(merged) !== JSON.stringify(normalized.altGreetings)) {
      normalized.changeLog = appendChangeLog(
        normalized,
        "altGreetings",
        normalized.altGreetings.length,
        merged.length,
        extraction.reason || "",
      );
      normalized.altGreetings = merged;
      changed = true;
    }
  }

  if (!locks.exampleDialogues && Array.isArray(extraction.exampleDialogues) && extraction.exampleDialogues.length) {
    const merged = normalizeStringList(
      [...normalized.exampleDialogues, ...extraction.exampleDialogues],
      MAX_EXAMPLE_DIALOGUES,
    );
    if (JSON.stringify(merged) !== JSON.stringify(normalized.exampleDialogues)) {
      normalized.changeLog = appendChangeLog(
        normalized,
        "exampleDialogues",
        normalized.exampleDialogues.length,
        merged.length,
        extraction.reason || "",
      );
      normalized.exampleDialogues = merged;
      changed = true;
    }
  }

  if (extraction.planNote) {
    const note = String(extraction.planNote || "").trim();
    if (note && note !== normalized.planNote) {
      normalized.planNote = note.slice(0, 500);
      changed = true;
    }
  }

  if (changed) {
    normalized.tuneCount += 1;
    normalized.updatedAt = now;
  }

  return normalized;
}

function appendFeedbackLog(profile = {}, entry = {}, personaId = "luna") {
  const normalized = normalizeSelfProfile(profile, personaId);
  const now = new Date().toISOString();
  const nextEntry = {
    at: now,
    userQuote: String(entry.userQuote || "").trim(),
    adjustment: String(entry.adjustment || "").trim(),
    applied: String(entry.applied || "").trim(),
  };
  if (!nextEntry.userQuote && !nextEntry.adjustment) {
    return normalized;
  }
  normalized.feedbackLog = [...normalized.feedbackLog, nextEntry].slice(-MAX_FEEDBACK_LOG);
  normalized.updatedAt = now;
  return normalized;
}

function appendFeedbackNotes(profile = {}, notes = [], personaId = "luna") {
  const normalized = normalizeSelfProfile(profile, personaId);
  const incoming = normalizeStringList(notes, MAX_FEEDBACK_NOTES);
  if (!incoming.length) {
    return normalized;
  }
  const merged = normalizeStringList([...normalized.feedbackNotes, ...incoming], MAX_FEEDBACK_NOTES);
  normalized.feedbackNotes = merged;
  normalized.updatedAt = new Date().toISOString();
  return normalized;
}

function clearPersonaFeedback(profile = {}, personaId = "luna") {
  const normalized = normalizeSelfProfile(profile, personaId);
  normalized.feedbackLog = [];
  normalized.feedbackNotes = [];
  normalized.updatedAt = new Date().toISOString();
  return normalized;
}

function getPersonaStoreKeys(personaId = "luna") {
  return PERSONA_STORE_KEYS[personaId] || PERSONA_STORE_KEYS.luna;
}

function getPersonaSelfProfileState(settings = {}, personaId = "luna") {
  const keys = getPersonaStoreKeys(personaId);
  const enabled = settings[keys.enabled] !== false
    && String(settings.activePersonaId || "luna") === personaId;
  const profile = normalizeSelfProfile(settings[keys.profile] || emptySelfProfile(personaId), personaId);
  const locks = settings[keys.locks] && typeof settings[keys.locks] === "object"
    ? settings[keys.locks]
    : {};
  return {
    personaId,
    enabled,
    profile,
    locks,
    tuneCount: profile.tuneCount,
    messageCount: profile.messageCount,
    planNote: profile.planNote,
    updatedAt: profile.updatedAt,
    changeLog: profile.changeLog.slice(-5),
    feedbackLog: profile.feedbackLog.slice(-5),
    feedbackNotes: profile.feedbackNotes.slice(-5),
  };
}

module.exports = {
  MAX_CHANGE_LOG,
  MAX_FEEDBACK_LOG,
  VALID_SCENARIO_IDS,
  PERSONA_STORE_KEYS,
  emptySelfProfile,
  normalizeSelfProfile,
  clampSliderDelta,
  mergeSlidersGradually,
  recordSelfTuneMessage,
  shouldRunSelfTuningExtract,
  applySelfTuningExtraction,
  appendFeedbackLog,
  appendFeedbackNotes,
  clearPersonaFeedback,
  getPersonaStoreKeys,
  getPersonaSelfProfileState,
};
