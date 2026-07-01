const { validateFixPlan } = require("./incident-guards");

const DIAGNOSE_PROMPT = `Aşağıdaki Sauron uygulama hatasını sınıflandır.
Yalnızca JSON döndür:
{"component":"workspace|bridge|panel|gamedev|finops","summary":"1 cümle Türkçe","suggestedCode":"UPPER_SNAKE","risk":"low|medium|high"}`;

const PLAN_PROMPT = `Sauron incident için GÜVENLİ onarım planı üret.
Yalnızca JSON döndür:
{"id":"kisa-id","hint":"kullanıcıya Türkçe mesaj","risk":"low|medium|high","allowedActions":[{"action":"run-doctor-check","checkId":"bridge-extension"}]}

İzinli action değerleri:
- run-doctor-check (checkId: vscode-cli|bridge-extension|cline-extension|workspace-path|ai-credentials)
- run-full-doctor
- suggest-install-bridge
- install-bridge
- open-settings-tab (tab: workspace|finops|personality)
- show-incident-hint (message)
- retry-handoff

YASAK: dosya silme, git reset, npm uninstall, kod yazma, store key dışı ayar değiştirme.`;

function parseJsonBlock(text = "") {
  const raw = String(text || "").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function diagnoseIncident({
  error = {},
  context = {},
  settings = {},
  streamAIResponse,
  signal,
}) {
  if (typeof streamAIResponse !== "function") {
    return null;
  }
  const body = [
    DIAGNOSE_PROMPT,
    "",
    `Fingerprint: ${context.fingerprint || ""}`,
    `Operation: ${context.operation || ""}`,
    `Component: ${context.component || ""}`,
    `Error: ${String(error?.message || error).slice(0, 800)}`,
  ].join("\n");

  const response = await streamAIResponse({
    text: body,
    images: [],
    history: [],
    settings,
    signal,
    sessionId: "incident-diagnose",
    operation: "incident-diagnose",
    complexityHint: "low",
  });

  const parsed = parseJsonBlock(response);
  if (!parsed) {
    return null;
  }
  return {
    component: String(parsed.component || context.component || "panel").trim(),
    summary: String(parsed.summary || "").trim(),
    suggestedCode: String(parsed.suggestedCode || context.errorCode || "UNKNOWN_ERROR").trim(),
    risk: ["low", "medium", "high"].includes(parsed.risk) ? parsed.risk : "medium",
  };
}

async function planIncidentFix({
  error = {},
  context = {},
  settings = {},
  streamAIResponse,
  diagnosis = {},
  signal,
}) {
  if (typeof streamAIResponse !== "function") {
    return null;
  }
  const body = [
    PLAN_PROMPT,
    "",
    `Diagnosis: ${JSON.stringify(diagnosis)}`,
    `Fingerprint: ${context.fingerprint || ""}`,
    `Error: ${String(error?.message || error).slice(0, 800)}`,
  ].join("\n");

  const response = await streamAIResponse({
    text: body,
    images: [],
    history: [],
    settings,
    signal,
    sessionId: "incident-plan",
    operation: "incident-plan-fix",
    complexityHint: "low",
  });

  const parsed = parseJsonBlock(response);
  if (!parsed) {
    return null;
  }
  const plan = {
    id: String(parsed.id || "").trim(),
    hint: String(parsed.hint || "").trim(),
    risk: ["low", "medium", "high"].includes(parsed.risk) ? parsed.risk : "medium",
    allowedActions: Array.isArray(parsed.allowedActions) ? parsed.allowedActions : [],
  };
  const validation = validateFixPlan(plan);
  if (!validation.ok) {
    return { ...plan, blocked: true, reason: validation.reason };
  }
  return { ...plan, allowedActions: validation.allowedActions, blocked: false };
}

module.exports = {
  DIAGNOSE_PROMPT,
  PLAN_PROMPT,
  diagnoseIncident,
  planIncidentFix,
  parseJsonBlock,
};
