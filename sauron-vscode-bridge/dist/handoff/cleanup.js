"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldHandoffArtifacts = cleanupOldHandoffArtifacts;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const discovery_1 = require("./discovery");
const ARCHIVE_DIR = "archive";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
async function cleanupOldHandoffArtifacts(workspaceRoot) {
    const sauronDir = (0, discovery_1.getSauronDir)(workspaceRoot);
    const archiveDir = path_1.default.join(sauronDir, ARCHIVE_DIR);
    let moved = 0;
    try {
        await promises_1.default.access(sauronDir);
    }
    catch {
        return 0;
    }
    await promises_1.default.mkdir(archiveDir, { recursive: true });
    const entries = await promises_1.default.readdir(sauronDir, { withFileTypes: true });
    const cutoff = Date.now() - RETENTION_MS;
    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }
        if (!entry.name.endsWith(".consumed") && !entry.name.endsWith(".rejected")) {
            continue;
        }
        const fullPath = path_1.default.join(sauronDir, entry.name);
        const stat = await promises_1.default.stat(fullPath);
        if (stat.mtimeMs >= cutoff) {
            continue;
        }
        const target = path_1.default.join(archiveDir, entry.name);
        await promises_1.default.rename(fullPath, target);
        moved += 1;
    }
    return moved;
}
//# sourceMappingURL=cleanup.js.map