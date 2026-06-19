export interface ActiveTaskMetrics {
	taskId: string
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	costUsd: number
	modelId: string
	providerId?: string
}

export interface ActiveModelSelection {
	providerId: string
	modelId: string
}

export interface TaskState {
	active: boolean
	taskId?: string
	startedAt?: string
}

export interface ClineAPI {
	/**
	 * Starts a new task with an optional initial message and images.
	 * @param task Optional initial task message.
	 * @param images Optional array of image data URIs (e.g., "data:image/webp;base64,...").
	 */
	startNewTask(task?: string, images?: string[]): Promise<void>

	/**
	 * Sends a message to the current task.
	 * @param message Optional message to send.
	 * @param images Optional array of image data URIs (e.g., "data:image/webp;base64,...").
	 */
	sendMessage(message?: string, images?: string[]): Promise<void>

	/**
	 * Simulates pressing the primary button in the chat interface.
	 */
	pressPrimaryButton(): Promise<void>

	/**
	 * Returns true when Cline currently has an in-memory active task.
	 */
	hasActiveTask(): boolean

	/**
	 * Prefills the chat input without starting a new task.
	 */
	addToInput(text: string): Promise<void>

	/**
	 * Simulates pressing the secondary button in the chat interface.
	 */
	pressSecondaryButton(): Promise<void>

	/**
	 * Returns cumulative token/cost metrics for the active in-memory task, or null if none.
	 */
	getActiveTaskMetrics(): ActiveTaskMetrics | null

	/**
	 * Returns the current plan-mode provider and model id from Cline API configuration.
	 */
	getPlanModeModel(): ActiveModelSelection

	/**
	 * Switches plan-mode provider/model (exploration / read phase).
	 */
	setPlanModeModel(selection: ActiveModelSelection): Promise<void>

	/**
	 * Returns the current act-mode provider and model id from Cline API configuration.
	 */
	getActiveModel(): ActiveModelSelection

	/**
	 * Switches act-mode provider/model before starting or continuing a task.
	 */
	setActiveModel(selection: ActiveModelSelection): Promise<void>

	/**
	 * Merges provider API keys / Ollama URL into Cline secret storage.
	 */
	syncProviderCredentials(creds: {
		geminiApiKey?: string
		deepSeekApiKey?: string
		openAiApiKey?: string
		ollamaBaseUrl?: string
	}): Promise<{ synced: string[] }>

	/**
	 * Returns active task metadata, or null when no task is running.
	 */
	getTaskState(): TaskState | null

	/**
	 * Clears the active in-memory task without starting a new one.
	 */
	clearTask(): Promise<{ cleared: boolean }>

	/**
	 * Short summary of the most recently completed/cleared task.
	 */
	getLastTaskSummary(): string | null
}
