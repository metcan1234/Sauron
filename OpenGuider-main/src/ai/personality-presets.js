const { migrateLegacyPreset, listPersonas } = require("./personas");

function getPersonalityPresetPrompt(presetId) {
  return "";
}

function listPersonalityPresets() {
  return listPersonas();
}

module.exports = {
  getPersonalityPresetPrompt,
  listPersonalityPresets,
  migrateLegacyPreset,
};
