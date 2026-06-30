"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeCredentialSyncCapability = probeCredentialSyncCapability;
exports.syncCredentialsForWorkspace = syncCredentialsForWorkspace;
const crypto_1 = require("./crypto");
function probeCredentialSyncCapability(cline) {
    return typeof cline.syncProviderCredentials === "function";
}
async function syncCredentialsForWorkspace(workspacePath, cline) {
    return (0, crypto_1.applyCredentialsFromWorkspace)(workspacePath, cline);
}
//# sourceMappingURL=sync.js.map