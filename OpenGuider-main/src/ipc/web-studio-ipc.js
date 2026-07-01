const { saveBrief, loadBrief, defaultBrief, normalizeBrief } = require("../sauron/web-studio/brief-schema");
const { scaffoldNextjs } = require("../sauron/web-studio/scaffold-nextjs");
const { detectNextProject } = require("../sauron/web-studio/project-status");
const { detectWebIntent } = require("../sauron/web-studio/web-intent");
const { detectWebDeployTool, runWebDeployPreview } = require("../sauron/web-deploy");

function registerWebStudioIpc({
  ipcMain,
  shell,
  store,
  debugLog,
}) {
  function resolveWorkspacePath(overridePath) {
    return String(overridePath || store.get("workspacePath") || "").trim();
  }

  ipcMain.handle("save-web-brief", (_event, { workspacePath, brief } = {}) => {
    debugLog("ipc:save-web-brief");
    const resolvedPath = resolveWorkspacePath(workspacePath);
    if (!resolvedPath) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    return saveBrief(resolvedPath, brief);
  });

  ipcMain.handle("load-web-brief", (_event, { workspacePath } = {}) => {
    debugLog("ipc:load-web-brief");
    const resolvedPath = resolveWorkspacePath(workspacePath);
    if (!resolvedPath) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    const result = loadBrief(resolvedPath);
    if (!result.ok) {
      return { ok: true, brief: defaultBrief({ locale: "tr" }), exists: false };
    }
    return { ok: true, brief: result.brief, exists: true, path: result.path };
  });

  ipcMain.handle("scaffold-web-project", (_event, { workspacePath, brief, options } = {}) => {
    debugLog("ipc:scaffold-web-project");
    const resolvedPath = resolveWorkspacePath(workspacePath);
    if (!resolvedPath) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    return scaffoldNextjs(resolvedPath, normalizeBrief(brief || defaultBrief({ locale: "tr" })), options || {});
  });

  ipcMain.handle("get-web-project-status", (_event, { workspacePath } = {}) => {
    debugLog("ipc:get-web-project-status");
    const resolvedPath = resolveWorkspacePath(workspacePath);
    if (!resolvedPath) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    return { ok: true, ...detectNextProject(resolvedPath) };
  });

  ipcMain.handle("get-web-quality-checklist", (_event, { workspacePath, brief } = {}) => {
    debugLog("ipc:get-web-quality-checklist");
    const resolvedPath = resolveWorkspacePath(workspacePath);
    const loaded = resolvedPath ? loadBrief(resolvedPath) : { ok: false };
    const normalized = normalizeBrief(brief || (loaded.ok ? loaded.brief : defaultBrief({ locale: "tr" })));
    const items = generateQualityChecklist(normalized);
    return {
      ok: true,
      markdown: exportChecklistMarkdown(items),
      items,
    };
  });

  ipcMain.handle("detect-web-intent", (_event, { text } = {}) => {
    return detectWebIntent(String(text || ""));
  });

  ipcMain.handle("open-web-preview", async (_event, { workspacePath, port } = {}) => {
    debugLog("ipc:open-web-preview", { port });
    const resolvedPath = resolveWorkspacePath(workspacePath);
    const status = detectNextProject(resolvedPath);
    if (!status.isNext) {
      return {
        ok: false,
        error: status.reason || "Next.js projesi bulunamadı. Önce Web Studio ile iskelet oluşturun.",
      };
    }
    const previewPort = Number(port) || 3000;
    const url = `http://localhost:${previewPort}`;
    await shell.openExternal(url);
    return { ok: true, url, hint: "Dev server çalışmıyorsa VS Code/Cline'da npm run dev çalıştırın." };
  });

  ipcMain.handle("prepare-web-deploy", async (_event, { workspacePath } = {}) => {
    debugLog("ipc:prepare-web-deploy");
    const resolvedPath = resolveWorkspacePath(workspacePath);
    return runWebDeployPreview(resolvedPath);
  });

  ipcMain.handle("detect-web-deploy-tool", (_event, { workspacePath } = {}) => {
    const resolvedPath = resolveWorkspacePath(workspacePath);
    return detectWebDeployTool(resolvedPath);
  });
}

module.exports = { registerWebStudioIpc };
