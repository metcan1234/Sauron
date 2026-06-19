import * as path from "path"
import * as vscode from "vscode"
import type { ClineAPI } from "./cline"
import {
	deliverHandoffPrompt,
	probeClineCapabilities,
	safeHasActiveTask,
} from "./cline-capabilities"
import { cleanupOldHandoffArtifacts } from "./handoff/cleanup"
import {
	getNextPendingHandoff,
	listPendingHandoffs,
	markHandoffConsumed,
	markHandoffRejected,
	readHandoffFile,
} from "./handoff/discovery"
import { setLastConsumedHandoff } from "./handoff/task-complete"
import {
	buildPromptFromHandoffForWorkspace,
	HANDOFF_REJECT_LABEL,
	HANDOFF_REPLACE_LABEL,
	logCostOptimizerHint,
	mapUserSelection,
	resolveHandoffAction,
	resolveWorkspaceRootFromHandoff,
} from "./handoff/handleIncomingHandoff"
import { applyClineModelBeforeHandoff } from "./cost-optimizer/apply"
import { syncCredentialsForWorkspace } from "./credentials/sync"
import type { HandoffUserChoice } from "./handoff/types"
import { readFinOpsConfig } from "./usage/config"
import { startCostMonitor } from "./usage/monitor"

const CLINE_EXTENSION_ID = "saoudrizwan.claude-dev"
const CLINE_SIDEBAR_FOCUS = "claude-dev.SidebarProvider.focus"
const DEBOUNCE_MS = 500
const CLINE_READY_ATTEMPTS = 3
const CLINE_READY_DELAY_MS = 2000

let processing = false
const debounceTimers = new Map<string, NodeJS.Timeout>()

