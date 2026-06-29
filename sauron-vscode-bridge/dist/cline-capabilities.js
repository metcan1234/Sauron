"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeClineCapabilities = probeClineCapabilities;
exports.safeHasActiveTask = safeHasActiveTask;
exports.deliverHandoffPrompt = deliverHandoffPrompt;
function probeClineCapabilities(cline) {
    return {
        canRouteModel: typeof cline.setActiveModel === "function",
        canDetectActiveTask: typeof cline.hasActiveTask === "function",
        canAddToInput: typeof cline.addToInput === "function",
        canStartTask: typeof cline.startNewTask === "function",
        canSyncCredentials: typeof cline.syncProviderCredentials === "function",
    };
}
function safeHasActiveTask(cline) {
    if (typeof cline.hasActiveTask !== "function") {
        return false;
    }
    try {
        return Boolean(cline.hasActiveTask());
    }
    catch {
        return false;
    }
}
async function deliverHandoffPrompt(cline, prompt, action) {
    const caps = probeClineCapabilities(cline);
    if (action === "startNewTask" && caps.canStartTask) {
        await cline.startNewTask(prompt);
        return "startNewTask";
    }
    if (action === "addToInput" && caps.canAddToInput) {
        await cline.addToInput(prompt);
        return "addToInput";
    }
    if (caps.canStartTask) {
        await cline.startNewTask(prompt);
        return "startNewTask";
    }
    if (caps.canAddToInput) {
        await cline.addToInput(prompt);
        return "addToInput";
    }
    return "clipboard";
}
//# sourceMappingURL=cline-capabilities.js.map