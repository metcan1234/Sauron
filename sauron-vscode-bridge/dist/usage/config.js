"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FINOPS_CONFIG = void 0;
exports.getFinOpsConfigPath = getFinOpsConfigPath;
exports.readFinOpsConfig = readFinOpsConfig;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../cost-optimizer/config");
const discovery_1 = require("../handoff/discovery");
exports.DEFAULT_FINOPS_CONFIG = {
    enabled: true,
    finopsUsdToTl: 34.5,
    pollIntervalMs: 5000,
    emitMode: "task-complete",
    trackingOnly: true,
    restrictModels: false,
    costOptimizer: (0, config_1.mergeCostOptimizerConfig)(undefined),
};
function getFinOpsConfigPath(workspaceRoot) {
    return path_1.default.join((0, discovery_1.getSauronDir)(workspaceRoot), "finops-config.json");
}
async function readFinOpsConfig(workspaceRoot) {
    const configPath = getFinOpsConfigPath(workspaceRoot);
    try {
        const raw = await promises_1.default.readFile(configPath, "utf8");
        const parsed = JSON.parse(raw);
        return {
            enabled: parsed.enabled !== false,
            finopsUsdToTl: Number.isFinite(Number(parsed.finopsUsdToTl))
                ? Number(parsed.finopsUsdToTl)
                : exports.DEFAULT_FINOPS_CONFIG.finopsUsdToTl,
            pollIntervalMs: Number.isFinite(Number(parsed.pollIntervalMs))
                ? Math.max(1000, Number(parsed.pollIntervalMs))
                : exports.DEFAULT_FINOPS_CONFIG.pollIntervalMs,
            emitMode: parsed.emitMode === "per-request" ? "per-request" : "task-complete",
            trackingOnly: parsed.trackingOnly !== false,
            restrictModels: parsed.restrictModels === true,
            costOptimizer: (0, config_1.mergeCostOptimizerConfig)(parsed.costOptimizer),
        };
    }
    catch {
        return { ...exports.DEFAULT_FINOPS_CONFIG, costOptimizer: (0, config_1.mergeCostOptimizerConfig)(undefined) };
    }
}
//# sourceMappingURL=config.js.map