export interface HandoffVerification {
	command: string
	cwd?: string
}

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
	autoChain?: boolean
	complexityHint?: "low" | "medium" | "high"
	projectType?: "corporate-web" | "electron-core" | "bridge-extension" | "monorepo-stack" | "generic"
	pipelineId?: string
	pipelinePhase?: number
	pipelineTotalPhases?: number
	parentHandoffId?: string
	verification?: HandoffVerification
	webBrief?: Record<string, unknown>
	scaffoldPath?: string
	qualityGates?: string[]
	costContext?: {
		coreModelTier?: string
		optimizerEnabled?: boolean
		mode?: string
	}
	relevantFiles?: string[]
	batchScope?: string[]
	cacheBreakpoint?: string
	subHandoff?: {
		delegateTo?: string
		researchSummary?: string
	}
	tokenUltra?: {
		enabled?: boolean
		deltaFrom?: string | null
		repoMapPointer?: string | null
		sceneCachePointer?: string | null
		compressedSummary?: string
		deltaMode?: boolean
		maxHandoffChars?: number
		cacheBreakpoint?: string | null
	}
}

export interface PendingHandoffFile {
	fileName: string
	fullPath: string
	createdAt: string
}

export type HandoffUserChoice = "startReplace" | "reject"

export type HandoffAction = "startNewTask" | "addToInput" | "reject" | "waitForUser" | "noop"
