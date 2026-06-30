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
exports.startCostMonitor = startCostMonitor;
exports.resetMonitorStateForTests = resetMonitorStateForTests;
const vscode = __importStar(require("vscode"));
const task_complete_1 = require("../handoff/task-complete");
const config_1 = require("./config");
const export_1 = require("./export");
const workspaceStates = new Map();
async function pollWorkspace(workspaceRoot, getCline) {
    const cline = getCline();
    if (!cline?.getActiveTaskMetrics) {
        return;
    }
    const config = await (0, config_1.readFinOpsConfig)(workspaceRoot);
    if (!config.enabled) {
        return;
    }
    const state = workspaceStates.get(workspaceRoot) ?? { hadActiveTask: false, lastMetrics: null };
    const hasActiveTask = cline.hasActiveTask();
    const metrics = hasActiveTask ? cline.getActiveTaskMetrics() : null;
    if (hasActiveTask && metrics) {
        state.lastMetrics = metrics;
    }
    if (state.hadActiveTask && !hasActiveTask && state.lastMetrics) {
        await (0, export_1.exportTaskMetricsIfNew)(workspaceRoot, state.lastMetrics, config);
        if (cline) {
            const summary = (0, task_complete_1.resolveTaskSummary)(cline, state.lastMetrics);
            const artifact = (0, task_complete_1.buildTaskCompleteArtifact)((0, task_complete_1.getLastConsumedHandoff)(), state.lastMetrics, summary);
            await (0, task_complete_1.writeTaskCompleteArtifact)(workspaceRoot, artifact).catch(() => { });
        }
        state.lastMetrics = null;
    }
    workspaceStates.set(workspaceRoot, {
        hadActiveTask: hasActiveTask,
        lastMetrics: state.lastMetrics,
    });
}
function startCostMonitor(context, getCline) {
    const tickAll = async () => {
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            await pollWorkspace(folder.uri.fsPath, getCline);
        }
    };
    void tickAll();
    const interval = setInterval(() => {
        void tickAll();
    }, 5000);
    context.subscriptions.push({
        dispose: () => {
            clearInterval(interval);
            workspaceStates.clear();
        },
    });
}
function resetMonitorStateForTests() {
    workspaceStates.clear();
}
//# sourceMappingURL=monitor.js.map