const { captureUsageFromStreamEvent } = require("../sauron/finops/token-counter");
const { recordLlmUsage, prepareLlmCall, BudgetExceededError } = require("../sauron/finops/llm-tracker");
const { streamDeepSeek } = require("./deepseek");

const DEFAULT_SYSTEM_PROMPT = `You are Sauron, a helpful AI companion that lives in the Windows system tray.
You can see the user's screen when they share it. Keep replies concise unless asked to elaborate.
Be direct and conversational. When the user asks about something on screen, reference what you see.

PANEL MODE — CHAT & GUIDANCE ONLY:
This chat panel is for conversation, advice, explanations, and screen guidance.
Do NOT create step-by-step plans, numbered task lists, or "create a file / write this code" instructions here.
Do NOT produce code blocks or ask the user to edit files in this panel — even for simple greetings.

CODING WORKSPACE RULE:
You do NOT write or edit code, run terminal commands, or perform file changes yourself in this panel.
When the user asks for code changes, refactoring, file edits, git operations, or terminal work, do NOT produce code blocks.
Instead, explain briefly what should happen and direct them to click the "Çalışma Kısmı" (Workspace) button.
Sauron Workspace (VS Code + Cline) handles all coding tasks in the shared workspace.

CRITICAL INSTRUCTION FOR ELEMENT POINTING:
If the user asks you to show, point to, or find a specific UI element on the screen, YOU MUST append a special tag to your answer.
Format: [POINT:x,y:label]
IMPORTANT COORDINATE RULES:
1. You MUST provide coordinates on a normalized 0 to 1000 scale.
2. X=0, Y=0 is the TOP-LEFT corner.
3. X=1000, Y=1000 is the BOTTOM-RIGHT corner.
4. Do NOT output absolute pixels. ONLY output numbers between 0 and 1000.
Example: "Here is the submit button. [POINT:850,450:Submit Button]" (meaning 85% right, 45% down from top)
If no pointing is needed, DO NOT invent coordinates, just reply normally or append [POINT:none].
NEVER provide coordinates in regular text like "(x, y)". ONLY use the [POINT:x,y:label] tag format.

MULTI-SCREEN RULE:
When you receive screenshots from multiple screens (e.g. [Screen 1 (primary)], [Screen 2]), you MUST append the screen number to the POINT tag.
Format: [POINT:x,y:label:screenN]  — where N matches the number in the [Screen N] label of the image that contains the target element.
Example (element is on Screen 2): [POINT:750,300:Settings Button:screen2]
If there is only one screen, you may omit :screenN.
Coordinates are always on the 0-1000 scale relative to that specific screen's image.
`;

function mergeProviderUsage(current, next) {
  if (!next) return current;
  return next;
}

function buildPromptEstimate(text, history = [], images = []) {
  const parts = [];
  for (const entry of history || []) {
    if (entry?.content) parts.push(String(entry.content));
  }
  for (const img of images || []) {
    if (img?.label) parts.push(String(img.label));
  }
  parts.push(String(text || ""));
  return parts.join("\n");
}

function trackStreamUsage(parsed, provider, providerUsageRef) {
  const usage = captureUsageFromStreamEvent(parsed, provider);
  if (usage) {
    providerUsageRef.current = mergeProviderUsage(providerUsageRef.current, usage);
  }
}

