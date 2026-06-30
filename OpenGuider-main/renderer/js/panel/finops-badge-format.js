const CHANNEL_LABELS = {
  core: "Panel",
  workspace: "Workspace",
  goose: "Goose",
  gamedev: "Game Dev",
};

export function formatAgentRoutingBadge(settings = {}) {
  const mode = settings.agentControlMode
    || (settings.finopsTrackingOnly === true ? "manual" : "auto");
  const provider = settings.coreManualAgent || settings.aiProvider || "gemini";
  if (mode === "auto") {
    return `AUTO · ${provider}`;
  }
  if (mode === "mixed" && (settings.coreRoutingMode || "auto") === "auto") {
    return `AUTO · ${provider}`;
  }
  return `MANUAL · ${provider}`;
}

export function formatFinOpsBadgeText(summary = {}, options = {}) {
  const budget = Number(summary.budgetTl) || 0;
  const totalSpent = Number(summary.totalSpentTl) || 0;
  const sessionSpent = Number(summary.sessionSpentTl) || 0;
  const hasSessionCost = sessionSpent > 0;
  const showUltra = options.showTokenUltra !== false
    && options.tokenUltraShowDashboard !== false;
  const tokenUltraSaved = Number(summary.tokenUltraStats?.estimatedCharsSaved) || 0;
  const ultraSuffix = showUltra && tokenUltraSaved > 500
    ? ` ↓${Math.round(tokenUltraSaved / 1000)}k`
    : "";

  if (budget <= 0) {
    if (!hasSessionCost && totalSpent <= 0) {
      return { text: "", hidden: true, ultraSuffix: "" };
    }
    const text = hasSessionCost
      ? `${sessionSpent.toFixed(2)} / ${totalSpent.toFixed(2)} ₺${ultraSuffix}`
      : `${totalSpent.toFixed(2)} ₺${ultraSuffix}`;
    return { text, hidden: false, ultraSuffix };
  }

  const remainingPct = Number(summary.remainingPct);
  const pctLabel = Number.isFinite(remainingPct) ? Math.round(remainingPct) : 0;
  const text = hasSessionCost
    ? `${sessionSpent.toFixed(2)} · ${totalSpent.toFixed(2)} ₺ · %${pctLabel}${ultraSuffix}`
    : `${totalSpent.toFixed(2)} ₺ · %${pctLabel}${ultraSuffix}`;
  return { text, hidden: false, ultraSuffix };
}

export function buildFinOpsBadgeTooltip(summary = {}, baseTitle = "") {
  const parts = [baseTitle].filter(Boolean);
  const sessionByChannel = summary.sessionByChannel || {};
  const channelParts = Object.entries(sessionByChannel)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${CHANNEL_LABELS[key] || key}: ${Number(value).toFixed(4)} ₺`);
  if (channelParts.length) {
    parts.push(`Oturum kanal — ${channelParts.join(" · ")}`);
  }
  if (summary.activeProjectLabel) {
    parts.push(`Proje: ${summary.activeProjectLabel}`);
  }
  const primary = summary.primaryAgentWallet;
  const wallet = primary?.wallet;
  if (wallet && !wallet.unlimited) {
    parts.push(`${primary.agentId} kalan: $${Number(wallet.remainingUsd).toFixed(4)} / $${Number(wallet.totalCreditUsd).toFixed(2)}`);
  }
  const tokenUltra = summary.tokenUltraStats;
  if (tokenUltra?.estimatedCharsSaved > 0) {
    parts.push(`Token Ultra: ~${Number(tokenUltra.estimatedCharsSaved).toLocaleString()} karakter`);
  }
  if (tokenUltra?.byChannel && Object.keys(tokenUltra.byChannel).length > 0) {
    const ultraChannelParts = Object.entries(tokenUltra.byChannel)
      .filter(([, value]) => Number(value?.estimatedCharsSaved) > 0)
      .map(([key, value]) => `${CHANNEL_LABELS[key] || key}: ~${Number(value.estimatedCharsSaved).toLocaleString()}`);
    if (ultraChannelParts.length) {
      parts.push(`Token Ultra kanal — ${ultraChannelParts.join(" · ")}`);
    }
  }
  if (summary.clineReadonlyNote) {
    parts.push(summary.clineReadonlyNote);
  }
  return parts.join(" · ");
}
