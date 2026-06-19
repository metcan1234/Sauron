import type { ClineAPI } from "./cline"
import type { HandoffAction } from "./handoff/types"

export interface ClineCapabilities {
	canRouteModel: boolean
	canDetectActiveTask: boolean
	canAddToInput: boolean
	canStartTask: boolean
}

export function probeClineCapabilities(cline: ClineAPI): ClineCapabilities {
	return {
		canRouteModel: typeof cline.setActiveModel === "function",
		canDetectActiveTask: typeof cline.hasActiveTask === "function",
		canAddToInput: typeof cline.addToInput === "function",
		canStartTask: typeof cline.startNewTask === "function",
	}
}

export function safeHasActiveTask(cline: ClineAPI): boolean {
	if (typeof cline.hasActiveTask !== "function") {
		return false
	}
	try {
		return Boolean(cline.hasActiveTask())
	} catch {
		return false
	}
}

export async function deliverHandoffPrompt(
	cline: ClineAPI,
	prompt: string,
	action: HandoffAction,
): Promise<"startNewTask" | "addToInput" | "clipboard"> {
	const caps = probeClineCapabilities(cline)

	if (action === "startNewTask" && caps.canStartTask) {
		await cline.startNewTask!(prompt)
		return "startNewTask"
	}

	if (action === "addToInput" && caps.canAddToInput) {
		await cline.addToInput!(prompt)
		return "addToInput"
	}

	if (caps.canStartTask) {
		await cline.startNewTask!(prompt)
		return "startNewTask"
	}

	if (caps.canAddToInput) {
		await cline.addToInput!(prompt)
		return "addToInput"
	}

	return "clipboard"
}