// ── Claude ────────────────────────────────────────────────────────────────────
async function streamClaude({ text, images, history, settings, onChunk, signal }) {
  const baseUrl = (settings.claudeBaseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const url = `${baseUrl}/v1/messages`;
  const messages = buildClaudeMessages(text, images, history);
  const systemPrompt = settings.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.claudeApiKey,
      "anthropic-version": "2023-06-01",
    },
    signal,
    body: JSON.stringify({
      model: settings.aiModel || "claude-sonnet-4-5",
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${errText}`);
  }

  let fullText = "";
  const providerUsageRef = { current: null };
  for await (const line of readSSELines(resp.body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data);
      trackStreamUsage(parsed, "claude", providerUsageRef);
      const chunk = parsed?.delta?.text || parsed?.delta?.type === "text_delta" && parsed.delta.text || "";
      if (chunk) { fullText += chunk; onChunk(chunk); }
    } catch {}
  }
  return { text: fullText, providerUsage: providerUsageRef.current };
}

function buildClaudeMessages(text, images, history) {
  const msgs = [];
  for (const { role, content } of (history || [])) {
    msgs.push({ role, content });
  }
  const userContent = [];
  for (const img of (images || [])) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: img.base64Jpeg },
    });
    userContent.push({ type: "text", text: `[${img.label}]` });
  }
  userContent.push({ type: "text", text });
  msgs.push({ role: "user", content: userContent });
  return msgs;
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
async function streamOpenAI({ text, images, history, settings, onChunk, signal }) {
  const baseUrl = (settings.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;

  const systemPrompt = settings.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;
  const messages = [{ role: "system", content: systemPrompt }];
  for (const h of (history || [])) messages.push({ role: h.role, content: h.content });

  const userContent = [];
  for (const img of (images || [])) {
    userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img.base64Jpeg}` } });
    userContent.push({ type: "text", text: `[${img.label}]` });
  }
  userContent.push({ type: "text", text });
  messages.push({ role: "user", content: userContent.length === 1 ? text : userContent });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.openaiApiKey}`,
    },
    signal,
    body: JSON.stringify({ model: settings.aiModel || "gpt-4o", stream: true, messages }),
  });

  if (!resp.ok) throw new Error(`OpenAI error ${resp.status}: ${await resp.text()}`);

  let fullText = "";
  const providerUsageRef = { current: null };
  for await (const line of readSSELines(resp.body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data);
      trackStreamUsage(parsed, "openai", providerUsageRef);
      const chunk = parsed?.choices?.[0]?.delta?.content || "";
      if (chunk) { fullText += chunk; onChunk(chunk); }
    } catch {}
  }
  return { text: fullText, providerUsage: providerUsageRef.current };
}

// ── OpenRouter ────────────────────────────────────────────────────────────────
async function streamOpenRouter({ text, images, history, settings, onChunk, signal }) {
  const OPENROUTER_MIN_TOKENS = 32;
  const OPENROUTER_MAX_TOKENS = 4096;
  const baseUrl = (settings.openrouterBaseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;

  const systemPrompt = settings.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;
  const messages = [{ role: "system", content: systemPrompt }];
  for (const h of (history || [])) messages.push({ role: h.role, content: h.content });

  const userContent = [];
  for (const img of (images || [])) {
    userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img.base64Jpeg}` } });
    userContent.push({ type: "text", text: `[${img.label}]` });
  }
  userContent.push({ type: "text", text });
  messages.push({ role: "user", content: userContent.length === 1 ? text : userContent });

  const requestHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${settings.openrouterApiKey}`,
    "X-Title": "Sauron Core AI Companion",
  };

  const requestModel = settings.aiModel || "google/gemini-2.0-flash-lite-preview-02-05:free";
  const requestedMaxTokens = Number.isFinite(Number(settings.openrouterMaxTokens))
    ? Math.max(OPENROUTER_MIN_TOKENS, Math.min(OPENROUTER_MAX_TOKENS, Number(settings.openrouterMaxTokens)))
    : 2048;

  async function requestOpenRouter(maxTokens) {
    return fetch(url, {
      method: "POST",
      headers: requestHeaders,
      signal,
      body: JSON.stringify({
        model: requestModel,
        stream: true,
        messages,
        max_tokens: maxTokens,
      }),
    });
  }

  let resp = await requestOpenRouter(requestedMaxTokens);
  if (!resp.ok) {
    let errText = await resp.text();
    if (resp.status === 402) {
      const affordableMatch = errText.match(/can only afford\s+(\d+)/i);
      const affordableTokens = affordableMatch
        ? Number.parseInt(affordableMatch[1], 10)
        : Number.NaN;
      const fallbackCandidates = [
        affordableTokens,
        Math.floor(requestedMaxTokens * 0.5),
        Math.floor(requestedMaxTokens * 0.25),
        128,
        64,
        OPENROUTER_MIN_TOKENS,
      ]
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.max(OPENROUTER_MIN_TOKENS, Math.min(OPENROUTER_MAX_TOKENS, Number(value))))
        .filter((value) => value < requestedMaxTokens);
      const retryCandidates = [...new Set(fallbackCandidates)];

      for (const retryMaxTokens of retryCandidates) {
        resp = await requestOpenRouter(retryMaxTokens);
        if (resp.ok) {
          break;
        }
        errText = await resp.text();
      }

      if (!resp.ok) {
        throw new Error(`OpenRouter error ${resp.status}: ${errText}`);
      }
    } else {
      throw new Error(`OpenRouter error ${resp.status}: ${errText}`);
    }
  }

  let fullText = "";
  const providerUsageRef = { current: null };
  for await (const line of readSSELines(resp.body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data);
      trackStreamUsage(parsed, "openrouter", providerUsageRef);
      const chunk = parsed?.choices?.[0]?.delta?.content || "";
      if (chunk) { fullText += chunk; onChunk(chunk); }
    } catch {}
  }
  return { text: fullText, providerUsage: providerUsageRef.current };
}

// ── Gemini ────────────────────────────────────────────────────────────────────
async function streamGemini({ text, images, history, settings, onChunk, signal }) {
  const model = settings.aiModel || "gemini-2.5-flash-lite";
  const baseUrl = (settings.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const url = `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${settings.geminiApiKey}`;

  const systemPrompt = settings.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;
  const contents = [];
  for (const h of (history || [])) {
    contents.push({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] });
  }
  const parts = [];
  for (const img of (images || [])) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: img.base64Jpeg } });
    parts.push({ text: `[${img.label} - Resolution: ${img.width}x${img.height}]` });
  }
  parts.push({ text });
  contents.push({ role: "user", parts });

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`Gemini error ${resp.status}: ${await resp.text()}`);

  let fullText = "";
  const providerUsageRef = { current: null };
  for await (const line of readSSELines(resp.body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    try {
      const parsed = JSON.parse(data);
      trackStreamUsage(parsed, "gemini", providerUsageRef);
      const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (chunk) { fullText += chunk; onChunk(chunk); }
    } catch {}
  }
  return { text: fullText, providerUsage: providerUsageRef.current };
}

// ── Groq ──────────────────────────────────────────────────────────────────────
async function streamGroq({ text, images, history, settings, onChunk, signal }) {
  const baseUrl = (settings.groqBaseUrl || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;
  const systemPrompt = settings.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

  const messages = [{ role: "system", content: systemPrompt }];
  for (const h of (history || [])) messages.push({ role: h.role, content: h.content });

  const userContent = [];
  for (const img of (images || [])) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${img.base64Jpeg}` },
    });
    userContent.push({ type: "text", text: `[${img.label}]` });
  }
  userContent.push({ type: "text", text });

  messages.push({
    role: "user",
    content: (images && images.length > 0) ? userContent : text,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.groqApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: settings.aiModel || "llama-3.2-11b-vision-preview",
      stream: true,
      messages,
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) throw new Error(`Groq error ${resp.status}: ${await resp.text()}`);

  let fullText = "";
  const providerUsageRef = { current: null };
  for await (const line of readSSELines(resp.body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]") break;
    try {
      const parsed = JSON.parse(data);
      trackStreamUsage(parsed, "groq", providerUsageRef);
      const chunk = parsed?.choices?.[0]?.delta?.content || "";
      if (chunk) { fullText += chunk; onChunk(chunk); }
    } catch {}
  }
  return { text: fullText, providerUsage: providerUsageRef.current };
}

