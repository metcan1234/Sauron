const { invokeStructuredChain } = require("../llm-client");
const { MicroGuideInstructSchema, parseStructuredJSON } = require("../schemas");

const MICRO_GUIDE_SYSTEM_PROMPT = [
  "You are a desktop screen guidance assistant for Turkish-speaking users.",
  "Give exactly ONE next micro-instruction at a time.",
  "Use short imperative Turkish (e.g. Buraya tıklayın, 'whatsapp' yazın).",
  "If the user should type text, set typeHint with the exact text to type.",
  "Use normalized coordinates 0-1000 for pointer when pointing is needed.",
  "Include [POINT:x,y:label] in chatMessage when shouldPoint is true.",
  "Set isTaskComplete true only when the user's original goal is fully achieved.",
  "Always return valid JSON only.",
].join(" ");

const MICRO_GUIDE_TEMPLATE = `
User goal:
{{goal}}

Previous instruction (if any):
{{lastInstruction}}

Turn: {{turnNumber}} / {{maxTurns}}

Return JSON:
{
  "chatMessage": "short Turkish instruction",
  "pointer": { "x": 500, "y": 500, "label": "target" } or null,
  "shouldPoint": true,
  "isTaskComplete": false,
  "typeHint": null
}
`;

async function instructMicroGuideTurn({
  goal,
  lastInstruction,
  turnNumber,
  maxTurns,
  images,
  settings,
  signal,
}) {
  const result = await invokeStructuredChain({
    settings,
    systemPrompt: MICRO_GUIDE_SYSTEM_PROMPT,
    template: MICRO_GUIDE_TEMPLATE,
    operationName: "guide-micro-instruct",
    input: {
      goal: goal || "",
      lastInstruction: lastInstruction || "Yok (ilk adım)",
      turnNumber: String(turnNumber),
      maxTurns: String(maxTurns),
    },
    images: Array.isArray(images) ? images : [],
    history: [],
    schema: MicroGuideInstructSchema,
    signal,
  });

  let parsed;
  try {
    parsed = result?.value?.chatMessage
      ? result.value
      : parseStructuredJSON(String(result?.rawText || ""), MicroGuideInstructSchema, true);
  } catch (error) {
    const fallback = parseStructuredJSON(String(result?.rawText || ""), MicroGuideInstructSchema, true);
    parsed = fallback;
    if (!parsed?.chatMessage && !parsed?.explanation) {
      throw error;
    }
  }

  return normalizeMicroGuideInstruction(parsed);
}

function normalizeMicroGuideInstruction(parsed) {
  const chatMessage = String(parsed?.chatMessage || parsed?.explanation || "").trim();
  const pointer = parsed?.pointer && typeof parsed.pointer === "object"
    ? {
      x: Number(parsed.pointer.x),
      y: Number(parsed.pointer.y),
      label: String(parsed.pointer.label || "").trim() || null,
    }
    : parsed?.coordinate
      ? {
        x: Number(parsed.coordinate.x),
        y: Number(parsed.coordinate.y),
        label: String(parsed.label || "").trim() || null,
      }
      : null;

  const shouldPoint = Boolean(parsed?.shouldPoint) && pointer
    && Number.isFinite(pointer.x)
    && Number.isFinite(pointer.y);

  let message = chatMessage;
  const typeHint = parsed?.typeHint ? String(parsed.typeHint).trim() : "";
  if (typeHint && !message.toLowerCase().includes(typeHint.toLowerCase())) {
    message = `${message} ${typeHint}`.trim();
  }

  return {
    chatMessage: message || "Bir sonraki adımı tamamlayın.",
    pointer: shouldPoint ? pointer : null,
    shouldPoint,
    isTaskComplete: Boolean(parsed?.isTaskComplete),
    typeHint: typeHint || null,
  };
}

module.exports = {
  instructMicroGuideTurn,
  normalizeMicroGuideInstruction,
};
