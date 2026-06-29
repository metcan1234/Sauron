/**
 * Hides optional feature entry points in the panel when disabled in settings.
 * Does not remove code paths — only toggles visibility.
 */
export function applyOptionalFeatureVisibility(doc, settings = {}) {
  const browserOn = settings.browserAgentEnabled !== false;
  const webStudioOn = settings.webStudioEnabled !== false;
  const selfBuildOn = settings.selfBuildEnabled !== false;
  const codeAgentOn = isCodeAgentEnabled(settings);
  const gooseOn = settings.gooseEnabled !== false;
  const gamedevOn = settings.gamedevEnabled !== false;

  doc.getElementById("btn-web-preview")?.classList.toggle("hidden", !webStudioOn);
  doc.getElementById("btn-code-studio")?.classList.toggle("hidden", !codeAgentOn);
  doc.getElementById("empty-cta-code-agent")?.classList.toggle("hidden", !codeAgentOn);
  doc.getElementById("web-studio-overlay")?.classList.toggle("feature-disabled", !webStudioOn);
  doc.getElementById("self-build-overlay")?.classList.toggle("feature-disabled", !selfBuildOn);

  const pipelinePanel = doc.getElementById("build-pipeline-panel");
  if (pipelinePanel && !selfBuildOn) {
    pipelinePanel.classList.add("hidden");
  }

  const advancedEl = doc.querySelector(".empty-state-advanced");
  if (advancedEl) {
    const parts = [];
    if (webStudioOn) parts.push("Web Studio");
    if (browserOn) parts.push("Browser agent");
    if (selfBuildOn) parts.push("Self-Build");
    if (gooseOn) parts.push("Goose");
    if (gamedevOn) parts.push("Game Dev");
    if (codeAgentOn) parts.push("Kod Agent");
    if (parts.length === 0) {
      advancedEl.classList.add("hidden");
    } else {
      advancedEl.classList.remove("hidden");
      advancedEl.textContent = `Gelişmiş: ${parts.join(", ")} → Ayarlar`;
    }
  }
}

export function isWebStudioEnabled(settings = {}) {
  return settings.webStudioEnabled !== false;
}

export function isSelfBuildEnabled(settings = {}) {
  return settings.selfBuildEnabled !== false;
}

export function isCodeAgentEnabled(settings = {}) {
  return settings.codeAgentNativeEnabled === true;
}