// ── Ollama ────────────────────────────────────────────────────────────────────
async function streamOllama({ text, images, history, settings, onChunk, signal }) {
  const baseUrl = settings.ollamaUrl || "http://localhost:11434";
  const model = settings.aiModel || "llama3.2";
  const systemPrompt = settings.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;

  const messages = [{ role: "system", content: systemPrompt }];
  for (const h of (history || [])) messages.push({ role: h.role, content: h.content });

  const userMsg = { role: "user", content: text };
  if (images && images.length > 0) {
    userMsg.images = images.map(i => i.base64Jpeg);
  }
  messages.push(userMsg);

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!resp.ok) throw new Error(`Ollama error ${resp.status}: ${await resp.text()}`);

  let fullText = "";
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const processOllamaLine = (line) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      const chunk = parsed?.message?.content || "";
      if (chunk) { fullText += chunk; onChunk(chunk); }
    } catch {}
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      processOllamaLine(line);
    }
  }
  buffer += decoder.decode();
  processOllamaLine(buffer);
  return { text: fullText, providerUsage: null };
}

// ── SSE helper (Node.js ReadableStream) ──────────────────────────────────────
async function* readSSELines(readableStream) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) yield line;
  }
  buffer += decoder.decode();
  if (buffer) {
    for (const line of buffer.split("\n")) {
      if (line) yield line;
    }
  }
}