export function getClineApi(): ClineAPI | undefined {
	const ext = vscode.extensions.getExtension<ClineAPI>(CLINE_EXTENSION_ID)
	if (!ext?.isActive) {
		return undefined
	}
	return ext.exports
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function ensureClineReady(): Promise<ClineAPI | undefined> {
	for (let attempt = 1; attempt <= CLINE_READY_ATTEMPTS; attempt += 1) {
		let ext = vscode.extensions.getExtension<ClineAPI>(CLINE_EXTENSION_ID)
		if (!ext) {
			vscode.window.showErrorMessage("Cline extension yüklü değil. Marketplace'ten Cline kurun.")
			return undefined
		}
		if (!ext.isActive) {
			await ext.activate()
		}
		const api = ext.exports
		if (api && (probeClineCapabilities(api).canStartTask || probeClineCapabilities(api).canAddToInput)) {
			return api
		}
		if (attempt < CLINE_READY_ATTEMPTS) {
			await sleep(CLINE_READY_DELAY_MS)
		}
	}

	const ext = vscode.extensions.getExtension<ClineAPI>(CLINE_EXTENSION_ID)
	return ext?.exports
}

async function focusClineSidebar(): Promise<void> {
	try {
		await vscode.commands.executeCommand(CLINE_SIDEBAR_FOCUS)
	} catch {
		// Sidebar command may be unavailable during cold start.
	}
}

async function copyHandoffToClipboard(prompt: string): Promise<void> {
	await vscode.env.clipboard.writeText(prompt)
}

async function promptForActiveTaskChoice(): Promise<HandoffUserChoice | undefined> {
	const selection = await vscode.window.showWarningMessage(
		"Sauron'dan yeni bir görev geldi, ama şu an aktif bir Cline görevi var. Ne yapmak istersiniz?",
		{ modal: true },
		HANDOFF_REPLACE_LABEL,
		HANDOFF_REJECT_LABEL,
	)
	return mapUserSelection(selection)
}

export async function handleIncomingHandoffWithActiveTask(
	cline: ClineAPI,
	fullPath: string,
	userChoice?: HandoffUserChoice,
): Promise<boolean> {
	const handoff = await readHandoffFile(fullPath)
	const workspaceRoot = resolveWorkspaceRootFromHandoff(handoff, fullPath)
	const prompt = await buildPromptFromHandoffForWorkspace(handoff, workspaceRoot)
	if (!prompt) {
		vscode.window.showWarningMessage("Sauron handoff dosyası boş — görev özeti bulunamadı.")
		await markHandoffRejected(fullPath)
		return false
	}

	const finopsConfig = await readFinOpsConfig(workspaceRoot)
	await syncCredentialsForWorkspace(workspaceRoot, cline).catch(() => ({ ok: false, synced: [] }))
	await logCostOptimizerHint(workspaceRoot, handoff, finopsConfig).catch(() => {})
	await applyClineModelBeforeHandoff(cline, handoff, finopsConfig, workspaceRoot).catch(() => {})

	const hasActive = safeHasActiveTask(cline)
	if (hasActive && handoff.autoChain && typeof cline.clearTask === "function") {
		await cline.clearTask()
		vscode.window.showInformationMessage(
			"Önceki Cline görevi tamamlandı — pipeline sonraki faz otomatik yükleniyor.",
		)
	}

	const action = resolveHandoffAction(
		safeHasActiveTask(cline),
		handoff.autoStart,
		userChoice,
		handoff.autoChain,
	)
	if (action === "waitForUser") {
		const choice = await promptForActiveTaskChoice()
		return handleIncomingHandoffWithActiveTask(cline, fullPath, choice)
	}
	if (action === "reject") {
		await markHandoffRejected(fullPath)
		vscode.window.showInformationMessage("Sauron görevi reddedildi — mevcut Cline görevine devam ediliyor.")
		return false
	}
	if (action === "noop") {
		return false
	}

	await focusClineSidebar()

	const delivery = await deliverHandoffPrompt(cline, prompt, action)
	if (delivery === "clipboard") {
		await copyHandoffToClipboard(prompt)
		await markHandoffConsumed(fullPath)
		setLastConsumedHandoff(handoff, fullPath)
		vscode.window.showInformationMessage(
			"Sauron görev özeti panoya kopyalandı. Cline sidebar'ına yapıştırıp gönderin.",
		)
		return true
	}

	await markHandoffConsumed(fullPath)
	setLastConsumedHandoff(handoff, fullPath)
	if (delivery === "startNewTask") {
		vscode.window.showInformationMessage("Sauron'dan gelen görev Cline'a yüklendi.")
	} else {
		vscode.window.showInformationMessage(
			"Sauron görevi Cline giriş alanına eklendi — göndermek için onaylayın.",
		)
	}
	return true
}

async function processWorkspace(workspaceRoot: string): Promise<void> {
	if (processing) {
		return
	}
	processing = true
	try {
		const cline = await ensureClineReady()
		if (!cline) {
			return
		}

		const next = await getNextPendingHandoff(workspaceRoot)
		if (!next) {
			return
		}

		await handleIncomingHandoffWithActiveTask(cline, next.fullPath)
		await cleanupOldHandoffArtifacts(workspaceRoot)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		vscode.window.showErrorMessage(`Sauron handoff okunamadı: ${message}`)
	} finally {
		processing = false
	}
}

export function scheduleProcess(workspaceRoot: string): void {
	const existing = debounceTimers.get(workspaceRoot)
	if (existing) {
		clearTimeout(existing)
	}
	debounceTimers.set(
		workspaceRoot,
		setTimeout(() => {
			debounceTimers.delete(workspaceRoot)
			void processWorkspace(workspaceRoot)
		}, DEBOUNCE_MS),
	)
}

export async function scanAllWorkspaces(context: vscode.ExtensionContext): Promise<void> {
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		await cleanupOldHandoffArtifacts(folder.uri.fsPath)
		const pending = await listPendingHandoffs(folder.uri.fsPath)
		if (pending.length > 0) {
			await focusClineSidebar()
			scheduleProcess(folder.uri.fsPath)
		}
	}

	const watcher = vscode.workspace.createFileSystemWatcher("**/.sauron/handoff*.json")
	const onHandoffEvent = (uri: vscode.Uri) => {
		const workspaceRoot = path.dirname(path.dirname(uri.fsPath))
		scheduleProcess(workspaceRoot)
	}
	watcher.onDidCreate(onHandoffEvent)
	watcher.onDidChange(onHandoffEvent)
	context.subscriptions.push(watcher)

	context.subscriptions.push(
		vscode.window.onDidChangeWindowState((state) => {
			if (!state.focused) {
				return
			}
			for (const folder of vscode.workspace.workspaceFolders ?? []) {
				void listPendingHandoffs(folder.uri.fsPath).then((pending) => {
					if (pending.length > 0) {
						scheduleProcess(folder.uri.fsPath)
					}
				})
			}
		}),
	)
}

export function activate(context: vscode.ExtensionContext): void {
	void scanAllWorkspaces(context)
	startCostMonitor(context, getClineApi)
}

export function deactivate(): void {
	for (const timer of debounceTimers.values()) {
		clearTimeout(timer)
	}
	debounceTimers.clear()
}
