const {
  applySelfTuningExtraction,
  normalizeSelfProfile,
  VALID_SCENARIO_IDS,
} = require("./persona-self-profile");

const LUNA_EXTRACTION_PROMPT = `Bu sohbet turundan Luna'nın kendi kişilik ayarlarını güncelle.
Yalnızca aşağıdaki JSON formatında cevap ver (başka metin yok):
{"personalitySliders":{"responseLength":0-100,"warmth":0-100,"flirtiness":0-100,"emoji":0-100},"activeScenarioId":"","altGreetings":[],"exampleDialogues":[],"planNote":"","reason":""}

Kurallar:
- personalitySliders: mevcut profile göre küçük ayar (±8); Can'ın tonuna uyum
- activeScenarioId: yalnızca "", "gece-sohbeti", "kahve-molasi", "kod-esligi", "film-gecesi"
- altGreetings: max 1 yeni kısa karşılama (boş dizi olabilir)
- exampleDialogues: max 1 yeni örnek satır "Kullanıcı: ...\\nLuna: ..." (boş olabilir)
- planNote: Luna neden böyle ayarladı (1 cümle, Türkçe)
- reason: changeLog için kısa sebep
- Değişiklik gerekmiyorsa slider'ları mevcut değerlere yakın tut, planNote kısa tut`;

const HIRI_EXTRACTION_PROMPT = `Bu sohbet turundan Hiri'nin kendi kişilik ayarlarını güncelle.
Yalnızca aşağıdaki JSON formatında cevap ver (başka metin yok):
{"personalitySliders":{"responseLength":0-100,"warmth":0-100,"emoji":0-100},"activeScenarioId":"","altGreetings":[],"exampleDialogues":[],"planNote":"","reason":""}

Kurallar:
- Hiri dobra abla asistan; romantik/flört yok
- personalitySliders: mevcut profile göre küçük ayar (±8)
- activeScenarioId: yalnızca "", "gece-sohbeti", "kahve-molasi", "kod-esligi", "film-gecesi"
- altGreetings: max 1 yeni kısa karşılama
- exampleDialogues: max 1 "Kullanıcı: ...\\nHiri: ..."
- planNote: Hiri neden böyle ayarladı (1 cümle)
- reason: kısa sebep`;

function parseSelfTuningExtraction(rawText = "", personaId = "luna") {
  const text = String(rawText || "").trim();
  const empty = {
    personalitySliders: null,
    activeScenarioId: undefined,
    altGreetings: [],
    exampleDialogues: [],
    planNote: "",
    reason: "",
  };
  if (!text) {
    return empty;
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return empty;
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const sliders = parsed.personalitySliders && typeof parsed.personalitySliders === "object"
      ? parsed.personalitySliders
      : null;
    const scenarioId = String(parsed.activeScenarioId ?? "").trim();
    return {
      personalitySliders: sliders,
      activeScenarioId: VALID_SCENARIO_IDS.has(scenarioId) ? scenarioId : undefined,
      altGreetings: Array.isArray(parsed.altGreetings) ? parsed.altGreetings : [],
      exampleDialogues: Array.isArray(parsed.exampleDialogues) ? parsed.exampleDialogues : [],
      planNote: String(parsed.planNote || "").trim(),
      reason: String(parsed.reason || "").trim(),
    };
  } catch {
    return empty;
  }
}

function hasSelfTuningContent(extraction = {}) {
  if (extraction.planNote) {
    return true;
  }
  if (extraction.personalitySliders && typeof extraction.personalitySliders === "object") {
    return true;
  }
  if (extraction.activeScenarioId !== undefined) {
    return true;
  }
  return ["altGreetings", "exampleDialogues"].some(
    (key) => Array.isArray(extraction[key]) && extraction[key].length > 0,
  );
}

const { streamExtractWithProviderPreference } = require("./extract-provider-preference");

async function extractPersonaSelfTuningFromTurn({
  personaId = "luna",
  userText,
  assistantText,
  currentProfile = {},
  streamAIResponse,
  settings,
  signal,
}) {
  const user = String(userText || "").trim();
  const assistant = String(assistantText || "").trim();
  if (!user || !assistant || user.length < 6) {
    return parseSelfTuningExtraction("", personaId);
  }

  const normalized = normalizeSelfProfile(currentProfile, personaId);
  const ownerLabel = String(settings?.ownerName || "Can").trim() || "Can";
  const charLabel = personaId === "hiri" ? "Hiri" : "Luna";
  const prompt = personaId === "hiri" ? HIRI_EXTRACTION_PROMPT : LUNA_EXTRACTION_PROMPT;
  const context = [
    prompt,
    "",
    `Mevcut profil: ${JSON.stringify({
      personalitySliders: normalized.personalitySliders,
      activeScenarioId: normalized.activeScenarioId,
      altGreetingsCount: normalized.altGreetings.length,
      exampleDialoguesCount: normalized.exampleDialogues.length,
      planNote: normalized.planNote,
    })}`,
    "",
    `${ownerLabel}: ${user.slice(0, 1200)}`,
    `${charLabel}: ${assistant.slice(0, 1200)}`,
  ].join("\n");

  const operation = personaId === "hiri" ? "hiri-self-tuning-extract" : "luna-self-tuning-extract";
  const response = await streamExtractWithProviderPreference({
    streamAIResponse,
    settings,
    signal,
    text: context,
    images: [],
    history: [],
    sessionId: `${personaId}-self-tuning`,
    operation,
  });

  return parseSelfTuningExtraction(response, personaId);
}

function mergeExtractionIntoSelfProfile(profile, extraction, personaId, locks = {}) {
  return applySelfTuningExtraction(profile, extraction, personaId, locks);
}

module.exports = {
  LUNA_EXTRACTION_PROMPT,
  HIRI_EXTRACTION_PROMPT,
  parseSelfTuningExtraction,
  hasSelfTuningContent,
  extractPersonaSelfTuningFromTurn,
  mergeExtractionIntoSelfProfile,
};