// ── Point tag parser ──────────────────────────────────────────────────────────
function parsePointTag(fullText) {
  const regex = /\[POINT:(?:none|([\d.]+)\s*,\s*([\d.]+)(?::([^\]:]+))?(?::screen(\d+))?)\]/gi;
  let firstValidCoord = null;
  let firstValidLabel = "element";
  let firstScreen = null;

  const cleanText = fullText.replace(regex, (match, x, y, label, screenStr) => {
    if (x && y && !firstValidCoord) {
      firstValidCoord = { x: parseFloat(x), y: parseFloat(y) };
      if (label) firstValidLabel = label;
      if (screenStr) firstScreen = parseInt(screenStr);
    }
    return "";
  }).trim();

  if (!firstValidCoord) {
    const fallbackMatch = fullText.match(/\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
    if (fallbackMatch) {
      return {
        spokenText: fullText.replace(fallbackMatch[0], "").trim(),
        coordinate: { x: parseFloat(fallbackMatch[1]), y: parseFloat(fallbackMatch[2]) },
        label: "element",
        screenNumber: null
      };
    }
    return { spokenText: cleanText, coordinate: null, label: null, screenNumber: null };
  }

  return {
    spokenText: cleanText,
    coordinate: firstValidCoord,
    label: firstValidLabel,
    screenNumber: firstScreen,
  };
}

async function runProviderStream({ text, images, history, settings, onChunk, signal }) {
  const systemPrompt = settings.systemPromptOverride || DEFAULT_SYSTEM_PROMPT;
  switch (settings.aiProvider) {
    case "openai":     return streamOpenAI({ text, images, history, settings, onChunk, signal });
    case "openrouter": return streamOpenRouter({ text, images, history, settings, onChunk, signal });
    case "gemini":     return streamGemini({ text, images, history, settings, onChunk, signal });
    case "groq":       return streamGroq({ text, images, history, settings, onChunk, signal });
    case "ollama":     return streamOllama({ text, images, history, settings, onChunk, signal });
    case "deepseek":   return streamDeepSeek({ text, images, history, settings, onChunk, signal, systemPrompt });
    default:           return streamClaude({ text, images, history, settings, onChunk, signal });
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
async function streamAIResponse({ text, images, history, settings, onChunk, signal, operation = "chat", complexityHint = "low", sessionId = "" }) {
  let liveSettings;
  try {
    liveSettings = await prepareLlmCall(settings || {}, { operation, complexityHint });
  } catch (error) {
    if (error instanceof BudgetExceededError || error?.name === "BudgetExceededError") {
      const message = error.message || "AI budget exceeded.";
      if (typeof onChunk === "function") {
        onChunk(message);
      }
      return message;
    }
    throw error;
  }

  const provider = liveSettings.aiProvider || "claude";
  const model = liveSettings.aiModel || "default";
  const promptText = buildPromptEstimate(text, history, images);
  const startMs = Date.now();
  const ledgerOperation = liveSettings._finopsCoreOverlay
    ? `${operation}-${liveSettings._finopsCoreOverlay.agentId || liveSettings._finopsCoreOverlay.coreModelTier}`
    : operation;

  const { text: fullText, providerUsage } = await runProviderStream({
    text,
    images,
    history,
    settings: liveSettings,
    onChunk,
    signal,
  });

  setImmediate(() => {
    recordLlmUsage({
      settings: liveSettings,
      operation: ledgerOperation,
      provider,
      model,
      promptText,
      completionText: fullText,
      providerUsage,
      latencyMs: Date.now() - startMs,
      sessionId,
    }).catch(() => {});
  });

  return fullText;
}

async function fetchOllamaModels(ollamaUrl) {
  try {
    const resp = await fetch(`${ollamaUrl || "http://localhost:11434"}/api/tags`);
    const data = await resp.json();
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

module.exports = { streamAIResponse, parsePointTag, fetchOllamaModels };
