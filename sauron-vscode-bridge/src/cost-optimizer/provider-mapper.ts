export interface ClineModelTarget {
	providerId: string
	modelId: string
}

const PROVIDER_MODEL_FIELDS: Record<string, "api" | "openai" | "ollama"> = {
	gemini: "api",
	deepseek: "api",
	openai: "openai",
	ollama: "ollama",
	openrouter: "api",
	groq: "api",
	anthropic: "api",
}

export function mapAgentToClineModel(providerId: string, modelId: string): ClineModelTarget {
	const normalizedProvider = String(providerId || "").trim().toLowerCase()
	const normalizedModel = String(modelId || "").trim()
	if (!normalizedProvider || !normalizedModel) {
		throw new Error("providerId and modelId are required")
	}
	return { providerId: normalizedProvider, modelId: normalizedModel }
}

export function resolveClineModelField(providerId: string): "api" | "openai" | "ollama" {
	return PROVIDER_MODEL_FIELDS[String(providerId || "").trim().toLowerCase()] || "api"
}

export function normalizeBridgeProviderId(providerId: string): string {
	const key = String(providerId || "").trim().toLowerCase()
	if (key === "google") {
		return "gemini"
	}
	return key
}
