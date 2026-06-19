export interface SauronHandoff {
	version?: number
	id?: string
	source?: string
	workspacePath?: string
	taskSummary?: string
	goal?: string
	sessionId?: string
	createdAt?: string
	autoStart?: boolean
	complexityHint?: "low" | "medium" | "high"
	costContext?: {
		coreModelTier?: string
		optimizerEnabled?: boolean
		mode?: string
	}
}

export interface PendingHandoffFile {
	fileName: string
	fullPath: string
	createdAt: string
}

export type HandoffUserChoice = "startReplace" | "reject"

export type HandoffAction = "startNewTask" | "addToInput" | "reject" | "waitForUser" | "noop"
