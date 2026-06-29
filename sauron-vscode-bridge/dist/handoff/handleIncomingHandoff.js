"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HANDOFF_REJECT_LABEL = exports.HANDOFF_REPLACE_LABEL = void 0;
exports.buildPromptFromHandoff = buildPromptFromHandoff;
exports.buildPromptFromHandoffForWorkspace = buildPromptFromHandoffForWorkspace;
exports.logCostOptimizerHint = logCostOptimizerHint;
exports.resolveWorkspaceRootFromHandoff = resolveWorkspaceRootFromHandoff;
exports.resolveHandoffAction = resolveHandoffAction;
exports.mapUserSelection = mapUserSelection;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const compact_handoff_1 = require("../cost-optimizer/compact-handoff");
const export_1 = require("../usage/export");
const config_1 = require("../usage/config");
exports.HANDOFF_REPLACE_LABEL = "Mevcut görevi bitir, yenisini başlat";
exports.HANDOFF_REJECT_LABEL = "Yeni görevi reddet, mevcut göreve devam et";
const CLINERULES_BY_PROJECT_TYPE = {
    "corporate-web": ["sauron-web-dev.md"],
    "electron-core": ["sauron-electron-dev.md", "sauron-self-improve.md"],
    "bridge-extension": ["sauron-bridge-dev.md"],
    "monorepo-stack": ["sauron-electron-dev.md", "sauron-bridge-dev.md"],
};
function buildProjectTypeHints(handoff) {
    const hints = [];
    if (handoff.projectType) {
        const files = CLINERULES_BY_PROJECT_TYPE[handoff.projectType] || [];
        if (files.length) {
            hints.push(`Follow project rules: ${files.map((f) => `.clinerules/${f}`).join(", ")}`);
        }
    }
    if (handoff.pipelineId && handoff.pipelinePhase) {
        const total = handoff.pipelineTotalPhases ? ` / ${handoff.pipelineTotalPhases}` : "";
        hints.push(`Pipeline phase ${handoff.pipelinePhase}${total} (${handoff.pipelineId})`);
    }
    if (handoff.batchScope?.length) {
        hints.push(`Batch scope: ${handoff.batchScope.slice(0, 8).join(", ")}`);
    }
    if (handoff.relevantFiles?.length) {
        hints.push(`Relevant files: ${handoff.relevantFiles.slice(0, 6).join(", ")}`);
    }
    if (handoff.cacheBreakpoint) {
        hints.push(`Cache breakpoint: ${handoff.cacheBreakpoint}`);
    }
    if (handoff.verification?.command) {
        hints.push(`When done, run verification: \`${handoff.verification.command}\``);
    }
    return hints;
}
function buildPromptFromHandoff(handoff) {
    const summary = String(handoff.taskSummary || handoff.goal || "").trim();
    if (!summary) {
        return "";
    }
    const hints = buildProjectTypeHints(handoff);
    return [
        "[Sauron Core handoff]",
        summary,
        ...hints,
        "",
        "Continue this task in the shared workspace. Follow .clinerules/sauron-workspace.md.",
    ].join("\n");
}
async function buildPromptFromHandoffForWorkspace(handoff, workspaceRoot) {
    const basePrompt = buildPromptFromHandoff(handoff);
    if (!basePrompt) {
        return "";
    }
    const config = await (0, config_1.readFinOpsConfig)(workspaceRoot);
    const optimizer = config.costOptimizer;
    const tokenUltraEnabled = handoff.tokenUltra?.enabled !== false;
    const compacted = optimizer?.enabled || tokenUltraEnabled
        ? (0, compact_handoff_1.compactHandoffPrompt)(basePrompt, optimizer || {
            enabled: false,
            mode: "balanced",
            coreModelTier: "economy",
            models: {
                economy: { providerId: "gemini", modelId: "gemini-2.5-flash-lite" },
                standard: { providerId: "deepseek", modelId: "deepseek-chat" },
                premium: { providerId: "openai", modelId: "gpt-4o-mini" },
                local: { providerId: "ollama", modelId: "qwen2.5-coder:7b" },
            },
            routing: {
                defaultTier: "economy",
                handoffMaxChars: handoff.tokenUltra?.maxHandoffChars || 6000,
                includeTranscript: false,
                complexityKeywords: [],
            },
            budgetGovernor: { enabled: false, dailyBudgetTl: 0, warnAtRemainingPct: 30 },
        }, { tokenUltraEnabled })
        : basePrompt;
    try {
        await promises_1.default.access(path_1.default.join(workspaceRoot, ".clinerules", "sauron-workspace.md"));
    }
    catch {
        // workspace rules optional
    }
    return compacted;
}
async function logCostOptimizerHint(workspaceRoot, handoff, config) {
    if (!config.enabled || !handoff.complexityHint) {
        return;
    }
    await (0, export_1.appendUsageRecord)(workspaceRoot, {
        provider: "sauron",
        model: handoff.complexityHint,
        promptTokens: 0,
        completionTokens: 0,
        costTl: 0,
        operation: "cost-optimizer-hint",
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        recordId: `cost-optimizer-hint:${handoff.id || Date.now()}`,
        source: "bridge",
    });
}
function resolveWorkspaceRootFromHandoff(handoff, handoffFilePath) {
    if (handoff.workspacePath) {
        return handoff.workspacePath;
    }
    return path_1.default.dirname(path_1.default.dirname(handoffFilePath));
}
function resolveHandoffAction(hasActiveTask, autoStart, userChoice, autoChain) {
    if (hasActiveTask) {
        if (autoChain) {
            return "startNewTask";
        }
        if (userChoice === "startReplace") {
            return "startNewTask";
        }
        if (userChoice === "reject") {
            return "reject";
        }
        return "waitForUser";
    }
    if (autoStart === false) {
        return "addToInput";
    }
    return "startNewTask";
}
function mapUserSelection(selection) {
    if (selection === exports.HANDOFF_REPLACE_LABEL) {
        return "startReplace";
    }
    if (selection === exports.HANDOFF_REJECT_LABEL) {
        return "reject";
    }
    return undefined;
}
//# sourceMappingURL=handleIncomingHandoff.js.map