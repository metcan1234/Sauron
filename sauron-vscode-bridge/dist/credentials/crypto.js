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
exports.REQUEST_FILENAME = void 0;
exports.decryptPayloadBuffer = decryptPayloadBuffer;
exports.readCredentialRequest = readCredentialRequest;
exports.cleanupCredentialArtifacts = cleanupCredentialArtifacts;
exports.applyCredentialsFromWorkspace = applyCredentialsFromWorkspace;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const SYNC_KEY_DIR = path.join(os.homedir(), ".sauron");
const SYNC_KEY_FILE = path.join(SYNC_KEY_DIR, "cline-sync.key");
exports.REQUEST_FILENAME = "cline-credential-request.json";
function getOrCreateSyncKey() {
    if (fs.existsSync(SYNC_KEY_FILE)) {
        const existing = fs.readFileSync(SYNC_KEY_FILE);
        if (existing.length >= 32) {
            return existing.subarray(0, 32);
        }
    }
    fs.mkdirSync(SYNC_KEY_DIR, { recursive: true });
    const key = crypto.randomBytes(32);
    fs.writeFileSync(SYNC_KEY_FILE, key, { mode: 0o600 });
    return key;
}
function decryptPayloadBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 28) {
        return null;
    }
    try {
        const key = getOrCreateSyncKey();
        const iv = buffer.subarray(0, 12);
        const tag = buffer.subarray(12, 28);
        const encrypted = buffer.subarray(28);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return JSON.parse(decrypted.toString("utf8"));
    }
    catch {
        return null;
    }
}
function readCredentialRequest(workspacePath) {
    const requestPath = path.join(workspacePath, ".sauron", exports.REQUEST_FILENAME);
    if (!fs.existsSync(requestPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(requestPath, "utf8"));
    }
    catch {
        return null;
    }
}
function cleanupCredentialArtifacts(workspacePath, tempPath) {
    const requestPath = path.join(workspacePath, ".sauron", exports.REQUEST_FILENAME);
    try {
        if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
    catch {
        // ignore
    }
    try {
        if (fs.existsSync(requestPath)) {
            fs.unlinkSync(requestPath);
        }
    }
    catch {
        // ignore
    }
}
async function applyCredentialsFromWorkspace(workspacePath, cline) {
    if (typeof cline.syncProviderCredentials !== "function") {
        return { ok: false, synced: [], error: "Cline fork does not support credential sync." };
    }
    const request = readCredentialRequest(workspacePath);
    if (!request?.tempPath) {
        return { ok: false, synced: [], error: "No pending credential request in workspace." };
    }
    if (request.expiresAt && Date.parse(request.expiresAt) < Date.now()) {
        cleanupCredentialArtifacts(workspacePath, request.tempPath);
        return { ok: false, synced: [], error: "Credential request expired." };
    }
    const payload = decryptPayloadBuffer(fs.readFileSync(request.tempPath));
    if (!payload || Object.keys(payload).length === 0) {
        cleanupCredentialArtifacts(workspacePath, request.tempPath);
        return { ok: false, synced: [], error: "Credential payload could not be decrypted." };
    }
    try {
        const result = await cline.syncProviderCredentials(payload);
        cleanupCredentialArtifacts(workspacePath, request.tempPath);
        return { ok: true, synced: result?.synced || [] };
    }
    catch (error) {
        return {
            ok: false,
            synced: [],
            error: error instanceof Error ? error.message : "Credential sync failed.",
        };
    }
}
//# sourceMappingURL=crypto.js.map