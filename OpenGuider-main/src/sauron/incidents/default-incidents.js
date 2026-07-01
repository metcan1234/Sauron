const DEFAULT_INCIDENTS = [
  {
    id: "bridge-extension-missing",
    fingerprint: "workspace:open-workspace-handoff:BRIDGE_MISSING",
    aliases: [
      "workspace:install-workspace-stack:BRIDGE_MISSING",
    ],
    component: "bridge",
    risk: "low",
    autoApply: false,
    verified: true,
    successCount: 0,
    fix: {
      tier: "scripted",
      allowedActions: [
        { action: "run-doctor-check", checkId: "bridge-extension" },
        { action: "suggest-install-bridge" },
        { action: "install-bridge" },
        { action: "run-doctor-check", checkId: "bridge-extension" },
      ],
    },
    hint: "Sauron Bridge extension eksik. Ayarlar → Bridge kur veya otomatik kurulumu dene.",
  },
  {
    id: "vscode-cli-missing",
    fingerprint: "workspace:open-workspace-handoff:VSCODE_CLI_MISSING",
    aliases: [
      "workspace:focus-vscode-workspace:VSCODE_CLI_MISSING",
    ],
    component: "workspace",
    risk: "low",
    autoApply: false,
    verified: true,
    successCount: 0,
    fix: {
      tier: "scripted",
      allowedActions: [
        { action: "run-doctor-check", checkId: "vscode-cli" },
        { action: "open-settings-tab", tab: "workspace" },
        { action: "show-incident-hint", message: "VS Code → Command Palette → Shell Command: Install 'code' command in PATH" },
      ],
    },
    hint: "VS Code CLI (code) PATH'te yok. Shell Command kurulumu gerekli.",
  },
  {
    id: "handoff-pending-blocked",
    fingerprint: "workspace:open-workspace-handoff:HANDOFF_BLOCKED",
    component: "workspace",
    risk: "low",
    autoApply: false,
    verified: true,
    successCount: 0,
    fix: {
      tier: "scripted",
      allowedActions: [
        { action: "show-incident-hint", message: "Önceki handoff bekliyor — onayla veya reddet, sonra tekrar dene." },
        { action: "open-settings-tab", tab: "workspace" },
      ],
    },
    hint: "Bekleyen handoff var. VS Code'da görevi bitir veya panelden reddet.",
  },
];

module.exports = {
  DEFAULT_INCIDENTS,
};
