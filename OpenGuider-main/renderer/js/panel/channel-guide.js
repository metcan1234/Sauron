export const CHANNEL_GUIDE = {
  core: {
    id: "core",
    label: "Sohbet",
    icon: "💬",
    color: "#94a3b8",
    hint: "Panel · planlama",
    placeholder: "Sohbet ve planlama — genel sorular…",
    vscodeMarker: null,
    summary: "Burada konuşursun; kod VS Code'a gitmez.",
  },
  workspace: {
    id: "workspace",
    label: "Çalışma",
    icon: "⌘",
    color: "#f0a080",
    hint: "Turuncu · Cline",
    placeholder: "Görevi yaz → ⌘ ile VS Code'da Cline'a handoff",
    vscodeMarker: "CHANNEL-WORKSPACE.md (turuncu)",
    summary: "Web, script, uygulama kodu. Cline + Bridge ile VS Code'da çalışır.",
  },
  gamedev: {
    id: "gamedev",
    label: "Game Dev",
    icon: "🎮",
    color: "#c4b5fd",
    hint: "Mor · Unity",
    placeholder: "Oyun planını yaz → 🎮 ile Game Dev pipeline başlar",
    vscodeMarker: "CHANNEL-GAMEDEV.md (mor)",
    summary: "Unity/Unreal oyun projesi. gamedev MCP + fazlı pipeline.",
  },
  goose: {
    id: "goose",
    label: "Goose",
    icon: "🪿",
    color: "#86efac",
    hint: "Terminal",
    placeholder: "Görevi yaz → Goose terminalde çalıştırır",
    vscodeMarker: null,
    summary: "Terminal ajanı — shell komutları ve otomasyon.",
  },
};

const PANEL_CHANNEL_CLASSES = [
  "channel-active-core",
  "channel-active-workspace",
  "channel-active-gamedev",
  "channel-active-goose",
];

export function normalizeChannelId(channel) {
  if (channel && CHANNEL_GUIDE[channel]) {
    return channel;
  }
  return "core";
}

export function applyChannelTheme(dom, channel) {
  const resolved = normalizeChannelId(channel);
  const guide = CHANNEL_GUIDE[resolved];

  dom.panelRoot?.classList.remove(...PANEL_CHANNEL_CLASSES);
  dom.panelRoot?.classList.add(`channel-active-${resolved}`);

  dom.channelRail?.querySelectorAll(".channel-rail-segment").forEach((segment) => {
    const isActive = segment.dataset.channel === resolved;
    segment.classList.toggle("is-active", isActive);
    segment.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  if (dom.textInput && guide?.placeholder) {
    dom.textInput.dataset.channelPlaceholder = guide.placeholder;
    if (!dom.textInput.matches(":focus")) {
      dom.textInput.placeholder = guide.placeholder;
    }
  }

  if (dom.channelRailActiveHint && guide) {
    dom.channelRailActiveHint.textContent = resolved === "core"
      ? "Aktif: Sohbet modu"
      : `Aktif: ${guide.icon} ${guide.label} — VS Code'da ${guide.vscodeMarker || "pencere yok"}`;
    dom.channelRailActiveHint.classList.toggle("hidden", false);
  }
}

export function buildChannelCompareMessage() {
  const ws = CHANNEL_GUIDE.workspace;
  const gd = CHANNEL_GUIDE.gamedev;
  return [
    "Hangisi hangisi?",
    "",
    `${ws.icon} ÇALIŞMA KISMI`,
    `• ${ws.summary}`,
    `• VS Code işareti: ${ws.vscodeMarker}`,
    `• Nasıl: Görev yaz → ⌘ butonuna bas`,
    "",
    `${gd.icon} GAME DEV`,
    `• ${gd.summary}`,
    `• VS Code işareti: ${gd.vscodeMarker}`,
    `• Nasıl: Oyun planı yaz → 🎮 butonuna bas`,
    "",
    "İpucu: VS Code'da açılan renkli dosyaya bak — turuncu = Çalışma, mor = Oyun.",
  ].join("\n");
}

export async function showChannelCompareDialog(ui) {
  if (typeof ui?.confirmDialog === "function") {
    await ui.confirmDialog({
      title: "⌘ Çalışma vs 🎮 Game Dev",
      message: buildChannelCompareMessage(),
      confirmLabel: "Anladım",
      cancelLabel: "Kapat",
      confirmDanger: false,
    });
    return;
  }
  window.alert(buildChannelCompareMessage());
}
