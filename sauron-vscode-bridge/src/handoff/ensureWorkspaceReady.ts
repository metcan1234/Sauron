import fs from "fs/promises"
import path from "path"
import * as vscode from "vscode"
import { isWorkspaceFolderOpen } from "./workspace-path"

const WORKSPACE_WAIT_MS = 5000
const WORKSPACE_POLL_MS = 250

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForWorkspaceFolder(
	targetPath: string,
	timeoutMs = WORKSPACE_WAIT_MS,
): Promise<boolean> {
	const target = path.resolve(targetPath)
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (isWorkspaceFolderOpen(target, vscode.workspace.workspaceFolders)) {
			return true
		}
		await sleep(WORKSPACE_POLL_MS)
	}
	return isWorkspaceFolderOpen(target, vscode.workspace.workspaceFolders)
}

export interface WorkspaceReadyResult {
	ready: boolean
	opened: boolean
}

/**
 * Ensures VS Code has the Sauron workspace folder open before Cline starts.
 * Avoids Cline falling back to homedir()/Desktop (broken on OneDrive Desktop redirect).
 */
export async function ensureWorkspaceReady(workspaceRoot: string): Promise<WorkspaceReadyResult> {
	const target = path.resolve(String(workspaceRoot || "").trim())
	if (!target) {
		throw new Error("Workspace path is missing from Sauron handoff.")
	}

	try {
		await fs.access(target)
	} catch {
		throw new Error(`Workspace path does not exist: ${target}`)
	}

	if (isWorkspaceFolderOpen(target, vscode.workspace.workspaceFolders)) {
		return { ready: true, opened: false }
	}

	if (await waitForWorkspaceFolder(target)) {
		return { ready: true, opened: false }
	}

	await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(target), false)
	if (await waitForWorkspaceFolder(target, WORKSPACE_WAIT_MS * 2)) {
		return { ready: true, opened: true }
	}
	return { ready: false, opened: true }
}
