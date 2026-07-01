const { LUNA } = require("./luna");
const { HIRI } = require("./hiri");

const PERSONAS = {
  luna: LUNA,
  hiri: HIRI,
};

const LEGACY_PRESET_MAP = {
  "sauron-default": "luna",
  samimi: "luna",
  resmi: "hiri",
  mentor: "hiri",
  minimal: "hiri",
};

function migrateLegacyPreset(presetId) {
  return LEGACY_PRESET_MAP[presetId] || "luna";
}

function resolveActivePersonaId(settings = {}) {
  const explicit = String(settings.activePersonaId || "").trim();
  if (explicit && PERSONAS[explicit]) {
    return explicit;
  }
  const legacy = String(settings.personalityPreset || "").trim();
  if (legacy) {
    return migrateLegacyPreset(legacy);
  }
  return "luna";
}

function getPersona(id) {
  const resolvedId = PERSONAS[id] ? id : resolveActivePersonaId({ activePersonaId: id });
  return PERSONAS[resolvedId] || LUNA;
}

function listPersonas() {
  return Object.values(PERSONAS).map((persona) => ({
    id: persona.id,
    label: persona.label,
    displayName: persona.displayName,
    tagline: persona.tagline,
    sampleLine: persona.sampleLine,
    defaultGreeting: persona.defaultGreeting,
  }));
}

function buildPersonaBlock(persona, ownerName = "Can") {
  const owner = String(ownerName || "Can").trim() || "Can";
  return String(persona?.personaBlock || "")
    .replace(/\{\{user\}\}/g, owner)
    .replace(/\{\{char\}\}/g, persona?.displayName || persona?.label || "Luna");
}

function buildLunaMatureBlock() {
  const { LUNA_MATURE_BLOCK } = require("./luna");
  return LUNA_MATURE_BLOCK;
}

module.exports = {
  PERSONAS,
  LEGACY_PRESET_MAP,
  migrateLegacyPreset,
  resolveActivePersonaId,
  getPersona,
  listPersonas,
  buildPersonaBlock,
  buildLunaMatureBlock,
};
