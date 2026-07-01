const { execFile } = require("child_process");
const path = require("path");

function runCommand(cwd, command, args, timeoutMs = 120000) {
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd,
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          ok: false,
          error: error.message || stderr || "Command failed.",
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
        });
        return;
      }
      resolve({
        ok: true,
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
      });
    });
  });
}

async function detectWebDeployTool(workspacePath) {
  const root = String(workspacePath || "").trim();
  if (!root) {
    return { ok: false, error: "Workspace path is not configured." };
  }
  const pkgPath = path.join(root, "package.json");
  let scripts = {};
  try {
    scripts = JSON.parse(require("fs").readFileSync(pkgPath, "utf8")).scripts || {};
  } catch {
    scripts = {};
  }
  return {
    ok: true,
    hasBuild: Boolean(scripts.build),
    hasDev: Boolean(scripts.dev || scripts.start),
    suggested: scripts.build ? "npm run build" : (scripts.dev ? "npm run dev" : "npm install"),
  };
}

async function runWebDeployPreview(workspacePath) {
  const root = String(workspacePath || "").trim();
  if (!root) {
    return { ok: false, error: "Workspace path is not configured." };
  }
  const install = await runCommand(root, process.platform === "win32" ? "npm.cmd" : "npm", ["install"]);
  if (!install.ok) {
    return install;
  }
  const info = await detectWebDeployTool(root);
  if (!info.hasDev) {
    return { ok: true, message: "Bağımlılıklar kuruldu. package.json'da dev script yok — build/deploy manuel.", previewUrl: "http://localhost:3000" };
  }
  return {
    ok: true,
    message: "Bağımlılıklar kuruldu. Panel Önizleme (👁) ile localhost:3000 deneyin.",
    previewUrl: "http://localhost:3000",
  };
}

module.exports = {
  detectWebDeployTool,
  runWebDeployPreview,
};
