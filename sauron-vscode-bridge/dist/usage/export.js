"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsageLogPath = getUsageLogPath;
exports.buildClineLedgerRecord = buildClineLedgerRecord;
exports.appendUsageRecord = appendUsageRecord;
exports.exportTaskMetricsIfNew = exportTaskMetricsIfNew;
exports.resetWriteChainForTests = resetWriteChainForTests;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const discovery_1 = require("../handoff/discovery");
const LOG_FILENAME = "logs.jsonl";
const EXPORT_STATE_FILENAME = "cline-export-state.json";
let writeChain = Promise.resolve();
function getUsageDir(workspaceRoot) {
    return path_1.default.join((0, discovery_1.getSauronDir)(workspaceRoot), "usage");
}
function getUsageLogPath(workspaceRoot) {
    return path_1.default.join(getUsageDir(workspaceRoot), LOG_FILENAME);
}
function getExportStatePath(workspaceRoot) {
    return path_1.default.join(getUsageDir(workspaceRoot), EXPORT_STATE_FILENAME);
}
async function ensureUsageDir(workspaceRoot) {
    await promises_1.default.mkdir(getUsageDir(workspaceRoot), { recursive: true });
}
function buildClineLedgerRecord(metrics, config) {
    const costUsd = Math.max(0, Number(metrics.costUsd) || 0);
    const costTl = costUsd * config.finopsUsdToTl;
    return {
        provider: metrics.providerId || "cline",
        model: metrics.modelId || "unknown",
        promptTokens: Math.max(0, Number(metrics.tokensIn) || 0),
        completionTokens: Math.max(0, Number(metrics.tokensOut) || 0),
        costTl,
        operation: "cline-task",
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        recordId: `cline-task:${metrics.taskId}`,
        source: "cline",
        channel: "workspace",
        costUsd,
        taskId: metrics.taskId,
    };
}
async function readExportState(workspaceRoot) {
    try {
        const raw = await promises_1.default.readFile(getExportStatePath(workspaceRoot), "utf8");
        const parsed = JSON.parse(raw);
        return {
            exportedTaskIds: Array.isArray(parsed.exportedTaskIds)
                ? parsed.exportedTaskIds.map(String)
                : [],
        };
    }
    catch {
        return { exportedTaskIds: [] };
    }
}
async function writeExportState(workspaceRoot, state) {
    await ensureUsageDir(workspaceRoot);
    await promises_1.default.writeFile(getExportStatePath(workspaceRoot), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
async function appendUsageRecord(workspaceRoot, record) {
    await ensureUsageDir(workspaceRoot);
    const logPath = getUsageLogPath(workspaceRoot);
    const line = `${JSON.stringify(record)}\n`;
    writeChain = writeChain.then(() => promises_1.default.appendFile(logPath, line, "utf8"));
    await writeChain;
}
async function exportTaskMetricsIfNew(workspaceRoot, metrics, config) {
    if (!config.enabled) {
        return false;
    }
    const state = await readExportState(workspaceRoot);
    if (state.exportedTaskIds.includes(metrics.taskId)) {
        return false;
    }
    const record = buildClineLedgerRecord(metrics, config);
    await appendUsageRecord(workspaceRoot, record);
    state.exportedTaskIds.push(metrics.taskId);
    if (state.exportedTaskIds.length > 500) {
        state.exportedTaskIds = state.exportedTaskIds.slice(-500);
    }
    await writeExportState(workspaceRoot, state);
    return true;
}
function resetWriteChainForTests() {
    writeChain = Promise.resolve();
}
//# sourceMappingURL=export.js.map