const { streamAIResponse } = require("../ai");
const { debugLog } = require("../utils/debug-logger");

function log(msg) {
  debugLog("Context-Analyzer", msg);
}

async function analyzeContext(userPrompt, preContext, settings) {
  log("Starting real-time context distillation...");
  
  let rawContextStr = "";
  
  // 1. Window Info
  if (preContext.windowInfo) {
    rawContextStr += "[OPEN WINDOWS]\n";
    if (preContext.windowInfo.focusedWindow) {
      const fw = preContext.windowInfo.focusedWindow;
      rawContextStr += `Focused window: "${fw.title}" (Class: ${fw.className}, PID: ${fw.pid})\n`;
    }
    const visible = preContext.windowInfo.windows || [];
    rawContextStr += `Other Visible Windows (${visible.length}):\n`;
    rawContextStr += visible.map((w) => `- "${w.title}"`).join("\n") + "\n\n";
    
    if (preContext.windowInfo.cursorPosition) {
      rawContextStr += `Cursor Position: (${preContext.windowInfo.cursorPosition.x}, ${preContext.windowInfo.cursorPosition.y})\n\n`;
    }
  }

  // 2. Extracted Elements (from UIA or OCR matches)
  if (preContext.matchedElements && preContext.matchedElements.length > 0) {
    rawContextStr += "[RELEVANT UI AUTOMATION ELEMENTS]\n";
    preContext.matchedElements.slice(0, 50).forEach((el) => {
      const x = el.bbox?.x0 || el.rect?.x || 0;
      const y = el.bbox?.y0 || el.rect?.y || 0;
      rawContextStr += `- [${el.type || el.controlType || "Element"}] "${el.text || el.name}" at approx (${Math.round(x)}, ${Math.round(y)})\n`;
    });
    rawContextStr += "\n";
  }

  // 3. Raw OCR (Fallback / Broad Context)
  if (preContext.ocrResult && preContext.ocrResult.words) {
    rawContextStr += "[OCR TEXT ON SCREEN]\n";
    // Send all text as a continuous string to save tokens, limit to ~1000 words
    const allWords = preContext.ocrResult.words.map((w) => w.text).slice(0, 1000).join(" ");
    rawContextStr += allWords + "\n\n";
  }

  if (!rawContextStr.trim()) {
    log("No extra context available to distill.");
    return "No screen context available.";
  }

  const systemPrompt = `You are a Context Distiller for an AI system.
The user is asking: "${userPrompt || 'Examine the screen'}"

Below is raw text data extracted from their desktop (OCR words, open pencereler, UI elements).
Your job is to read this raw text data and write a short summary extracting ONLY facts relevant to the user's request.

CRITICAL RULES:
1. Do NOT use conversational filler like "Based on the raw data" or "I can see". Start directly with the facts (e.g., "Open windows: A, B. Relevant elements: ...").
2. DO NOT DRAW NEGATIVE CONCLUSIONS. Never say "there is no spatial coordinate information", "cannot determine", or "not enough relevant information". If you can't find something in the text, DO NOT MENTION IT. Just summarize what IS there. The main vision system will find the rest using the actual image.
3. Keep it brief. Do not output JSON or lists.
`;

  const analyzerSettings = {
    ...settings,
    systemPromptOverride: systemPrompt,
  };

  let summary = "";
  try {
    const textResp = await streamAIResponse({
      text: `Raw Screen Data:\n\n${rawContextStr}`,
      images: [], // Text-only for speed and cost
      history: [],
      settings: analyzerSettings,
      onChunk: () => {}, // discard stream chunks for now, we just wait for final
      signal: new AbortController().signal, // or pass through
      operation: "context-analyzer",
    });
    summary = textResp.trim();
    log(`Distillation complete. Summary length: ${summary.length} chars`);
    log(`Distilled Summary:\n${summary}`);
  } catch (e) {
    log(`Distillation failed: ${e.message}`);
    summary = "Failed to distill context due to API error. Rely on the image provided.";
  }

  return summary;
}

module.exports = { analyzeContext };
