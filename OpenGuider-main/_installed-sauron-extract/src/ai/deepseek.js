const { captureUsageFromStreamEvent } = require("../sauron/finops/token-counter");

function trackStreamUsage(parsed, providerUsageRef) {
  const usage = captureUsageFromStreamEvent(parsed, "openai");
  if (usage) {
    providerUsageRef.current = usage;
  }
}

async function streamDeepSeek({ text, images, history, settings, onChunk, signal, systemPrompt }) {
  const baseUrl = (settings.deepseekBaseUrl || "https://api.deepseek.com").replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;

  const messages = [{ role: "system", content: systemPrompt }];
  for (const entry of history || []) {
    messages.push({ role: entry.role, content: entry.content });
  }

  const userContent = [];
  for (const img of images || []) {
    userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img.base64Jpeg}` } });
    userContent.push({ type: "text", text: `[${img.label}]` });
  }
  userContent.push({ type: "text", text });
  messages.push({ role: "user", content: userContent.length === 1 ? text : userContent });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.deepseekApiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: settings.aiModel || settings.deepseekModelCustom || "deepseek-chat",
      stream: true,
      messages,
    }),
  });

  if (!resp.ok) {
    throw new Error(`DeepSeek error ${resp.status}: ${await resp.text()}`);
  }

  let fullText = "";
  const providerUsageRef = { current: null };
  for await (const line of readSSELines(resp.body)) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      break;
    }
    try {
      const parsed = JSON.parse(data);
      trackStreamUsage(parsed, providerUsageRef);
      const chunk = parsed?.choices?.[0]?.delta?.content || "";
      if (chunk) {
        fullText += chunk;
        onChunk(chunk);
      }
    } catch {
      // ignore malformed chunks
    }
  }

  return { text: fullText, providerUsage: providerUsageRef.current };
}

async function* readSSELines(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      yield line;
    }
  }
  if (buffer.trim()) {
    yield buffer;
  }
}

module.exports = { streamDeepSeek };
