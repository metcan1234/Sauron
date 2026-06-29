import fs from "fs/promises"
import path from "path"
import { mergeCostOptimizerConfig } from "../cost-optimizer/config"
import { getSauronDir } from "../handoff/discovery"
import type { FinOpsConfig } from "./types"

export const DEFAULT_FINOPS_CONFIG: FinOpsConfig = {
	enabled: true,
	finopsUsdToTl: 34.5,
	pollIntervalMs: 5000,
	emitMode: "task-complete",
	trackingOnly: true,
	restrictModels: false,
	costOptimizer: mergeCostOptimizerConfig(undefined),
}

export function getFinOpsConfigPath(workspaceRoot: string): string {
	return path.join(getSauronDir(workspaceRoot), "finops-config.json")
}

export async function readFinOpsConfig(workspaceRoot: string): Promise<FinOpsConfig> {
	const configPath = getFinOpsConfigPath(workspaceRoot)
	try {
		const raw = await fs.readFile(configPath, "utf8")
		const parsed = JSON.parse(raw) as Partial<FinOpsConfig>
		return {
			enabled: parsed.enabled !== false,
			finopsUsdToTl: Number.isFinite(Number(parsed.finopsUsdToTl))
				? Number(parsed.finopsUsdToTl)
				: DEFAULT_FINOPS_CONFIG.finopsUsdToTl,
			pollIntervalMs: Number.isFinite(Number(parsed.pollIntervalMs))
				? Math.max(1000, Number(parsed.pollIntervalMs))
				: DEFAULT_FINOPS_CONFIG.pollIntervalMs,
			emitMode: parsed.emitMode === "per-request" ? "per-request" : "task-complete",
			trackingOnly: parsed.trackingOnly !== false,
			restrictModels: parsed.restrictModels === true,
			costOptimizer: mergeCostOptimizerConfig(parsed.costOptimizer),
		}
	} catch {
		return { ...DEFAULT_FINOPS_CONFIG, costOptimizer: mergeCostOptimizerConfig(undefined) }
	}
}
