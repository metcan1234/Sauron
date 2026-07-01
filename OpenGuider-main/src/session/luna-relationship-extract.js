const { applyRelationshipExtraction } = require("./luna-relationship");

const EXTRACTION_PROMPT = `Bu sohbet turundan Luna-Can ilişkisi için kalıcı bilgi çıkar.
Yalnızca aşağıdaki JSON formatında cevap ver (başka metin yok):
{"aboutUser":["..."],"aboutUs":["..."],"lunaSelfNotes":["..."]}

Kurallar:
- aboutUser: Can'ın tercihi, alışkanlığı, ruh hali, iş/hobi (max 2 madde)
- aboutUs: birlikte yaşanan an, inside joke, ortak plan (max 1 madde)
- lunaSelfNotes: Luna'nın tutarlı "kendi günü" notu (max 1, kısa)
- Geçici görev detayı veya kod snippet ekleme
- Değer yoksa boş dizi kullan: {"aboutUser":[],"aboutUs":[],"lunaSelfNotes":[]}`;

function parseRelationshipExtraction(rawText = "") {
  const text = String(rawText || "").trim();
  if (!text) {
    return { aboutUser: [], aboutUs: [], lunaSelfNotes: [] };
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { aboutUser: [], aboutUs: [], lunaSelfNotes: [] };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      aboutUser: Array.isArray(parsed.aboutUser) ? parsed.aboutUser : [],
      aboutUs: Array.isArray(parsed.aboutUs) ? parsed.aboutUs : [],
      lunaSelfNotes: Array.isArray(parsed.lunaSelfNotes) ? parsed.lunaSelfNotes : [],
    };
  } catch {
    return { aboutUser: [], aboutUs: [], lunaSelfNotes: [] };
  }
}

function hasExtractionContent(extraction = {}) {
  return ["aboutUser", "aboutUs", "lunaSelfNotes"].some(
    (key) => Array.isArray(extraction[key]) && extraction[key].length > 0,
  );
}

async function extractLunaRelationshipFromTurn({
  userText,
  assistantText,
  streamAIResponse,
  settings,
  signal,
}) {
  const user = String(userText || "").trim();
  const assistant = String(assistantText || "").trim();
  if (!user || !assistant || user.length < 6) {
    return { aboutUser: [], aboutUs: [], lunaSelfNotes: [] };
  }

  const transcript = `Can: ${user.slice(0, 1400)}\nLuna: ${assistant.slice(0, 1400)}`;
  const response = await streamAIResponse({
    text: `${EXTRACTION_PROMPT}\n\n${transcript}`,
    images: [],
    history: [],
    settings,
    signal,
    sessionId: "luna-relationship",
    operation: "luna-relationship-extract",
  });

  return parseRelationshipExtraction(response);
}

function mergeExtractionIntoProfile(profile, extraction) {
  return applyRelationshipExtraction(profile, extraction);
}

module.exports = {
  EXTRACTION_PROMPT,
  parseRelationshipExtraction,
  hasExtractionContent,
  extractLunaRelationshipFromTurn,
  mergeExtractionIntoProfile,
};
