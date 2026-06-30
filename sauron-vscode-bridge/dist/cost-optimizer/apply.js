"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyClineModelBeforeHandoff = applyClineModelBeforeHandoff;
const vscode = __importStar(require("vscode"));
const cline_capabilities_1 = require("../cline-capabilities");
const export_1 = require("../usage/export");
const governor_1 = require("./governor");
const router_1 = require("./router");
async function applyClineModelBeforeHandoff(cline, handoff, finopsConfig, workspaceRoot) {
    const optimizer = finopsConfig.costOptimizer;
    const trackingOnly = finopsConfig.trackingOnly !== false;
    const autoRouteCline = finopsConfig.shouldAutoRoute?.cline ?? !trackingOnly;
    const caps = (0, cline_capabilities_1.probeClineCapabilities)(cline);
    if (!optimizer?.enabled || !caps.canRouteModel) {
        return { applied: false };
    }
    const budgetGovernorActive = autoRouteCline
        ? await (0, governor_1.resolveBudgetDowngrade)(workspaceRoot, optimizer, handoff.id, handoff.projectType)
        : false;
    if (budgetGovernorActive) {
        void vscode.window.showInformationMessage(governor_1.GOVERNOR_ALERT_MESSAGE);
    }
    const manualAgent = finopsConfig.manualAgents?.cline;
    const manualSelection = !autoRouteCline && manualAgent
        ? (0, router_1.resolveManualClineAgent)(manualAgent, optimizer.agentMatrix)
        : null;
    const planSelection = autoRouteCline
        ? (0, router_1.resolveClineAgent)("low", optimizer.agentMatrix, {
            budgetGovernorActive,
            fallbackText: handoff.taskSummary || handoff.goal || "",
        })
        : manualSelection;
    const actSelection = autoRouteCline
        ? (0, router_1.resolveClineAgent)(handoff.complexityHint, optimizer.agentMatrix, {
            budgetGovernorActive,
            fallbackText: handoff.taskSummary || handoff.goal || "",
        })
        : manualSelection;
    if (!actSelection) {
        return { applied: false };
    }
    try {
        if (planSelection && caps.canRouteModel && cline.setPlanModeModel) {
            await cline.setPlanModeModel({
                providerId: planSelection.providerId,
                modelId: planSelection.modelId,
            });
        }
        await cline.setActiveModel({
            providerId: actSelection.providerId,
            modelId: actSelection.modelId,
        });
    }
    catch {
        return { applied: false, selection: actSelection, planSelection: planSelection || undefined };
    }
    await (0, export_1.appendUsageRecord)(workspaceRoot, {
        provider: "sauron",
        model: `plan:${planSelection?.agentId || "none"} act:${actSelection.agentId}:${actSelection.modelId}`,
        promptTokens: 0,
        completionTokens: 0,
        costTl: 0,
        operation: "cline-agent-routing",
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        recordId: `cline-agent-routing:${handoff.id || Date.now()}`,
        source: "bridge",
    }).catch(() => { });
    return {
        applied: true,
        selection: actSelection,
        planSelection: planSelection || undefined,
    };
}
//# sourceMappingURL=apply.js.map