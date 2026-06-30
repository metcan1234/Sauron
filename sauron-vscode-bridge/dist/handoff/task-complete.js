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
exports.TASK_COMPLETE_FILENAME = void 0;
exports.setLastConsumedHandoff = setLastConsumedHandoff;
exports.getLastConsumedHandoff = getLastConsumedHandoff;
exports.clearLastConsumedHandoff = clearLastConsumedHandoff;
exports.buildTaskCompleteArtifact = buildTaskCompleteArtifact;
exports.writeTaskCompleteArtifact = writeTaskCompleteArtifact;
exports.resolveTaskSummary = resolveTaskSummary;
exports.TASK_COMPLETE_FILENAME = "cline-task-complete.json";
let lastConsumedHandoff = null;
let lastConsumedHandoffPath = null;
function setLastConsumedHandoff(handoff, fullPath) {
    lastConsumedHandoff = handoff;
    lastConsumedHandoffPath = fullPath;
}
function getLastConsumedHandoff() {
    return lastConsumedHandoff;
}
function clearLastConsumedHandoff() {
    lastConsumedHandoff = null;
    lastConsumedHandoffPath = null;
}
function buildTaskCompleteArtifact(handoff, metrics, summary) {
    const tokensIn = metrics?.tokensIn ?? 0;
    const tokensOut = metrics?.tokensOut ?? 0;
    return {
        version: 1,
        handoffId: handoff?.id,
        sessionId: handoff?.sessionId,
        pipelineId: handoff?.pipelineId,
        pipelinePhase: handoff?.pipelinePhase,
        projectType: handoff?.projectType,
        completedAt: new Date().toISOString(),
        metrics: {
            totalTokens: tokensIn + tokensOut,
            totalCostUsd: metrics?.costUsd ?? 0,
            modelId: metrics?.modelId,
            providerId: metrics?.providerId,
        },
        summary: summary || "Cline task completed",
    };
}
async function writeTaskCompleteArtifact(workspaceRoot, artifact) {
    const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
    const path = await Promise.resolve().then(() => __importStar(require("path")));
    const sauronDir = path.join(workspaceRoot, ".sauron");
    await fs.mkdir(sauronDir, { recursive: true });
    const targetPath = path.join(sauronDir, exports.TASK_COMPLETE_FILENAME);
    await fs.writeFile(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    return targetPath;
}
function resolveTaskSummary(cline, metrics) {
    if (typeof cline.getLastTaskSummary === "function") {
        const summary = cline.getLastTaskSummary();
        if (summary) {
            return summary;
        }
    }
    if (metrics?.taskId) {
        return `Task ${metrics.taskId} completed`;
    }
    return "Cline task completed";
}
//# sourceMappingURL=task-complete.js.map