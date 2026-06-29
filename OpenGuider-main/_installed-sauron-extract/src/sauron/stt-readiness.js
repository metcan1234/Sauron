function resolveSttReadiness(settings = {}) {
  const preferred = settings.sttProvider === "whisper" ? "whisper" : "assemblyai";
  const assemblyReady = Boolean(String(settings.assemblyaiApiKey || "").trim());
  const whisperReady = Boolean(
    String(settings.whisperApiKey || settings.openaiApiKey || "").trim(),
  );

  let provider = preferred;
  if (preferred === "whisper" && !whisperReady && assemblyReady) {
    provider = "assemblyai";
  } else if (preferred === "assemblyai" && !assemblyReady && whisperReady) {
    provider = "whisper";
  }

  const ok = provider === "whisper" ? whisperReady : assemblyReady;
  let message = "";
  if (!ok) {
    if (preferred === "whisper") {
      message = "Whisper/OpenAI API anahtarı yok. Ayarlar → Ses → Whisper veya OpenAI key girin; ya da AssemblyAI seçin.";
    } else {
      message = "AssemblyAI anahtarı yok. Ayarlar → Ses bölümünden AssemblyAI key girin.";
    }
  }

  return {
    provider,
    preferred,
    assemblyReady,
    whisperReady,
    ok,
    message,
  };
}

function resolveWhisperApiKey(settings = {}) {
  return String(settings.whisperApiKey || settings.openaiApiKey || "").trim();
}

module.exports = {
  resolveSttReadiness,
  resolveWhisperApiKey,
};
