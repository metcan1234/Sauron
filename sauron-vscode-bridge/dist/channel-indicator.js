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
exports.registerChannelIndicator = registerChannelIndicator;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const CLINE_EXTENSION_ID = "saoudrizwan.claude-dev";
function refreshClineWelcomeState() {
    const cline = vscode.extensions.getExtension(CLINE_EXTENSION_ID)?.exports;
    void cline?.refreshWebviewState?.();
}
const CHANNEL_UI = {
    workspace: {
        text: "$(code) ⌘ ÇALIŞMA KISMI",
        tooltip: "Sauron Çalışma Kısmı — turuncu çubuk · Cline + Bridge handoff",
        welcomeFile: "CHANNEL-WORKSPACE.md",
    },
    gamedev: {
        text: "$(game) 🎮 GAME DEV",
        tooltip: "Sauron Game Dev — mor çubuk · gamedev MCP + pipeline",
        welcomeFile: "CHANNEL-GAMEDEV.md",
    },
};
function readActiveChannelMarker(workspaceRoot) {
    const markerPath = path.join(workspaceRoot, ".sauron", "active-channel.json");
    try {
        return JSON.parse(fs.readFileSync(markerPath, "utf8"));
    }
    catch {
        return null;
    }
}
function resolveChannel(marker) {
    if (marker?.channel === "workspace" || marker?.channel === "gamedev") {
        return marker.channel;
    }
    return null;
}
function registerChannelIndicator(context) {
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 200);
    statusItem.command = "sauron.showChannelGuide";
    context.subscriptions.push(statusItem);
    const update = (workspaceRoot) => {
        const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) {
            statusItem.hide();
            return;
        }
        const marker = readActiveChannelMarker(root);
        const channel = resolveChannel(marker);
        if (!channel) {
            statusItem.hide();
            return;
        }
        const ui = CHANNEL_UI[channel];
        const engine = marker?.engineLabel ? ` · ${marker.engineLabel}` : "";
        statusItem.text = `${ui.text}${engine}`;
        statusItem.tooltip = `${ui.tooltip}\n\nKarıştırdıysan: turuncu = Çalışma, mor = Game Dev.`;
        statusItem.show();
    };
    const watchRoots = () => {
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const pattern = new vscode.RelativePattern(folder, ".sauron/active-channel.json");
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            const refresh = () => {
                update(folder.uri.fsPath);
                refreshClineWelcomeState();
            };
            watcher.onDidCreate(refresh);
            watcher.onDidChange(refresh);
            watcher.onDidDelete(refresh);
            context.subscriptions.push(watcher);
        }
    };
    context.subscriptions.push(vscode.commands.registerCommand("sauron.showChannelGuide", async () => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const marker = root ? readActiveChannelMarker(root) : null;
        const channel = resolveChannel(marker);
        const choice = await vscode.window.showInformationMessage(channel === "gamedev"
            ? "Şu an GAME DEV modundasın (mor çubuk). Genel kod için Sauron panelinde ⌘ Çalışma Kısmı'nı kullan."
            : channel === "workspace"
                ? "Şu an ÇALIŞMA KISMI modundasın (turuncu çubuk). Oyun için Sauron panelinde 🎮 Game Dev'i kullan."
                : "Aktif Sauron kanalı bulunamadı. Panelden ⌘ veya 🎮 ile aç.", "Kanal dosyasını aç", "Tamam");
        if (choice === "Kanal dosyasını aç" && root && channel) {
            const welcomePath = path.join(root, ".sauron", CHANNEL_UI[channel].welcomeFile);
            if (fs.existsSync(welcomePath)) {
                const doc = await vscode.workspace.openTextDocument(welcomePath);
                await vscode.window.showTextDocument(doc, { preview: false });
            }
        }
    }));
    watchRoots();
    update();
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
        update();
    }));
}
//# sourceMappingURL=channel-indicator.js.map