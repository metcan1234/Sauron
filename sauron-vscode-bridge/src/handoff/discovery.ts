import fs from "fs/promises"
import path from "path"
import type { PendingHandoffFile, SauronHandoff } from "./types"

export const HANDOFF_DIR = ".sauron"
export const LEGACY_HANDOFF_FILE = "handoff.json"

export function isTerminalHandoffName(name: string): boolean {
	return name.endsWith(".consumed") || name.endsWith(".rejected")
}

export function isPendingHandoffFileName(name: string): boolean {
	if (isTerminalHandoffName(name)) {
		return false
	}
	if (name === LEGACY_HANDOFF_FILE) {
		return true
	}
	return /^handoff-.+\.json$/i.test(name)
}

export function getSauronDir(workspaceRoot: string): string {
	return path.join(workspaceRoot, HANDOFF_DIR)
}

export async function listPendingHandoffs(workspaceRoot: string): Promise<PendingHandoffFile[]> {
	const sauronDir = getSauronDir(workspaceRoot)
	try {
		await fs.access(sauronDir)
	} catch {
		return []
	}

	const entries = await fs.readdir(sauronDir, { withFileTypes: true })
	const pending: PendingHandoffFile[] = []

	for (const entry of entries) {
		if (!entry.isFile() || !isPendingHandoffFileName(entry.name)) {
			continue
		}
		const fullPath = path.join(sauronDir, entry.name)
		const stat = await fs.stat(fullPath)
		let createdAt = stat.mtime.toISOString()
		try {
			const parsed = JSON.parse(await fs.readFile(fullPath, "utf8")) as SauronHandoff
			if (parsed.createdAt) {
				createdAt = parsed.createdAt
			}
		} catch {
			// keep mtime fallback
		}
		pending.push({ fileName: entry.name, fullPath, createdAt })
	}

	pending.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
	return pending
}

export async function getLatestPendingHandoff(workspaceRoot: string): Promise<PendingHandoffFile | null> {
	const pending = await listPendingHandoffs(workspaceRoot)
	return pending[0] ?? null
}

export async function getNextPendingHandoff(workspaceRoot: string): Promise<PendingHandoffFile | null> {
	const pending = await listPendingHandoffs(workspaceRoot)
	if (pending.length === 0) {
		return null
	}

	const withPhase = await Promise.all(
		pending.map(async (item) => {
			try {
				const parsed = await readHandoffFile(item.fullPath)
				return {
					item,
					pipelinePhase: Number(parsed.pipelinePhase) || 9999,
					createdAt: parsed.createdAt || item.createdAt,
				}
			} catch {
				return { item, pipelinePhase: 9999, createdAt: item.createdAt }
			}
		}),
	)

	withPhase.sort((a, b) => {
		if (a.pipelinePhase !== b.pipelinePhase) {
			return a.pipelinePhase - b.pipelinePhase
		}
		return Date.parse(a.createdAt) - Date.parse(b.createdAt)
	})

	return withPhase[0]?.item ?? null
}

export async function readHandoffFile(fullPath: string): Promise<SauronHandoff> {
	const raw = await fs.readFile(fullPath, "utf8")
	return JSON.parse(raw) as SauronHandoff
}

export async function markHandoffConsumed(fullPath: string): Promise<void> {
	await fs.rename(fullPath, `${fullPath}.consumed`)
}

export async function markHandoffRejected(fullPath: string): Promise<void> {
	await fs.rename(fullPath, `${fullPath}.rejected`)
}
