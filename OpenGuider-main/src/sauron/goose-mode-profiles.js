const GOOSE_MODE_PROFILES = {
  economy: {
    envOverrides: {
      GOOSE_CLI_MIN_PRIORITY: "0.5",
      GOOSE_AUTO_COMPACT_THRESHOLD: "0.55",
      GOOSE_CONTEXT_STRATEGY: "summarize",
    },
    maxTurns: 40,
    systemCharLimit: 2000,
    instructionSuffix: [
      "## Economy Modu",
      "- Kısa plan (2-3 madde), gereksiz kod bloğu gösterme.",
      "- Büyük dosyalarda önce grep/arama, tam okuma son çare.",
      "- Kısa ve net cevaplar ver.",
    ].join("\n"),
  },
  balanced: {
    envOverrides: {
      GOOSE_CLI_MIN_PRIORITY: "0.25",
      GOOSE_AUTO_COMPACT_THRESHOLD: "0.65",
    },
    maxTurns: 60,
    systemCharLimit: 4000,
    instructionSuffix: [
      "## Balanced Modu",
      "- Dengeli açıklama; gereksiz tekrar yapma.",
      "- Büyük değişikliklerde kısa plan sun.",
    ].join("\n"),
  },
  premium: {
    envOverrides: {
      GOOSE_CLI_MIN_PRIORITY: "0.0",
      GOOSE_AUTO_COMPACT_THRESHOLD: "0.75",
    },
    maxTurns: 100,
    systemCharLimit: 8000,
    instructionSuffix: [
      "## Premium Modu",
      "- Mimari derinlik ve kapsamlı analiz serbest.",
      "- Yine de aynı bilgiyi tekrar etme.",
    ].join("\n"),
  },
};

function getGooseModeProfile(mode) {
  const key = ["economy", "balanced", "premium"].includes(mode) ? mode : "balanced";
  const profile = GOOSE_MODE_PROFILES[key];
  return {
    mode: key,
    envOverrides: { ...profile.envOverrides },
    maxTurns: profile.maxTurns,
    systemCharLimit: profile.systemCharLimit,
    instructionSuffix: profile.instructionSuffix,
  };
}

function applyModeProfileToProviderConfig(mode, providerConfig = {}) {
  const profile = getGooseModeProfile(mode);
  const mergedOverrides = {
    ...(providerConfig.envOverrides && typeof providerConfig.envOverrides === "object"
      ? providerConfig.envOverrides
      : {}),
    ...profile.envOverrides,
    GOOSE_MAX_TURNS: String(profile.maxTurns),
  };

  return {
    ...providerConfig,
    envOverrides: mergedOverrides,
    modeProfile: {
      mode: profile.mode,
      maxTurns: profile.maxTurns,
      systemCharLimit: profile.systemCharLimit,
    },
  };
}

module.exports = {
  GOOSE_MODE_PROFILES,
  getGooseModeProfile,
  applyModeProfileToProviderConfig,
};
