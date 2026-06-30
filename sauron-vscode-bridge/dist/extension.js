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
exports.getClineApi = getClineApi;
exports.ensureClineReady = ensureClineReady;
exports.handleIncomingHandoffWithActiveTask = handleIncomingHandoffWithActiveTask;
exports.scheduleProcess = scheduleProcess;
exports.scanAllWorkspaces = scanAllWorkspaces;
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const cline_capabilities_1 = require("./cline-capabilities");
const cleanup_1 = require("./handoff/cleanup");
const discovery_1 = require("./handoff/discovery");
const task_complete_1 = require("./handoff/task-complete");
const handleIncomingHandoff_1 = require("./handoff/handleIncomingHandoff");
const ensureWorkspaceReady_1 = require("./handoff/ensureWorkspaceReady");
const apply_1 = require("./cost-optimizer/apply");
const sync_1 = require("./credentials/sync");
const config_1 = require("./usage/config");
const monitor_1 = require("./usage/monitor");
const CLINE_EXTENSION_ID = "saoudrizwan.claude-dev";
const CLINE_SIDEBAR_FOCUS = "claude-dev.SidebarProvider.focus";
const DEBOUNCE_MS = 500;
const CLINE_READY_ATTEMPTS = 3;
const CLINE_READY_DELAY_MS = 2000;
let processing = false;
const debounceTimers = new Map();
function getClineApi() {
    const ext = vscode.extensions.getExtension(CLINE_EXTENSION_ID);
    if (!ext?.isActive) {
        return undefined;
    }
    return ext.exports;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function ensureClineReady() {
    for (let attempt = 1; attempt <= CLINE_READY_ATTEMPTS; attempt += 1) {
        let ext = vscode.extensions.getExtension(CLINE_EXTENSION_ID);
        if (!ext) {
            vscode.window.showErrorMessage("Cline extension yüklü değil. Marketplace'ten Cline kurun.");
            return undefined;
        }
        if (!ext.isActive) {
            await ext.activate();
        }
        const api = ext.exports;
        if (api && ((0, cline_capabilities_1.probeClineCapabilities)(api).canStartTask || (0, cline_capabilities_1.probeClineCapabilities)(api).canAddToInput)) {
            return api;
        }
        if (attempt < CLINE_READY_ATTEMPTS) {
            await sleep(CLINE_READY_DELAY_MS);
        }
    }
    const ext = vscode.extensions.getExtension(CLINE_EXTENSION_ID);
    return ext?.exports;
}
async function focusClineSidebar() {
    try {
        await vscode.commands.executeCommand(CLINE_SIDEBAR_FOCUS);
    }
    catch {
        // Sidebar command may be unavailable during cold start.
    }
}
async function copyHandoffToClipboard(prompt) {
    await vscode.env.clipboard.writeText(prompt);
}
async function promptForActiveTaskChoice() {
    const selection = await vscode.window.showWarningMessage("Sauron'dan yeni bir görev geldi, ama şu an aktif bir Cline görevi var. Ne yapmak istersiniz?", { modal: true }, handleIncomingHandoff_1.HANDOFF_REPLACE_LABEL, handleIncomingHandoff_1.HANDOFF_REJECT_LABEL);
    return (0, handleIncomingHandoff_1.mapUserSelection)(selection);
}
async function handleIncomingHandoffWithActiveTask(cline, fullPath, userChoice) {
    const handoff = await (0, discovery_1.readHandoffFile)(fullPath);
    const workspaceRoot = (0, handleIncomingHandoff_1.resolveWorkspaceRootFromHandoff)(handoff, fullPath);
    const workspaceReady = await (0, ensureWorkspaceReady_1.ensureWorkspaceReady)(workspaceRoot);
    if (!workspaceReady.ready) {
        return false;
    }
    const prompt = await (0, handleIncomingHandoff_1.buildPromptFromHandoffForWorkspace)(handoff, workspaceRoot);
    if (!prompt) {
        vscode.window.showWarningMessage("Sauron handoff dosyası boş — görev özeti bulunamadı.");
        await (0, discovery_1.markHandoffRejected)(fullPath);
        return false;
    }
    const finopsConfig = await (0, config_1.readFinOpsConfig)(workspaceRoot);
    await (0, sync_1.syncCredentialsForWorkspace)(workspaceRoot, cline).catch(() => ({ ok: false, synced: [] }));
    await (0, handleIncomingHandoff_1.logCostOptimizerHint)(workspaceRoot, handoff, finopsConfig).catch(() => { });
    await (0, apply_1.applyClineModelBeforeHandoff)(cline, handoff, finopsConfig, workspaceRoot).catch(() => { });
    const hasActive = (0, cline_capabilities_1.safeHasActiveTask)(cline);
    if (hasActive && handoff.autoChain && typeof cline.clearTask === "function") {
        await cline.clearTask();
        vscode.window.showInformationMessage("Önceki Cline görevi tamamlandı — pipeline sonraki faz otomatik yükleniyor.");
    }
    const action = (0, handleIncomingHandoff_1.resolveHandoffAction)((0, cline_capabilities_1.safeHasActiveTask)(cline), handoff.autoStart, userChoice, handoff.autoChain);
    if (action === "waitForUser") {
        const choice = await promptForActiveTaskChoice();
        return handleIncomingHandoffWithActiveTask(cline, fullPath, choice);
    }
    if (action === "reject") {
        await (0, discovery_1.markHandoffRejected)(fullPath);
        vscode.window.showInformationMessage("Sauron görevi reddedildi — mevcut Cline görevine devam ediliyor.");
        return false;
    }
    if (action === "noop") {
        return false;
    }
    await focusClineSidebar();
    const delivery = await (0, cline_capabilities_1.deliverHandoffPrompt)(cline, prompt, action);
    if (delivery === "clipboard") {
        await copyHandoffToClipboard(prompt);
        await (0, discovery_1.markHandoffConsumed)(fullPath);
        (0, task_complete_1.setLastConsumedHandoff)(handoff, fullPath);
        vscode.window.showInformationMessage("Sauron görev özeti panoya kopyalandı. Cline sidebar'ına yapıştırıp gönderin.");
        return true;
    }
    await (0, discovery_1.markHandoffConsumed)(fullPath);
    (0, task_complete_1.setLastConsumedHandoff)(handoff, fullPath);
    if (delivery === "startNewTask") {
        vscode.window.showInformationMessage("Sauron'dan gelen görev Cline'a yüklendi.");
    }
    else {
        vscode.window.showInformationMessage("Sauron görevi Cline giriş alanına eklendi — göndermek için onaylayın.");
    }
    return true;
}
async function processWorkspace(workspaceRoot) {
    if (processing) {
        return;
    }
    processing = true;
    try {
        const cline = await ensureClineReady();
        if (!cline) {
            return;
        }
        const next = await (0, discovery_1.getNextPendingHandoff)(workspaceRoot);
        if (!next) {
            return;
        }
        await handleIncomingHandoffWithActiveTask(cline, next.fullPath);
        await (0, cleanup_1.cleanupOldHandoffArtifacts)(workspaceRoot);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Sauron handoff okunamadı: ${message}`);
    }
    finally {
        processing = false;
    }
}
function scheduleProcess(workspaceRoot) {
    const existing = debounceTimers.get(workspaceRoot);
    if (existing) {
        clearTimeout(existing);
    }
    debounceTimers.set(workspaceRoot, setTimeout(() => {
        debounceTimers.delete(workspaceRoot);
        void processWorkspace(workspaceRoot);
    }, DEBOUNCE_MS));
}
async function scanAllWorkspaces(context) {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        await (0, cleanup_1.cleanupOldHandoffArtifacts)(folder.uri.fsPath);
        const pending = await (0, discovery_1.listPendingHandoffs)(folder.uri.fsPath);
        if (pending.length > 0) {
            await focusClineSidebar();
            scheduleProcess(folder.uri.fsPath);
        }
    }
    const watcher = vscode.workspace.createFileSystemWatcher("**/.sauron/handoff*.json");
    const onHandoffEvent = (uri) => {
        const workspaceRoot = path.dirname(path.dirname(uri.fsPath));
        scheduleProcess(workspaceRoot);
    };
    watcher.onDidCreate(onHandoffEvent);
    watcher.onDidChange(onHandoffEvent);
    context.subscriptions.push(watcher);
    context.subscriptions.push(vscode.window.onDidChangeWindowState((state) => {
        if (!state.focused) {
            return;
        }
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            void (0, discovery_1.listPendingHandoffs)(folder.uri.fsPath).then((pending) => {
                if (pending.length > 0) {
                    scheduleProcess(folder.uri.fsPath);
                }
            });
        }
    }));
}
function activate(context) {
    void scanAllWorkspaces(context);
    (0, monitor_1.startCostMonitor)(context, getClineApi);
}
function deactivate() {
    for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
    }
    debounceTimers.clear();
}
//# sourceMappingURL=extension.js.map