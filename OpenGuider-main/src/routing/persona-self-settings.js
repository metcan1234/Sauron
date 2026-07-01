const { resolveActivePersonaId } = require("../ai/personas");
const {
  emptySelfProfile,
  normalizeSelfProfile,
  getPersonaStoreKeys,
} = require("../session/persona-self-profile");

function resolveSelfField(baseValue, selfValue, locked) {
  if (locked) {
    return baseValue;
  }
  if (selfValue === undefined || selfValue === null) {
    return baseValue;
  }
  if (Array.isArray(selfValue) && selfValue.length === 0) {
    return baseValue;
  }
  if (typeof selfValue === "string" && !selfValue.trim()) {
    return baseValue;
  }
  return selfValue;
}

function applyPersonaSelfProfile(settings = {}, { includePersona = true } = {}) {
  if (!includePersona) {
    return settings;
  }

  const activePersonaId = resolveActivePersonaId(settings);
  if (activePersonaId !== "luna" && activePersonaId !== "hiri") {
    return settings;
  }

  const keys = getPersonaStoreKeys(activePersonaId);
  const selfTuningEnabled = settings[keys.enabled] !== false;
  if (!selfTuningEnabled) {
    return settings;
  }

  const locks = settings[keys.locks] && typeof settings[keys.locks] === "object"
    ? settings[keys.locks]
    : {};
  const selfProfile = normalizeSelfProfile(
    settings[keys.profile] || emptySelfProfile(activePersonaId),
    activePersonaId,
  );

  const hasSelfData = selfProfile.tuneCount > 0
    || selfProfile.altGreetings.length > 0
    || selfProfile.exampleDialogues.length > 0
    || Boolean(selfProfile.activeScenarioId)
    || Boolean(selfProfile.planNote)
    || selfProfile.feedbackLog.length > 0
    || selfProfile.feedbackNotes.length > 0;

  if (!hasSelfData) {
    return settings;
  }

  const feedbackAttention = buildPersonaFeedbackAttention(selfProfile);

  return {
    ...settings,
    personalitySliders: resolveSelfField(
      settings.personalitySliders,
      selfProfile.personalitySliders,
      locks.personalitySliders === true,
    ),
    activeScenarioId: resolveSelfField(
      settings.activeScenarioId,
      selfProfile.activeScenarioId,
      locks.activeScenarioId === true,
    ),
    altGreetings: resolveSelfField(
      settings.altGreetings,
      selfProfile.altGreetings,
      locks.altGreetings === true,
    ),
    exampleDialogues: resolveSelfField(
      settings.exampleDialogues,
      selfProfile.exampleDialogues,
      locks.exampleDialogues === true,
    ),
    _personaSelfPlanNote: selfProfile.planNote,
    _personaSelfProfileActive: true,
    _personaSelfPersonaId: activePersonaId,
    _personaFeedbackAttention: feedbackAttention,
  };
}

function buildPersonaFeedbackAttention(selfProfile = {}) {
  const lines = [];
  for (const note of (selfProfile.feedbackNotes || []).slice(-5)) {
    if (note) lines.push(`- ${note}`);
  }
  for (const entry of (selfProfile.feedbackLog || []).slice(-3)) {
    const quote = String(entry.userQuote || "").trim();
    const applied = String(entry.applied || "").trim();
    if (quote) {
      lines.push(`- Can dedi: "${quote}"${applied ? ` → ${applied}` : ""}`);
    }
  }
  return lines.join("\n");
}

module.exports = {
  applyPersonaSelfProfile,
  buildPersonaFeedbackAttention,
};
