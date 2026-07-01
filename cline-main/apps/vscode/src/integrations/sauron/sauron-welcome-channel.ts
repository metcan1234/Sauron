import * as fs from "fs"
import * as path from "path"

export type SauronWelcomeChannel = "workspace" | "gamedev"

export interface SauronWelcomeState {
	sauronWelcomeChannel: SauronWelcomeChannel | null
	sauronWelcomeLabel: string | null
}

const CHANNEL_LABELS: Record<SauronWelcomeChannel, string> = {
	workspace: "ÇALIŞMA KISMI",
	gamedev: "GAME DEV",
}

function readMarker(workspaceRoot: string): { channel?: string } | null {
	const markerPath = path.join(workspaceRoot, ".sauron", "active-channel.json")
	try {
		return JSON.parse(fs.readFileSync(markerPath, "utf8")) as { channel?: string }
	} catch {
		return null
	}
}

export function resolveSauronWelcomeState(workspaceRoots: Array<{ path?: string } | string> = []): SauronWelcomeState {
	for (const entry of workspaceRoots) {
		const root = typeof entry === "string" ? entry : String(entry?.path || "").trim()
		if (!root) {
			continue
		}
		const marker = readMarker(root)
		if (marker?.channel === "workspace" || marker?.channel === "gamedev") {
			return {
				sauronWelcomeChannel: marker.channel,
				sauronWelcomeLabel: CHANNEL_LABELS[marker.channel],
			}
		}
	}
	return {
		sauronWelcomeChannel: null,
		sauronWelcomeLabel: null,
	}
}
