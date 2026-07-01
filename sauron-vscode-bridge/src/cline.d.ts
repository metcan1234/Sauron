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

export interface ClineAPI {
	startNewTask(task?: string, images?: string[]): Promise<void>
	sendMessage(message?: string, images?: string[]): Promise<void>
	pressPrimaryButton(): Promise<void>
	hasActiveTask(): boolean
	addToInput(text: string): Promise<void>
	pressSecondaryButton(): Promise<void>
	getActiveTaskMetrics?(): ActiveTaskMetrics | null
	getActiveModel?(): ActiveModelSelection
	setActiveModel?(selection: ActiveModelSelection): Promise<void>
	getPlanModeModel?(): ActiveModelSelection
	setPlanModeModel?(selection: ActiveModelSelection): Promise<void>
	syncProviderCredentials?(creds: {
		geminiApiKey?: string
		deepSeekApiKey?: string
		openAiApiKey?: string
		ollamaBaseUrl?: string
	}): Promise<{ synced: string[] }>
	getTaskState?(): { active: boolean; taskId?: string; startedAt?: string } | null
	clearTask?(): Promise<{ cleared: boolean }>
	getLastTaskSummary?(): string | null
	refreshWebviewState?(): Promise<void>
}
