import { afterEach, beforeEach, describe, it } from "mocha"
import * as should from "should"
import * as sinon from "sinon"
import { createClineAPI } from "@/exports"
import { Logger } from "@/shared/services/Logger"
import type { ClineAPI } from "../exports/cline"
import { setVscodeHostProviderMock } from "./host-provider-test-utils"

describe("ClineAPI Core Functionality", () => {
	let api: ClineAPI
	let mockController: any
	let mockLoggerError: sinon.SinonStub
	let sandbox: sinon.SinonSandbox
	let _getGlobalStateStub: sinon.SinonStub

	beforeEach(async () => {
		sandbox = sinon.createSandbox()

		// Stub Logger.error
		mockLoggerError = sandbox.stub(Logger, "error")
		setVscodeHostProviderMock({})

		// Create a mock controller that matches what the real createClineAPI expects
		// We don't import the real Controller to avoid the webview dependencies
		mockController = {
			id: "test-controller-id",
			context: {
				globalState: {
					get: sandbox.stub(),
					update: sandbox.stub(),
					keys: sandbox.stub().returns([]),
					setKeysForSync: sandbox.stub(),
				},
				secrets: {
					get: sandbox.stub(),
					store: sandbox.stub(),
					delete: sandbox.stub(),
					onDidChange: sandbox.stub(),
				},
			},
			stateManager: {
				getApiConfiguration: () => ({
					actModeApiProvider: "anthropic",
					actModeApiModelId: "claude-sonnet-4-5",
				}),
				setApiConfiguration: sandbox.stub(),
				getGlobalSettingsKey: sandbox.stub().returns("act"),
			},
			updateCustomInstructions: sandbox.stub().resolves(),
			clearTask: sandbox.stub().resolves(),
			postStateToWebview: sandbox.stub().resolves(),
			postMessageToWebview: sandbox.stub().resolves(),
			initTask: sandbox.stub().resolves(),
			task: undefined,
		}

		// Create API instance
		api = createClineAPI(mockController)
	})

	afterEach(() => {
		sandbox.restore()
	})

	describe("startNewTask", () => {
		it("should clear existing task and start new one with description", async () => {
			const taskDescription = "Create a test function"
			const images = ["image1.png", "image2.png"]

			await api.startNewTask(taskDescription, images)

			// Verify task clearing sequence
			sinon.assert.called(mockController.clearTask)
			sinon.assert.called(mockController.postStateToWebview)
			sinon.assert.calledWith(mockController.initTask, taskDescription, images)
		})

		it("should handle undefined task description", async () => {
			await api.startNewTask(undefined, [])

			sinon.assert.called(mockController.clearTask)
			sinon.assert.calledWith(mockController.initTask, undefined, [])
		})

		it("should handle task with no images", async () => {
			await api.startNewTask("Task without images")

			sinon.assert.calledWith(mockController.initTask, "Task without images", undefined)
		})
	})

	describe("sendMessage", () => {
		it("should send message to active task", async () => {
			const mockTask = {
				handleWebviewAskResponse: sandbox.stub().resolves(),
			}
			mockController.task = mockTask

			await api.sendMessage("Test message", ["image.png"])

			sinon.assert.calledWith(mockTask.handleWebviewAskResponse, "messageResponse", "Test message", ["image.png"])
		})

		it("should handle no active task gracefully", async () => {
			mockController.task = undefined

			await api.sendMessage("Message to nowhere", [])
		})

		it("should handle empty message", async () => {
			const mockTask = {
				handleWebviewAskResponse: sandbox.stub().resolves(),
			}
			mockController.task = mockTask

			await api.sendMessage("", [])

			sinon.assert.calledWith(mockTask.handleWebviewAskResponse, "messageResponse", "", [])
		})

		it("should handle undefined message", async () => {
			const mockTask = {
				handleWebviewAskResponse: sandbox.stub().resolves(),
			}
			mockController.task = mockTask

			await api.sendMessage(undefined, [])

			sinon.assert.calledWith(mockTask.handleWebviewAskResponse, "messageResponse", "", [])
		})
	})

	describe("Button Press Methods", () => {
		describe("pressPrimaryButton", () => {
			it("should handle primary button press with active task", async () => {
				const mockTask = {
					handleWebviewAskResponse: sandbox.stub().resolves(),
				}
				mockController.task = mockTask

				await api.pressPrimaryButton()

				sinon.assert.calledWith(mockTask.handleWebviewAskResponse, "yesButtonClicked", "", [])
			})

			it("should handle primary button press with no active task", async () => {
				mockController.task = undefined

				await api.pressPrimaryButton()

				sinon.assert.calledWith(mockLoggerError, "No active task to press button for")
			})
		})

		describe("pressSecondaryButton", () => {
			it("should handle secondary button press with active task", async () => {
				const mockTask = {
					handleWebviewAskResponse: sandbox.stub().resolves(),
				}
				mockController.task = mockTask

				await api.pressSecondaryButton()

				sinon.assert.calledWith(mockTask.handleWebviewAskResponse, "noButtonClicked", "", [])
			})

			it("should handle secondary button press with no active task", async () => {
				mockController.task = undefined

				await api.pressSecondaryButton()

				sinon.assert.calledWith(mockLoggerError, "No active task to press button for")
			})
		})
	})

	describe("Error Handling", () => {
		it("should handle errors in task initialization", async () => {
			mockController.initTask.rejects(new Error("Init failed"))

			try {
				await api.startNewTask("test task")
				should.fail("", "", "Should have thrown an error", "")
			} catch (error: any) {
				error.message.should.equal("Init failed")
			}
		})
	})

	describe("getActiveTaskMetrics", () => {
		it("should return null when no active task", () => {
			mockController.task = undefined
			should.equal(api.getActiveTaskMetrics(), null)
		})

		it("should return aggregated metrics for active task", () => {
			mockController.task = {
				taskId: "task-123",
				messageStateHandler: {
					getClineMessages: () => [
						{ type: "say", say: "task", text: "Do something", ts: 1 },
						{
							type: "say",
							say: "api_req_started",
							text: JSON.stringify({
								tokensIn: 100,
								tokensOut: 50,
								cost: 0.12,
							}),
							ts: 2,
						},
					],
					getApiConversationHistory: () => [
						{
							modelInfo: {
								modelId: "claude-sonnet-4-5",
								providerId: "anthropic",
							},
						},
					],
				},
				api: {
					getModel: () => ({ id: "claude-sonnet-4-5" }),
				},
			}

			const metrics = api.getActiveTaskMetrics()
			should.exist(metrics)
			if (!metrics) {
				return
			}
			metrics.taskId.should.equal("task-123")
			metrics.tokensIn.should.equal(100)
			metrics.tokensOut.should.equal(50)
			metrics.costUsd.should.equal(0.12)
			metrics.modelId.should.equal("claude-sonnet-4-5")
			should.exist(metrics.providerId)
			metrics.providerId!.should.equal("anthropic")
		})
	})

	describe("getActiveModel / setActiveModel", () => {
		it("should read act-mode provider/model from api configuration", () => {
			mockController.stateManager.getApiConfiguration = () => ({
				actModeApiProvider: "deepseek",
				actModeApiModelId: "deepseek-chat",
			})

			const model = api.getActiveModel()
			model.providerId.should.equal("deepseek")
			model.modelId.should.equal("deepseek-chat")
		})

		it("should update openai model field via setActiveModel", async () => {
			const setApiConfiguration = sandbox.stub()
			mockController.stateManager = {
				getApiConfiguration: () => ({
					actModeApiProvider: "gemini",
					actModeApiModelId: "gemini-2.0-flash",
				}),
				setApiConfiguration,
				getGlobalSettingsKey: sandbox.stub().returns("act"),
			}

			await api.setActiveModel({ providerId: "openai", modelId: "gpt-4o-mini" })

			sinon.assert.calledOnce(setApiConfiguration)
			const updated = setApiConfiguration.firstCall.args[0]
			updated.actModeApiProvider.should.equal("openai")
			updated.actModeOpenAiModelId.should.equal("gpt-4o-mini")
			sinon.assert.called(mockController.postStateToWebview)
		})
	})

	describe("getTaskState / clearTask / getLastTaskSummary", () => {
		it("should return null task state when no active task", () => {
			mockController.task = undefined
			should.equal(api.getTaskState(), null)
		})

		it("should return active task state", () => {
			mockController.task = { taskId: "task-abc" }
			const state = api.getTaskState()
			should.exist(state)
			state!.active.should.be.true()
			state!.taskId!.should.equal("task-abc")
		})

		it("should clear task and store last summary", async () => {
			mockController.task = {
				taskId: "task-done",
				messageStateHandler: {
					getClineMessages: () => [
						{ say: "text", text: "Implemented feature X successfully." },
					],
				},
			}

			const result = await api.clearTask()
			result.cleared.should.be.true()
			sinon.assert.called(mockController.clearTask)
			api.getLastTaskSummary()!.should.equal("Implemented feature X successfully.")
		})

		it("should return cleared false when no task", async () => {
			mockController.task = undefined
			const result = await api.clearTask()
			result.cleared.should.be.false()
		})
	})
})
