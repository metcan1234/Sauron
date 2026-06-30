import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"

interface ActiveChannelMarker {
	channel?: "workspace" | "gamedev" | string
	label?: string
	engineLabel?: string
	openedAt?: string
	welcomeFile?: string
}

const CHANNEL_UI = {
	workspace: {
		text: "$(code) ⌘ ÇALIŞMA KISMI",
		tooltip: "Sauron Çalışma Kısmı — turuncu çubuk · Cline + Bridge handoff",
		welcomeFile: "CHANNEL-WORKSPACE.md",
	},
	gamedev: {
		text: "$(game) 🎮 GAME DEV",
		tooltip: "Sauron Game Dev — mor çubuk · gamedev MCP + pipeline",
		welcomeFile: "CHANNEL-GAMEDEV.md",
	},
} as const

function readActiveChannelMarker(workspaceRoot: string): ActiveChannelMarker | null {
	const markerPath = path.join(workspaceRoot, ".sauron", "active-channel.json")
	try {
		return JSON.parse(fs.readFileSync(markerPath, "utf8")) as ActiveChannelMarker
	} catch {
		return null
	}
}

function resolveChannel(marker: ActiveChannelMarker | null): keyof typeof CHANNEL_UI | null {
	if (marker?.channel === "workspace" || marker?.channel === "gamedev") {
		return marker.channel
	}
	return null
}

export function registerChannelIndicator(context: vscode.ExtensionContext): void {
	const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 200)
	statusItem.command = "sauron.showChannelGuide"
	context.subscriptions.push(statusItem)

	const update = (workspaceRoot?: string) => {
		const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		if (!root) {
			statusItem.hide()
			return
		}
		const marker = readActiveChannelMarker(root)
		const channel = resolveChannel(marker)
		if (!channel) {
			statusItem.hide()
			return
		}
		const ui = CHANNEL_UI[channel]
		const engine = marker?.engineLabel ? ` · ${marker.engineLabel}` : ""
		statusItem.text = `${ui.text}${engine}`
		statusItem.tooltip = `${ui.tooltip}\n\nKarıştırdıysan: turuncu = Çalışma, mor = Game Dev.`
		statusItem.show()
	}

	const watchRoots = () => {
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			const pattern = new vscode.RelativePattern(folder, ".sauron/active-channel.json")
			const watcher = vscode.workspace.createFileSystemWatcher(pattern)
			const refresh = () => update(folder.uri.fsPath)
			watcher.onDidCreate(refresh)
			watcher.onDidChange(refresh)
			watcher.onDidDelete(refresh)
			context.subscriptions.push(watcher)
		}
	}

	context.subscriptions.push(
		vscode.commands.registerCommand("sauron.showChannelGuide", async () => {
			const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			const marker = root ? readActiveChannelMarker(root) : null
			const channel = resolveChannel(marker)
			const choice = await vscode.window.showInformationMessage(
				channel === "gamedev"
					? "Şu an GAME DEV modundasın (mor çubuk). Genel kod için Sauron panelinde ⌘ Çalışma Kısmı'nı kullan."
					: channel === "workspace"
						? "Şu an ÇALIŞMA KISMI modundasın (turuncu çubuk). Oyun için Sauron panelinde 🎮 Game Dev'i kullan."
						: "Aktif Sauron kanalı bulunamadı. Panelden ⌘ veya 🎮 ile aç.",
				"Kanal dosyasını aç",
				"Tamam",
			)
			if (choice === "Kanal dosyasını aç" && root && channel) {
				const welcomePath = path.join(
					root,
					".sauron",
					CHANNEL_UI[channel].welcomeFile,
				)
				if (fs.existsSync(welcomePath)) {
					const doc = await vscode.workspace.openTextDocument(welcomePath)
					await vscode.window.showTextDocument(doc, { preview: false })
				}
			}
		}),
	)

	watchRoots()
	update()
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			update()
		}),
	)
}
