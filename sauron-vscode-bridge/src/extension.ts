import * as path from "path"
import * as vscode from "vscode"
import type { ClineAPI } from "./cline"
import { cleanupOldHandoffArtifacts } from "./handoff/cleanup"
import {
	getLatestPendingHandoff,
	listPendingHandoffs,
	markHandoffConsumed,
	markHandoffRejected,
	readHandoffFile,
} from "./handoff/discovery"
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
import type { HandoffUserChoice } from "./handoff/types"
import { readFinOpsConfig } from "./usage/config"
import { startCostMonitor } from "./usage/monitor"

const CLINE_EXTENSION_ID = "saoudrizwan.claude-dev"
const CLINE_SIDEBAR_FOCUS = "claude-dev.SidebarProvider.focus"
const DEBOUNCE_MS = 500

let processing = false
const debounceTimers = new Map<string, NodeJS.Timeout>()

export function getClineApi(): ClineAPI | undefined {
	const ext = vscode.extensions.getExtension<ClineAPI>(CLINE_EXTENSION_ID)
	if (!ext?.isActive) {
		return undefined
	}
	return ext.exports
}

async function ensureClineReady(): Promise<ClineAPI | undefined> {
	let ext = vscode.extensions.getExtension<ClineAPI>(CLINE_EXTENSION_ID)
	if (!ext) {
		vscode.window.showErrorMessage("Cline extension is not installed.")
		return undefined
	}
	if (!ext.isActive) {
		await ext.activate()
	}
	return ext.exports
}

async function focusClineSidebar(): Promise<void> {
	await vscode.commands.executeCommand(CLINE_SIDEBAR_FOCUS)
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
	await logCostOptimizerHint(workspaceRoot, handoff, finopsConfig).catch(() => {})
	await applyClineModelBeforeHandoff(cline, handoff, finopsConfig, workspaceRoot).catch(() => {})

	const action = resolveHandoffAction(cline.hasActiveTask(), handoff.autoStart, userChoice)
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
	if (action === "startNewTask") {
		await cline.startNewTask(prompt)
		await markHandoffConsumed(fullPath)
		vscode.window.showInformationMessage("Sauron'dan gelen görev Cline'a yüklendi.")
		return true
	}

	await cline.addToInput(prompt)
	await markHandoffConsumed(fullPath)
	vscode.window.showInformationMessage("Sauron'dan gelen görev giriş alanına eklendi — göndermek için onaylayın.")
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

		const latest = await getLatestPendingHandoff(workspaceRoot)
		if (!latest) {
			return
		}

		await handleIncomingHandoffWithActiveTask(cline, latest.fullPath)
		await cleanupOldHandoffArtifacts(workspaceRoot)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		vscode.window.showErrorMessage(`Sauron handoff okunamadı: ${message}`)
	} finally {
		processing = false
	}
}

function scheduleProcess(workspaceRoot: string): void {
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
