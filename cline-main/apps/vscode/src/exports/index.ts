import { Controller } from "@core/controller"
import { buildApiHandler } from "@core/api"
import { sendChatButtonClickedEvent } from "@core/controller/ui/subscribeToChatButtonClicked"
import { sendAddToInputEvent } from "@core/controller/ui/subscribeToAddToInput"
import { Logger } from "@/shared/services/Logger"
import { combineApiRequests } from "@/shared/combineApiRequests"
import { combineCommandSequences } from "@/shared/combineCommandSequences"
import { getApiMetrics } from "@/shared/getApiMetrics"
import type { ApiConfiguration } from "@shared/api"
import { ActiveModelSelection, ClineAPI } from "./cline"

function resolvePlanModeModel(config: ApiConfiguration): ActiveModelSelection {
	const providerId = String(config.planModeApiProvider || config.actModeApiProvider || "")
	if (providerId === "openai") {
		return { providerId, modelId: config.planModeOpenAiModelId || config.actModeOpenAiModelId || "" }
	}
	if (providerId === "ollama") {
		return { providerId, modelId: config.planModeOllamaModelId || config.actModeOllamaModelId || "" }
	}
	return { providerId, modelId: config.planModeApiModelId || config.actModeApiModelId || "" }
}

function applyPlanModeModel(
	config: ApiConfiguration,
	providerId: string,
	modelId: string,
): ApiConfiguration {
	const updated: ApiConfiguration = {
		...config,
		planModeApiProvider: providerId as ApiConfiguration["planModeApiProvider"],
	}
	if (providerId === "openai") {
		updated.planModeOpenAiModelId = modelId
	} else if (providerId === "ollama") {
		updated.planModeOllamaModelId = modelId
	} else {
		updated.planModeApiModelId = modelId
	}
	return updated
}

function resolveActModeModel(config: ApiConfiguration): ActiveModelSelection {
	const providerId = String(config.actModeApiProvider || "")
	if (providerId === "openai") {
		return { providerId, modelId: config.actModeOpenAiModelId || "" }
	}
	if (providerId === "ollama") {
		return { providerId, modelId: config.actModeOllamaModelId || "" }
	}
	return { providerId, modelId: config.actModeApiModelId || "" }
}

function applyActModeModel(
	config: ApiConfiguration,
	providerId: string,
	modelId: string,
): ApiConfiguration {
	const updated: ApiConfiguration = {
		...config,
		actModeApiProvider: providerId as ApiConfiguration["actModeApiProvider"],
	}
	if (providerId === "openai") {
		updated.actModeOpenAiModelId = modelId
	} else if (providerId === "ollama") {
		updated.actModeOllamaModelId = modelId
	} else {
		updated.actModeApiModelId = modelId
	}
	return updated
}

export function createClineAPI(sidebarController: Controller): ClineAPI {
	const api: ClineAPI = {
		startNewTask: async (task?: string, images?: string[]) => {
			await sidebarController.clearTask()
			await sidebarController.postStateToWebview()

			await sendChatButtonClickedEvent()
			await sidebarController.initTask(task, images)
		},

		sendMessage: async (message?: string, images?: string[]) => {
			if (sidebarController.task) {
				await sidebarController.task.handleWebviewAskResponse("messageResponse", message || "", images || [])
			} else {
				Logger.error("No active task to send message to")
			}
		},

		pressPrimaryButton: async () => {
			if (sidebarController.task) {
				await sidebarController.task.handleWebviewAskResponse("yesButtonClicked", "", [])
			} else {
				Logger.error("No active task to press button for")
			}
		},

		hasActiveTask: () => Boolean(sidebarController.task),

		addToInput: async (text: string) => {
			await sendAddToInputEvent(text)
		},

		pressSecondaryButton: async () => {
			if (sidebarController.task) {
				await sidebarController.task.handleWebviewAskResponse("noButtonClicked", "", [])
			} else {
				Logger.error("No active task to press button for")
			}
		},

		getActiveTaskMetrics: () => {
			const task = sidebarController.task
			if (!task) {
				return null
			}

			const messages = task.messageStateHandler.getClineMessages()
			const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(messages.slice(1))))
			const history = task.messageStateHandler.getApiConversationHistory()
			const lastModel = [...history].reverse().find((msg) => msg.modelInfo !== undefined)

			return {
				taskId: task.taskId,
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				costUsd: apiMetrics.totalCost,
				modelId: lastModel?.modelInfo?.modelId ?? task.api.getModel().id,
				providerId: lastModel?.modelInfo?.providerId,
			}
		},

		getPlanModeModel: () => {
			const config = sidebarController.stateManager.getApiConfiguration()
			return resolvePlanModeModel(config)
		},

		getActiveModel: () => {
			const config = sidebarController.stateManager.getApiConfiguration()
			return resolveActModeModel(config)
		},

		setPlanModeModel: async ({ providerId, modelId }: ActiveModelSelection) => {
			const current = sidebarController.stateManager.getApiConfiguration()
			const updated = applyPlanModeModel(current, providerId, modelId)
			sidebarController.stateManager.setApiConfiguration(updated)
			if (sidebarController.task) {
				const currentMode = sidebarController.stateManager.getGlobalSettingsKey("mode")
				if (currentMode === "plan") {
					sidebarController.task.api = buildApiHandler(
						{ ...updated, ulid: sidebarController.task.ulid },
						currentMode,
					)
				}
			}
			await sidebarController.postStateToWebview()
		},

		setActiveModel: async ({ providerId, modelId }: ActiveModelSelection) => {
			const current = sidebarController.stateManager.getApiConfiguration()
			const updated = applyActModeModel(current, providerId, modelId)
			sidebarController.stateManager.setApiConfiguration(updated)
			if (sidebarController.task) {
				const currentMode = sidebarController.stateManager.getGlobalSettingsKey("mode")
				sidebarController.task.api = buildApiHandler(
					{ ...updated, ulid: sidebarController.task.ulid },
					currentMode,
				)
			}
			await sidebarController.postStateToWebview()
		},
	}

	return api
}
