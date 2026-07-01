const MAX_MEMORY_FACTS = 48;

function normalizeFacts(facts) {
  if (!Array.isArray(facts)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const entry of facts) {
    const line = String(entry || "").trim();
    if (!line) {
      continue;
    }
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(line);
  }
  return result.slice(-MAX_MEMORY_FACTS);
}

function parseExtractedFacts(rawText) {
  const text = String(rawText || "").trim();
  if (!text || /^NONE$/i.test(text)) {
    return [];
  }
  return normalizeFacts(
    text
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean),
  );
}

function mergeMemoryFacts(existingFacts, newFacts) {
  return normalizeFacts([...(existingFacts || []), ...(newFacts || [])]);
}

const EXTRACTION_PROMPT = `Extract durable user preferences and personal facts from this chat turn.
Return ONLY bullet lines (Turkish), max 3 facts. If nothing worth remembering, return exactly: NONE
Examples: "Kahve sever", "React projelerinde çalışıyor", "Kısa cevapları tercih ediyor"
Do NOT include transient task details or code snippets.`;

async function extractMemoryFactsFromTurn({
  userText,
  assistantText,
  streamAIResponse,
  settings,
  signal,
}) {
  const user = String(userText || "").trim();
  const assistant = String(assistantText || "").trim();
  if (!user || !assistant || user.length < 8) {
    return [];
  }

  const transcript = `Kullanıcı: ${user.slice(0, 1200)}\nAsistan: ${assistant.slice(0, 1200)}`;
  const response = await streamAIResponse({
    text: `${EXTRACTION_PROMPT}\n\n${transcript}`,
    images: [],
    history: [],
    settings,
    signal,
    sessionId: "auto-memory",
    operation: "auto-memory-extract",
  });

  return parseExtractedFacts(response);
}

module.exports = {
  MAX_MEMORY_FACTS,
  normalizeFacts,
  parseExtractedFacts,
  mergeMemoryFacts,
  extractMemoryFactsFromTurn,
};
