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
exports.LEGACY_HANDOFF_FILE = exports.HANDOFF_DIR = void 0;
exports.isTerminalHandoffName = isTerminalHandoffName;
exports.isPendingHandoffFileName = isPendingHandoffFileName;
exports.getSauronDir = getSauronDir;
exports.listPendingHandoffs = listPendingHandoffs;
exports.getLatestPendingHandoff = getLatestPendingHandoff;
exports.getNextPendingHandoff = getNextPendingHandoff;
exports.readHandoffFile = readHandoffFile;
exports.markHandoffConsumed = markHandoffConsumed;
exports.markHandoffRejected = markHandoffRejected;
const promises_1 = __importDefault(require("fs/promises"));
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
exports.HANDOFF_DIR = ".sauron";
exports.LEGACY_HANDOFF_FILE = "handoff.json";
function isTerminalHandoffName(name) {
    return name.endsWith(".consumed") || name.endsWith(".rejected");
}
function isPendingHandoffFileName(name) {
    if (isTerminalHandoffName(name)) {
        return false;
    }
    if (name === exports.LEGACY_HANDOFF_FILE) {
        return true;
    }
    return /^handoff-.+\.json$/i.test(name);
}
function getSauronDir(workspaceRoot) {
    return path_1.default.join(workspaceRoot, exports.HANDOFF_DIR);
}
async function listPendingHandoffs(workspaceRoot) {
    const sauronDir = getSauronDir(workspaceRoot);
    try {
        await promises_1.default.access(sauronDir);
    }
    catch {
        return [];
    }
    const entries = await promises_1.default.readdir(sauronDir, { withFileTypes: true });
    const pending = [];
    for (const entry of entries) {
        if (!entry.isFile() || !isPendingHandoffFileName(entry.name)) {
            continue;
        }
        const fullPath = path_1.default.join(sauronDir, entry.name);
        const stat = await promises_1.default.stat(fullPath);
        let createdAt = stat.mtime.toISOString();
        try {
            const parsed = JSON.parse(await promises_1.default.readFile(fullPath, "utf8"));
            if (parsed.createdAt) {
                createdAt = parsed.createdAt;
            }
        }
        catch {
            // keep mtime fallback
        }
        pending.push({ fileName: entry.name, fullPath, createdAt });
    }
    pending.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return pending;
}
async function getLatestPendingHandoff(workspaceRoot) {
    const pending = await listPendingHandoffs(workspaceRoot);
    return pending[0] ?? null;
}
async function getNextPendingHandoff(workspaceRoot) {
    const pending = await listPendingHandoffs(workspaceRoot);
    if (pending.length === 0) {
        return null;
    }
    const withPhase = await Promise.all(pending.map(async (item) => {
        try {
            const parsed = await readHandoffFile(item.fullPath);
            return {
                item,
                pipelinePhase: Number(parsed.pipelinePhase) || 9999,
                createdAt: parsed.createdAt || item.createdAt,
            };
        }
        catch {
            return { item, pipelinePhase: 9999, createdAt: item.createdAt };
        }
    }));
    withPhase.sort((a, b) => {
        if (a.pipelinePhase !== b.pipelinePhase) {
            return a.pipelinePhase - b.pipelinePhase;
        }
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });
    return withPhase[0]?.item ?? null;
}
async function readHandoffFile(fullPath) {
    const raw = await promises_1.default.readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    const { _checksum, ...content } = parsed;
    if (_checksum) {
        // Verify SHA256 checksum — strip _checksum before hashing
        const serialized = JSON.stringify(content, null, 2);
        const computed = crypto_1.default.createHash("sha256").update(serialized, "utf8").digest("hex");
        if (computed !== _checksum) {
            // Checksum mismatch — file is corrupt or tampered
            const { default: vscode } = await Promise.resolve().then(() => __importStar(require("vscode")));
            vscode.window.showWarningMessage(`Sauron handoff dosyası bozuk (checksum uyuşmazlığı): ${path_1.default.basename(fullPath)}. Dosya reddediliyor.`);
            // Reject the file so it won't be processed again
            await markHandoffRejected(fullPath).catch(() => { });
            throw new Error(`Handoff checksum mismatch: ${path_1.default.basename(fullPath)}`);
        }
    }
    // Legacy files without _checksum are accepted (no checksum to verify)
    return content;
}
async function markHandoffConsumed(fullPath) {
    await promises_1.default.rename(fullPath, `${fullPath}.consumed`);
}
async function markHandoffRejected(fullPath) {
    await promises_1.default.rename(fullPath, `${fullPath}.rejected`);
}
//# sourceMappingURL=discovery.js.map