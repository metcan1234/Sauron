"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAgentToClineModel = mapAgentToClineModel;
exports.resolveClineModelField = resolveClineModelField;
exports.normalizeBridgeProviderId = normalizeBridgeProviderId;
const PROVIDER_MODEL_FIELDS = {
    gemini: "api",
    deepseek: "api",
    openai: "openai",
    ollama: "ollama",
    openrouter: "api",
    groq: "api",
    anthropic: "api",
};
function mapAgentToClineModel(providerId, modelId) {
    const normalizedProvider = String(providerId || "").trim().toLowerCase();
    const normalizedModel = String(modelId || "").trim();
    if (!normalizedProvider || !normalizedModel) {
        throw new Error("providerId and modelId are required");
    }
    return { providerId: normalizedProvider, modelId: normalizedModel };
}
function resolveClineModelField(providerId) {
    return PROVIDER_MODEL_FIELDS[String(providerId || "").trim().toLowerCase()] || "api";
}
function normalizeBridgeProviderId(providerId) {
    const key = String(providerId || "").trim().toLowerCase();
    if (key === "google") {
        return "gemini";
    }
    return key;
}
//# sourceMappingURL=provider-mapper.js.map