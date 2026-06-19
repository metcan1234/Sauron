import fs from "fs/promises"
import path from "path"
import { getSauronDir } from "../handoff/discovery"
import type { CostOptimizerConfig } from "../usage/types"

const LOG_FILENAME = "logs.jsonl"

function startOfTodayIso(): string {
	const now = new Date()
	now.setHours(0, 0, 0, 0)
	return now.toISOString()
}

export async function computeDailySpendTl(workspaceRoot: string): Promise<number> {
	const logPath = path.join(getSauronDir(workspaceRoot), "usage", LOG_FILENAME)
	const cutoff = startOfTodayIso()
	let total = 0

	try {
		const raw = await fs.readFile(logPath, "utf8")
		for (const line of raw.split("\n")) {
			const trimmed = line.trim()
			if (!trimmed) {
				continue
			}
			try {
				const record = JSON.parse(trimmed) as { timestamp?: string; costTl?: number }
				if (!record.timestamp || record.timestamp < cutoff) {
					continue
				}
				const costTl = Number(record.costTl)
				if (Number.isFinite(costTl)) {
					total += costTl
				}
			} catch {
				// ignore malformed lines
			}
		}
	} catch {
		return 0
	}

	return total
}

export async function shouldDowngradeOneTier(
	workspaceRoot: string,
	optimizer: CostOptimizerConfig | undefined,
): Promise<boolean> {
	if (!optimizer?.enabled || !optimizer.budgetGovernor?.enabled) {
		return false
	}

	const dailyBudget = Number(optimizer.budgetGovernor.dailyBudgetTl) || 0
	if (dailyBudget <= 0) {
		return false
	}

	const spent = await computeDailySpendTl(workspaceRoot)
	const now = new Date()
	const dayProgress = (now.getHours() * 60 + now.getMinutes()) / (24 * 60)
	const expectedSpend = dailyBudget * Math.max(0.25, dayProgress)

	return spent >= expectedSpend
}

const downgradeAppliedForHandoff = new Set<string>()

export function markDowngradeApplied(handoffId: string): void {
	if (handoffId) {
		downgradeAppliedForHandoff.add(handoffId)
	}
}

export function wasDowngradeApplied(handoffId: string): boolean {
	return Boolean(handoffId && downgradeAppliedForHandoff.has(handoffId))
}

export function resetGovernorStateForTests(): void {
	downgradeAppliedForHandoff.clear()
}

export async function resolveBudgetDowngrade(
	workspaceRoot: string,
	optimizer: CostOptimizerConfig | undefined,
	handoffId?: string,
): Promise<boolean> {
	if (handoffId && wasDowngradeApplied(handoffId)) {
		return false
	}

	const shouldDowngrade = await shouldDowngradeOneTier(workspaceRoot, optimizer)
	if (shouldDowngrade && handoffId) {
		markDowngradeApplied(handoffId)
	}
	return shouldDowngrade
}
