const { applyExtractProviderPreference } = require("../sauron/token-ultra/token-ultra-v3-config");

async function streamExtractWithProviderPreference({
  streamAIResponse,
  settings = {},
  signal,
  ...rest
}) {
  const preferred = applyExtractProviderPreference(settings);
  if (preferred._tokenUltraExtractProvider !== "ollama") {
    return streamAIResponse({ ...rest, settings, signal });
  }
  try {
    return await streamAIResponse({ ...rest, settings: preferred, signal });
  } catch {
    return streamAIResponse({ ...rest, settings, signal });
  }
}

module.exports = {
  streamExtractWithProviderPreference,
};
