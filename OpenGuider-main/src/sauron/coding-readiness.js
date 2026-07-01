const fs = require("fs");
const { checkWorkspacePrerequisites } = require("./workspace-setup");
const { isCursorCliPath } = require("./vscode-launcher");
const { probeGamedevMcpEntry } = require("./gamedev-path-resolver");

function getCodingReadiness(store, settings = {}) {
  const prerequisites = checkWorkspacePrerequisites();
  const workspacePath = String(store?.get?.("workspacePath") || settings.workspacePath || "").trim();
  const codeAgentEnabled = settings.codeAgentNativeEnabled === true;
  const checks = [
    {
      id: "workspace-path",
      ok: Boolean(workspacePath && fs.existsSync(workspacePath)),
      message: "Workspace klasörü",
    },
    {
      id: "vscode-cli",
      ok: prerequisites.vscodeCli && !isCursorCliPath(prerequisites.codeCmd),
      message: "VS Code CLI",
    },
    {
      id: "bridge-extension",
      ok: prerequisites.bridgeExtension,
      message: "Sauron Bridge",
    },
    {
      id: "cline-extension",
      ok: prerequisites.clineExtension,
      message: "Cline",
    },
    {
      id: "code-index",
      ok: Boolean(workspacePath && fs.existsSync(require("path").join(workspacePath, ".sauron", "code-index.json"))),
      message: "Kod indeksi (opsiyonel)",
      optional: true,
    },
    {
      id: "code-agent",
      ok: codeAgentEnabled || true,
      message: codeAgentEnabled ? "Yerel Kod Agent açık" : "Yerel Kod Agent kapalı (handoff yolu aktif)",
      optional: !codeAgentEnabled,
    },
  ];

  const required = checks.filter((check) => !check.optional);
  const failed = required.filter((check) => !check.ok);
  const status = failed.length === 0 ? "ready" : "blocked";
  const headline = failed.length === 0
    ? "Kod: workspace + Bridge + Cline hazır"
    : `Kod eksik: ${failed.map((entry) => entry.message).join(", ")}`;

  return {
    ok: true,
    status,
    headline,
    checks,
    workspacePath: workspacePath || null,
    codeAgentEnabled,
  };
}

module.exports = { getCodingReadiness };
