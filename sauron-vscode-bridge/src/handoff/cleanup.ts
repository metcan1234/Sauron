import fs from "fs/promises"
import path from "path"
import { getSauronDir } from "./discovery"

const ARCHIVE_DIR = "archive"
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export async function cleanupOldHandoffArtifacts(workspaceRoot: string): Promise<number> {
	const sauronDir = getSauronDir(workspaceRoot)
	const archiveDir = path.join(sauronDir, ARCHIVE_DIR)
	let moved = 0

	try {
		await fs.access(sauronDir)
	} catch {
		return 0
	}

	await fs.mkdir(archiveDir, { recursive: true })
	const entries = await fs.readdir(sauronDir, { withFileTypes: true })
	const cutoff = Date.now() - RETENTION_MS

	for (const entry of entries) {
		if (!entry.isFile()) {
			continue
		}
		if (!entry.name.endsWith(".consumed") && !entry.name.endsWith(".rejected")) {
			continue
		}
		const fullPath = path.join(sauronDir, entry.name)
		const stat = await fs.stat(fullPath)
		if (stat.mtimeMs >= cutoff) {
			continue
		}
		const target = path.join(archiveDir, entry.name)
		await fs.rename(fullPath, target)
		moved += 1
	}

	return moved
}
