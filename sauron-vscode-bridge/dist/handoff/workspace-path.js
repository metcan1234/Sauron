"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathsEqual = pathsEqual;
exports.isWorkspaceFolderOpen = isWorkspaceFolderOpen;
const path_1 = __importDefault(require("path"));
function pathsEqual(left, right) {
    const normalizedLeft = path_1.default.normalize(left);
    const normalizedRight = path_1.default.normalize(right);
    if (process.platform === "win32") {
        return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
    }
    return normalizedLeft === normalizedRight;
}
function isWorkspaceFolderOpen(targetPath, workspaceFolders) {
    const target = path_1.default.resolve(targetPath);
    for (const folder of workspaceFolders ?? []) {
        if (pathsEqual(folder.uri.fsPath, target)) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=workspace-path.js.map