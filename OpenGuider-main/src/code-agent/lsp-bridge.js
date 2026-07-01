const { spawn } = require("child_process");

function resolveLanguageServer(workspacePath) {
  const pkgPath = require("path").join(String(workspacePath || ""), "package.json");
  try {
    require("fs").accessSync(pkgPath);
    return { command: "npx", args: ["typescript-language-server", "--stdio"] };
  } catch {
    return null;
  }
}

async function queryLspSymbols(workspacePath, options = {}) {
  if (options.settings?.codeLspEnabled !== true) {
    return { ok: false, skipped: true, reason: "lsp_disabled" };
  }
  const resolved = String(workspacePath || "").trim();
  const server = resolveLanguageServer(resolved);
  if (!server) {
    return { ok: false, skipped: true, reason: "no_lsp_server" };
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      resolve({ ok: false, error: "LSP timeout" });
    }, Number(options.timeoutMs) || 4000);

    const child = spawn(server.command, server.args, {
      cwd: resolved,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message || "LSP spawn failed" });
    });

    child.on("exit", () => {
      clearTimeout(timer);
      resolve({ ok: true, symbols: [], note: "LSP bridge placeholder — use symbol-index fallback" });
    });
  });
}

module.exports = { queryLspSymbols, resolveLanguageServer };
