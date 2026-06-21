const MAX_CLARIFY_OUTPUT_CHARS = 200;
const MAX_CLARIFY_INPUT_CHARS = 1200;

function extractHandoffClarifySource(snapshot = {}) {
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const lastUser = [...messages].reverse().find((entry) => entry?.role === "user" && entry?.content);
  if (lastUser?.content) {
    return String(lastUser.content).trim();
  }
  if (snapshot.goalIntent) {
    return String(snapshot.goalIntent).trim();
  }
  if (snapshot.activePlan?.goal) {
    return String(snapshot.activePlan.goal).trim();
  }
  if (snapshot.browserExecution?.goal) {
    return String(snapshot.browserExecution.goal).trim();
  }
  return "";
}

async function clarifyHandoffTask({
  rawText,
  settings,
  streamAIResponse,
  signal,
  appLogger,
}) {
  const source = String(rawText || "").trim();
  if (!source || typeof streamAIResponse !== "function") {
    return null;
  }

  const clipped = source.length > MAX_CLARIFY_INPUT_CHARS
    ? `${source.slice(0, MAX_CLARIFY_INPUT_CHARS)}…`
    : source;

  try {
    const response = await streamAIResponse({
      text: [
        "Kullanıcının ham mesajını Cline için net, eyleme dönük 1-2 cümlelik bir görev özetine çevir.",
        "Aynı dili kullan (Türkçe ise Türkçe). Sadece özeti yaz, başka açıklama ekleme.",
        "Maksimum 200 karakter.",
        "",
        `Ham mesaj: ${clipped}`,
      ].join("\n"),
      images: [],
      history: [],
      settings,
      operation: "handoff-task-clarify",
      complexityHint: "low",
      signal,
    });

    const summary = String(response || "").trim().replace(/\s+/g, " ");
    if (!summary) {
      appLogger?.info?.("handoff-task-clarify", { ok: false, reason: "empty_response" });
      return null;
    }

    const trimmed = summary.length > MAX_CLARIFY_OUTPUT_CHARS
      ? `${summary.slice(0, MAX_CLARIFY_OUTPUT_CHARS - 1)}…`
      : summary;

    appLogger?.info?.("handoff-task-clarify", { ok: true, charCount: trimmed.length });
    return trimmed;
  } catch (error) {
    appLogger?.warn?.("handoff-task-clarify", {
      ok: false,
      reason: "error",
      error: error?.message || String(error),
    });
    return null;
  }
}

module.exports = {
  MAX_CLARIFY_OUTPUT_CHARS,
  extractHandoffClarifySource,
  clarifyHandoffTask,
};
