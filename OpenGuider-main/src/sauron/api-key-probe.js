async function probeProviderKey(provider, settings = {}) {
  const id = String(provider || "").trim().toLowerCase();
  const timeoutMs = 12000;

  if (id === "deepseek") {
    return probeOpenAiCompatible({
      label: "DeepSeek",
      apiKey: settings.deepseekApiKey,
      baseUrl: settings.deepseekBaseUrl || "https://api.deepseek.com",
      model: settings.deepseekModelCustom || "deepseek-chat",
    }, timeoutMs);
  }

  if (id === "openai") {
    return probeOpenAiCompatible({
      label: "OpenAI",
      apiKey: settings.openaiApiKey,
      baseUrl: settings.openaiBaseUrl || "https://api.openai.com/v1",
      model: settings.openaiModelCustom || "gpt-4o-mini",
    }, timeoutMs);
  }

  if (id === "gemini") {
    const key = String(settings.geminiApiKey || "").trim();
    if (!key) {
      return { ok: false, provider: id, error: "API key boş." };
    }
    const baseUrl = String(settings.geminiBaseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    const model = settings.geminiModelCustom || "gemini-2.0-flash";
    const url = `${baseUrl}/models/${model}?key=${encodeURIComponent(key)}`;
    try {
      const resp = await fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
      if (resp.ok) {
        return { ok: true, provider: id, message: "Gemini key geçerli." };
      }
      const body = await resp.text();
      return { ok: false, provider: id, error: parseAuthError(resp.status, body) };
    } catch (error) {
      return { ok: false, provider: id, error: error?.message || "Bağlantı hatası." };
    }
  }

  if (id === "ollama") {
    const baseUrl = String(settings.ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
    try {
      const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!resp.ok) {
        return { ok: false, provider: id, error: `Ollama yanıt vermedi (${resp.status}).` };
      }
      return { ok: true, provider: id, message: "Ollama erişilebilir." };
    } catch (error) {
      return { ok: false, provider: id, error: "Ollama çalışmıyor veya URL yanlış." };
    }
  }

  return { ok: false, provider: id, error: "Bilinmeyen provider." };
}

async function probeOpenAiCompatible({ label, apiKey, baseUrl, model }, timeoutMs) {
  const key = String(apiKey || "").trim();
  if (!key) {
    return { ok: false, provider: label, error: "API key boş." };
  }
  const root = String(baseUrl || "").replace(/\/$/, "");
  const url = root.endsWith("/v1") ? `${root}/chat/completions` : `${root}/v1/chat/completions`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: model || "deepseek-chat",
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    if (resp.ok) {
      return { ok: true, provider: label, message: `${label} key geçerli.` };
    }
    const body = await resp.text();
    return { ok: false, provider: label, error: parseAuthError(resp.status, body) };
  } catch (error) {
    return { ok: false, provider: label, error: error?.message || "Bağlantı hatası." };
  }
}

function parseAuthError(status, body) {
  const text = String(body || "").slice(0, 280);
  if (status === 401) {
    return "401 — API key geçersiz veya iptal edilmiş.";
  }
  if (status === 402) {
    return "402 — Bakiye yetersiz (key geçerli olabilir).";
  }
  if (status === 429) {
    return "429 — Rate limit; key muhtemelen geçerli.";
  }
  return `${status} — ${text || "API hatası"}`;
}

module.exports = {
  probeProviderKey,
};
