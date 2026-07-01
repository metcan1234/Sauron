function resolveDeltaOverlapMin(settings = {}) {
  const raw = Number(settings.tokenUltraDeltaOverlapMin);
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) {
    return raw;
  }
  const level = String(settings.tokenUltraAggressionLevel || "smart").trim().toLowerCase();
  if (level === "max") {
    return 0.4;
  }
  if (level === "balanced") {
    return 0.55;
  }
  return 0.5;
}

function isChangedFilesOnlyEnabled(settings = {}) {
  return settings.tokenUltraUseChangedFilesOnly !== false;
}

function shouldPreferFullTreeFallback(settings = {}, changedFileCount = 0) {
  const mode = String(settings.finopsCostOptimizerMode || "balanced").trim().toLowerCase();
  if (mode === "performance") {
    return true;
  }
  return changedFileCount > 12;
}

function isSmartAtFileTrimEnabled(settings = {}) {
  return settings.tokenUltraSmartAtFileTrim !== false;
}

function isPreferOllamaForExtract(settings = {}) {
  return settings.tokenUltraPreferOllamaForExtract !== false;
}

function isAutoEconomyEnabled(settings = {}) {
  return settings.tokenUltraAutoEconomyEnabled === true;
}

function applyExtractProviderPreference(settings = {}) {
  if (!isPreferOllamaForExtract(settings)) {
    return settings;
  }
  const url = String(settings.ollamaUrl || "").trim();
  if (!url) {
    return settings;
  }
  const model = String(settings.ollamaModelCustom || "").trim() || "qwen2.5-coder:7b";
  return {
    ...settings,
    _tokenUltraExtractProvider: "ollama",
    aiProvider: "ollama",
    aiModel: model,
  };
}

module.exports = {
  resolveDeltaOverlapMin,
  isChangedFilesOnlyEnabled,
  shouldPreferFullTreeFallback,
  isSmartAtFileTrimEnabled,
  isPreferOllamaForExtract,
  isAutoEconomyEnabled,
  applyExtractProviderPreference,
};
