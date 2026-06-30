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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForWorkspaceFolder = waitForWorkspaceFolder;
exports.ensureWorkspaceReady = ensureWorkspaceReady;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const vscode = __importStar(require("vscode"));
const workspace_path_1 = require("./workspace-path");
const WORKSPACE_WAIT_MS = 5000;
const WORKSPACE_POLL_MS = 250;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForWorkspaceFolder(targetPath, timeoutMs = WORKSPACE_WAIT_MS) {
    const target = path_1.default.resolve(targetPath);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if ((0, workspace_path_1.isWorkspaceFolderOpen)(target, vscode.workspace.workspaceFolders)) {
            return true;
        }
        await sleep(WORKSPACE_POLL_MS);
    }
    return (0, workspace_path_1.isWorkspaceFolderOpen)(target, vscode.workspace.workspaceFolders);
}
/**
 * Ensures VS Code has the Sauron workspace folder open before Cline starts.
 * Avoids Cline falling back to homedir()/Desktop (broken on OneDrive Desktop redirect).
 */
async function ensureWorkspaceReady(workspaceRoot) {
    const target = path_1.default.resolve(String(workspaceRoot || "").trim());
    if (!target) {
        throw new Error("Workspace path is missing from Sauron handoff.");
    }
    try {
        await promises_1.default.access(target);
    }
    catch {
        throw new Error(`Workspace path does not exist: ${target}`);
    }
    if ((0, workspace_path_1.isWorkspaceFolderOpen)(target, vscode.workspace.workspaceFolders)) {
        return { ready: true, opened: false };
    }
    if (await waitForWorkspaceFolder(target)) {
        return { ready: true, opened: false };
    }
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(target), false);
    if (await waitForWorkspaceFolder(target, WORKSPACE_WAIT_MS * 2)) {
        return { ready: true, opened: true };
    }
    return { ready: false, opened: true };
}
//# sourceMappingURL=ensureWorkspaceReady.js.map