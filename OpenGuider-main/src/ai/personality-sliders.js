const DEFAULT_PERSONALITY_SLIDERS = {
  responseLength: 50,
  warmth: 70,
  flirtiness: 50,
  emoji: 30,
};

function normalizePersonalitySliders(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    responseLength: clampSlider(source.responseLength, DEFAULT_PERSONALITY_SLIDERS.responseLength),
    warmth: clampSlider(source.warmth, DEFAULT_PERSONALITY_SLIDERS.warmth),
    flirtiness: clampSlider(source.flirtiness, DEFAULT_PERSONALITY_SLIDERS.flirtiness),
    emoji: clampSlider(source.emoji, DEFAULT_PERSONALITY_SLIDERS.emoji),
  };
}

function clampSlider(value, fallback = 50) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(num)));
}

function describeSlider(value, lowLabel, highLabel) {
  if (value <= 33) return lowLabel;
  if (value >= 67) return highLabel;
  return "balanced";
}

function buildSliderBlock(settings = {}, personaId = "luna") {
  const sliders = normalizePersonalitySliders(settings.personalitySliders);
  const lines = [
    "# KİŞİLİK AYARLARI (kullanıcı tercihi)",
    "",
    `- Yanıt uzunluğu: ${describeSlider(sliders.responseLength, "very concise (1-2 sentences when enough)", "detailed and expressive when helpful")}.`,
    `- Sıcaklık: ${describeSlider(sliders.warmth, "cooler and calmer tone", "very warm and affectionate tone")}.`,
  ];

  if (personaId === "luna") {
    lines.push(`- Flört seviyesi: ${describeSlider(sliders.flirtiness, "light romantic hints only", "openly flirty when natural")}.`);
    lines.push("- Luna persona rules override sliders: never use pet names or *actions* in every message even if flirtiness is high.");
  } else {
    lines.push("- Hiri: dobra abla asistan tonu; warmth slider samimiyeti ayarlar, flirtiness geçersiz (romantik dil yok).");
    lines.push("- Her konuda yardım et (kod, proje, günlük); sahte motivasyon kullanma.");
  }

  lines.push(`- Emoji: ${describeSlider(sliders.emoji, "avoid emojis unless user uses them", "use emojis naturally when fitting")}.`);

  return lines.join("\n");
}

function buildFeedbackBlock(notes) {
  const normalized = Array.isArray(notes)
    ? notes.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (normalized.length === 0) {
    return "";
  }
  return [
    "# Kullanıcı geri bildirim tercihleri",
    ...normalized.map((entry) => `- ${entry}`),
  ].join("\n");
}

module.exports = {
  DEFAULT_PERSONALITY_SLIDERS,
  normalizePersonalitySliders,
  buildSliderBlock,
  buildFeedbackBlock,
};
