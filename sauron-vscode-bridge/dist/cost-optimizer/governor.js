"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOVERNOR_ALERT_MESSAGE = void 0;
exports.computeDailySpendTl = computeDailySpendTl;
exports.shouldDowngradeOneTier = shouldDowngradeOneTier;
exports.markDowngradeApplied = markDowngradeApplied;
exports.wasDowngradeApplied = wasDowngradeApplied;
exports.resetGovernorStateForTests = resetGovernorStateForTests;
exports.resolveBudgetDowngrade = resolveBudgetDowngrade;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const discovery_1 = require("../handoff/discovery");
const LOG_FILENAME = "logs.jsonl";
function startOfTodayIso() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
}
async function computeDailySpendTl(workspaceRoot) {
    const logPath = path_1.default.join((0, discovery_1.getSauronDir)(workspaceRoot), "usage", LOG_FILENAME);
    const cutoff = startOfTodayIso();
    let total = 0;
    try {
        const raw = await promises_1.default.readFile(logPath, "utf8");
        for (const line of raw.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }
            try {
                const record = JSON.parse(trimmed);
                if (!record.timestamp || record.timestamp < cutoff) {
                    continue;
                }
                const costTl = Number(record.costTl);
                if (Number.isFinite(costTl)) {
                    total += costTl;
                }
            }
            catch {
                // ignore malformed lines
            }
        }
    }
    catch {
        return 0;
    }
    return total;
}
async function shouldDowngradeOneTier(workspaceRoot, optimizer, projectType) {
    if (!optimizer?.enabled || !optimizer.budgetGovernor?.enabled) {
        return false;
    }
    const projectBudgets = optimizer
        .projectBudgets;
    const projectBudget = projectType && projectBudgets?.[projectType]?.dailyBudgetTl;
    const dailyBudget = Number(projectBudget) > 0
        ? Number(projectBudget)
        : Number(optimizer.budgetGovernor.dailyBudgetTl) || 0;
    if (dailyBudget <= 0) {
        return false;
    }
    const spent = await computeDailySpendTl(workspaceRoot);
    const now = new Date();
    const dayProgress = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
    const expectedSpend = dailyBudget * Math.max(0.25, dayProgress);
    return spent >= expectedSpend;
}
const downgradeAppliedForHandoff = new Set();
exports.GOVERNOR_ALERT_MESSAGE = "Günlük bütçe aşıldı — zor işler için DeepSeek kullanılıyor.";
function markDowngradeApplied(handoffId) {
    if (handoffId) {
        downgradeAppliedForHandoff.add(handoffId);
    }
}
function wasDowngradeApplied(handoffId) {
    return Boolean(handoffId && downgradeAppliedForHandoff.has(handoffId));
}
function resetGovernorStateForTests() {
    downgradeAppliedForHandoff.clear();
}
async function resolveBudgetDowngrade(workspaceRoot, optimizer, handoffId, projectType) {
    if (handoffId && wasDowngradeApplied(handoffId)) {
        return false;
    }
    const shouldDowngrade = await shouldDowngradeOneTier(workspaceRoot, optimizer, projectType);
    if (shouldDowngrade && handoffId) {
        markDowngradeApplied(handoffId);
    }
    return shouldDowngrade;
}
//# sourceMappingURL=governor.js.map